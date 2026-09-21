import { companyFixture } from '../helpers';
import {
  authHeader,
  closeTestApp,
  createTestApp,
  createVerifiedUser,
  login,
  registerUser,
} from '../helpers';

/**
 * Critical security tests. Company A must never access Company B data;
 * candidates must never access other candidates' private data.
 */
describe('Security & multi-tenancy (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { accessToken: string };
  let companyA: { id: string; admin: { accessToken: string; userId: string } };
  let companyB: { id: string; admin: { accessToken: string; userId: string } };
  let jobA: string;
  let jobB: string;
  let candidateA: { accessToken: string; userId: string };
  let candidateB: { accessToken: string; userId: string };

  beforeAll(async () => {
    ctx = await createTestApp();

    // Admin
    await registerUser(ctx.http, 'Security Admin', 'secadmin@test.com');
    const adminLogin = await login(ctx.http, 'secadmin@test.com');
    const adminRole = await (ctx.prisma as never as { role: { findUnique: (a: object) => Promise<{ id: string } | null> } }).role.findUnique({
      where: { name: 'PLATFORM_ADMIN' },
    });
    const adminUser = await (ctx.prisma as never as { user: { findUnique: (a: object) => Promise<{ id: string } | null> } }).user.findUnique({
      where: { email: 'secadmin@test.com' },
    });
    if (adminRole && adminUser) {
      await (ctx.prisma as never as { userRole: { create: (a: object) => Promise<unknown> } }).userRole.create({
        data: { userId: adminUser.id, roleId: adminRole.id },
      });
    }
    admin = { accessToken: adminLogin.accessToken };

    // Two companies, both verified.
    companyA = { id: '', admin: await createVerifiedUser(ctx, 'Admin A', 'adminA@sec.test') };
    const ca = await companyFixture(ctx, companyA.admin.accessToken, { legalName: 'Isolation A', commercialName: 'IsolationA' });
    companyA.id = (ca.body as { id: string }).id;
    await verifyCompany(ctx, admin.accessToken, companyA.id, companyA.admin.accessToken);

    companyB = { id: '', admin: await createVerifiedUser(ctx, 'Admin B', 'adminB@sec.test') };
    const cb = await companyFixture(ctx, companyB.admin.accessToken, { legalName: 'Isolation B', commercialName: 'IsolationB' });
    companyB.id = (cb.body as { id: string }).id;
    await verifyCompany(ctx, admin.accessToken, companyB.id, companyB.admin.accessToken);

    // A published job in each company.
    jobA = await createPublishedJob(ctx, companyA.admin.accessToken, companyA.id, 'Job A Role');
    jobB = await createPublishedJob(ctx, companyB.admin.accessToken, companyB.id, 'Job B Role');

    // Two candidates with profiles + CVs.
    candidateA = await createVerifiedUser(ctx, 'Candidate A', 'candA@sec.test');
    candidateB = await createVerifiedUser(ctx, 'Candidate B', 'candB@sec.test');
    await ctx.http
      .patch('/api/v1/candidates/me')
      .set(authHeader(candidateA.accessToken))
      .send({ headline: 'Candidate A', visibility: 'RECRUITERS_ONLY' });
    await ctx.http
      .patch('/api/v1/candidates/me')
      .set(authHeader(candidateB.accessToken))
      .send({ headline: 'Candidate B', visibility: 'RECRUITERS_ONLY' });
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('company A cannot read company B applications', async () => {
    const apply = await ctx.http
      .post(`/api/v1/jobs/${jobB}/apply`)
      .set(authHeader(candidateB.accessToken))
      .send({ motivation: 'Applying to B' });
    expect(apply.status).toBe(201);

    const listA = await ctx.http
      .get(`/api/v1/companies/${companyA.id}/applications`)
      .set(authHeader(companyA.admin.accessToken));
    const itemsA = (listA.body as { items: Array<{ id: string }> }).items;

    const listB = await ctx.http
      .get(`/api/v1/companies/${companyB.id}/applications`)
      .set(authHeader(companyB.admin.accessToken));
    const itemsB = (listB.body as { items: Array<{ id: string }> }).items;

    expect(itemsA).not.toContainEqual(expect.objectContaining({ id: itemsB[0].id }));
    expect(itemsB).toHaveLength(1);
    expect(itemsA).toHaveLength(0);
  });

  it('company A cannot modify company B jobs', async () => {
    const attempt = await ctx.http
      .post(`/api/v1/jobs/${jobB}/close`)
      .set(authHeader(companyA.admin.accessToken));
    expect(attempt.status).toBe(403);

    const job = await ctx.http.get(`/api/v1/jobs/${jobB}`);
    expect((job.body as { status: string }).status).toBe('PUBLISHED');
  });

  it('company A cannot access company B candidate profiles', async () => {
    const meB = await ctx.http.get('/api/v1/candidates/me').set(authHeader(candidateB.accessToken));
    const profileBId = (meB.body as { id: string }).id;

    const attempt = await ctx.http
      .get(`/api/v1/candidates/${profileBId}`)
      .set(authHeader(companyA.admin.accessToken));
    // No application link → forbidden, even with a company membership.
    expect(attempt.status).toBe(403);
  });

  it('company cannot download a CV without an application link', async () => {
    const upload = await ctx.http
      .post('/api/v1/candidates/me/resumes')
      .set(authHeader(candidateB.accessToken))
      .attach('file', Buffer.from('Candidate B private CV'), { filename: 'cv-b.txt', contentType: 'text/plain' });
    const resumeId = (upload.body as { id: string }).id;

    const attempt = await ctx.http
      .get(`/api/v1/candidates/me/resumes/${resumeId}/download`)
      .set(authHeader(companyA.admin.accessToken));
    expect(attempt.status).toBe(403);
  });

  it('candidate B cannot see or modify candidate A applications', async () => {
    const applyA = await ctx.http
      .post(`/api/v1/jobs/${jobA}/apply`)
      .set(authHeader(candidateA.accessToken))
      .send({ motivation: 'Applying to A' });
    const appAId = (applyA.body as { id: string }).id;

    const attempt = await ctx.http
      .get(`/api/v1/applications/${appAId}`)
      .set(authHeader(candidateB.accessToken));
    expect(attempt.status).toBe(403);

    const move = await ctx.http
      .patch(`/api/v1/applications/${appAId}/status`)
      .set(authHeader(candidateB.accessToken))
      .send({ newStatus: 'WITHDRAWN' });
    expect(move.status).toBe(403);
  });

  it('candidate A cannot see candidate B private profile data', async () => {
    const meB = await ctx.http.get('/api/v1/candidates/me').set(authHeader(candidateB.accessToken));
    const profileBId = (meB.body as { id: string }).id;

    // Candidate A has no company membership → cannot view B's profile.
    const attempt = await ctx.http
      .get(`/api/v1/candidates/${profileBId}`)
      .set(authHeader(candidateA.accessToken));
    expect(attempt.status).toBe(403);
  });

  it('a candidate cannot access admin endpoints', async () => {
    const attempts = [
      await ctx.http.get('/api/v1/admin/analytics').set(authHeader(candidateA.accessToken)),
      await ctx.http.get('/api/v1/admin/users').set(authHeader(candidateA.accessToken)),
      await ctx.http.get('/api/v1/admin/audit-logs').set(authHeader(candidateA.accessToken)),
    ];
    for (const attempt of attempts) {
      expect(attempt.status).toBe(403);
    }
  });

  it('an HR member cannot perform Company Admin actions (e.g. delete jobs)', async () => {
    const hr = await createVerifiedUser(ctx, 'HR Security', 'hrsec@sec.test');
    // Invite + accept HR into company A.
    const invite = await ctx.http
      .post(`/api/v1/companies/${companyA.id}/invitations`)
      .set(authHeader(companyA.admin.accessToken))
      .send({ email: 'hrsec@sec.test', role: 'HR' });
    const invitationUrl = (invite.body as { invitationUrl: string }).invitationUrl;
    const token = new URL(`http://x/${invitationUrl}`).searchParams.get('token')!;
    await ctx.http.post('/api/v1/company-invitations/accept').set(authHeader(hr.accessToken)).send({ token });

    const draftJob = await ctx.http
      .post('/api/v1/jobs')
      .set(authHeader(hr.accessToken))
      .send({
        title: 'HR Draft Job',
        description: 'A job created by HR with a sufficiently long description for validation.',
        employmentType: 'FULL_TIME',
        experienceLevel: 'MID',
      });
    expect(draftJob.status).toBe(201);
    const draftId = (draftJob.body as { id: string }).id;

    // HR can create jobs (job.create) but cannot delete them (job.delete).
    const del = await ctx.http.delete(`/api/v1/jobs/${draftId}`).set(authHeader(hr.accessToken));
    expect(del.status).toBe(403);

    // Company Admin can delete (no applications yet).
    const delByAdmin = await ctx.http.delete(`/api/v1/jobs/${draftId}`).set(authHeader(companyA.admin.accessToken));
    expect(delByAdmin.status).toBe(200);
  });

  it('company admin cannot impersonate another tenant via query/body params', async () => {
    // Attempt to create a job in company B while authenticated as company A.
    const attempt = await ctx.http
      .post('/api/v1/jobs')
      .set(authHeader(companyA.admin.accessToken))
      .set('X-Company-Id', companyB.id)
      .send({
        title: 'Sneaky Job',
        description: 'Attempting to create a job in another tenant via header spoofing with a long enough description.',
        employmentType: 'FULL_TIME',
        experienceLevel: 'MID',
      });
    expect(attempt.status).toBe(403);
  });

  it('suspended users lose access', async () => {
    const meB = await ctx.http.get('/api/v1/auth/me').set(authHeader(candidateB.accessToken));
    const targetId = (meB.body as { id: string }).id;

    const suspend = await ctx.http
      .patch(`/api/v1/admin/users/${targetId}`)
      .set(authHeader(admin.accessToken))
      .send({ status: 'SUSPENDED' });
    expect(suspend.status).toBe(200);

    // Existing tokens stop working immediately.
    const me = await ctx.http.get('/api/v1/auth/me').set(authHeader(candidateB.accessToken));
    expect(me.status).toBe(401);

    // Reinstate for other tests that reuse candidate B.
    await ctx.http.patch(`/api/v1/admin/users/${targetId}`).set(authHeader(admin.accessToken)).send({ status: 'ACTIVE' });
  });

  it('an anonymous caller cannot reach protected data', async () => {
    const responses = [
      await ctx.http.get('/api/v1/applications/me'),
      await ctx.http.get(`/api/v1/companies/${companyA.id}/applications`),
      await ctx.http.get('/api/v1/admin/users'),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });

  it('admin can list and manage users', async () => {
    const users = await ctx.http.get('/api/v1/admin/users').set(authHeader(admin.accessToken));
    expect(users.status).toBe(200);
    expect((users.body as { total: number }).total).toBeGreaterThanOrEqual(6);
  });
});

async function verifyCompany(
  ctx: Awaited<ReturnType<typeof createTestApp>>,
  adminToken: string,
  companyId: string,
  companyAdminToken: string,
): Promise<void> {
  await ctx.http
    .post(`/api/v1/companies/${companyId}/verification/documents`)
    .set(authHeader(companyAdminToken))
    .attach('file', Buffer.from('%PDF-1.4\nverification doc'), { filename: 'doc.pdf', contentType: 'application/pdf' });
  await ctx.http.post(`/api/v1/companies/${companyId}/verification/submit`).set(authHeader(companyAdminToken));

  const verifications = await ctx.http.get('/api/v1/admin/verifications').set(authHeader(adminToken));
  const pending = (verifications.body as { items: Array<{ id: string; companyId: string }> }).items.find(
    (v) => v.companyId === companyId,
  );
  await ctx.http.post(`/api/v1/admin/verifications/${pending!.id}/approve`).set(authHeader(adminToken));
}

async function createPublishedJob(
  ctx: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
  companyId: string,
  title: string,
): Promise<string> {
  const created = await ctx.http
    .post('/api/v1/jobs')
    .set(authHeader(token))
    .send({
      title,
      description: `${title} — a sufficiently long description for the published job used in security tests.`,
      employmentType: 'FULL_TIME',
      experienceLevel: 'MID',
      location: 'Remote',
      remote: true,
    });
  const jobId = (created.body as { id: string }).id;
  await ctx.http.post(`/api/v1/jobs/${jobId}/submit`).set(authHeader(token));
  const adminLogin = await login(ctx.http, 'secadmin@test.com');
  const adminToken = adminLogin.accessToken;
  await ctx.http.post(`/api/v1/admin/jobs/${jobId}/approve`).set(authHeader(adminToken));
  await ctx.http.post(`/api/v1/jobs/${jobId}/publish`).set(authHeader(token));
  return jobId;
}
