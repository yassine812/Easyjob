import { authHeader, closeTestApp, createTestApp, createVerifiedUser, login, waitFor } from '../helpers';
import { ConsoleEmailProvider } from '../../src/queues/email/email.provider';
import { CompanyAccessWorker } from '../../src/queues/email/company-access.worker';
import sharp from 'sharp';

describe('Admin provisioning, password recovery and CV prefill', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>, admin: Awaited<ReturnType<typeof createVerifiedUser>>, candidate: typeof admin;
  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await createVerifiedUser(ctx, 'Platform Admin', 'release-admin@workspace.test');
    candidate = await createVerifiedUser(ctx, 'CV Candidate', 'release-candidate@workspace.test');
    const role = await ctx.prisma.role.findUniqueOrThrow({ where: { name: 'PLATFORM_ADMIN' } });
    await ctx.prisma.userRole.create({ data: { userId: admin.userId, roleId: role.id } });
  });
  afterAll(async () => { if (ctx) await closeTestApp(ctx); });

  it('rejects public company registration and company creation by candidates', async () => {
    expect((await ctx.http.post('/api/v1/auth/register').send({ name: 'Public HR', email: 'blocked@workspace.test', password: 'Str0ngPass123', intent: 'company' })).status).toBe(403);
    expect((await ctx.http.post('/api/v1/companies').set(authHeader(candidate.accessToken)).send({ legalName: 'Blocked', commercialName: 'Blocked' })).status).toBe(403);
    expect((await ctx.http.post('/api/v1/admin/companies').set(authHeader(candidate.accessToken)).send({ legalName: 'Blocked', commercialName: 'Blocked', ownerName: 'Owner', ownerEmail: 'blocked@workspace.test' })).status).toBe(403);
    expect(await ctx.prisma.user.count({ where: { email: 'blocked@workspace.test' } })).toBe(0);
  });

  it('provisions credentials privately, sends them, forces replacement, and invalidates old tokens', async () => {
    const dto = { legalName: 'Release SARL', commercialName: 'Release Studio', ownerName: 'Release Owner', ownerEmail: 'release-owner@workspace.test' };
    const created = await ctx.http.post('/api/v1/admin/companies').set(authHeader(admin.accessToken)).send(dto);
    expect(created.status).toBe(201); expect(created.body.company.status).toBe('ACTIVE');
    expect(JSON.stringify(created.body)).not.toMatch(/passwordHash|encryptedBody/);
    const delivery = await ctx.prisma.companyAccessDelivery.findUniqueOrThrow({ where: { companyId: created.body.company.id } });
    expect(delivery.encryptedBody).not.toContain('Votre espace');
    await ctx.app.get(CompanyAccessWorker).deliver();
    const email = await waitFor(() => ConsoleEmailProvider.sentEmails.find(e => e.to === dto.ownerEmail));
    const password = email!.html.match(/<strong>([^<]+)<\/strong>/)?.[1];
    expect(password).toBeTruthy();
    const owner = await login(ctx.http, dto.ownerEmail, password!);
    const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(owner.accessToken));
    expect(me.body.mustChangePassword).toBe(true);
    expect((await ctx.http.get('/api/v1/users/me').set(authHeader(owner.accessToken))).status).toBe(403);
    const changed = await ctx.http.post('/api/v1/auth/change-password').set(authHeader(owner.accessToken)).send({ currentPassword: password, newPassword: 'MyOwnNewPassw0rd!' });
    expect(changed.status).toBe(200);
    expect((await ctx.http.get('/api/v1/auth/me').set(authHeader(owner.accessToken))).status).toBe(401);
    const newSession = await login(ctx.http, dto.ownerEmail, 'MyOwnNewPassw0rd!');
    const newMe = await ctx.http.get('/api/v1/auth/me').set(authHeader(newSession.accessToken));
    expect(newMe.body.mustChangePassword).toBe(false);
    expect(newMe.body.memberships[0].companyId).toBe(created.body.company.id);
    expect((await ctx.prisma.companyAccessDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).encryptedBody).toBeNull();
    expect((await ctx.http.post('/api/v1/admin/companies').set(authHeader(admin.accessToken)).send(dto)).status).toBe(409);
  });

  it('rejects an expired temporary password and permits recovery without revealing account existence', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'release-owner@workspace.test' } });
    await ctx.prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true, temporaryPasswordExpiresAt: new Date(Date.now() - 1000) } });
    expect((await ctx.http.post('/api/v1/auth/login').send({ email: user.email, password: 'MyOwnNewPassw0rd!' })).status).toBe(401);
    const known = await ctx.http.post('/api/v1/auth/forgot-password').send({ email: user.email });
    const unknown = await ctx.http.post('/api/v1/auth/forgot-password').send({ email: 'missing@workspace.test' });
    expect(known.body).toEqual(unknown.body);
    const email = await waitFor(() => ConsoleEmailProvider.sentEmails.find(e => e.to === user.email && e.html.includes('/reset-password?token=')));
    const token = email!.html.match(/reset-password\?token=([a-f0-9]+)/)![1];
    const reset = () => ctx.http.post('/api/v1/auth/reset-password').send({ token, newPassword: 'RecoveredPassw0rd!' });
    const results = await Promise.all([reset(), reset()]);
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    expect((await login(ctx.http, user.email, 'RecoveredPassw0rd!')).accessToken).toBeTruthy();
  });

  it('automatically fills CV fields and skills while preserving the candidate headline', async () => {
    await ctx.http.patch('/api/v1/candidates/me').set(authHeader(candidate.accessToken)).send({ headline: 'My chosen title' });
    const text = 'Jane Doe\nTitle: Python Engineer\nLocation: Tunis\n+216 20 123 456\nSummary\n5 years of experience building APIs.\nSkills: Python, SQL\nExperience\nEngineer at Atlas\nEducation\nMaster of computing';
    const upload = await ctx.http.post('/api/v1/candidates/me/resumes').set(authHeader(candidate.accessToken)).attach('file', Buffer.from(text), { filename: 'cv.txt', contentType: 'text/plain' });
    expect(upload.status).toBe(201);
    await waitFor(async () => { const r = await ctx.prisma.resume.findUniqueOrThrow({ where: { id: upload.body.id } }); return r.processingStatus === 'COMPLETED'; });
    const profile = await ctx.http.get('/api/v1/candidates/me').set(authHeader(candidate.accessToken));
    expect(profile.body).toMatchObject({ headline: 'My chosen title', location: 'Tunis', yearsExperience: 5, phone: '+216 20 123 456' });
    expect(profile.body.skills.map((s: { name: string }) => s.name).sort()).toEqual(['python', 'sql']);
  });

  it('stores and deletes a candidate photo and rejects disguised files', async () => {
    const bad = await ctx.http.post('/api/v1/candidates/me/photo').set(authHeader(candidate.accessToken)).attach('file', Buffer.from('<script>bad</script>'), { filename: 'photo.png', contentType: 'image/png' });
    expect(bad.status).toBe(400);
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#335599' } }).png().toBuffer();
    expect((await ctx.http.post('/api/v1/candidates/me/photo').set(authHeader(candidate.accessToken)).attach('file', png, { filename: 'photo.png', contentType: 'image/png' })).status).toBe(201);
    expect((await ctx.http.get('/api/v1/candidates/me/photo').set(authHeader(candidate.accessToken))).body.url).toBeTruthy();
    expect((await ctx.http.get('/api/v1/candidates/me/photo').set(authHeader(admin.accessToken))).body.url).toBeNull();
    expect((await ctx.http.delete('/api/v1/candidates/me/photo').set(authHeader(candidate.accessToken))).status).toBe(200);
    expect((await ctx.http.get('/api/v1/candidates/me/photo').set(authHeader(candidate.accessToken))).body.url).toBeNull();
  });
});
