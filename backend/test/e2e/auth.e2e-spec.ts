import {
  closeTestApp,
  createTestApp,
  extractTokenFromEmails,
  login,
  registerUser,
  waitFor,
} from '../helpers';

describe('Authentication (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  const PASSWORD = 'Str0ngPass123';

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('registers, sends a verification email and verifies the account', async () => {
    const { status, body } = await registerUser(ctx.http, 'Auth Tester', 'auth@test.com', PASSWORD);
    expect(status).toBe(201);
    expect(body.id).toBeDefined();
    expect(JSON.stringify(body)).not.toContain('password');

    const token = await waitFor(() => extractTokenFromEmails('Verify your email', 'verify-email'));
    const verify = await ctx.http.post('/api/v1/auth/verify-email').send({ token });
    expect(verify.status).toBe(200);
    expect(verify.body).toEqual({ verified: true });

    // Token is single-use.
    const replay = await ctx.http.post('/api/v1/auth/verify-email').send({ token });
    expect(replay.status).toBe(400);
  });

  it('rejects duplicate emails', async () => {
    const { status } = await registerUser(ctx.http, 'Auth Tester 2', 'auth@test.com', PASSWORD);
    expect(status).toBe(400);
  });

  it('rejects invalid or expired verification tokens', async () => {
    const response = await ctx.http.post('/api/v1/auth/verify-email').send({ token: 'invalid-token' });
    expect(response.status).toBe(400);
  });

  it('logs in with valid credentials and returns an access token', async () => {
    const auth = await login(ctx.http, 'auth@test.com', PASSWORD);
    expect(auth.accessToken).toBeTruthy();
    expect((auth.body.user as { email: string }).email).toBe('auth@test.com');
  });

  it('returns a generic error for wrong credentials (no user enumeration)', async () => {
    const wrong = await ctx.http.post('/api/v1/auth/login').send({ email: 'auth@test.com', password: 'WrongPass123' });
    const missing = await ctx.http.post('/api/v1/auth/login').send({ email: 'nobody@test.com', password: 'WrongPass123' });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect((wrong.body as { message: string }).message).toBe((missing.body as { message: string }).message);
  });

  it('rotates refresh tokens — old tokens cannot be reused', async () => {
    const auth = await login(ctx.http, 'auth@test.com', PASSWORD);

    const refresh1 = await ctx.http.post('/api/v1/auth/refresh').send({ refreshToken: auth.refreshToken });
    expect(refresh1.status).toBe(200);
    const newRefresh = (refresh1.body as { refreshToken: string }).refreshToken;

    const replay = await ctx.http.post('/api/v1/auth/refresh').send({ refreshToken: auth.refreshToken });
    expect(replay.status).toBe(401);

    const refresh2 = await ctx.http.post('/api/v1/auth/refresh').send({ refreshToken: newRefresh });
    expect(refresh2.status).toBe(200);
  });

  it('logs out and invalidates the refresh token', async () => {
    const auth = await login(ctx.http, 'auth@test.com', PASSWORD);
    const logout = await ctx.http.post('/api/v1/auth/logout').send({ refreshToken: auth.refreshToken });
    expect(logout.status).toBe(204);

    const refresh = await ctx.http.post('/api/v1/auth/refresh').send({ refreshToken: auth.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('requests a password reset without leaking account existence', async () => {
    const existing = await ctx.http.post('/api/v1/auth/forgot-password').send({ email: 'auth@test.com' });
    const ghost = await ctx.http.post('/api/v1/auth/forgot-password').send({ email: 'ghost@test.com' });
    expect(existing.status).toBe(200);
    expect(ghost.status).toBe(200);
    expect(existing.body).toEqual(ghost.body);
  });

  it('resets the password with the emailed token (single-use)', async () => {
    await ctx.http.post('/api/v1/auth/forgot-password').send({ email: 'auth@test.com' });
    const token = await waitFor(() => extractTokenFromEmails('Reset your password', 'reset-password'));
    const reset = await ctx.http
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'NewPassw0rd!' });
    expect(reset.status).toBe(200);

    const oldLogin = await ctx.http.post('/api/v1/auth/login').send({ email: 'auth@test.com', password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await ctx.http.post('/api/v1/auth/login').send({ email: 'auth@test.com', password: 'NewPassw0rd!' });
    expect(newLogin.status).toBe(200);

    // Token is single-use.
    const replay = await ctx.http.post('/api/v1/auth/reset-password').send({ token, newPassword: 'Another123' });
    expect(replay.status).toBe(400);
  });

  it('exposes the current user via /auth/me', async () => {
    const auth = await login(ctx.http, 'auth@test.com', 'NewPassw0rd!');
    const me = await ctx.http.get('/api/v1/auth/me').set('Authorization', `Bearer ${auth.accessToken}`);
    expect(me.status).toBe(200);
    expect((me.body as { email: string }).email).toBe('auth@test.com');
    expect((me.body as { roles: string[] }).roles).toContain('CANDIDATE');
  });

  it('protects protected routes', async () => {
    const me = await ctx.http.get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });

  it('validates DTOs strictly (whitelist + required fields)', async () => {
    const bad = await ctx.http
      .post('/api/v1/auth/register')
      .send({ name: 'X', email: 'not-an-email', password: 'short' });
    expect(bad.status).toBe(400);
    const extra = await ctx.http
      .post('/api/v1/auth/register')
      .send({ name: 'X', email: 'x@test.com', password: 'Str0ngPass123', role: 'PLATFORM_ADMIN' });
    expect(extra.status).toBe(400); // forbidNonWhitelisted rejects mass-assignment attempts
  });

  it('never returns password hashes or tokens in responses', async () => {
    const auth = await login(ctx.http, 'auth@test.com', 'NewPassw0rd!');
    const me = await ctx.http.get('/api/v1/auth/me').set('Authorization', `Bearer ${auth.accessToken}`);
    expect(me.body).not.toHaveProperty('passwordHash');
    expect(me.body).not.toHaveProperty('accessToken');
    expect(me.body).not.toHaveProperty('refreshToken');
  });

  it('requires email verification before company creation', async () => {
    await registerUser(ctx.http, 'Unverified User', 'unverified@test.com', PASSWORD);
    const auth = await login(ctx.http, 'unverified@test.com', PASSWORD);

    const createCompany = await ctx.http
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ legalName: 'No Verify Ltd', commercialName: 'NoVerify', country: 'US' });
    expect(createCompany.status).toBe(403);
  });

  it('rejects tampered access tokens', async () => {
    const auth = await login(ctx.http, 'auth@test.com', 'NewPassw0rd!');
    const tampered = auth.accessToken.slice(0, -4) + 'AAAA';
    const me = await ctx.http.get('/api/v1/auth/me').set('Authorization', `Bearer ${tampered}`);
    expect(me.status).toBe(401);
  });

  it('rejects refresh tokens presented as access tokens', async () => {
    const auth = await login(ctx.http, 'auth@test.com', 'NewPassw0rd!');
    const me = await ctx.http.get('/api/v1/auth/me').set('Authorization', `Bearer ${auth.refreshToken}`);
    expect(me.status).toBe(401);
  });
});
