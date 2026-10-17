import { companyFixture } from '../helpers';
import {
  authHeader,
  closeTestApp,
  createTestApp,
  createVerifiedUser,
  login,
  registerUser,
  waitFor,
  waitForNotification,
} from '../helpers';

describe('Full recruitment flow (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { accessToken: string; userId: string };
  let candidate: { accessToken: string; userId: string };
  let companyAdmin: { accessToken: string; userId: string };
  let companyId: string;
  let jobId: string;
  let applicationId: string;
  let resumeId: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Platform admin: register via API then promote via database.
    await registerUser(ctx.http, 'Platform Admin', 'platformadmin@test.com');
    const adminLogin = await login(ctx.http, 'platformadmin@test.com');
    const adminRole = await (ctx.prisma as never as { role: { findUnique: (a: object) => Promise<{ id: string } | null> } }).role.findUnique({
      where: { name: 'PLATFORM_ADMIN' },
    });
    const adminUser = await (ctx.prisma as never as { user: { findUnique: (a: object) => Promise<{ id: string } | null> } }).user.findUnique({
      where: { email: 'platformadmin@test.com' },
    });
    if (adminRole && adminUser) {
      await (ctx.prisma as never as { userRole: { create: (a: object) => Promise<unknown> } }).userRole.create({
        data: { userId: adminUser.id, roleId: adminRole.id },
      });
    }
    admin = { accessToken: adminLogin.accessToken, userId: adminUser!.id };

    candidate = await createVerifiedUser(ctx, 'Cara Candidate', 'cara@flow.test');
    companyAdmin = await createVerifiedUser(ctx, 'Ali Admin', 'ali@flow.test');
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('1. candidate creates a profile with skills, experience and education', async () => {
    const patch = await ctx.http
      .patch('/api/v1/candidates/me')
      .set(authHeader(candidate.accessToken))
      .send({
        headline: 'Senior Backend Engineer',
        bio: 'Backend engineer with 6 years of experience.',
        location: 'Tunis, Tunisia',
        yearsExperience: 6,
        visibility: 'RECRUITERS_ONLY',
        remotePreference: true,
      });
    expect(patch.status).toBe(200);

    const skill = await ctx.http
      .post('/api/v1/candidates/me/skills')
      .set(authHeader(candidate.accessToken))
      .send({ name: 'TypeScript', level: 'ADVANCED' });
    expect(skill.status).toBe(201);

    await ctx.http
      .post('/api/v1/candidates/me/skills')
      .set(authHeader(candidate.accessToken))
      .send({ name: 'Node.js', level: 'ADVANCED' });

    const exp = await ctx.http
      .post('/api/v1/candidates/me/experiences')
      .set(authHeader(candidate.accessToken))
      .send({
        companyName: 'Fictional Co',
        title: 'Senior Engineer',
        description: 'Built APIs.',
        startDate: '2020-01-01',
        current: true,
      });
    expect(exp.status).toBe(201);

    const edu = await ctx.http
      .post('/api/v1/candidates/me/education')
      .set(authHeader(candidate.accessToken))
      .send({ institution: 'Test University', degree: "Bachelor's", field: 'CS', startDate: '2014-09-01' });
    expect(edu.status).toBe(201);

    const me = await ctx.http.get('/api/v1/candidates/me').set(authHeader(candidate.accessToken));
    expect(me.status).toBe(200);
    const body = me.body as { skills: unknown[]; experiences: unknown[]; educations: unknown[] };
    expect(body.skills.length).toBe(2);
    expect(body.experiences.length).toBe(1);
    expect(body.educations.length).toBe(1);
  });

  it('2. candidate uploads a CV (primary, auto-processed)', async () => {
    const upload = await ctx.http
      .post('/api/v1/candidates/me/resumes')
      .set(authHeader(candidate.accessToken))
      .attach('file', Buffer.from('Cara Candidate CV with TypeScript and Node.js experience'), {
        filename: 'cv.txt',
        contentType: 'text/plain',
      });
    expect(upload.status).toBe(201);
    resumeId = (upload.body as { id: string }).id;

    await waitFor(
      async () => {
        const resumes = await ctx.http.get('/api/v1/candidates/me/resumes').set(authHeader(candidate.accessToken));
        const row = (resumes.body as Array<{ id: string; processingStatus: string; isPrimary: boolean }>)[0];
        return row?.processingStatus === 'COMPLETED' ? row : undefined;
      },
      { description: 'CV text extraction to complete' },
    );

    const resumes = await ctx.http.get('/api/v1/candidates/me/resumes').set(authHeader(candidate.accessToken));
    const row = (resumes.body as Array<{ isPrimary: boolean; processingStatus: string }>)[0];
    expect(row.isPrimary).toBe(true);
    expect(row.processingStatus).toBe('COMPLETED');
  });

  it('3. company admin creates a company (onboarding) and submits verification documents', async () => {
    const create = await companyFixture(ctx, companyAdmin.accessToken, {
        legalName: 'Tenant One SARL',
        commercialName: 'TenantOne',
        website: 'https://tenantone.example.com',
        industry: 'SaaS',
        city: 'Tunis',
        country: 'TN',
        professionalEmail: 'contact@tenantone.example.com',
      });
    expect(create.status).toBe(201);
    companyId = (create.body as { id: string }).id;
    expect((create.body as { status: string }).status).toBe('PENDING_VERIFICATION');

    const doc = await ctx.http
      .post(`/api/v1/companies/${companyId}/verification/documents`)
      .set(authHeader(companyAdmin.accessToken))
      .attach('file', Buffer.from('%PDF-1.4\nfictional registration document'), {
        filename: 'registration.pdf',
        contentType: 'application/pdf',
      });
    expect(doc.status).toBe(201);

    const submit = await ctx.http
      .post(`/api/v1/companies/${companyId}/verification/submit`)
      .set(authHeader(companyAdmin.accessToken));
    expect(submit.status).toBe(201);
    expect((submit.body as { status: string }).status).toBe('UNDER_REVIEW');

    // This legacy tenant fixture tests document review. New company access
    // delivery is exercised through the real administrator API in provisioning.e2e.
  });

  it('4. admin reviews and approves the company verification', async () => {
    const verifications = await ctx.http
      .get('/api/v1/admin/verifications')
      .set(authHeader(admin.accessToken));
    expect(verifications.status).toBe(200);
    const pending = (verifications.body as { items: Array<{ id: string; status: string; companyId: string }> }).items.find(
      (v) => v.companyId === companyId && v.status === 'UNDER_REVIEW',
    );
    expect(pending).toBeDefined();

    const approve = await ctx.http
      .post(`/api/v1/admin/verifications/${pending!.id}/approve`)
      .set(authHeader(admin.accessToken));
    expect(approve.status).toBe(201);
    expect((approve.body as { status: string }).status).toBe('VERIFIED');

    const company = await ctx.http.get(`/api/v1/companies/${companyId}`);
    expect((company.body as { status: string }).status).toBe('ACTIVE');

    await waitForNotification(ctx, companyAdmin.userId, 'company.verified');
  });

  it('5. company creates a job, submits for approval, admin approves, company publishes', async () => {
    const createJob = await ctx.http
      .post('/api/v1/jobs')
      .set(authHeader(companyAdmin.accessToken))
      .send({
        title: 'Senior Backend Engineer',
        description: 'We are hiring a senior backend engineer to build our platform. This is a test job description with enough length.',
        responsibilities: ['Build APIs', 'Lead projects'],
        requirements: ['TypeScript', 'Node.js'],
        location: 'Tunis',
        remote: true,
        employmentType: 'FULL_TIME',
        experienceLevel: 'SENIOR',
        salaryMin: 60000,
        salaryMax: 90000,
        currency: 'USD',
        skills: [{ name: 'TypeScript', required: true }, { name: 'Node.js', required: true }],
      });
    expect(createJob.status).toBe(201);
    jobId = (createJob.body as { id: string }).id;
    expect((createJob.body as { status: string }).status).toBe('DRAFT');

    const submit = await ctx.http.post(`/api/v1/jobs/${jobId}/submit`).set(authHeader(companyAdmin.accessToken));
    expect((submit.body as { status: string }).status).toBe('PENDING_APPROVAL');

    const approve = await ctx.http.post(`/api/v1/admin/jobs/${jobId}/approve`).set(authHeader(admin.accessToken));
    expect((approve.body as { status: string }).status).toBe('APPROVED');

    const publish = await ctx.http.post(`/api/v1/jobs/${jobId}/publish`).set(authHeader(companyAdmin.accessToken));
    expect((publish.body as { status: string }).status).toBe('PUBLISHED');
  });

  it('6. candidate finds the job via search and saves it', async () => {
    const search = await ctx.http.get('/api/v1/jobs?keyword=backend&location=Tunis&remote=true');
    expect(search.status).toBe(200);
    const found = (search.body as { items: Array<{ id: string }> }).items.find((j) => j.id === jobId);
    expect(found).toBeDefined();

    const save = await ctx.http
      .post('/api/v1/candidates/me/saved-jobs')
      .set(authHeader(candidate.accessToken))
      .send({ jobId });
    expect(save.status).toBe(201);

    const saved = await ctx.http.get('/api/v1/candidates/me/saved-jobs').set(authHeader(candidate.accessToken));
    expect((saved.body as unknown[]).length).toBe(1);
  });

  it('7. candidate applies to the published job with a CV', async () => {
    const apply = await ctx.http
      .post(`/api/v1/jobs/${jobId}/apply`)
      .set(authHeader(candidate.accessToken))
      .send({ resumeId, motivation: 'I am very interested in this role.' });
    expect(apply.status).toBe(201);
    applicationId = (apply.body as { id: string }).id;

    // Duplicate applications are rejected.
    const again = await ctx.http
      .post(`/api/v1/jobs/${jobId}/apply`)
      .set(authHeader(candidate.accessToken))
      .send({ resumeId });
    expect(again.status).toBe(400);
  });

  it('8. company receives the application and the company admin is notified', async () => {
    const list = await ctx.http
      .get(`/api/v1/companies/${companyId}/applications`)
      .set(authHeader(companyAdmin.accessToken));
    expect(list.status).toBe(200);
    const items = (list.body as { items: Array<{ id: string }> }).items;
    expect(items.map((i) => i.id)).toContain(applicationId);

    await waitForNotification(ctx, companyAdmin.userId, 'candidate.applied');
  });

  it('9. company views the candidate profile and downloads the CV (audit-logged)', async () => {
    const applications = await ctx.http
      .get(`/api/v1/companies/${companyId}/applications`)
      .set(authHeader(companyAdmin.accessToken));
    const app = (applications.body as { items: Array<{ candidate: { id: string }; resume: { id: string } | null }> }).items.find(
      (a) => a.resume?.id === resumeId,
    );
    expect(app).toBeDefined();

    const profile = await ctx.http
      .get(`/api/v1/candidates/${app!.candidate.id}`)
      .set(authHeader(companyAdmin.accessToken));
    expect(profile.status).toBe(200);

    const cv = await ctx.http
      .get(`/api/v1/applications/${applicationId}/cv`)
      .set(authHeader(companyAdmin.accessToken));
    expect(cv.status).toBe(200);
    expect((cv.body as { url: string }).url).toContain('signed');
  });

  it('10. recruiter moves the candidate through the pipeline (with history)', async () => {
    for (const status of ['SCREENING', 'SHORTLISTED', 'INTERVIEW']) {
      const move = await ctx.http
        .patch(`/api/v1/applications/${applicationId}/status`)
        .set(authHeader(companyAdmin.accessToken))
        .send({ newStatus: status, note: `Moved to ${status}` });
      expect(move.status).toBe(200);
      expect((move.body as { status: string }).status).toBe(status);
    }

    // Backwards moves are forbidden.
    const backward = await ctx.http
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set(authHeader(companyAdmin.accessToken))
      .send({ newStatus: 'APPLIED' });
    expect(backward.status).toBe(400);

    // Full history is recorded.
    const events = await ctx.http
      .get(`/api/v1/applications/${applicationId}/events`)
      .set(authHeader(companyAdmin.accessToken));
    const statuses = (events.body as Array<{ newStatus: string }>).map((e) => e.newStatus);
    expect(statuses).toEqual(expect.arrayContaining(['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW']));

    // Notes are recorded.
    const note = await ctx.http
      .post(`/api/v1/applications/${applicationId}/notes`)
      .set(authHeader(companyAdmin.accessToken))
      .send({ content: 'Strong candidate, moving forward.' });
    expect(note.status).toBe(201);
  });

  it('11. candidate receives a status-change notification and sees the new status', async () => {
    await waitForNotification(ctx, candidate.userId, 'application.status_changed');

    const mine = await ctx.http.get('/api/v1/applications/me').set(authHeader(candidate.accessToken));
    const app = (mine.body as { items: Array<{ id: string; status: string }> }).items.find((a) => a.id === applicationId);
    expect(app?.status).toBe('INTERVIEW');
  });

  it('12. company schedules an interview; candidate is notified', async () => {
    const interview = await ctx.http
      .post('/api/v1/interviews')
      .set(authHeader(companyAdmin.accessToken))
      .send({
        applicationId,
        startAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        endAt: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString(),
        type: 'VIDEO',
        location: 'https://meet.example.com/flow',
        notes: 'Technical interview',
      });
    expect(interview.status).toBe(201);

    await waitForNotification(ctx, candidate.userId, 'interview.scheduled');

    const candidateInterviews = await ctx.http
      .get(`/api/v1/interviews/applications/${applicationId}`)
      .set(authHeader(candidate.accessToken));
    expect((candidateInterviews.body as unknown[]).length).toBe(1);
  });

  it('13. company invites an HR member who accepts and gains access', async () => {
    const invite = await ctx.http
      .post(`/api/v1/companies/${companyId}/invitations`)
      .set(authHeader(companyAdmin.accessToken))
      .send({ email: 'hr@tenantone.example.com', role: 'HR' });
    expect(invite.status).toBe(201);
    const invitationUrl = (invite.body as { invitationUrl?: string }).invitationUrl;
    expect(invitationUrl).toBeDefined();
    const token = new URL(`http://x/${invitationUrl}`).searchParams.get('token')!;

    const hr = await createVerifiedUser(ctx, 'Helen HR', 'hr@tenantone.example.com');

    const accept = await ctx.http
      .post('/api/v1/company-invitations/accept')
      .set(authHeader(hr.accessToken))
      .send({ token });
    expect(accept.status).toBe(201);
    expect((accept.body as { role: string }).role).toBe('HR');

    // HR can now view the company's applications.
    const list = await ctx.http
      .get(`/api/v1/companies/${companyId}/applications`)
      .set(authHeader(hr.accessToken));
    expect(list.status).toBe(200);
  });

  it('14. analytics reflect the company activity', async () => {
    const metrics = await ctx.http
      .get(`/api/v1/analytics/company/${companyId}`)
      .set(authHeader(companyAdmin.accessToken));
    expect(metrics.status).toBe(200);
    const body = metrics.body as { activeJobs: number; totalApplications: number; hireRate: number };
    expect(body.activeJobs).toBeGreaterThanOrEqual(1);
    expect(body.totalApplications).toBeGreaterThanOrEqual(1);
    expect(typeof body.hireRate).toBe('number');
  });

  it('15. audit log records the application pipeline activity', async () => {
    const logs = await ctx.http
      .get('/api/v1/admin/audit-logs?action=application.status_changed')
      .set(authHeader(admin.accessToken));
    expect(logs.status).toBe(200);
    const items = (logs.body as { items: unknown[] }).items;
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('16. admin platform analytics are available', async () => {
    const platform = await ctx.http
      .get('/api/v1/admin/analytics')
      .set(authHeader(admin.accessToken));
    expect(platform.status).toBe(200);
    const body = platform.body as { users: number; companies: number; applications: number };
    expect(body.users).toBeGreaterThanOrEqual(4);
    expect(body.companies).toBeGreaterThanOrEqual(1);
    expect(body.applications).toBeGreaterThanOrEqual(1);
  });

  it('17. candidate can withdraw their own application', async () => {
    const withdraw = await ctx.http
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set(authHeader(candidate.accessToken))
      .send({ newStatus: 'WITHDRAWN' });
    expect(withdraw.status).toBe(200);
    expect((withdraw.body as { status: string }).status).toBe('WITHDRAWN');
  });
});
