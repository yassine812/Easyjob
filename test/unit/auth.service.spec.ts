import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../src/auth/auth.service';
import { ROLES } from '../../src/common/constants/roles';
import type { AppConfig } from '../../src/config/configuration';

function mockConfig(): AppConfig {
  return {
    env: 'test',
    port: 3000,
    apiPrefix: 'api/v1',
    frontendUrl: 'http://localhost:5173',
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
    ai: { baseUrl: '', timeoutMs: 0 },
    biometric: {
      enabled: false,
      encryptionKey: '',
      matchThreshold: 0.5,
      livenessEnabled: true,
      maxAttempts: 5,
      attemptWindowMs: 600000,
      blockMs: 600000,
      challengeTtlSeconds: 120,
      faceServiceUrl: '',
      maxImageBytes: 5 * 1024 * 1024,
    },
    payment: {
      provider: 'dev',
      devWebhookSecret: 'secret',
      stripe: { priceMap: {} },
    },
    logLevel: 'info',
    runWorkers: false,
  };
}

interface MockDb {
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  userRole: { create: jest.Mock; findMany: jest.Mock };
  candidateProfile: { create: jest.Mock };
  role: { findUnique: jest.Mock };
  emailVerificationToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  passwordResetToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  refreshToken: { updateMany: jest.Mock };
  $transaction: jest.Mock;
}

const makeService = (overrides: Record<string, unknown> = {}) => {
  const prisma: MockDb = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userRole: { create: jest.fn(), findMany: jest.fn() },
    candidateProfile: { create: jest.fn() },
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-candidate' }) },
    emailVerificationToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    $transaction: jest.fn((fn: (tx: MockDb) => unknown) => fn(prisma)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const email = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const tokenService = {
    issueAccessToken: jest.fn().mockResolvedValue('access-token'),
    issueRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
    rotateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };
  const service = new AuthService(
    prisma as never,
    tokenService as never,
    audit as never,
    email as never,
    mockConfig(),
  );
  return { service, prisma, audit, email, tokenService, ...overrides };
};

describe('AuthService', () => {
  it('registers a user with hashed password, candidate role and profile', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: (tx: MockDb) => Promise<unknown>) => fn(prisma));
    prisma.user.create.mockResolvedValue({ id: 'u1', name: 'Jane', email: 'jane@test.com' });

    const result = await service.register({ name: 'Jane', email: 'Jane@Test.com', password: 'Str0ngPass123' }, {});

    expect(result.email).toBe('jane@test.com');
    const created = prisma.user.create.mock.calls[0][0].data;
    expect(created.passwordHash).not.toBe('Str0ngPass123');
    expect(await bcrypt.compare('Str0ngPass123', created.passwordHash)).toBe(true);
    expect(prisma.userRole.create).toHaveBeenCalled();
    expect(prisma.candidateProfile.create).toHaveBeenCalled();
  });

  it('rejects duplicate email registration', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'jane@test.com' });
    await expect(
      service.register({ name: 'Jane', email: 'jane@test.com', password: 'Str0ngPass123' }, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('logs in with correct credentials and returns tokens', async () => {
    const { service, prisma, tokenService } = makeService();
    const hash = await bcrypt.hash('Str0ngPass123', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Jane',
      email: 'jane@test.com',
      passwordHash: hash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    });
    prisma.user.update.mockResolvedValue({});
    const userRoles = { findMany: jest.fn().mockResolvedValue([{ role: { name: ROLES.CANDIDATE } }]) };
    (service as unknown as { prisma: MockDb }).prisma = { ...prisma, userRole: userRoles } as MockDb;

    const result = await service.login({ email: 'jane@test.com', password: 'Str0ngPass123' }, {});
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(tokenService.issueRefreshToken).toHaveBeenCalled();
  });

  it('never reveals which part of the credentials was wrong', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'ghost@test.com', password: 'whatever1' }, {})).rejects.toThrow(
      UnauthorizedException,
    );
    const wrongHash = await bcrypt.hash('other', 10);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: wrongHash, status: 'ACTIVE' });
    await expect(service.login({ email: 'x@test.com', password: 'Str0ngPass123' }, {})).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifies email only with a valid unused token', async () => {
    const { service, prisma } = makeService();
    prisma.emailVerificationToken.findUnique.mockResolvedValue(null);
    await expect(service.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 10000),
    });
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
    await expect(service.verifyEmail('good-token')).resolves.toEqual({ verified: true });
  });

  it('does not leak whether an email exists on forgot-password', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    const missing = await service.forgotPassword('ghost@test.com', {});
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'exists@test.com' });
    const existing = await service.forgotPassword('exists@test.com', {});
    expect(missing).toEqual({ sent: true });
    expect(existing).toEqual({ sent: true });
  });
});
