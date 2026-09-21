import { companyFixture } from '../helpers';
import { authHeader, closeTestApp, createTestApp, createVerifiedUser } from '../helpers';

describe('Company workspace lifecycle (isolated database)', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let owner: Awaited<ReturnType<typeof createVerifiedUser>>, interviewer: typeof owner, manager: typeof owner, candidate: typeof owner, stranger: typeof owner;
  let companyId: string, jobId: string, applicationId: string, interviewerId: string, managerId: string, interviewId: string, otherInterviewId: string;
  const root = () => `/api/v1/companies/${companyId}/workspace`;
  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await createVerifiedUser(ctx, 'Workspace Owner', 'owner@workspace.test');
    interviewer = await createVerifiedUser(ctx, 'Workspace Interviewer', 'interviewer@workspace.test');
    manager = await createVerifiedUser(ctx, 'Workspace Manager', 'manager@workspace.test');
    candidate = await createVerifiedUser(ctx, 'Workspace Candidate', 'candidate@workspace.test');
    stranger = await createVerifiedUser(ctx, 'Workspace Stranger', 'stranger@workspace.test');
    const company = await companyFixture(ctx, owner.accessToken, { legalName: 'Workspace Company', commercialName: 'Workspace Company' });
    expect(company.status).toBe(201); companyId = company.body.id;
    await ctx.prisma.company.update({ where: { id: companyId }, data: { status: 'ACTIVE', verification: { update: { status: 'VERIFIED' } } } });
    const findUser = (email: string) => ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    const interviewerUser = await findUser('interviewer@workspace.test'), managerUser = await findUser('manager@workspace.test');
    interviewerId = (await ctx.prisma.companyMember.create({ data: { companyId, userId: interviewerUser.id, role: 'INTERVIEWER', status: 'ACTIVE' } })).id;
    managerId = (await ctx.prisma.companyMember.create({ data: { companyId, userId: managerUser.id, role: 'HIRING_MANAGER', status: 'ACTIVE' } })).id;
    const job = await ctx.http.post('/api/v1/jobs').set(authHeader(owner.accessToken)).set('X-Company-Id', companyId).send({ title: 'API Engineer', description: 'Build and maintain reliable APIs for our customers.', department: 'Engineering', benefits: ['Flexible hours'], preferredLanguages: ['French'], positions: 2, employmentType: 'FULL_TIME', experienceLevel: 'MID' });
    expect(job.status).toBe(201); jobId = job.body.id;
    expect(job.body).toMatchObject({ department: 'Engineering', benefits: ['Flexible hours'], positions: 2 });
    await ctx.prisma.job.update({ where: { id: jobId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const application = await ctx.http.post(`/api/v1/jobs/${jobId}/apply`).set(authHeader(candidate.accessToken)).send({});
    expect(application.status).toBe(201); applicationId = application.body.id;
  });
  afterAll(async () => { if (ctx) await closeTestApp(ctx); });
  it('exposes public company details without private registration and contact data', async () => {
    const response = await ctx.http.get(`/api/v1/companies/${companyId}`);
    expect(response.status).toBe(200); expect(response.body).not.toHaveProperty('professionalEmail'); expect(response.body).not.toHaveProperty('registrationIdentifier'); expect(response.body).not.toHaveProperty('members');
  });
  it('persists onboarding preferences and rejects overlapping thresholds', async () => {
    const settings = { domains: ['Software'], positions: ['Engineer'], locations: ['Tunis'], languages: ['French'], workModes: ['HYBRID'], hiringVolume: 3, thresholds: { excellent: 90, strong: 80, good: 70, potential: 55 }, completeOnboarding: true };
    const response = await ctx.http.patch(`${root()}/settings`).set(authHeader(owner.accessToken)).send(settings);
    expect(response.status).toBe(200); expect(response.body.onboardingCompletedAt).toBeTruthy();
    const invalid = await ctx.http.patch(`${root()}/settings`).set(authHeader(owner.accessToken)).send({ ...settings, thresholds: { ...settings.thresholds, strong: 90 } }); expect(invalid.status).toBe(400);
    expect((await ctx.http.get(`${root()}/settings`).set(authHeader(stranger.accessToken))).status).toBe(403);
  });
  it('hides an unassigned job from managers and reveals only after assignment', async () => {
    const before = await ctx.http.get(`/api/v1/companies/${companyId}/applications`).set(authHeader(manager.accessToken));
    expect(before.status).toBe(200); expect(before.body.total).toBe(0);
    const response = await ctx.http.patch(`${root()}/jobs/${jobId}/assignments`).set(authHeader(owner.accessToken)).send({ memberIds: [managerId] }); expect(response.status).toBe(200);
    const after = await ctx.http.get(`${root()}/overview`).set(authHeader(manager.accessToken)); expect(after.status).toBe(200); expect(after.body.totalApplications).toBe(1);
    const forbidden = await ctx.http.patch(`${root()}/jobs/${jobId}/assignments`).set(authHeader(manager.accessToken)).send({ memberIds: [] }); expect(forbidden.status).toBe(403);
  });
  it('distinguishes under review from shortlisted and records the human decision', async () => {
    const response = await ctx.http.patch(`/api/v1/applications/${applicationId}/status`).set(authHeader(owner.accessToken)).send({ newStatus: 'UNDER_REVIEW', source: 'HR' });
    expect(response.status).toBe(200);
    const overview = await ctx.http.get(`${root()}/overview`).set(authHeader(owner.accessToken));
    expect(overview.body.stages.UNDER_REVIEW).toBe(1); expect(overview.body.stages.SHORTLISTED ?? 0).toBe(0);
  });
  it('schedules real interviews and prevents access to another interview on the same job', async () => {
    const startAt = new Date(Date.now() + 3 * 86400000).toISOString(), endAt = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString();
    const one = await ctx.http.post('/api/v1/interviews').set(authHeader(owner.accessToken)).send({ applicationId, type: 'TECHNICAL', startAt, endAt, memberIds: [interviewerId], notes: 'Internal evaluation context' });
    expect(one.status).toBe(201); interviewId = one.body.id;
    const two = await ctx.http.post('/api/v1/interviews').set(authHeader(owner.accessToken)).send({ applicationId, type: 'HR', startAt, endAt });
    expect(two.status).toBe(201); otherInterviewId = two.body.id;
    const own = await ctx.http.get(`/api/v1/interviews/${interviewId}`).set(authHeader(interviewer.accessToken)); expect(own.status).toBe(200);
    expect((await ctx.http.get(`/api/v1/interviews/${otherInterviewId}`).set(authHeader(interviewer.accessToken))).status).toBe(403);
    const list = await ctx.http.get(`${root()}/interviews`).set(authHeader(interviewer.accessToken)); expect(list.status).toBe(200); expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([interviewId]);
    const candidateView = await ctx.http.get(`/api/v1/interviews/${interviewId}`).set(authHeader(candidate.accessToken)); expect(candidateView.status).toBe(200); expect(candidateView.body).not.toHaveProperty('notes'); expect(candidateView.body).not.toHaveProperty('aiReport');
  });
  it('stores structured feedback only from authorized participants', async () => {
    const feedback = { technical: 85, communication: 80, problemSolving: 90, roleKnowledge: 80, summary: 'Explained the API design with examples.' };
    expect((await ctx.http.post(`${root()}/interviews/${otherInterviewId}/feedback`).set(authHeader(interviewer.accessToken)).send(feedback)).status).toBe(403);
    const response = await ctx.http.post(`${root()}/interviews/${interviewId}/feedback`).set(authHeader(interviewer.accessToken)).send(feedback); expect(response.status).toBe(201); expect(response.body.technical).toBe(85);
  });
  it('deduplicates reviewed candidate messages using the request id', async () => {
    const message = { name: 'Follow up', subject: 'Next step', body: 'Please confirm your availability.', channel: 'IN_APP', requestId: 'workspace-one' };
    const first = await ctx.http.post(`${root()}/applications/${applicationId}/messages`).set(authHeader(owner.accessToken)).send(message);
    const second = await ctx.http.post(`${root()}/applications/${applicationId}/messages`).set(authHeader(owner.accessToken)).send(message);
    expect(first.status).toBe(201); expect(second.body.id).toBe(first.body.id);
    expect(await ctx.prisma.candidateCommunication.count({ where: { applicationId } })).toBe(1);
  });
  it('keeps draft offers private and records acceptance as an HR-approved hire', async () => {
    const offer = await ctx.http.post(`${root()}/applications/${applicationId}/offers`).set(authHeader(owner.accessToken)).send({ title: 'API Engineer offer', terms: 'Full-time role. Terms reviewed by the recruiter.' }); expect(offer.status).toBe(201);
    const id = offer.body.id;
    expect((await ctx.http.get(`/api/v1/recruitment-offers/${id}`).set(authHeader(candidate.accessToken))).status).toBe(404);
    const sent = await ctx.http.post(`${root()}/offers/${id}/send`).set(authHeader(owner.accessToken)).send({}); expect(sent.status).toBe(201);
    expect((await ctx.http.get(`/api/v1/recruitment-offers/${id}`).set(authHeader(stranger.accessToken))).status).toBe(404);
    const accepted = await ctx.http.post(`/api/v1/recruitment-offers/${id}/respond`).set(authHeader(candidate.accessToken)).send({ response: 'ACCEPTED' }); expect(accepted.status).toBe(201);
    const application = await ctx.prisma.application.findUniqueOrThrow({ where: { id: applicationId } }); expect(application.status).toBe('HIRED'); expect(application.stageChangeSource).toBe('CANDIDATE_ACCEPTED_HR_OFFER');
    expect((await ctx.http.post(`/api/v1/recruitment-offers/${id}/respond`).set(authHeader(candidate.accessToken)).send({ response: 'ACCEPTED' })).status).toBe(400);
  });
  it('links assessments to jobs, sends usable invitations, rejects duplicate answers and supports human grading', async () => {
    const candidateProfile = await ctx.prisma.candidateProfile.findFirstOrThrow({ where: { user: { email: 'candidate@workspace.test' } } });
    const base = `/api/v1/companies/${companyId}/assessments`;
    const created = await ctx.http.post(base).set(authHeader(owner.accessToken)).send({ title: 'API fundamentals', jobId, type: 'TECHNICAL', questions: [
      { prompt: 'Choose HTTP success', type: 'MULTIPLE_CHOICE', points: 2, correctAnswer: '200', options: [{ label: '200', value: '200' }, { label: '500', value: '500' }] },
      { prompt: 'Explain idempotency', type: 'TEXT', points: 3 },
    ] });
    expect(created.status).toBe(201); expect(created.body.jobId).toBe(jobId);
    const malformed = await ctx.http.post(base).set(authHeader(owner.accessToken)).send({ title: 'Invalid', type: 'TECHNICAL', questions: [{ prompt: 'Invalid', type: 'BAD', points: -1 }] });
    expect(malformed.status).toBe(400);
    const assessmentId = created.body.id;
    const invited = await ctx.http.post(`${base}/${assessmentId}/invitations`).set(authHeader(owner.accessToken)).send({ candidateId: candidateProfile.id });
    expect(invited.status).toBe(201);
    const notification = await ctx.prisma.notification.findFirstOrThrow({ where: { userId: candidateProfile.userId, type: 'assessment.invited' } });
    expect(notification.data).toMatchObject({ href: `/assessments/attempt/${invited.body.token}` });
    const started = await ctx.http.post('/api/v1/assessments/attempts/start').set(authHeader(candidate.accessToken)).send({ token: invited.body.token });
    expect(started.status).toBe(201); expect(started.body.id).toBe(started.body.attemptId);
    expect(started.body.questions[0]).not.toHaveProperty('correctAnswer');
    const id = started.body.id, q1 = created.body.questions[0].id, q2 = created.body.questions[1].id;
    const submit = `/api/v1/assessments/attempts/${id}/submit`;
    const duplicate = await ctx.http.post(submit).set(authHeader(candidate.accessToken)).send({ answers: [{ questionId: q1, answer: '200' }, { questionId: q1, answer: '200' }] });
    expect(duplicate.status).toBe(400); expect(await ctx.prisma.assessmentAnswer.count({ where: { attemptId: id } })).toBe(0);
    const submitted = await ctx.http.post(submit).set(authHeader(candidate.accessToken)).send({ answers: [{ questionId: q1, answer: '200' }, { questionId: q2, answer: 'Repeating a request has the same effect.' }] });
    expect(submitted.status).toBe(201); expect(submitted.body).toMatchObject({ score: 2, maxScore: 5, pendingReview: true });
    const grade = `/api/v1/companies/${companyId}/assessment-attempts/${id}/grade`;
    expect((await ctx.http.post(grade).set(authHeader(stranger.accessToken)).send({ answers: [{ questionId: q2, score: 3 }] })).status).toBe(403);
    expect((await ctx.http.post(grade).set(authHeader(owner.accessToken)).send({ answers: [{ questionId: q2, score: 4 }] })).status).toBe(400);
    const marked = await ctx.http.post(grade).set(authHeader(owner.accessToken)).send({ answers: [{ questionId: q2, score: 3 }] });
    expect(marked.status).toBe(201); expect(marked.body.score).toBe(5);
    const candidateResult = await ctx.http.get(`/api/v1/assessments/attempts/${id}`).set(authHeader(candidate.accessToken));
    expect(candidateResult.body.answers[0].question).not.toHaveProperty('correctAnswer');
    expect((await ctx.http.post(submit).set(authHeader(candidate.accessToken)).send({ answers: [] })).status).toBe(400);
  });

});
