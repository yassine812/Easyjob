import { companyFixture } from '../helpers';
import { authHeader, closeTestApp, createTestApp, createVerifiedUser } from '../helpers';

describe('EasyJob recruitment workflow (isolated database)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let hr: Awaited<ReturnType<typeof createVerifiedUser>>;
  let otherHr: Awaited<ReturnType<typeof createVerifiedUser>>;
  let candidate: Awaited<ReturnType<typeof createVerifiedUser>>;
  let otherCandidate: Awaited<ReturnType<typeof createVerifiedUser>>;
  let companyId: string, jobId: string, applicationId: string;
  beforeAll(async () => {
    ctx = await createTestApp();
    hr = await createVerifiedUser(ctx, 'Recruiter One', 'recruiter-one@product.test');
    otherHr = await createVerifiedUser(ctx, 'Recruiter Two', 'recruiter-two@product.test');
    candidate = await createVerifiedUser(ctx, 'Candidate One', 'candidate-one@product.test');
    otherCandidate = await createVerifiedUser(ctx, 'Candidate Two', 'candidate-two@product.test');
    const company = await companyFixture(ctx, hr.accessToken, { legalName: 'Product Test Company', commercialName: 'Product Test Company' });
    expect(company.status).toBe(201); companyId = company.body.id;
    await ctx.prisma.company.update({ where: { id: companyId }, data: { status: 'ACTIVE', verification: { update: { status: 'VERIFIED' } } } });
    const job = await ctx.http.post('/api/v1/jobs').set(authHeader(hr.accessToken)).set('X-Company-Id', companyId).send({ title: 'Python Developer', description: 'Build reliable Python APIs with our engineering team.', domain: 'Software', skills: [{ name: 'Python', required: true }], employmentType: 'FULL_TIME', contractType: 'CDI', languages: ['French'], experienceLevel: 'MID', workMode: 'REMOTE', location: 'France', salaryMin: 40000, salaryMax: 60000, currency: 'EUR' });
    expect(job.status).toBe(201); jobId = job.body.id;
    await ctx.prisma.job.update({ where: { id: jobId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const apply = await ctx.http.post(`/api/v1/jobs/${jobId}/apply`).set(authHeader(candidate.accessToken)).send({ motivation: 'I would like to discuss this role.' });
    expect(apply.status).toBe(201); applicationId = apply.body.id;
  });
  afterAll(async () => { if (ctx) await closeTestApp(ctx); });

  it('returns real per-job counts and isolates company summaries', async () => {
    const response = await ctx.http.get(`/api/v1/companies/${companyId}/application-jobs`).set(authHeader(hr.accessToken));
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([expect.objectContaining({ id: jobId, applications: 1, newApplications: 1, strongMatches: 0 })]);
    const forbidden = await ctx.http.get(`/api/v1/companies/${companyId}/application-jobs`).set(authHeader(otherHr.accessToken));
    expect(forbidden.status).toBe(403);
  });
  it('persists saved jobs for the owner only and distinguishes applied jobs', async () => {
    const save = await ctx.http.post('/api/v1/candidates/me/saved-jobs').set(authHeader(candidate.accessToken)).send({ jobId });
    expect(save.status).toBe(201);
    const own = await ctx.http.get('/api/v1/candidates/me/saved-jobs').set(authHeader(candidate.accessToken));
    expect(own.body).toEqual([expect.objectContaining({ jobId, applied: true })]);
    const other = await ctx.http.get('/api/v1/candidates/me/saved-jobs').set(authHeader(otherCandidate.accessToken));
    expect(other.body).toEqual([]);
  });
  it('filters job discovery by company and publication date', async () => {
    const response = await ctx.http.get(`/api/v1/career/jobs?companyId=${companyId}&publishedWithin=1&contractType=CDI`).set(authHeader(candidate.accessToken));
    expect(response.status).toBe(200); expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ id: jobId, isSaved: true, contractType: 'CDI', languages: ['French'] });
    const absent = await ctx.http.get('/api/v1/career/jobs?contractType=CDD').set(authHeader(candidate.accessToken));
    expect(absent.body.items).toEqual([]);
  });
  it('persists exact preferences and blocks premium activation without entitlement', async () => {
    const response = await ctx.http.patch('/api/v1/career/settings').set(authHeader(candidate.accessToken)).send({ minimumSalary: 45000, salaryCurrency: 'EUR', employmentTypes: ['FULL_TIME'], excludedJobs: [jobId], autoMinimumScore: 85 });
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ minimumSalary: 45000, autoMinimumScore: 85, excludedJobs: [jobId] });
    const forbidden = await ctx.http.patch('/api/v1/career/settings').set(authHeader(candidate.accessToken)).send({ autoApply: true, consent: true });
    expect(forbidden.status).toBe(403);
  });
  it('records a human stage change without leaking internal notes to the candidate', async () => {
    const response = await ctx.http.patch(`/api/v1/applications/${applicationId}/status`).set(authHeader(hr.accessToken)).send({ newStatus: 'SCREENING', note: 'Private recruiter discussion', source: 'HR' });
    expect(response.status).toBe(200);
    const notes = await ctx.http.get(`/api/v1/applications/${applicationId}/notes`).set(authHeader(candidate.accessToken));
    expect(notes.status).toBe(403);
    const events = await ctx.http.get(`/api/v1/applications/${applicationId}/events`).set(authHeader(candidate.accessToken));
    expect(events.status).toBe(200); expect(JSON.stringify(events.body)).not.toContain('Private recruiter discussion');
    const other = await ctx.http.get(`/api/v1/applications/${applicationId}`).set(authHeader(otherCandidate.accessToken));
    expect(other.status).toBe(403);
  });
  it('requires human review for rejection and leaves status unchanged on failure', async () => {
    const response = await ctx.http.patch(`/api/v1/applications/${applicationId}/status`).set(authHeader(hr.accessToken)).send({ newStatus: 'REJECTED', source: 'AI' });
    expect(response.status).toBe(400);
    expect((await ctx.prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).status).toBe('SCREENING');
  });
  it('duplicates into a new draft and hides paused jobs from public search', async () => {
    const duplicate = await ctx.http.post(`/api/v1/jobs/${jobId}/duplicate`).set(authHeader(hr.accessToken));
    expect(duplicate.status).toBe(201); expect(duplicate.body).toMatchObject({ status: 'DRAFT', title: 'Python Developer' });
    expect(duplicate.body.id).not.toBe(jobId);
    const owned = await ctx.http.get(`/api/v1/jobs/managed/${duplicate.body.id}`).set(authHeader(hr.accessToken));
    expect(owned.status).toBe(200);
    const foreign = await ctx.http.get(`/api/v1/jobs/managed/${duplicate.body.id}`).set(authHeader(otherHr.accessToken));
    expect(foreign.status).toBe(404);
    const paused = await ctx.http.post(`/api/v1/jobs/${jobId}/pause`).set(authHeader(hr.accessToken));
    expect(paused.status).toBe(201);
    const publicJob = await ctx.http.get(`/api/v1/jobs/${jobId}`); expect(publicJob.status).toBe(404);
    const search = await ctx.http.get('/api/v1/career/jobs').set(authHeader(candidate.accessToken)); expect(search.body.items).toEqual([]);
  });
});
