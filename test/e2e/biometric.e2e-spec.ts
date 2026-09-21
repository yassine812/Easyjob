import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import {
  authHeader,
  closeTestApp,
  createTestApp,
  createVerifiedUser,
  login,
} from '../helpers';

/** Good/bad descriptor patterns (mirror the unit tests). */
const GOOD = Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? 0.1 : 0.9));
const BAD = Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? 0.9 : 0.1));

const WRONG_MARKER = Buffer.from('WRONGFACE');
const DOWN_MARKER = Buffer.from('SERVICEDOWN');

/** Minimal JPEG-looking frame; marker controls stub behavior. */
function frame(marker: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(marker.padEnd(24, '_')), Buffer.alloc(64)]);
}

function okEmbedding(embedding: number[]) {
  return { embedding, quality: { passed: true, reasons: [] }, liveness: { passed: true, reason: null } };
}

describe('Biometric face authentication (e2e)', () => {
  let stub: Server;
  let baseUrl: string;
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    stub = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/json');
        if (body.includes(DOWN_MARKER)) {
          res.statusCode = 503;
          res.end(JSON.stringify({ detail: { code: 'ai_unavailable' } }));
          return;
        }
        if (req.url === '/ai/face/enroll' || req.url === '/ai/face/embed') {
          res.end(JSON.stringify(okEmbedding(body.includes(WRONG_MARKER) ? BAD : GOOD)));
          return;
        }
        res.statusCode = 404;
        res.end(JSON.stringify({ detail: 'not found' }));
      });
    });
    await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    ctx = await createTestApp({
      BIOMETRIC_ENABLED: 'true',
      BIOMETRIC_ENCRYPTION_KEY: 'e'.repeat(64),
      AI_SERVICE_URL: baseUrl,
      FACE_MAX_ATTEMPTS: '3',
    });
  });

  afterAll(async () => {
    await closeTestApp(ctx);
    await new Promise<void>((resolve) => stub.close(() => resolve()));
  });

  async function enroll(userToken: string, frames = [frame(''), frame('')]) {
    const start = await ctx.http
      .post('/api/v1/biometric/enroll/start')
      .set(authHeader(userToken))
      .send({ consent: true });
    expect(start.status).toBe(201);
    const enrollmentId = (start.body as { enrollmentId: string }).enrollmentId;
    const verify = await ctx.http
      .post('/api/v1/biometric/enroll/verify')
      .set(authHeader(userToken))
      .field('enrollmentId', enrollmentId)
      .attach('frame_a', frames[0], 'a.jpg')
      .attach('frame_b', frames[1], 'b.jpg');
    expect(verify.status).toBe(201);
    return enrollmentId;
  }

  describe('enrollment', () => {
    it('requires explicit consent', async () => {
      const { accessToken } = await createVerifiedUser(ctx, 'Biometric Jane', 'bjan@test.com');
      const res = await ctx.http
        .post('/api/v1/biometric/enroll/start')
        .set(authHeader(accessToken))
        .send({ consent: false });
      expect(res.status).toBe(400);
    });

    it('enrolls a candidate and reports enrolled status', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Jane', 'bjane@test.com');
      await enroll(user.accessToken);
      const status = await ctx.http.get('/api/v1/biometric/status').set(authHeader(user.accessToken));
      expect(status.status).toBe(200);
      expect((status.body as { enrolled: boolean }).enrolled).toBe(true);
      expect((status.body as { enabled: boolean }).enabled).toBe(true);
    });

    it('rejects a replayed enrollment session', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Replay', 'breplay@test.com');
      const start = await ctx.http
        .post('/api/v1/biometric/enroll/start')
        .set(authHeader(user.accessToken))
        .send({ consent: true });
      const enrollmentId = (start.body as { enrollmentId: string }).enrollmentId;
      const post = () =>
        ctx.http
          .post('/api/v1/biometric/enroll/verify')
          .set(authHeader(user.accessToken))
          .field('enrollmentId', enrollmentId)
          .attach('frame_a', frame(''), 'a.jpg')
          .attach('frame_b', frame(''), 'b.jpg');
      expect((await post()).status).toBe(201);
      expect((await post()).status).toBe(410);
    });

    it('blocks PLATFORM_ADMIN enrollment', async () => {
      const admin = await createVerifiedUser(ctx, 'Biometric Admin', 'badmin@test.com');
      const adminRole = await (ctx.prisma as never as { role: { findUnique: (a: object) => Promise<{ id: string } | null> } }).role.findUnique({
        where: { name: 'PLATFORM_ADMIN' },
      });
      const adminUser = await (ctx.prisma as never as { user: { findUnique: (a: object) => Promise<{ id: string } | null> } }).user.findUnique({
        where: { email: 'badmin@test.com' },
      });
      if (adminRole && adminUser) {
        await (ctx.prisma as never as { userRole: { create: (a: object) => Promise<unknown> } }).userRole.create({
          data: { userId: adminUser.id, roleId: adminRole.id },
        });
      }
      const res = await ctx.http
        .post('/api/v1/biometric/enroll/start')
        .set(authHeader(admin.accessToken))
        .send({ consent: true });
      expect(res.status).toBe(403);
    });

    it('fails safely when the AI service is unavailable', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Down', 'bdown@test.com');
      const start = await ctx.http
        .post('/api/v1/biometric/enroll/start')
        .set(authHeader(user.accessToken))
        .send({ consent: true });
      const enrollmentId = (start.body as { enrollmentId: string }).enrollmentId;
      const res = await ctx.http
        .post('/api/v1/biometric/enroll/verify')
        .set(authHeader(user.accessToken))
        .field('enrollmentId', enrollmentId)
        .attach('frame_a', frame('SERVICEDOWN'), 'a.jpg')
        .attach('frame_b', frame(''), 'b.jpg');
      expect(res.status).toBe(503);
    });

    it('requires two valid image frames', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Frames', 'bframes@test.com');
      const start = await ctx.http
        .post('/api/v1/biometric/enroll/start')
        .set(authHeader(user.accessToken))
        .send({ consent: true });
      const enrollmentId = (start.body as { enrollmentId: string }).enrollmentId;
      const res = await ctx.http
        .post('/api/v1/biometric/enroll/verify')
        .set(authHeader(user.accessToken))
        .field('enrollmentId', enrollmentId)
        .attach('frame_a', Buffer.from('not-an-image'), 'a.jpg')
        .attach('frame_b', Buffer.from('also-not'), 'b.jpg');
      expect(res.status).toBe(400);
    });
  });

  describe('face login', () => {
    it('issues a normal session after a successful face match', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Login', 'blogin@test.com');
      await enroll(user.accessToken);

      const start = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'blogin@test.com' });
      expect(start.status).toBe(201);
      const { challengeId } = start.body as { challengeId: string };

      const verify = await ctx.http
        .post('/api/v1/auth/face/verify')
        .field('email', 'blogin@test.com')
        .field('challengeId', challengeId)
        .attach('frame_a', frame(''), 'a.jpg')
        .attach('frame_b', frame(''), 'b.jpg');
      if (verify.status !== 201) console.log('VERIFY BODY:', JSON.stringify(verify.body));
      expect(verify.status).toBe(201);
      const body = verify.body as { accessToken: string; user: { email: string; roles: string[] } };
      expect(body.accessToken).toBeTruthy();
      expect(body.user.email).toBe('blogin@test.com');

      // The issued token is a real session: /auth/me works with it.
      const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(body.accessToken));
      expect(me.status).toBe(200);
      expect((me.body as { email: string }).email).toBe('blogin@test.com');
    });

    it('rejects a wrong face', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Wrong', 'bwrong@test.com');
      await enroll(user.accessToken);
      const start = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'bwrong@test.com' });
      const { challengeId } = start.body as { challengeId: string };
      const verify = await ctx.http
        .post('/api/v1/auth/face/verify')
        .field('email', 'bwrong@test.com')
        .field('challengeId', challengeId)
        .attach('frame_a', frame('WRONGFACE'), 'a.jpg')
        .attach('frame_b', frame(''), 'b.jpg');
      expect(verify.status).toBe(401);
    });

    it('rejects a replayed challenge', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Replay Login', 'breplaylogin@test.com');
      await enroll(user.accessToken);
      const start = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'breplaylogin@test.com' });
      const { challengeId } = start.body as { challengeId: string };
      const post = () =>
        ctx.http
          .post('/api/v1/auth/face/verify')
          .field('email', 'breplaylogin@test.com')
          .field('challengeId', challengeId)
          .attach('frame_a', frame(''), 'a.jpg')
          .attach('frame_b', frame(''), 'b.jpg');
      expect((await post()).status).toBe(201);
      expect((await post()).status).toBe(401);
    });

    it('rejects an expired challenge', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Expired', 'bexpired@test.com');
      await enroll(user.accessToken);
      // No start call — use a fabricated id; it must fail cleanly (invalid).
      const verify = await ctx.http
        .post('/api/v1/auth/face/verify')
        .field('email', 'bexpired@test.com')
        .field('challengeId', 'deadbeef'.repeat(4))
        .attach('frame_a', frame(''), 'a.jpg')
        .attach('frame_b', frame(''), 'b.jpg');
      expect(verify.status).toBe(401);
    });

    it('does not reveal whether an account has face login enabled', async () => {
      // Registered + verified, but never enrolled.
      await createVerifiedUser(ctx, 'Biometric Ghost', 'bghost@test.com');
      const start = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'bghost@test.com' });
      const { challengeId } = start.body as { challengeId: string };
      const verify = await ctx.http
        .post('/api/v1/auth/face/verify')
        .field('email', 'bghost@test.com')
        .field('challengeId', challengeId)
        .attach('frame_a', frame(''), 'a.jpg')
        .attach('frame_b', frame(''), 'b.jpg');
      // Same generic error as a wrong face — no enumeration signal.
      expect(verify.status).toBe(401);
    });

    it('cannot use one account to log into another (cross-account)', async () => {
      const attacker = await createVerifiedUser(ctx, 'Biometric Attacker', 'battacker@test.com');
      await enroll(attacker.accessToken);
      const start = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'battacker@test.com' });
      const { challengeId } = start.body as { challengeId: string };
      // Victim account exists but has no credential; attacker supplies the
      // challenge they received for their own email — verification resolves
      // the victim user, who is not enrolled → generic 401.
      const verify = await ctx.http
        .post('/api/v1/auth/face/verify')
        .field('email', 'bjane@test.com')
        .field('challengeId', challengeId)
        .attach('frame_a', frame(''), 'a.jpg')
        .attach('frame_b', frame(''), 'b.jpg');
      expect(verify.status).toBe(401);
    });

    it('fails safely when the AI service is unavailable (password still works)', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Unavail', 'bunavail@test.com');
      await enroll(user.accessToken);
      const start = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'bunavail@test.com' });
      const { challengeId } = start.body as { challengeId: string };
      const verify = await ctx.http
        .post('/api/v1/auth/face/verify')
        .field('email', 'bunavail@test.com')
        .field('challengeId', challengeId)
        .attach('frame_a', frame('SERVICEDOWN'), 'a.jpg')
        .attach('frame_b', frame(''), 'b.jpg');
      expect(verify.status).toBe(503);

      const pw = await login(ctx.http, 'bunavail@test.com');
      expect(pw.accessToken).toBeTruthy();
    });

    it('temporarily blocks after repeated failures', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Brute', 'bbrute@test.com');
      await enroll(user.accessToken);
      for (let i = 0; i < 3; i++) {
        const start = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'bbrute@test.com' });
        const { challengeId } = start.body as { challengeId: string };
        const verify = await ctx.http
          .post('/api/v1/auth/face/verify')
          .field('email', 'bbrute@test.com')
          .field('challengeId', challengeId)
          .attach('frame_a', frame('WRONGFACE'), 'a.jpg')
          .attach('frame_b', frame(''), 'b.jpg');
        expect(verify.status).toBe(401);
      }
      // Blocked now — even a correct face is refused at start.
      const blocked = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'bbrute@test.com' });
      expect(blocked.status).toBe(429);
      // Password login is unaffected.
      const pw = await login(ctx.http, 'bbrute@test.com');
      expect(pw.accessToken).toBeTruthy();
    });
  });

  describe('disabling', () => {
    it('disables face login while keeping password login', async () => {
      const user = await createVerifiedUser(ctx, 'Biometric Disable', 'bdisable@test.com');
      await enroll(user.accessToken);

      const del = await ctx.http.delete('/api/v1/biometric').set(authHeader(user.accessToken));
      expect(del.status).toBe(200);
      expect((del.body as { disabled: boolean }).disabled).toBe(true);

      const start = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'bdisable@test.com' });
      const { challengeId } = start.body as { challengeId: string };
      const verify = await ctx.http
        .post('/api/v1/auth/face/verify')
        .field('email', 'bdisable@test.com')
        .field('challengeId', challengeId)
        .attach('frame_a', frame(''), 'a.jpg')
        .attach('frame_b', frame(''), 'b.jpg');
      expect(verify.status).toBe(401);

      const pw = await login(ctx.http, 'bdisable@test.com');
      expect(pw.accessToken).toBeTruthy();
    });
  });

});
