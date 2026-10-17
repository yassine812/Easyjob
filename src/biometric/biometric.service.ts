import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import {
  BIOMETRIC_ALGORITHM_VERSION,
  cosineSimilarity,
  decryptEmbedding,
  encryptEmbedding,
} from './biometric.crypto';
import { FaceClient, FaceRejectedError, FaceServiceUnavailableError } from './face-client';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

interface Challenge {
  id: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

interface AttemptState {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function looksLikeImage(buf: Buffer): boolean {
  if (!buf || buf.length < 8) return false;
  return buf.subarray(0, 3).equals(JPEG_MAGIC) || buf.subarray(0, 4).equals(PNG_MAGIC);
}

/**
 * Optional face login. Everything here is gated by BIOMETRIC_ENABLED (default
 * false). Frames are processed in memory and discarded; only the encrypted
 * embedding is persisted. The final authentication decision is always made in
 * NestJS (token issuance happens here, never in the AI service).
 *
 * Challenges are single-use, short-lived and server-side. Failure responses
 * are intentionally generic to avoid account enumeration.
 */
@Injectable()
export class BiometricService {
  private readonly logger = new Logger(BiometricService.name);
  private readonly challenges = new Map<string, Challenge>();
  private readonly attempts = new Map<string, AttemptState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokenService: TokenService,
    private readonly faceClient: FaceClient,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private assertFeatureEnabled(): void {
    if (!this.config.biometric.enabled) {
      throw new NotFoundException('Biometric authentication is disabled');
    }
  }

  private emailKey(email: string, ip?: string): string {
    return `${email.toLowerCase()}|${ip ?? 'unknown'}`;
  }

  private checkBlocked(key: string): void {
    const state = this.attempts.get(key);
    if (state && state.blockedUntil > Date.now()) {
      throw new HttpException('Too many attempts. Try again later or use your password.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailure(key: string): void {
    const now = Date.now();
    const state = this.attempts.get(key);
    if (!state || now - state.windowStart > this.config.biometric.attemptWindowMs) {
      this.attempts.set(key, { count: 1, windowStart: now, blockedUntil: 0 });
      return;
    }
    state.count += 1;
    if (state.count >= this.config.biometric.maxAttempts) {
      state.blockedUntil = now + this.config.biometric.blockMs;
      this.logger.warn(`Biometric attempts temporarily blocked for ${key}`);
    }
  }

  private clearAttempts(key: string): void {
    this.attempts.delete(key);
  }

  // ------------------------------------------------------------------
  // Enrollment (authenticated)
  // ------------------------------------------------------------------

  async getStatus(userId: string): Promise<{
    enabled: boolean;
    enrolled: boolean;
    consentAt: string | null;
    lastUsedAt: string | null;
  }> {
    if (!this.config.biometric.enabled) {
      return { enabled: false, enrolled: false, consentAt: null, lastUsedAt: null };
    }
    const credential = await this.prisma.biometricCredential.findUnique({ where: { userId } });
    return {
      enabled: true,
      enrolled: credential?.enabled === true,
      consentAt: credential?.consentAt.toISOString() ?? null,
      lastUsedAt: credential?.lastUsedAt?.toISOString() ?? null,
    };
  }

  async enrollStart(userId: string, meta: RequestMeta): Promise<{ enrollmentId: string; expiresAt: string }> {
    this.assertFeatureEnabled();
    // Platform administrators keep normal authentication only — there is no
    // strong reason for them to use face login and it widens the attack
    // surface of the highest-privilege accounts.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    const isPlatformAdmin = user?.roles.some((r) => r.role.name === 'PLATFORM_ADMIN');
    if (isPlatformAdmin) {
      throw new ForbiddenException('Platform administrators cannot enable face login');
    }
    const id = randomBytes(24).toString('hex');
    const ttlMs = this.config.biometric.challengeTtlSeconds * 1000;
    this.challenges.set(id, { id, email: `enroll:${userId}`, expiresAt: Date.now() + ttlMs, used: false });
    await this.audit.log({
      actorId: userId,
      action: 'biometric.enrollment_started',
      entityType: 'User',
      entityId: userId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { enrollmentId: id, expiresAt: new Date(Date.now() + ttlMs).toISOString() };
  }

  async enrollVerify(userId: string, enrollmentId: string, frames: Buffer[], meta: RequestMeta): Promise<{ enrolled: boolean }> {
    this.assertFeatureEnabled();
    const challenge = this.challenges.get(enrollmentId);
    if (!challenge || challenge.email !== `enroll:${userId}`) {
      throw new GoneException('Enrollment session expired. Please start again.');
    }
    if (challenge.used || challenge.expiresAt < Date.now()) {
      this.challenges.delete(enrollmentId);
      throw new GoneException('Enrollment session expired. Please start again.');
    }
    challenge.used = true;
    this.challenges.delete(enrollmentId);

    this.validateFrames(frames);

    let faceResult;
    try {
      faceResult = await this.faceClient.enroll(frames);
    } catch (err) {
      await this.audit.log({
        actorId: userId,
        action: 'biometric.enrollment_failed',
        entityType: 'User',
        entityId: userId,
        metadata: { reason: err instanceof FaceRejectedError ? err.code : 'ai_unavailable' },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      if (err instanceof FaceRejectedError) {
        // The scan was processed but rejected — tell the user what to fix.
        throw new BadRequestException(this.safeFaceError(err.code));
      }
      if (err instanceof FaceServiceUnavailableError) {
        throw new ServiceUnavailableException('Face processing is temporarily unavailable. Please try again.');
      }
      throw err;
    }

    if (!faceResult.quality.passed) {
      await this.audit.log({
        actorId: userId,
        action: 'biometric.enrollment_failed',
        entityType: 'User',
        entityId: userId,
        metadata: { reason: faceResult.quality.reasons[0] ?? 'quality' },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new BadRequestException(this.safeFaceError(faceResult.quality.reasons[0]));
    }
    if (this.config.biometric.livenessEnabled && !faceResult.liveness.passed) {
      await this.audit.log({
        actorId: userId,
        action: 'biometric.enrollment_failed',
        entityType: 'User',
        entityId: userId,
        metadata: { reason: 'liveness' },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new BadRequestException('Liveness check failed. Please try again.');
    }

    const encrypted = encryptEmbedding(this.config.biometric.encryptionKey, faceResult.embedding);
    await this.prisma.biometricCredential.upsert({
      where: { userId },
      create: {
        userId,
        encryptedEmbedding: encrypted,
        algorithmVersion: BIOMETRIC_ALGORITHM_VERSION,
        consentAt: new Date(),
        enabled: true,
      },
      update: {
        encryptedEmbedding: encrypted,
        algorithmVersion: BIOMETRIC_ALGORITHM_VERSION,
        enabled: true,
        consentAt: new Date(),
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'biometric.enrollment_completed',
      entityType: 'User',
      entityId: userId,
      metadata: { algorithmVersion: BIOMETRIC_ALGORITHM_VERSION },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { enrolled: true };
  }

  async enrollReferencePhoto(userId: string, enrollmentId: string, photo: Buffer | undefined, meta: RequestMeta): Promise<{ enrolled: boolean }> {
    this.assertFeatureEnabled();
    const challenge = this.challenges.get(enrollmentId);
    if (!challenge || challenge.email !== `enroll:${userId}` || challenge.used || challenge.expiresAt < Date.now()) {
      this.challenges.delete(enrollmentId);
      throw new GoneException('Enrollment session expired. Please start again.');
    }
    challenge.used = true;
    this.challenges.delete(enrollmentId);
    this.validateReferencePhoto(photo);

    let faceResult;
    try {
      faceResult = await this.faceClient.reference(photo);
    } catch (err) {
      await this.audit.log({ actorId: userId, action: 'biometric.enrollment_failed', entityType: 'User', entityId: userId,
        metadata: { reason: err instanceof FaceRejectedError ? err.code : 'ai_unavailable', source: 'profile_photo' }, ipAddress: meta.ip, userAgent: meta.userAgent });
      if (err instanceof FaceRejectedError) throw new BadRequestException(this.safeFaceError(err.code));
      if (err instanceof FaceServiceUnavailableError) throw new ServiceUnavailableException('Face processing is temporarily unavailable. Please try again.');
      throw err;
    }

    const encrypted = encryptEmbedding(this.config.biometric.encryptionKey, faceResult.embedding);
    await this.prisma.biometricCredential.upsert({
      where: { userId },
      create: { userId, encryptedEmbedding: encrypted, algorithmVersion: BIOMETRIC_ALGORITHM_VERSION, consentAt: new Date(), enabled: true },
      update: { encryptedEmbedding: encrypted, algorithmVersion: BIOMETRIC_ALGORITHM_VERSION, enabled: true, consentAt: new Date() },
    });
    await this.audit.log({ actorId: userId, action: 'biometric.enrollment_completed', entityType: 'User', entityId: userId,
      metadata: { algorithmVersion: BIOMETRIC_ALGORITHM_VERSION, source: 'profile_photo' }, ipAddress: meta.ip, userAgent: meta.userAgent });
    return { enrolled: true };
  }

  /** Permanently disables face login and deletes the stored template. */
  async disable(userId: string, meta: RequestMeta): Promise<{ disabled: boolean }> {
    this.assertFeatureEnabled();
    await this.prisma.biometricCredential.deleteMany({ where: { userId } });
    await this.audit.log({
      actorId: userId,
      action: 'biometric.disabled',
      entityType: 'User',
      entityId: userId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { disabled: true };
  }

  // ------------------------------------------------------------------
  // Face login (public, challenge-based)
  // ------------------------------------------------------------------

  async faceStart(email: string, meta: RequestMeta): Promise<{ challengeId: string; expiresAt: string }> {
    this.assertFeatureEnabled();
    const key = this.emailKey(email, meta.ip);
    this.checkBlocked(key);
    const id = randomBytes(24).toString('hex');
    const ttlMs = this.config.biometric.challengeTtlSeconds * 1000;
    this.challenges.set(id, { id, email: email.toLowerCase(), expiresAt: Date.now() + ttlMs, used: false });
    return { challengeId: id, expiresAt: new Date(Date.now() + ttlMs).toISOString() };
  }

  async faceVerify(
    email: string,
    challengeId: string,
    frames: Buffer[],
    meta: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; emailVerified: boolean; roles: string[] } }> {
    this.assertFeatureEnabled();
    const key = this.emailKey(email, meta.ip);
    this.checkBlocked(key);

    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.email !== email.toLowerCase()) {
      this.recordFailure(key);
      await this.audit.log({
        action: 'biometric.login_failed',
        entityType: 'User',
        metadata: { reason: 'challenge_invalid' },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Face verification failed.');
    }
    if (challenge.used) {
      this.recordFailure(key);
      throw new UnauthorizedException('Face verification failed. Please start a fresh scan.');
    }
    if (challenge.expiresAt < Date.now()) {
      this.recordFailure(key);
      this.challenges.delete(challengeId);
      throw new UnauthorizedException('Face verification failed. Please start a fresh scan.');
    }
    challenge.used = true;
    this.challenges.delete(challengeId);

    this.validateFrames(frames);

    // Resolve the user WITHOUT revealing whether the account exists or has
    // biometrics enabled (identical generic error below).
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { biometricCredential: true },
    });

    let faceResult;
    try {
      faceResult = await this.faceClient.embed(frames);
    } catch (err) {
      if (err instanceof FaceServiceUnavailableError) {
        this.recordFailure(key);
        throw new ServiceUnavailableException('Face login is temporarily unavailable. Please use your password.');
      }
      // Capture feedback is independent of whether this account exists.
      // Identity failures below remain generic; no tokens are issued here.
      if (err instanceof FaceRejectedError) {
        this.recordFailure(key);
        const captureCodes = ['invalid_image', 'no_face', 'multiple_faces', 'low_quality', 'face_too_small', 'bad_angle', 'insufficient_frames', 'face_count_changed', 'face_moved', 'no_motion', 'liveness_failed'];
        const reason = captureCodes.includes(err.code) ? err.code : 'low_quality';
        throw new HttpException(`FACE_CAPTURE:${reason}`, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      throw err;
    }

    if (!user || user.status !== 'ACTIVE' || !user.biometricCredential?.enabled) {
      this.recordFailure(key);
      await this.audit.log({
        action: 'biometric.login_failed',
        entityType: 'User',
        metadata: { reason: 'not_enrolled_or_invalid' },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Face verification failed.');
    }
    if (this.config.biometric.livenessEnabled && !faceResult.liveness.passed) {
      this.recordFailure(key);
      await this.audit.log({
        actorId: user.id,
        action: 'biometric.login_failed',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'liveness' },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Face verification failed.');
    }

    let stored;
    try {
      stored = decryptEmbedding(this.config.biometric.encryptionKey, user.biometricCredential.encryptedEmbedding);
    } catch {
      this.recordFailure(key);
      await this.audit.log({
        actorId: user.id,
        action: 'biometric.login_failed',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'decrypt_failed' },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Face verification failed.');
    }

    const similarity = cosineSimilarity(faceResult.embedding, stored.embedding);
    if (similarity < this.config.biometric.matchThreshold) {
      this.recordFailure(key);
      await this.audit.log({
        actorId: user.id,
        action: 'biometric.login_failed',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'mismatch' },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Face verification failed.');
    }

    // Reveal the required next step only after the live face matches. Keep
    // email verification mandatory and never issue tokens for this state.
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Confirm your email before signing in with your face.',
      });
    }

    // Success — issue the normal NestJS session.
    this.clearAttempts(key);
    const accessToken = await this.tokenService.issueAccessToken(user);
    const refreshToken = await this.tokenService.issueRefreshToken(user.id, meta.ip, meta.userAgent);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.biometricCredential.update({
        where: { id: user.biometricCredential.id },
        data: { lastUsedAt: new Date() },
      }),
    ]);
    const roles = await this.userRoleNames(user.id);
    await this.audit.log({
      actorId: user.id,
      action: 'biometric.login_success',
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
        roles,
      },
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private validateFrames(frames: Buffer[]): void {
    if (!Array.isArray(frames) || frames.length < 2) {
      throw new BadRequestException('Two camera frames are required');
    }
    for (const frame of frames) {
      if (!Buffer.isBuffer(frame) || frame.length === 0) {
        throw new BadRequestException('Invalid camera frame');
      }
      if (frame.length > this.config.biometric.maxImageBytes) {
        throw new BadRequestException('Image too large');
      }
      if (!looksLikeImage(frame)) {
        throw new BadRequestException('Invalid image format');
      }
    }
  }

  private validateReferencePhoto(photo: Buffer | undefined): asserts photo is Buffer {
    if (!Buffer.isBuffer(photo) || photo.length === 0) throw new BadRequestException('A profile photo is required');
    if (photo.length > this.config.biometric.maxImageBytes) throw new BadRequestException('Image too large');
    if (!looksLikeImage(photo)) throw new BadRequestException('Invalid image format');
  }

  private safeFaceError(reason?: string): string {
    // Never leak model internals — map to safe user messages.
    switch (reason) {
      case 'no_face':
        return 'No face detected. Please position your face in the frame.';
      case 'multiple_faces':
      case 'face_count_changed':
        return 'Multiple faces detected. Please ensure only one person is in the frame.';
      case 'low_quality':
      case 'blurry':
      case 'face_too_small':
        return 'Image quality is too low. Please use better lighting and look at the camera.';
      case 'liveness_failed':
      case 'no_motion':
      case 'face_moved':
        return 'Liveness check failed. Please try again with a live scan.';
      case 'invalid_image':
        return 'The image could not be read. Please use your camera and try again.';
      default:
        return 'We could not process your face. Please try again.';
    }
  }

  private async userRoleNames(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({ where: { userId }, include: { role: true } });
    return rows.map((r) => r.role.name);
  }
}
