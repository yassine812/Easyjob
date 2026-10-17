/* eslint-disable @typescript-eslint/no-var-requires */
import type { INestApplication, ValidationPipeOptions } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service';

export type Http = ReturnType<typeof request>;

export interface TestContext {
  app: INestApplication;
  http: Http;
  prisma: PrismaService;
}

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/startup_starter_test?schema=public';

export const DEV_WEBHOOK_SECRET = 'test-webhook-secret';

export function setTestEnv(overrides: Record<string, string> = {}): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.RUN_WORKERS = 'true';
  process.env.EMAIL_PROVIDER = 'console';
  process.env.PAYMENT_PROVIDER = 'dev';
  process.env.DEV_WEBHOOK_SECRET = DEV_WEBHOOK_SECRET;
  process.env.THROTTLE_ENABLED = 'false';
  process.env.STORAGE_PROVIDER = 'local';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef0123456789abcdef';
  process.env.AI_API_KEY = 'isolated-test-ai-key';
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:65534';
  process.env.AI_FACE_SERVICE_URL = overrides.AI_SERVICE_URL ?? 'http://127.0.0.1:65534';
  process.env.BIOMETRIC_ENABLED = 'false';
  Object.assign(process.env, overrides);
}

/** Creates a fully initialized Nest app bound to the test database. */
export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestContext> {
  const trace = (stage: string) => { if (process.env.TEST_DIAGNOSTICS === 'true') console.log(`[test init] ${stage}`); };
  setTestEnv(overrides);
  // Fresh module registry per app so env changes are picked up.
  const { AppModule } = require('../src/app.module');
  const { NestFactory } = require('@nestjs/core');
  const { PrismaService } = require('../src/prisma/prisma.service');

  const pipeOptions: ValidationPipeOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  };

  trace('create');
  const app: INestApplication = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn'],
  });
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe(pipeOptions));
  trace('init');
  await app.init();

  const prisma: PrismaService = app.get(PrismaService);
  trace('clean');
  await prisma.cleanDatabase();
  const { seedEssential } = require('./essential-seed');
  trace('seed');
  await seedEssential(prisma);
  trace('ready');

  return { app, http: request(app.getHttpServer()), prisma };
}

export async function closeTestApp(ctx: TestContext): Promise<void> {
  await ctx.app.close();
}

// ---------------- auth helpers ----------------

export async function registerUser(
  http: Http,
  name: string,
  email: string,
  password = 'Str0ngPass123',
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await http.post('/api/v1/auth/register').send({ name, email, password });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

export async function login(
  http: Http,
  email: string,
  password = 'Str0ngPass123',
): Promise<{ accessToken: string; refreshToken: string; body: Record<string, unknown> }> {
  const response = await http.post('/api/v1/auth/login').send({ email, password });
  const body = response.body as {
    accessToken: string;
    refreshToken?: string;
    user: Record<string, unknown>;
  };
  const cookieName = process.env.COOKIE_NAME ?? 'refresh_token';
  const setCookie = response.headers['set-cookie'];
  let refreshToken = body.refreshToken ?? '';
  if (Array.isArray(setCookie)) {
    const match = (setCookie as string[]).find((c) => c.startsWith(`${cookieName}=`));
    if (match) refreshToken = decodeURIComponent(match.split(';')[0].slice(cookieName.length + 1));
  }
  return { accessToken: body.accessToken, refreshToken, body: body as unknown as Record<string, unknown> };
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Legacy tenant fixture for business-flow tests. Public company creation is disabled. */
export async function companyFixture(ctx: TestContext, ownerToken: string, data: { commercialName: string; legalName: string; [key: string]: unknown }) {
  const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(ownerToken));
  if (me.status !== 200) throw new Error('Fixture requires authenticated owner');
  const company = await ctx.prisma.company.create({ data: {
    ...data, slug: `fixture-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    members: { create: { userId: me.body.id, role: 'COMPANY_ADMIN', isOwner: true, status: 'ACTIVE' } },
    verification: { create: { status: 'PENDING' } },
  } });
  return { status: 201, body: company };
}

/** Extracts a verification/reset token from the captured console emails. */
export function extractTokenFromEmails(subjectPart: string, pathPart: string, recipient?: string): string {
  const { ConsoleEmailProvider } = require('../src/queues/email/email.provider');
  const email = [...ConsoleEmailProvider.sentEmails].reverse().find((e) => e.subject.includes(subjectPart)
    && (!recipient || String(e.to).toLowerCase() === recipient.toLowerCase()));
  if (!email) throw new Error(`No captured email with subject containing "${subjectPart}"`);
  const match = email.html.match(new RegExp(`${pathPart}\\?token=([a-f0-9]+)`));
  if (!match) throw new Error(`No token found in email`);
  return match[1];
}

/** Creates and verifies a user, returning tokens and user id. */
export async function createVerifiedUser(
  ctx: TestContext,
  name: string,
  email: string,
  password = 'Str0ngPass123',
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  await registerUser(ctx.http, name, email, password);
  const token = await waitFor(() => extractTokenFromEmails('Verify your email', 'verify-email', email));
  const verify = await ctx.http.post('/api/v1/auth/verify-email').send({ token });
  expect(verify.status).toBe(200);
  const auth = await login(ctx.http, email, password);
  const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(auth.accessToken));
  const body = me.body as { id: string };
  return { accessToken: auth.accessToken, refreshToken: auth.refreshToken, userId: body.id };
}

/** Polls a predicate until it passes or times out. */
export async function waitFor<T>(
  fn: () => T | Promise<T>,
  { timeoutMs = 15000, intervalMs = 100, description = 'condition' }: { timeoutMs?: number; intervalMs?: number; description?: string } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result !== undefined && result !== null && result !== false) return result;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${(lastError as Error).message}` : ''}`);
}

export async function waitForNotification(
  ctx: TestContext,
  userId: string,
  type: string,
  timeoutMs = 15000,
): Promise<Record<string, unknown>> {
  const prisma = ctx.prisma;
  return waitFor(
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notification = await (prisma as any).notification.findFirst({
        where: { userId, type },
        orderBy: { createdAt: 'desc' },
      });
      return notification ?? undefined;
    },
    { timeoutMs, description: `notification ${type} for user ${userId}` },
  );
}

export function expectUnauthorized(status: number): void {
  expect(status).toBe(401);
}

export function expectForbidden(status: number): void {
  expect(status).toBe(403);
}
