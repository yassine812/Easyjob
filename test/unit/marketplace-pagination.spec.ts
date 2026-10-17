import { JobMarketplaceService } from '../../src/career/job-marketplace.service';

describe('matching precedes marketplace pagination', () => {
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
});
