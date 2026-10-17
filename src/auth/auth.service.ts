import { BadRequestException, ForbiddenException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { TokenService } from './token.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../queues/email/email.service';
import { emailTemplates } from '../queues/email/templates';
import { addMinutes } from '../common/utils/dates';
import { generateToken, hashToken } from '../common/utils/tokens';
import { PLATFORM_ADMIN_ROLES, ROLES } from '../common/constants/roles';
import { StorageService } from '../files/storage.service';
import type {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

export interface AuthRequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly audit: AuditService,
    private readonly emailService: EmailService,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Optional() private readonly realtime?: RealtimeService,
    private readonly storage?: StorageService,
  ) {}

  async register(dto: RegisterDto, meta: AuthRequestMeta) {
    // Keep this invariant in the service as well as in the DTO/ValidationPipe:
    // a future client or an internal caller must never be able to request a
    // platform-admin role through public registration.
    const submitted = dto as RegisterDto & { role?: unknown; roles?: unknown };
    const submittedRoles = [
      submitted.role,
      ...(Array.isArray(submitted.roles) ? submitted.roles : []),
    ].filter((role): role is string => typeof role === 'string');
    if (submittedRoles.some(role => (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role.toUpperCase()))) {
      throw new ForbiddenException('Platform administrator accounts are created by the server operator');
    }
    if (dto.intent === 'company' || dto.company) throw new ForbiddenException('Company accounts are created by the platform administrator');
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.config.bcryptRounds);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          phone: dto.phone ?? null,
        },
      });

      await tx.userRole.create({ data: { userId: created.id, roleId: (await this.ensureRole(tx, ROLES.CANDIDATE)).id } });
      await tx.candidateProfile.create({ data: { userId: created.id } });

      return created;
    });

    await this.createVerificationTokenAndEmail(user.id, user.email);

    await this.audit.log({
      actorId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: user.id, name: user.name, email: user.email };
  }

  async login(dto: LoginDto, meta: AuthRequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same generic error whether the email or password is wrong.
    const genericError = 'Invalid email or password';
    if (!user) {
      await this.audit.log({
        action: 'auth.login.failed',
        entityType: 'User',
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException(genericError);
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      await this.audit.log({
        actorId: user.id,
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException(genericError);
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is suspended');
    }

    if (user.mustChangePassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Temporary password expired. Use forgot password.');
    const accessToken = await this.tokenService.issueAccessToken(user);
    const refreshToken = await this.tokenService.issueRefreshToken(user.id, meta.ip, meta.userAgent);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'auth.login',
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
        roles: await this.userRoleNames(user.id),
      },
    };
  }

  async logout(rawToken: string | undefined, meta: AuthRequestMeta): Promise<void> {
    if (rawToken) {
      await this.tokenService.revokeRefreshToken(rawToken);
      const user = await this.resolveUserByRawToken(rawToken);
      if (user) {
        await this.audit.log({
          actorId: user.id,
          action: 'auth.logout',
          entityType: 'User',
          entityId: user.id,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        });
      }
    }
  }

  async refresh(rawToken: string | undefined, meta: AuthRequestMeta) {
    if (!rawToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const pair = await this.tokenService.rotateRefreshToken(rawToken, meta.ip, meta.userAgent);
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
  }

  async verifyEmail(email: string, code: string, meta: AuthRequestMeta = {}) {
    const record = await this.prisma.emailVerificationToken.findFirst({
      where: { user: { email: email.trim().toLowerCase() } },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    const invalid = () => new BadRequestException('Invalid or expired verification code');
    if (!/^\d{6}$/.test(code) || !record || record.usedAt || record.expiresAt.getTime() <= Date.now() || record.user.status !== 'ACTIVE') {
      throw invalid();
    }
    const attempt = await this.prisma.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count !== 1 || !(await bcrypt.compare(code, record.tokenHash))) throw invalid();
    const user = await this.prisma.$transaction(async tx => {
      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw invalid();
      const verified = await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), lastLoginAt: new Date() },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: new Date() },
      });
      return verified;
    });
    await this.audit.log({
      actorId: record.userId,
      action: 'auth.email_verified',
      entityType: 'User',
      entityId: record.userId,
    });
    return {
      verified: true,
      accessToken: await this.tokenService.issueAccessToken(user),
      refreshToken: await this.tokenService.issueRefreshToken(user.id, meta.ip, meta.userAgent),
    };
  }

  async resendVerification(email: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (user && !user.emailVerifiedAt) {
      await this.createVerificationTokenAndEmail(user.id, user.email);
    }
    // Always respond identically to avoid leaking account existence.
    return { sent: true };
  }

  async forgotPassword(email: string, meta: AuthRequestMeta): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (user) {
      const raw = generateToken();
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: addMinutes(new Date(), 60),
        },
      });
      const url = `${this.config.frontendUrl}/reset-password?token=${raw}`;
      const rendered = emailTemplates.passwordReset(url);
      await this.emailService.enqueue({
        to: user.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        dedupeKey: `password-reset:${user.id}:${Date.now()}`,
      });
      await this.audit.log({
        actorId: user.id,
        action: 'auth.forgot_password',
        entityType: 'User',
        entityId: user.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
    } else {
      await this.audit.log({
        action: 'auth.forgot_password.unknown_email',
        entityType: 'User',
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      });
    }
    // Never reveal whether the email exists.
    return { sent: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, this.config.bcryptRounds);
    await this.prisma.$transaction(async tx => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new BadRequestException('Invalid or expired reset token');
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash, mustChangePassword: false, temporaryPasswordExpiresAt: null, emailVerifiedAt: new Date(), sessionVersion: { increment: 1 } } });
      await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    await this.audit.log({
      actorId: record.userId,
      action: 'auth.password_reset',
      entityType: 'User',
      entityId: record.userId,
    });
    this.realtime?.disconnectUser(record.userId);
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !await bcrypt.compare(dto.currentPassword, user.passwordHash)) throw new UnauthorizedException('Incorrect current password');
    if (user.mustChangePassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt.getTime() <= Date.now()) throw new BadRequestException('Temporary password expired. Use forgot password.');
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException('Choose a different password');
    const passwordHash = await bcrypt.hash(dto.newPassword, this.config.bcryptRounds);
    await this.prisma.$transaction(async tx => {
      const changed = await tx.user.updateMany({ where: { id: userId, passwordHash: user.passwordHash }, data: { passwordHash, mustChangePassword: false, temporaryPasswordExpiresAt: null, sessionVersion: { increment: 1 } } });
      if (changed.count !== 1) throw new UnauthorizedException('Password was already changed');
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    });
    await this.audit.log({ actorId: userId, action: 'auth.password_changed', entityType: 'User', entityId: userId });
    this.realtime?.disconnectUser(userId);
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        candidateProfile: { select: { id: true, headline: true, visibility: true, photoKey: true } },
        companyMemberships: {
          where: { status: 'ACTIVE' },
          include: { company: { select: { id: true, commercialName: true, slug: true, status: true } } },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.roles.map((ur) => ur.role.name),
      candidateProfileId: user.candidateProfile?.id ?? null,
      avatar_url: await this.avatarUrl(user.candidateProfile?.photoKey),
      memberships: user.companyMemberships.map((m) => ({
        companyId: m.company.id,
        companyName: m.company.commercialName,
        companySlug: m.company.slug,
        companyStatus: m.company.status,
        role: m.role,
      })),
    };
  }

  /** CandidateProfile.photoKey is the sole persisted profile-photo reference. */
  private async avatarUrl(photoKey: string | null | undefined): Promise<string | null> {
    if (!photoKey || !this.storage) return null;
    try {
      await this.storage.getBytes(photoKey);
      return await this.storage.presignedGet(photoKey);
    } catch {
      return null;
    }
  }

  private async createVerificationTokenAndEmail(userId: string, email: string): Promise<void> {
    const raw = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = await bcrypt.hash(raw, 10);
    const created = await this.prisma.$transaction(async tx => {
      const recent = await tx.emailVerificationToken.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (recent && recent.createdAt.getTime() > Date.now() - 120_000) return false;
      await tx.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt: addMinutes(new Date(), 10) } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!created) return;
    const rendered = emailTemplates.verifyEmail(raw);
    await this.emailService.enqueue({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      dedupeKey: `verify-email:${userId}:${Date.now()}`,
    });
  }

  private async userRoleNames(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((ur) => ur.role.name);
  }

  private async resolveUserByRawToken(rawToken: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });
  }

  private async ensureRole(tx: Prisma.TransactionClient, name: string) {
    const role = await tx.role.findUnique({ where: { name } });
    if (!role) throw new Error(`Role ${name} not seeded`);
    return role;
  }
}
