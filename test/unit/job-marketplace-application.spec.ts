import { JobMarketplaceService } from '../../src/career/job-marketplace.service';

describe('external job application handoff', () => {
  it('generates from the selected owned CV and the target job in the requested language', async () => {
    const profile = { user: { name: 'Candidate', email: 'test@example.test' }, id: 'candidate-1', resumes: [{ id: 'primary', isPrimary: true, parsedText: 'React CV' }, { id: 'chosen', parsedText: 'Python CV' }], skills: [], experiences: [], educations: [] };
    const career = { profile: jest.fn().mockResolvedValue(profile), job: jest.fn().mockResolvedValue({ title: 'Python engineer', company: { commercialName: 'Acme' }, description: 'Build Python tools', skills: [], requirements: [] }) };
    const ai = { coverLetter: jest.fn().mockResolvedValue({ cover_letter: 'Lettre personnalisée' }) };
    const service = new JobMarketplaceService({} as never, career as never, {} as never, ai as never, { assertCan: jest.fn() } as never);
    await service.generateNativeCoverLetter('user', 'job', 'chosen', 'fr');
    expect(ai.coverLetter).toHaveBeenCalledWith(expect.objectContaining({ sourceCvText: 'Python CV' }), expect.objectContaining({ title: 'Python engineer', locale: 'fr' }));
    await expect(service.generateNativeCoverLetter('user', 'job', 'someone-elses-cv', 'fr')).rejects.toThrow('does not belong');
    profile.resumes[1].parsedText = '';
    await expect(service.generateNativeCoverLetter('user', 'job', 'chosen', 'fr')).rejects.toThrow('analysé');
    expect(ai.coverLetter).toHaveBeenCalledTimes(1);
  });
  it('prepares the candidate data in EasyJob, then opens the source without claiming it was submitted', async () => {
    const profile = { id: 'candidate-1', resumes: [{ id: 'resume-1', mimeType: 'application/pdf', processingStatus: 'COMPLETED', parsedText: 'Candidate\nPython developer\ncandidate@example.test' }] };
    const prepared = { id: 'prep-1', status: 'READY_TO_APPLY_EXTERNALLY', applied: false };
    const prisma = {
      externalApplicationPreparation: {
        upsert: jest.fn().mockResolvedValue(prepared),
        findUnique: jest.fn().mockResolvedValue({
          id: 'prep-1',
          aggregatedJob: {
            status: 'OPEN',
            sources: [{ applicationMethod: 'EXTERNAL_APPLICATION', applicationUrl: 'https://careers.example.test/job/1' }],
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'prep-1', status: 'EXTERNAL_SITE_OPENED' }),
      },
    };
    const career = { profile: jest.fn().mockResolvedValue(profile) };
    const aggregation = { findOpenJob: jest.fn().mockResolvedValue({ id: 'job-1', title: 'Python developer', skills: ['Python'], requirements: [], sources: [{ status: 'OPEN', applicationMethod: 'EXTERNAL_APPLICATION', applicationUrl: 'https://careers.example.test/job/1' }] }) };
    const service = new JobMarketplaceService(prisma as never, career as never, aggregation as never, {} as never, { assertCan: jest.fn().mockResolvedValue(undefined) } as never);

    const preparedResult = await service.prepareExternal('user-1', 'job-1', {
      resumeId: 'resume-1', consent: true,
      candidateSnapshot: { fullName: 'Candidate', email: 'candidate@example.test' },
      answers: {},
    } as never);
    const openedResult = await service.openExternal('user-1', 'job-1');

    expect(preparedResult).toEqual(expect.objectContaining({ status: 'READY_TO_APPLY_EXTERNALLY', applied: false }));
    expect(prisma.externalApplicationPreparation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { candidateId_aggregatedJobId: { candidateId: 'candidate-1', aggregatedJobId: 'job-1' } },
      create: expect.objectContaining({ resumeId: 'resume-1', candidateSnapshot: expect.objectContaining({ cvTextSnapshot: profile.resumes[0].parsedText, applicationQuality: expect.objectContaining({ ready: true }) }) }),
    }));
    expect(openedResult).toEqual({
      status: 'EXTERNAL_SITE_OPENED',
      applicationUrl: 'https://careers.example.test/job/1',
      submitted: false,
    });
  });
});
