import { ApplicationsService } from '../../src/applications/applications.service';

describe('Recruitment application workflow data', () => {
  function setup(items: Array<Record<string, unknown>>, grouped = [{ status: 'SCREENING', _count: { _all: 1 } }]) {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ recruitmentSettings: null }) },
      application: {
        findMany: jest.fn().mockResolvedValue(items),
        count: jest.fn().mockResolvedValue(items.length),
        groupBy: jest.fn().mockResolvedValue(grouped),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const access = {
      assertJobPermission: jest.fn().mockResolvedValue(undefined),
      assertPermission: jest.fn().mockResolvedValue(undefined),
      assertMembership: jest.fn().mockResolvedValue({ role: 'RECRUITER', memberId: 'member' }),
      applicationScope: jest.fn().mockResolvedValue({ job: { companyId: 'company' } }),
    };
    const service = new ApplicationsService(prisma as never, access as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    return { prisma, service, access };
  }

  it('rejects a job outside the authorized company before reading applications', async () => {
    const { service, prisma, access } = setup([]);
    access.assertJobPermission.mockRejectedValue(new Error('Forbidden job'));
    await expect(service.listForCompany('hr', 'company', { jobId: 'foreign-job' })).rejects.toThrow('Forbidden job');
    expect(access.assertJobPermission).toHaveBeenCalledWith('hr', 'company', 'foreign-job', 'application.view');
    expect(prisma.application.findMany).not.toHaveBeenCalled();
  });

  it('returns current-stage elapsed time, target and overdue state', async () => {
    const stageChangedAt = new Date(Date.now() - 2 * 3600000);
    const { service } = setup([{ id: 'application', status: 'SCREENING', stageChangedAt, appliedAt: stageChangedAt, interviews: [] }]);

    const result = await service.listForCompany('hr', 'company', { page: 1, limit: 10 });

    expect(result.items[0].workflow).toEqual(expect.objectContaining({ stage: 'SCREENING', targetSeconds: 3600, overdue: true }));
    expect(result.items[0].workflow.elapsedSeconds).toBeGreaterThanOrEqual(2 * 3600 - 2);
    expect(result.stageCounts).toEqual({ SCREENING: 1 });
  });

  it('sorts potential candidates before paginating when requested', async () => {
    const now = new Date();
    const { service, prisma } = setup([
      { id: 'low', status: 'APPLIED', potentialScore: 'LOW', aiMatchScore: 98, stageChangedAt: now, appliedAt: now, interviews: [] },
      { id: 'high', status: 'APPLIED', potentialScore: 'HIGH', aiMatchScore: 60, stageChangedAt: now, appliedAt: now, interviews: [] },
    ]);

    const result = await service.listForCompany('hr', 'company', { page: 1, limit: 1, sort: 'potential' });

    expect(result.items[0].id).toBe('high');
    expect(prisma.application.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ skip: expect.anything(), take: expect.anything() }));
  });

  it('classifies applications for recruiter review without exposing analysis as a stage', async () => {
    const now = new Date();
    const { service } = setup([
      { id: 'strong', status: 'APPLIED', aiMatchScore: 92, potentialScore: 'LOW', stageChangedAt: now, appliedAt: now, interviews: [] },
      { id: 'low', status: 'APPLIED', aiMatchScore: 40, potentialScore: 'LOW', stageChangedAt: now, appliedAt: now, interviews: [] },
    ], [{ status: 'APPLIED', _count: { _all: 2 } }, { status: 'SCREENING', _count: { _all: 1 } }]);

    const result = await service.listForCompany('hr', 'company', { page: 1, limit: 10, classification: 'LOW_ALIGNMENT' });

    expect(result.items.map(item => item.id)).toEqual(['low']);
    expect(result.items[0].classification).toBe('LOW_ALIGNMENT');
    expect(result.stageCounts).toEqual({ APPLIED: 2, SCREENING: 1 });
  });

  it('keeps scoped job totals aligned when low-alignment applications are included', async () => {
    const now = new Date();
    const { service } = setup([{ id: 'low', status: 'REJECTED', aiMatchScore: 18, potentialScore: 'LOW', stageChangedAt: now, appliedAt: now, interviews: [] }], [{ status: 'REJECTED', _count: { _all: 1 } }]);

    const result = await service.listForCompany('hr', 'company', { page: 1, limit: 10, jobId: 'devops-job', includeLowAlignment: 'true' });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.stageCounts).toEqual({ REJECTED: 1 });
    expect(Object.values(result.stageCounts).reduce((sum, count) => sum + count, 0)).toBe(result.total);
  });

  it('exposes a READY growth-potential contract when analysis is complete', async () => {
    const now = new Date();
    const { service } = setup([{
      id: 'ready', status: 'APPLIED', aiMatchScore: 91, potentialScore: 'HIGH', potentialReason: 'Documented transferable evidence.', aiScreeningStatus: 'COMPLETED',
      matchExplanation: { growthAnalysis: { score: 88, category: 'HIGH', why: ['Python backend evidence'], gaps: [{ skill: 'Docker' }] } }, stageChangedAt: now, appliedAt: now, interviews: [],
    }]);

    const result = await service.listForCompany('hr', 'company', { page: 1, limit: 10 });

    expect(result.items[0]).toEqual(expect.objectContaining({ analysisStatus: 'READY', growthPotential: { score: 88, level: 'HIGH', reasons: ['Python backend evidence'], developmentPoints: ['Docker'] } }));
  });

  it('never exposes READY when a completed row is missing growth data', async () => {
    const now = new Date();
    const { service } = setup([{
      id: 'partial', status: 'APPLIED', aiMatchScore: 91, potentialScore: null, potentialReason: null, aiScreeningStatus: 'COMPLETED',
      matchExplanation: { skills: ['Python'] }, stageChangedAt: now, appliedAt: now, interviews: [],
    }]);

    const result = await service.listForCompany('hr', 'company', { page: 1, limit: 10 });

    expect(result.items[0]).toEqual(expect.objectContaining({ analysisStatus: 'PARTIAL', growthPotential: expect.objectContaining({ level: 'INCOMPLETE' }) }));
  });
});
