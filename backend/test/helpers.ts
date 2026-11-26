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
  // Keep one listener for the app lifetime, including requests that prepare
  // another API-backed fixture before sending their body.
  await app.listen(0, '127.0.0.1');

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
  if (ctx?.app) await ctx.app.close();
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

/** A completed PDF fixture for application tests; extraction itself has a dedicated AI E2E suite. */
export async function applicationPayload(ctx: TestContext, token: string, extra: Record<string, unknown> = {}) {
  const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(token));
  expect(me.status).toBe(200);
  const profile = await ctx.prisma.candidateProfile.findUniqueOrThrow({ where: { userId: me.body.id } });
  let resume = await ctx.prisma.resume.findFirst({ where: { candidateId: profile.id, mimeType: 'application/pdf', processingStatus: 'COMPLETED' } });
  if (!resume) {
    const { StorageService } = require('../src/files/storage.service');
    const text = `${me.body.name}\n${me.body.email}\nSenior Backend Engineer\n6 years of experience building TypeScript Node.js Python APIs.\nSkills: TypeScript, Node.js, Python, SQL\nEducation: Computer Science`;
    const escaped = text.replace(/[^\x20-\x7e\n]/g, ' ').split('\n').map(line => line.replace(/[\\()]/g, '\\$&'));
    const stream = `BT /F1 11 Tf 50 780 Td ${escaped.map((line: string, i: number) => `${i ? '0 -16 Td ' : ''}(${line}) Tj`).join('\n')} ET`;
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = Buffer.from(pdf), storageKey = `test-fixtures/${profile.id}/reviewed-cv.pdf`;
    await ctx.app.get(StorageService).put(storageKey, bytes, 'application/pdf');
    const last = await ctx.prisma.resume.aggregate({ where: { candidateId: profile.id }, _max: { version: true } });
    resume = await ctx.prisma.resume.create({ data: { candidateId: profile.id, filename: 'reviewed-cv.pdf', storageKey,
      mimeType: 'application/pdf', fileSize: bytes.length, version: (last._max.version ?? 0) + 1, parsedText: text, processingStatus: 'COMPLETED' } });
  }
  return { ...extra, resumeId: resume.id, consent: true, candidateSnapshot: { fullName: me.body.name as string, email: me.body.email as string } };
}

/** Active tenant fixture. Real administrator invitations are covered separately. */
export async function companyFixture(ctx: TestContext, ownerToken: string, data: { commercialName: string; legalName: string; [key: string]: unknown }) {
  const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(ownerToken));
  if (me.status !== 200) throw new Error('Fixture requires authenticated owner');
  const company = await ctx.prisma.company.create({ data: {
    ...data, status: 'ACTIVE', slug: `fixture-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    members: { create: { userId: me.body.id, role: 'COMPANY_ADMIN', isOwner: true, status: 'ACTIVE' } },
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

export function extractVerificationCode(recipient: string): string {
  const { ConsoleEmailProvider } = require('../src/queues/email/email.provider');
  const email = [...ConsoleEmailProvider.sentEmails].reverse().find((message) => String(message.to).toLowerCase() === recipient.toLowerCase() && /\b\d{6}\b/.test(message.text ?? ''));
  const code = email?.text?.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error('No verification code captured for the test recipient');
  return code;
}

export function refreshCookie(response: { headers: Record<string, unknown> }): string {
  const cookieName = process.env.COOKIE_NAME ?? 'refresh_token';
  const cookies = response.headers['set-cookie'];
  if (!Array.isArray(cookies)) throw new Error('Expected an HTTP-only refresh cookie');
  const cookie = cookies.find((value: string) => value.startsWith(`${cookieName}=`));
  if (!cookie) throw new Error('Expected an HTTP-only refresh cookie');
  return decodeURIComponent(cookie.split(';')[0].slice(cookieName.length + 1));
}

/** Creates and verifies a user, returning tokens and user id. */
export async function createVerifiedUser(
  ctx: TestContext,
  name: string,
  email: string,
  password = 'Str0ngPass123',
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  await registerUser(ctx.http, name, email, password);
  const code = await waitFor(() => extractVerificationCode(email));
  const verify = await ctx.http.post('/api/v1/auth/verify-email').send({ email, code });
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
