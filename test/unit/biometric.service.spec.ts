import { ForbiddenException, GoneException, HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { BiometricService } from '../../src/biometric/biometric.service';
import { FaceRejectedError, FaceServiceUnavailableError } from '../../src/biometric/face-client';
import { BIOMETRIC_ALGORITHM_VERSION, encryptEmbedding } from '../../src/biometric/biometric.crypto';
import type { AppConfig } from '../../src/config/configuration';

const KEY = 'c'.repeat(64);

function mockConfig(overrides: Partial<AppConfig['biometric']> = {}): AppConfig {
  return {
    env: 'test',
    port: 3000,
    apiPrefix: 'api/v1',
    frontendUrl: 'http://localhost:3000',
    corsOrigins: [],
    cookie: { name: 'refresh_token', secure: false, sameSite: 'lax' },
    jwt: {
      accessSecret: 'x'.repeat(32),
      accessExpiresIn: '15m',
      refreshSecret: 'y'.repeat(32),
      refreshExpiresIn: '30d',
      refreshTokenTtlDays: 30,
    },
    bcryptRounds: 10,
    databaseUrl: '',
    redis: { url: '' },
    throttle: { enabled: false, ttlMs: 0, limit: 0, authTtlMs: 0, authLimit: 0 },
    storage: {
      provider: 'local',
      localDir: 'storage',
      s3: { endpoint: '', region: '', bucket: '', accessKey: '', secretKey: '', forcePathStyle: true, presignExpiresSec: 900 },
    },
    email: { provider: 'console', from: '', smtp: { host: '', port: 0, secure: false, user: '', pass: '' } },
    ai: { baseUrl: '', timeoutMs: 1000 },
    biometric: {
      enabled: true,
      encryptionKey: KEY,
      matchThreshold: 0.5,
      livenessEnabled: true,
      maxAttempts: 3,
      attemptWindowMs: 60_000,
      blockMs: 60_000,
      challengeTtlSeconds: 120,
      faceServiceUrl: 'http://localhost:8000',
      maxImageBytes: 5 * 1024 * 1024,
      ...overrides,
    },
    payment: { provider: 'dev', devWebhookSecret: 's', stripe: { priceMap: {} } },
    logLevel: 'info',
    runWorkers: false,
  };
}

function jpegFrame(marker = 0): Buffer {
  // Minimal JPEG-looking buffer (magic bytes) — client validation only.
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, marker]), Buffer.alloc(64)]);
}

interface MockPrisma {
  user: { findUnique: jest.Mock; update: jest.Mock };
  biometricCredential: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    deleteMany: jest.Mock;
    update: jest.Mock;
  };
  userRole: { findMany: jest.Mock };
  $transaction: jest.Mock;
}

// Genuinely distinct descriptor patterns: GOOD matches GOOD, BAD is far below
// the 0.5 threshold (cosine of GOOD vs BAD ≈ 0.28).
const GOOD = Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? 0.1 : 0.9));
const BAD = Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? 0.9 : 0.1));

const enrolledUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'jane@test.com',
  name: 'Jane',
  status: 'ACTIVE',
  emailVerifiedAt: new Date(),
  lastLoginAt: null,
  roles: [],
  biometricCredential: {
    id: 'bc1',
    enabled: true,
    encryptedEmbedding: encryptEmbedding(KEY, GOOD),
    lastUsedAt: null,
  },
  ...overrides,
});

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma: MockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(enrolledUser()),
      update: jest.fn().mockResolvedValue({}),
    },
    biometricCredential: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    userRole: { findMany: jest.fn().mockResolvedValue([{ role: { name: 'CANDIDATE' } }]) },
    // $transaction is called with an array of promises (not a callback).
    $transaction: jest.fn(async (tx: unknown) => {
      if (Array.isArray(tx)) return tx;
      return typeof tx === 'function' ? tx(prisma) : tx;
    }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tokenService = {
    issueAccessToken: jest.fn().mockResolvedValue('access-token'),
    issueRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
  };
  const faceClient = {
    enroll: jest.fn().mockResolvedValue({
      embedding: GOOD,
      quality: { passed: true, reasons: [] },
      liveness: { passed: true, reason: null },
    }),
    embed: jest.fn().mockResolvedValue({
      embedding: GOOD,
      quality: { passed: true, reasons: [] },
      liveness: { passed: true, reason: null },
    }),
  };
  const service = new BiometricService(
    prisma as never,
    audit as never,
    tokenService as never,
    faceClient as never,
    mockConfig(overrides.config as never),
  );
  return { service, prisma, audit, tokenService, faceClient };
}

describe('BiometricService — feature flag', () => {
  it('returns disabled status when the feature flag is off', async () => {
    const { service } = makeService({ config: { enabled: false } });
    await expect(service.getStatus('u1')).resolves.toEqual({
      enabled: false,
      enrolled: false,
      consentAt: null,
      lastUsedAt: null,
    });
  });

  it('rejects enrollment when the feature flag is off', async () => {
    const { service } = makeService({ config: { enabled: false } });
    await expect(service.enrollStart('u1', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('BiometricService — enrollment', () => {
  it('enrolls a user after consent, storing an encrypted template', async () => {
    const { service, prisma, faceClient } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', roles: [] });

    const { enrollmentId } = await service.enrollStart('u1', { ip: '1.2.3.4' });
    const result = await service.enrollVerify('u1', enrollmentId, [jpegFrame(1), jpegFrame(2)], {});

    expect(result).toEqual({ enrolled: true });
    expect(faceClient.enroll).toHaveBeenCalled();
    const [create, update] = [
      prisma.biometricCredential.upsert.mock.calls[0][0].create,
      prisma.biometricCredential.upsert.mock.calls[0][0].update,
    ];
    expect(create.algorithmVersion).toBe(BIOMETRIC_ALGORITHM_VERSION);
    expect(create.consentAt).toBeInstanceOf(Date);
    expect(create.enabled).toBe(true);
    expect(create.encryptedEmbedding).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(update.encryptedEmbedding).toBe(create.encryptedEmbedding);
  });

  it('blocks PLATFORM_ADMIN enrollment', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'admin1',
      roles: [{ role: { name: 'PLATFORM_ADMIN' } }],
    });
    await expect(service.enrollStart('admin1', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a replayed enrollment session', async () => {
    const { service } = makeService();
    const { enrollmentId } = await service.enrollStart('u1', {});
    await service.enrollVerify('u1', enrollmentId, [jpegFrame(1), jpegFrame(2)], {});
    await expect(service.enrollVerify('u1', enrollmentId, [jpegFrame(3), jpegFrame(4)], {})).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('rejects an expired enrollment session', async () => {
    const { service } = makeService({ config: { challengeTtlSeconds: -1 } });
    const { enrollmentId } = await service.enrollStart('u1', {});
    await expect(service.enrollVerify('u1', enrollmentId, [jpegFrame(1), jpegFrame(2)], {})).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('rejects low-quality enrollment frames', async () => {
    const { service, faceClient } = makeService();
    faceClient.enroll.mockResolvedValueOnce({
      embedding: [],
      quality: { passed: false, reasons: ['no_face'] },
      liveness: { passed: false, reason: 'no_face' },
    });
    const { enrollmentId } = await service.enrollStart('u1', {});
    await expect(service.enrollVerify('u1', enrollmentId, [jpegFrame(1), jpegFrame(2)], {})).rejects.toThrow(
      /No face detected/,
    );
  });

  it('fails safely when the AI service is unavailable', async () => {
    const { service, faceClient } = makeService();
    faceClient.enroll.mockRejectedValueOnce(new FaceServiceUnavailableError('down'));
    const { enrollmentId } = await service.enrollStart('u1', {});
    await expect(service.enrollVerify('u1', enrollmentId, [jpegFrame(1), jpegFrame(2)], {})).rejects.toThrow(
      /temporarily unavailable/,
    );
  });

  it('maps an AI rejection (low_quality) to a safe 400 quality message on enrollment', async () => {
    const { service, faceClient } = makeService();
    faceClient.enroll.mockRejectedValueOnce(new FaceRejectedError('low_quality'));
    const { enrollmentId } = await service.enrollStart('u1', {});
    await expect(service.enrollVerify('u1', enrollmentId, [jpegFrame(1), jpegFrame(2)], {})).rejects.toThrow(
      /Image quality is too low/,
    );
  });

  it('reports capture feedback without issuing an identity decision or session', async () => {
    const { service, faceClient } = makeService();
    faceClient.embed.mockRejectedValueOnce(new FaceRejectedError('no_face'));
    const { challengeId } = await service.faceStart('jane@test.com', { ip: '5.5.5.5' });
    await expect(
      service.faceVerify('jane@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], { ip: '5.5.5.5' }),
    ).rejects.toMatchObject({ status: 422, response: 'FACE_CAPTURE:no_face' });
  });

  it('disables face login and deletes the template', async () => {
    const { service, prisma } = makeService();
    await expect(service.disable('u1', {})).resolves.toEqual({ disabled: true });
    expect(prisma.biometricCredential.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});

describe('BiometricService — face login', () => {
  it('requires email confirmation after a valid face match without issuing a session', async () => {
    const { service, prisma, tokenService } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(enrolledUser({ emailVerifiedAt: null }));
    const { challengeId } = await service.faceStart('jane@test.com', {});
    await expect(service.faceVerify('jane@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], {}))
      .rejects.toMatchObject({ response: { code: 'EMAIL_VERIFICATION_REQUIRED' } });
    expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
    expect(tokenService.issueRefreshToken).not.toHaveBeenCalled();
  });

  it('does not reveal unverified email status to a wrong face', async () => {
    const { service, prisma, faceClient, tokenService } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(enrolledUser({ emailVerifiedAt: null }));
    faceClient.embed.mockResolvedValueOnce({ embedding: BAD, quality: { passed: true, reasons: [] }, liveness: { passed: true } });
    const { challengeId } = await service.faceStart('jane@test.com', {});
    await expect(service.faceVerify('jane@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], {}))
      .rejects.toThrow('Face verification failed.');
    expect(tokenService.issueAccessToken).not.toHaveBeenCalled();
  });

  it('issues tokens after a successful face match', async () => {
    const { service } = makeService();
    const { challengeId } = await service.faceStart('jane@test.com', { ip: '9.9.9.9' });
    const result = await service.faceVerify('jane@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], {
      ip: '9.9.9.9',
    });
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user).toMatchObject({ email: 'jane@test.com', emailVerified: true });
  });

  it('rejects a wrong face (below threshold)', async () => {
    const { service, faceClient } = makeService();
    faceClient.embed.mockResolvedValueOnce({
      embedding: BAD, // different identity
      quality: { passed: true, reasons: [] },
      liveness: { passed: true, reason: null },
    });
    const { challengeId } = await service.faceStart('jane@test.com', { ip: '1.1.1.1' });
    await expect(service.faceVerify('jane@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], { ip: '1.1.1.1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a user without an enrolled credential (generic error)', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({ ...enrolledUser(), biometricCredential: null });
    const { challengeId } = await service.faceStart('jane@test.com', { ip: '1.1.1.1' });
    await expect(service.faceVerify('jane@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], { ip: '1.1.1.1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not reveal whether an account exists', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const { challengeId } = await service.faceStart('ghost@test.com', { ip: '1.1.1.1' });
    await expect(service.faceVerify('ghost@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], { ip: '1.1.1.1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a replayed challenge', async () => {
    const { service } = makeService();
    const { challengeId } = await service.faceStart('jane@test.com', { ip: '1.1.1.1' });
    await service.faceVerify('jane@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], { ip: '1.1.1.1' });
    await expect(service.faceVerify('jane@test.com', challengeId, [jpegFrame(3), jpegFrame(4)], { ip: '1.1.1.1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('blocks after repeated failures but keeps the failure generic', async () => {
    const { service, faceClient } = makeService(); // maxAttempts = 3
    faceClient.embed.mockResolvedValue({
      embedding: BAD,
      quality: { passed: true, reasons: [] },
      liveness: { passed: true, reason: null },
    });
    const key = { ip: '2.2.2.2' };
    for (let i = 0; i < 3; i++) {
      const { challengeId } = await service.faceStart('jane@test.com', key);
      await expect(
        service.faceVerify('jane@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], key),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(service.faceStart('jane@test.com', key)).rejects.toBeInstanceOf(HttpException);
  });

  it('does not consume a challenge for a wrong-face attempt against another email', async () => {
    const { service } = makeService();
    const { challengeId } = await service.faceStart('jane@test.com', { ip: '3.3.3.3' });
    // Attacker supplies the challenge with a different email.
    await expect(service.faceVerify('other@test.com', challengeId, [jpegFrame(1), jpegFrame(2)], { ip: '3.3.3.3' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
