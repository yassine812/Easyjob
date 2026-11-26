import { JobMarketplaceService } from '../../src/career/job-marketplace.service';

describe('matching precedes marketplace pagination', () => {
  it('preserves distinct employer references with identical titles and descriptions', () => {
    const instance = service(false) as any;
    const job = { title: 'Ingénieur Développement', location: 'Tunis', company: { commercialName: 'Sofrecom' }, description: 'Official description. '.repeat(20), sourceReferences: [] };
    expect(instance.mergeDuplicates([], [{ ...job, reference: 'SOFTU1' }, { ...job, reference: 'SOFTU2' }], false)).toHaveLength(2);
    expect(instance.mergeDuplicates([], [{ ...job, reference: 'SOFTU1' }, { ...job, reference: 'SOFTU1' }], false)).toHaveLength(1);
  });
  function service(advanced: boolean) {
    const jobs = [10, 20, 60, 90, 85, 65].map((score, index) => ({ id: String(index), isExternal: true, title: `Job ${index}`, requirements: [], skills: [], sources: [], match: { score }, sourceReferences: [], publishedAt: new Date(2026, 8, index + 1) }));
    const aggregation = { search: jest.fn().mockResolvedValue({ items: jobs, total: jobs.length }), sourceStatuses: jest.fn().mockResolvedValue([]) };
    const instance = new JobMarketplaceService({} as never, { profile: async () => ({ id: 'candidate' }), requireFeature: async () => { throw new Error('PRO required'); } } as never,
      aggregation as never, {} as never, { can: async () => advanced } as never);
    jest.spyOn(instance as any, 'toExternalCareerJob').mockImplementation((job: any) => job);
    return instance;
  }
  it('analyses only visible results for general browsing without dropping low matches', async () => {
    const s = service(true);
    const result = await s.search('candidate', { source: 'APEC', page: 1, limit: 2, sort: 'newest' });
    expect(result.total).toBe(6);
    expect(result.items.map(job => job.id)).toEqual(['5', '4']);
    const calls = (s as any).toExternalCareerJob.mock.calls;
    expect(calls.filter((args: unknown[]) => args[1] !== undefined)).toHaveLength(2);
  });
  it('counts all scores and keeps page boundaries stable for every plan', async () => {
    const s = service(false);
    const first = await s.search('candidate', { source: 'APEC', page: 1, limit: 2, sort: 'match' });
    const second = await s.search('candidate', { source: 'APEC', page: 2, limit: 2, sort: 'match' });
    expect(first.total).toBe(6); expect(second.total).toBe(6);
    expect(first.items.map((j: any) => j.match.score)).toEqual([90, 85]);
    expect(second.items.map((j: any) => j.match.score)).toEqual([65, 60]);
  });
  it('applies an explicit minimum score for paid and free accounts', async () => {
    const result = await service(true).search('candidate', { source: 'APEC', minimumScore: 80, page: 1, limit: 2, sort: 'match' });
    expect(result.total).toBe(2); expect(result.items.map((j: any) => j.match.score)).toEqual([90, 85]);
    const free = await service(false).search('candidate', { source: 'APEC', minimumScore: 80, page: 1, limit: 2, sort: 'match' });
    expect(free.total).toBe(2); expect(free.items.map((j: any) => j.match.score)).toEqual([90, 85]);
  });
  it('includes official employer imports alongside native jobs in the company filter without duplicate source options', async () => {
    const native = { id: 'native', title: 'Native vacancy', requirements: [], skills: [], match: { score: null } };
    const external = { id: 'official', isExternal: true, title: 'EY vacancy', requirements: [], skills: [], sources: [], sourceReferences: [], match: { score: null } };
    const aggregation = {
      search: jest.fn().mockResolvedValue({ items: [external], total: 1 }),
      sourceStatuses: jest.fn().mockResolvedValue([{ type: 'COMPANY_DIRECT', name: 'Employer careers', enabled: true, status: 'ACTIVE' }]),
    };
    const career = { profile: jest.fn().mockResolvedValue({ id: 'candidate' }), search: jest.fn().mockResolvedValue({ items: [native], total: 1, advanced: false }) };
    const instance = new JobMarketplaceService({} as never, career as never, aggregation as never, {} as never, { can: async () => false } as never);
    jest.spyOn(instance as any, 'toExternalCareerJob').mockImplementation((job: any) => job);
    const result = await instance.search('candidate', { source: 'COMPANY_DIRECT', limit: 20 });
    expect(aggregation.search).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'COMPANY_DIRECT' }));
    expect(result.items.map(job => job.id).sort()).toEqual(['native', 'official']);
    expect(result.items.find(job => job.id === 'native')?.applicationMethod).toBe('NATIVE_EASYJOB');
    expect(result.sources.filter(source => source.type === 'COMPANY_DIRECT')).toHaveLength(1);
  });
});
