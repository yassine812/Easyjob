import { ApplicationsService } from '../../src/applications/applications.service';
import { CareerScheduler } from '../../src/career/career.scheduler';

describe('Auto Apply final authorization boundary', () => {
  function setup() {
    const date = new Date('2026-09-09T10:00:00Z');
    const settings = { autoApply: true, autoConsentAt: date, updatedAt: date, approvedDraftId: 'draft', approvalRequired: false, unattendedConsentAt: date, preferredResumeId: 'cv', maxPerWeek: 10,
      autoMinimumScore: 80, maxPerDay: 3, domains: [], locations: [], workModes: [], excludedCompanies: [] as string[], excludedJobTypes: [] };
    const job = { applicationFields: [], id: 'job', companyId: 'co', title: 'Engineer', description: 'APIs', status: 'PUBLISHED', expiresAt: null,
      company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } },
      remote: true, location: null, requirements: [], employmentType: 'FULL_TIME', experienceLevel: 'MID',
      skills: [{ skill: { name: 'React' }, required: true }] };
    const draft = { content: 'Reviewed React project', approvedAt: date };
    const features = { 'career.auto_apply': true, 'cv.uploads': 50 };
    const plan = { type: 'CANDIDATE', name: 'PREMIUM', features };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]), careerSettings: { findUnique: jest.fn().mockResolvedValue(settings) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ plan }) },
      cvDraft: { findFirst: jest.fn().mockResolvedValue(draft) },
      application: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'application' }) },
      resume: { findFirst: jest.fn().mockResolvedValue({ id: 'cv', mimeType: 'application/pdf' }), count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }), create: jest.fn().mockResolvedValue({ id: 'cv' }) },
      job: { findFirst: jest.fn().mockResolvedValue(job) }, applicationEvent: { create: jest.fn() },
    };
    const prisma = { job: { findUnique: jest.fn().mockResolvedValue(job) },
      candidateProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'candidate', skills: [], resumes: [{ id: 'cv', filename: 'cv.pdf', storageKey: 'cv.pdf', version: 1, parsedText: 'Reviewed React project', mimeType: 'application/pdf', processingStatus: 'COMPLETED' }] }) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Candidate', email: 'candidate@example.test', status: 'ACTIVE', emailVerifiedAt: date }) },
      resume: { findFirst: jest.fn().mockResolvedValue({ id: 'cv' }) }, application: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn().mockImplementation(fn => fn(tx)) };
    const storage = { getBytes: jest.fn().mockResolvedValue(Buffer.from('%PDF submitted CV')), put: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) };
    const service = new ApplicationsService(prisma as never, {} as never, { log: jest.fn() } as never, {} as never,
      {} as never, {} as never, { emitToCompany: jest.fn() } as never, { emit: jest.fn() } as never, storage as never);
    const apply = () => service.apply('user', 'job', { resumeId: 'cv', consent: true }, {}, { resumeId: 'cv', settingsVersion: date });
    return { settings, job, features, plan, draft, tx, storage, service, apply };
  }
  it.each(['disabled', 'no-consent', 'downgraded', 'changed-preferences', 'excluded', 'changed-CV', 'daily-cap', 'weekly-cap', 'approval-required', 'unattended-consent-missing', 'low-score'])(
    'does not submit when %s', async condition => {
      const s = setup();
      if (condition === 'disabled') s.settings.autoApply = false;
      if (condition === 'no-consent') s.settings.autoConsentAt = null as never;
      if (condition === 'downgraded') s.plan.name = 'FREE';
      if (condition === 'changed-preferences') s.settings.updatedAt = new Date();
      if (condition === 'excluded') s.settings.excludedCompanies.push('co');
      if (condition === 'changed-CV') s.settings.preferredResumeId = 'other-cv';
      if (condition === 'daily-cap') s.tx.application.count.mockResolvedValue(3);
      if (condition === 'weekly-cap') s.tx.application.count.mockResolvedValueOnce(0).mockResolvedValueOnce(10);
      if (condition === 'approval-required') s.settings.approvalRequired = true;
      if (condition === 'unattended-consent-missing') s.settings.unattendedConsentAt = null as never;
      if (condition === 'low-score') s.job.skills.push({ skill: { name: 'Django' }, required: true });
      await expect(s.apply()).rejects.toThrow();
      expect(s.tx.application.create).not.toHaveBeenCalled();
      expect(s.storage.put).not.toHaveBeenCalled();
    },
  );
  it('checks consent under a database lock before writing', async () => {
    const s = setup();
    jest.spyOn(s.service, 'getById').mockResolvedValue({ id: 'application' } as never);
    jest.spyOn(s.service as unknown as { notifyCompanyOfApplication: () => Promise<void> }, 'notifyCompanyOfApplication').mockResolvedValue(undefined);
    await s.apply();
    expect(s.tx.$queryRaw).toHaveBeenCalled();
    expect(s.tx.resume.create).not.toHaveBeenCalled();
    expect(s.storage.put).toHaveBeenCalledWith(expect.stringMatching(/^application-cvs\/.*cv.pdf$/), expect.any(Buffer), 'application/pdf');
    expect(s.tx.application.create).toHaveBeenCalledWith({ data: expect.objectContaining({ autoApplied: true, status: 'APPLIED', aiMatchScore: 100, cvTextSnapshot: 'Reviewed React project' }) });
  });
  it('scheduler does no outbound work without distributed exclusion', async () => {
    const prisma = { careerSettings: { findMany: jest.fn() } };
    const scheduler = new CareerScheduler(prisma as never, { getConnection: () => null } as never, {} as never, {} as never, {} as never);
    await scheduler.tick();
    expect(prisma.careerSettings.findMany).not.toHaveBeenCalled();
  });
});
