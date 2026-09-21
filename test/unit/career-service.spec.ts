import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CareerService } from '../../src/career/career.service';

describe('Candidate career ownership and consent', () => {
  function setup() {
    const profile = { id: 'candidate', user: { emailVerifiedAt: new Date() }, skills: [], resumes: [] };
    const settings = { autoApply: false, approvedDraftId: null, domains: [], locations: [], workModes: [], excludedCompanies: [], excludedJobTypes: [] };
    const prisma = {
      candidateProfile: { findUnique: jest.fn().mockResolvedValue(profile) },
      careerSettings: { upsert: jest.fn().mockResolvedValue(settings), update: jest.fn().mockImplementation(({ data }) => data) },
      cvDraft: { findFirst: jest.fn().mockResolvedValue({ id: 'draft', content: 'Reviewed content', keywords: [] }), update: jest.fn().mockImplementation(({ data }) => data) },
      job: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const entitlements = { assertCan: jest.fn().mockResolvedValue(undefined), can: jest.fn().mockResolvedValue(false) };
    const ai = { tailorCv: jest.fn().mockResolvedValue({ tailored_cv: '## Skills\nReact, PostgreSQL' }) };
    const service = new CareerService(prisma as never, entitlements as never, ai as never, {} as never);
    return { service, prisma, settings, entitlements, ai };
  }
  it('cannot enable Auto Apply without explicit consent', async () => {
    const { service, prisma } = setup();
    await expect(service.updateSettings('user', { autoApply: true, approvedDraftId: 'draft' })).rejects.toThrow(BadRequestException);
    expect(prisma.careerSettings.update).not.toHaveBeenCalled();
  });
  it('requires highest-tier entitlement even with consent', async () => {
    const { service, entitlements, prisma } = setup();
    entitlements.assertCan.mockRejectedValue(new ForbiddenException());
    await expect(service.updateSettings('user', { autoApply: true, consent: true })).rejects.toThrow(ForbiddenException);
    expect(prisma.careerSettings.update).not.toHaveBeenCalled();
  });
  it('requires an owned approved CV', async () => {
    const { service, prisma } = setup();
    prisma.cvDraft.findFirst.mockResolvedValue(null);
    await expect(service.updateSettings('user', { autoApply: true, consent: true, approvedDraftId: 'foreign' })).rejects.toThrow(BadRequestException);
    expect(prisma.cvDraft.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', candidateId: 'candidate', approvedAt: { not: null } } });
  });
  it('always permits disabling after downgrade and clears consent', async () => {
    const { service, entitlements } = setup();
    const result = await service.updateSettings('user', { autoApply: false, emailAlerts: false });
    expect(result.autoConsentAt).toBeNull();
    expect(entitlements.assertCan).not.toHaveBeenCalled();
  });
  it('revokes draft approval when edited without reapproval', async () => {
    const { service } = setup();
    const result = await service.saveDraft('user', 'draft', { content: 'Changed professional content' });
    expect(result.approvedAt).toBeNull();
  });
  it('does not reveal a foreign CV report', async () => {
    const { service } = setup();
    await expect(service.report('user', 'foreign')).rejects.toThrow(NotFoundException);
  });
  it('regenerates only the chosen section as an unsaved proposal', async () => {
    const { service, prisma, ai } = setup();
    const content = '# Ada\nada@example.test\n\n## Skills\nReact\n\n## Education\nActual degree';
    const result = await service.regenerateSection('user', 'draft', { content, sectionIndex: 1 });
    expect(result.content).toContain('# Ada\nada@example.test\n\n');
    expect(result.content).toContain('## Education\nActual degree');
    expect(ai.tailorCv.mock.calls[0][0].cv_text).toBe('## Skills\nReact\n\n');
    expect(prisma.cvDraft.update).not.toHaveBeenCalled();
  });
  it('rejects another candidate draft before invoking AI', async () => {
    const { service, prisma, ai } = setup(); prisma.cvDraft.findFirst.mockResolvedValue(null);
    await expect(service.regenerateSection('user', 'foreign', { content: 'Some professional content', sectionIndex: 0 })).rejects.toThrow(NotFoundException);
    expect(ai.tailorCv).not.toHaveBeenCalled();
  });
  it('allows Free match sorting but queries only available verified jobs', async () => {
    const { service, prisma } = setup();
    expect((await service.search('user', { sort: 'match' })).items).toEqual([]);
    const filter = prisma.job.findMany.mock.calls[0][0].where.AND[0];
    expect(filter.company).toEqual({ status: 'ACTIVE', verification: { status: 'VERIFIED' } });
    expect(filter.status).toBe('PUBLISHED');
    expect(filter.OR[1].expiresAt.gt).toBeInstanceOf(Date);
  });
});
