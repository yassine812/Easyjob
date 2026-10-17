import { companyFixture } from '../helpers';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import {
  authHeader,
  closeTestApp,
  createTestApp,
  createVerifiedUser,
  waitFor,
} from '../helpers';

describe('AI pipeline (e2e)', () => {
  let stub: Server;
  let baseUrl: string;
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let candidate: { accessToken: string; userId: string };

  beforeAll(async () => {
    // Minimal stub of the FastAPI AI service.
    stub = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/ai/cv/extract') {
          res.end(JSON.stringify({ text: 'Extracted CV text with TypeScript and Node.js experience' }));
          return;
        }
        if (req.url === '/ai/cv/analyze') {
          res.end(
            JSON.stringify({
              overall_score: 82,
              strengths: ['Clear structure'],
              weaknesses: ['No quantified results'],
              missing_skills: ['Docker'],
              ats_compatibility: 78,
              improvement_suggestions: ['Add metrics'],
              structure_quality: 'good',
              keyword_recommendations: ['Docker', 'Kubernetes'],
            }),
          );
          return;
        }
        if (req.url === '/ai/match') {
          res.end(
            JSON.stringify({
              skill_match: 90,
              experience_match: 80,
              location_match: 100,
              seniority_match: 75,
              overall_match: 87,
              reasoning: 'Heuristic scoring.',
            }),
          );
          return;
        }
        if (req.url === '/ai/cv/generate') {
          res.end(JSON.stringify({ cv_markdown: '# Generated CV\n\nOnly provided data.' }));
          return;
        }
        res.statusCode = 404;
        res.end(JSON.stringify({ detail: 'not found' }));
      });
    });

    await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;

    ctx = await createTestApp({ AI_SERVICE_URL: baseUrl });
    candidate = await createVerifiedUser(ctx, 'AI Candidate', 'ai@test.com');
    const profile = await ctx.prisma.candidateProfile.findUniqueOrThrow({ where: { userId: candidate.userId } });
    const pro = await ctx.prisma.plan.findFirstOrThrow({ where: { type: 'CANDIDATE', name: 'PRO' } });
    await ctx.prisma.subscription.create({ data: { ownerType: 'CANDIDATE', candidateId: profile.id, planId: pro.id, provider: 'test', status: 'ACTIVE' } });
  }, 240000);

  afterAll(async () => {
    if (ctx) await closeTestApp(ctx);
    await new Promise<void>((resolve) => stub.close(() => resolve()));
  });

  it('processes an uploaded PDF CV (extraction via the AI service)', async () => {
    const upload = await ctx.http
      .post('/api/v1/candidates/me/resumes')
      .set(authHeader(candidate.accessToken))
      .attach('file', Buffer.from('%PDF-1.4\nfictional pdf payload'), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      });
    expect(upload.status).toBe(201);
    const resumeId = (upload.body as { id: string }).id;

    await waitFor(
      async () => {
        const resumes = await ctx.http.get('/api/v1/candidates/me/resumes').set(authHeader(candidate.accessToken));
        const row = (resumes.body as Array<{ id: string; processingStatus: string }>).find((r) => r.id === resumeId);
        return row?.processingStatus === 'COMPLETED' ? row : undefined;
      },
      { description: 'PDF CV extraction via AI stub' },
    );

    return resumeId;
  });

  it('analyzes the CV asynchronously and stores structured results', async () => {
    const resumes = await ctx.http.get('/api/v1/candidates/me/resumes').set(authHeader(candidate.accessToken));
    const resume = (resumes.body as Array<{ id: string }>)[0];

    const analyze = await ctx.http
      .post('/api/v1/ai/cv/analyze')
      .set(authHeader(candidate.accessToken))
      .send({ resumeId: resume.id });
    expect(analyze.status).toBe(201);
    const analysisId = (analyze.body as { analysisId: string }).analysisId;

    const completed = await waitFor(
      async () => {
        const result = await ctx.http
          .get(`/api/v1/ai/analyses/${analysisId}`)
          .set(authHeader(candidate.accessToken));
        if (result.status !== 200) return undefined;
        const body = result.body as { status: string; output?: { overall_score?: number } };
        return body.status === 'COMPLETED' && body.output?.overall_score === 82 ? body : undefined;
      },
      { description: 'AI CV analysis to complete' },
    );
    expect(completed!.output?.overall_score).toBe(82);
  });

  it('runs job matching and exposes the score', async () => {
    // Create a published job first.
    const companyAdmin = await createVerifiedUser(ctx, 'AI Company', 'aicompany@test.com');
    const company = await companyFixture(ctx, companyAdmin.accessToken, { legalName: 'AI Co', commercialName: 'AICo' });
    const companyId = (company.body as { id: string }).id;
    await ctx.http
      .post(`/api/v1/companies/${companyId}/verification/documents`)
      .set(authHeader(companyAdmin.accessToken))
      .attach('file', Buffer.from('%PDF-1.4\ndoc'), { filename: 'd.pdf', contentType: 'application/pdf' });
    await ctx.http.post(`/api/v1/companies/${companyId}/verification/submit`).set(authHeader(companyAdmin.accessToken));
    const verifications = await ctx.http.get('/api/v1/admin/verifications').set(authHeader(companyAdmin.accessToken));
    expect(verifications.status).toBe(403); // not admin

    const job = await ctx.http
      .post('/api/v1/jobs')
      .set(authHeader(companyAdmin.accessToken))
      .send({
        title: 'Node Backend Engineer',
        description: 'A job description for the AI matching test with enough length.',
        employmentType: 'FULL_TIME',
        experienceLevel: 'SENIOR',
        remote: true,
        skills: [{ name: 'TypeScript', required: true }, { name: 'Node.js', required: true }],
      });
    expect(job.status).toBe(201);
    const jobId = (job.body as { id: string }).id;

    // Matching must only expose published jobs from verified, active companies.
    await ctx.prisma.company.update({ where: { id: companyId }, data: { status: 'ACTIVE', verification: { update: { status: 'VERIFIED' } } } });
    await ctx.prisma.job.update({ where: { id: jobId }, data: { status: 'APPROVED', approvedAt: new Date() } });
    expect((await ctx.http.post(`/api/v1/jobs/${jobId}/publish`).set(authHeader(companyAdmin.accessToken))).status).toBe(201);

    const match = await ctx.http
      .post('/api/v1/ai/match')
      .set(authHeader(candidate.accessToken))
      .send({ jobId });
    expect(match.status).toBe(201);
    const analysisId = (match.body as { analysisId: string }).analysisId;

    const completed = await waitFor(
      async () => {
        const result = await ctx.http
          .get(`/api/v1/ai/analyses/${analysisId}`)
          .set(authHeader(candidate.accessToken));
        const body = result.body as { status: string; scores?: { overall: number } };
        return body.status === 'COMPLETED' ? body : undefined;
      },
      { description: 'AI job matching to complete' },
    );
    expect(completed!.scores?.overall).toBe(87);
  });

  it('rejects AI operations on other users analysis results', async () => {
    const other = await createVerifiedUser(ctx, 'Other AI', 'aiother@test.com');
    const analyses = await ctx.http.get('/api/v1/ai/analyses').set(authHeader(candidate.accessToken));
    const first = (analyses.body as { items: Array<{ id: string }> }).items[0];
    const stolen = await ctx.http
      .get(`/api/v1/ai/analyses/${first.id}`)
      .set(authHeader(other.accessToken));
    expect(stolen.status).toBe(403);
  });

  it('CV generation works from the candidate profile', async () => {
    const generate = await ctx.http.post('/api/v1/ai/cv/generate').set(authHeader(candidate.accessToken));
    expect(generate.status).toBe(201);
    const analysisId = (generate.body as { analysisId: string }).analysisId;

    const completed = await waitFor(
      async () => {
        const result = await ctx.http
          .get(`/api/v1/ai/analyses/${analysisId}`)
          .set(authHeader(candidate.accessToken));
        const body = result.body as { status: string; output?: { cv_markdown?: string } };
        return body.status === 'COMPLETED' && body.output?.cv_markdown ? body : undefined;
      },
      { description: 'AI CV generation to complete' },
    );
    expect(completed!.output?.cv_markdown).toContain('Generated CV');
  });
});
