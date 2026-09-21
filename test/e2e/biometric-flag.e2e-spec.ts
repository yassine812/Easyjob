import {
  authHeader,
  closeTestApp,
  createTestApp,
  createVerifiedUser,
  login,
} from '../helpers';

describe('Biometric feature flag (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp({
      BIOMETRIC_ENABLED: 'false',
      BIOMETRIC_ENCRYPTION_KEY: 'e'.repeat(64),
    });
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('keeps biometric endpoints unavailable when disabled', async () => {
    const user = await createVerifiedUser(ctx, 'Biometric Flagged', 'bflagged@test.com');

    const start = await ctx.http
      .post('/api/v1/biometric/enroll/start')
      .set(authHeader(user.accessToken))
      .send({ consent: true });
    expect(start.status).toBe(404);

    const status = await ctx.http.get('/api/v1/biometric/status').set(authHeader(user.accessToken));
    expect(status.status).toBe(200);
    expect((status.body as { enabled: boolean }).enabled).toBe(false);
    expect((status.body as { enrolled: boolean }).enrolled).toBe(false);

    const faceStart = await ctx.http.post('/api/v1/auth/face/start').send({ email: 'bflagged@test.com' });
    expect(faceStart.status).toBe(404);
  });

  it('leaves normal password authentication untouched', async () => {
    const pw = await login(ctx.http, 'bflagged@test.com');
    expect(pw.accessToken).toBeTruthy();
    const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(pw.accessToken));
    expect(me.status).toBe(200);
  });
});
