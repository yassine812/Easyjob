import { applicationWorkflow, potentialAssessment, stageDurations } from '../../src/applications/recruitment-policy';
import { copySubmittedCv, publicSubmittedCv } from '../../src/applications/submitted-cv';
import { ApplicationsService } from '../../src/applications/applications.service';
import { ResumesService } from '../../src/candidates/resumes.service';
import { CompanyWorkspaceService } from '../../src/companies/company-workspace.service';

describe('recruitment business consistency', () => {
  it.each(['REJECTED', 'HIRED', 'WITHDRAWN'] as const)('%s stops the processing clock', status => {
    expect(applicationWorkflow(status, new Date('2020-01-01'), 24)).toMatchObject({ terminal: true, elapsedSeconds: 0, overdue: false, targetSeconds: 0 });
  });
  it('keeps overdue work actionable only while active', () => {
    expect(applicationWorkflow('UNDER_REVIEW', new Date('2020-01-01'), 72).overdue).toBe(true);
  });
  it('does not invent zero potential without transferable evidence', () => {
    expect(potentialAssessment(8, { growthAnalysis: { score: 0 } })).toMatchObject({ applicable: false, score: null });
    expect(potentialAssessment(8, { growthAnalysis: { score: 40, transferableEvidence: [{ concept: 'skill_transferability', relevance: .8, confidence: .9 }] } })).toMatchObject({ applicable: true, score: 40 });
    expect(potentialAssessment(null, null).applicable).toBe(true);
  });
  it('uses real completed stage intervals and excludes terminal time', () => {
    expect(stageDurations([{ newStatus: 'APPLIED', createdAt: new Date('2026-10-01') }, { newStatus: 'UNDER_REVIEW', createdAt: new Date('2026-10-02') }, { newStatus: 'REJECTED', createdAt: new Date('2026-10-04') }])).toEqual([{ stage: 'APPLIED', seconds: 86400 }, { stage: 'UNDER_REVIEW', seconds: 172800 }]);
  });

  const resume = { id: 'cv-v1', storageKey: 'resumes/original', filename: 'submitted.pdf', mimeType: 'application/pdf', version: 1, isPrimary: false };
  function storageFixture() {
    const files = new Map<string, Buffer>([[resume.storageKey, Buffer.from('%PDF original submitted bytes')]]);
    const storage = { getBytes: jest.fn(async (key: string) => { if (!files.has(key)) throw new Error('missing'); return files.get(key)!; }), put: jest.fn(async (key: string, bytes: Buffer) => { files.set(key, bytes); }), delete: jest.fn(async (key: string) => { files.delete(key); }), presignedGet: jest.fn(async (key: string) => `/signed/${key}`) };
    return { files, storage };
  }
  it('preserves exact bytes/version independently of the main CV and keeps storage keys private', async () => {
    const { files, storage } = storageFixture();
    const file = await copySubmittedCv(storage as never, resume);
    expect(file.storageKey).toMatch(/\.pdf$/);
    files.set(resume.storageKey, Buffer.from('edited CV')); files.delete(resume.storageKey);
    expect((await storage.getBytes(file.storageKey)).toString()).toBe('%PDF original submitted bytes');
    expect(publicSubmittedCv({ submittedCv: file })).toMatchObject({ filename: 'submitted.pdf', version: 1 });
    expect(publicSubmittedCv({ submittedCv: file })).not.toHaveProperty('storageKey');
  });
  it('preserves legacy submissions before library deletion', async () => {
    const { storage, files } = storageFixture();
    const application = { id: 'a', resumeId: resume.id, appliedAt: new Date('2026-09-30'), candidateSnapshot: { fullName: 'Candidate' } };
    const prisma = { candidateProfile: { findUnique: jest.fn(async () => ({ id: 'c' })) }, resume: { findMany: jest.fn(async () => [resume]), deleteMany: jest.fn(async () => undefined) }, application: { findMany: jest.fn(async () => [application]), update: jest.fn(async args => args) } };
    const service = new ResumesService(prisma as never, storage as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await service.remove('candidate', resume.id);
    const snapshot = prisma.application.update.mock.calls[0][0].data.candidateSnapshot;
    expect(snapshot.fullName).toBe('Candidate');
    expect(snapshot.submittedCv.submittedAt).toBe('2026-09-30T00:00:00.000Z');
    expect(files.has(snapshot.submittedCv.storageKey)).toBe(true);
    expect(files.has(resume.storageKey)).toBe(false);
  });

  function serviceFixture(status = 'APPLIED', score = 90) {
    const app = { id: 'a', status, jobId: 'job', candidateId: 'c', aiMatchScore: score, potentialScore: 'LOW', candidate: { userId: 'candidate', user: { email: 'candidate@example.test' } }, job: { id: 'job', companyId: 'company', title: 'Role', company: { recruitmentSettings: null } } };
    const event = { create: jest.fn(async args => args) };
    const prisma = { application: { findUnique: jest.fn(async () => app), update: jest.fn(async args => ({ ...app, ...args.data })) }, applicationEvent: event, $transaction: jest.fn() };
    prisma.$transaction.mockImplementation(fn => fn(prisma));
    const access = { assertApplicationPermission: jest.fn(async () => undefined) };
    const storage = storageFixture().storage;
    const notifications = { create: jest.fn(async () => undefined) };
    const service = new ApplicationsService(prisma as never, access as never, { log: jest.fn() } as never, notifications as never, {} as never, {} as never, { emitToCompany: jest.fn(), emitToUser: jest.fn() } as never, { emit: jest.fn() } as never, storage as never);
    return { app, service, prisma, event, access, storage };
  }
  it('persists a stage change and actor/history atomically', async () => {
    const { service, prisma, event } = serviceFixture();
    await service.moveStatus('hr', 'a', { newStatus: 'SHORTLISTED', source: 'HR' }, {});
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a', status: 'APPLIED' }, data: expect.objectContaining({ status: 'SHORTLISTED', stageChangedById: 'hr' }) }));
    expect(event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ applicationId: 'a', actorId: 'hr', previousStatus: 'APPLIED', newStatus: 'SHORTLISTED' }) });
  });
  it('serves the submitted copy only after application-specific CV permission', async () => {
    const { service, app, access, storage } = serviceFixture();
    const file = await copySubmittedCv(storage as never, resume);
    Object.assign(app, { resumeId: null, candidateSnapshot: { submittedCv: file } });
    const result = await service.getCvUrl('hr', 'a', {});
    expect(result.filename).toBe('submitted.pdf'); expect(result).not.toHaveProperty('storageKey');
    expect(storage.presignedGet).toHaveBeenCalledWith(file.storageKey);
    expect(access.assertApplicationPermission).toHaveBeenLastCalledWith('hr', 'company', 'a', 'candidate.cv.view');
    access.assertApplicationPermission.mockRejectedValueOnce(new Error('forbidden'));
    storage.presignedGet.mockClear();
    await expect(service.getCvUrl('outsider', 'a', {})).rejects.toThrow();
    expect(storage.presignedGet).not.toHaveBeenCalled();
  });
  it('blocks terminal progression and requires a reason for low-alignment overrides', async () => {
    const terminal = serviceFixture('REJECTED');
    await expect(terminal.service.moveStatus('hr', 'a', { newStatus: 'HIRED' }, {})).rejects.toThrow();
    expect(terminal.event.create).not.toHaveBeenCalled();
    const low = serviceFixture('UNDER_REVIEW', 8);
    await expect(low.service.moveStatus('hr', 'a', { newStatus: 'INTERVIEW', alignmentOverride: true }, {})).rejects.toThrow('Explain');
    await low.service.moveStatus('hr', 'a', { newStatus: 'INTERVIEW', alignmentOverride: true, overrideReason: 'Verified additional evidence' }, {});
    expect(low.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ metadata: expect.objectContaining({ alignmentOverride: true, alignmentOverrideReason: 'Verified additional evidence' }) }) });
  });
  it('builds scoped actionable dashboard counts, real history and entitlement-gated intelligence', async () => {
    const date = new Date('2026-10-01');
    const apps = [{ id: 'closed', status: 'REJECTED', aiMatchScore: 8 }, { id: 'new', status: 'APPLIED', aiMatchScore: 90 }].map(app => ({ ...app, appliedAt: date, stageChangedAt: date, jobId: 'job', job: { title: 'Role' }, candidate: { user: { name: app.id } }, potentialScore: 'LOW', events: app.id === 'closed' ? [{ newStatus: 'APPLIED', createdAt: date }, { newStatus: 'REJECTED', createdAt: new Date('2026-10-02') }] : [] }));
    const prisma = { job: { groupBy: jest.fn(async () => [{ status: 'PUBLISHED', _count: { _all: 1 } }]) }, application: { findMany: jest.fn(async (_args: unknown) => apps) }, interview: { findMany: jest.fn(async () => []) }, company: { findUnique: jest.fn(async () => ({ recruitmentSettings: null })) } };
    const access = { assertPermission: jest.fn(), jobScope: jest.fn(async () => ({ companyId: 'company' })), applicationScope: jest.fn(async () => ({ candidateId: { in: ['permitted'] } })), interviewScope: jest.fn(async () => ({})) };
    const entitlement = { hasRecruitmentIntelligence: jest.fn(async () => true) };
    const service = new CompanyWorkspaceService(prisma as never, access as never, {} as never, {} as never, {} as never, {} as never, entitlement as never);
    const result = await service.overview('hr', 'company', { from: '2026-10-01', to: '2026-10-06' });
    expect(result.attention.newApplications).toBe(1); expect(result.attention.overdue).toBe(1);
    expect(result.bottlenecks).toEqual([{ stage: 'APPLIED', averageDays: 1, completedIntervals: 1 }]);
    expect(result.topCandidates.map(row => row.id)).toEqual(['new']);
    expect(result.classificationDistribution).toMatchObject({ LOW_ALIGNMENT: 1, STRONG_MATCH: 1 });
    expect((prisma.application.findMany.mock.calls[0][0] as { where: unknown }).where).toMatchObject({ candidateId: { in: ['permitted'] } });
    entitlement.hasRecruitmentIntelligence.mockResolvedValue(false);
    const locked = await service.overview('hr', 'company', { from: '2026-10-01', to: '2026-10-06' });
    expect(locked.topCandidates).toEqual([]); expect(locked.classificationDistribution).toEqual({});
    expect(locked.recent[0]).not.toHaveProperty('aiMatchScore');
  });
});
