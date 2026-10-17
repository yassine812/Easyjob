import { sameVacancy } from '../../src/jobs/job-identity';
import { JobAggregationService } from '../../src/jobs/job-aggregation.service';
import { JobSourceType } from '@prisma/client';
import type { ExternalJobListing } from '../../src/jobs/sources/job-source.types';

function setup() {
  const jobs: any[] = [], refs: any[] = [];
  const source = (type: JobSourceType) => ({ type, name: type, isConfigured: () => true });
  const tx: any = {
    sourceCompany: { upsert: jest.fn(({ create }) => Promise.resolve({ id: create.identityKey, ...create })) },
    aggregatedJob: {
      findMany: jest.fn(() => Promise.resolve(jobs)),
      findUnique: jest.fn(({ where }) => Promise.resolve(jobs.find(j => where.id ? j.id === where.id : j.dedupeKey === where.dedupeKey) || null)),
      update: jest.fn(({ where, data }) => { const job = jobs.find(j => j.id === where.id); Object.assign(job, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))); return Promise.resolve(job); }),
      upsert: jest.fn(({ where, create, update }) => { let job = jobs.find(j => j.dedupeKey === where.dedupeKey); if (job) Object.assign(job, update); else { job = { id: `job-${jobs.length}`, ...create }; jobs.push(job); } return Promise.resolve(job); }),
    },
    aggregatedJobSource: {
      findUnique: jest.fn(({ where }) => Promise.resolve(refs.find(r => r.sourceId === where.sourceId_sourceJobId.sourceId && r.sourceJobId === where.sourceId_sourceJobId.sourceJobId) || null)),
      count: jest.fn(({ where }) => Promise.resolve(refs.filter(r => r.aggregatedJobId === where.aggregatedJobId && r.status === where.status).length)),
      upsert: jest.fn(({ where, create, update }) => { const old = refs.find(r => r.sourceId === where.sourceId_sourceJobId.sourceId && r.sourceJobId === where.sourceId_sourceJobId.sourceJobId); if (old) Object.assign(old, update); else refs.push({ ...create }); return Promise.resolve(old || create); }),
    },
  };
  const service = new JobAggregationService({ $transaction: (fn: (tx: any) => unknown) => fn(tx) } as never,
    ...[JobSourceType.JOOBLE, JobSourceType.ANETI, JobSourceType.ANETI_INTERNATIONAL, JobSourceType.TANITJOBS, JobSourceType.LINKEDIN].map(type => source(type)) as [never, never, never, never, never]);
  const store = (sourceId: string, rows: ExternalJobListing[]) => (service as any).storeListings(sourceId, rows, new Date('2026-09-23'));
  return { jobs, refs, store };
}
const listing: ExternalJobListing = { id: '42', title: 'Engineer', companyName: 'Actual employer', description: 'Full source requirements and responsibilities. '.repeat(10),
  location: 'Tunis', salaryText: null, employmentType: 'CDI', sourceLabel: 'Licensed partner', url: 'https://employer.example/job/42', sourceUpdatedAt: null,
  responsibilities: ['Build APIs'], publishedAt: new Date('2026-09-22'), salaryMin: 2000, salaryMax: 4000, currency: 'TND' };

describe('canonical job identity and source lifecycle', () => {
  it('preserves canonical IDs when a source changes the title, and retains richer text', async () => {
    const s = setup(); await s.store('one', [listing]);
    await s.store('one', [{ ...listing, title: 'Senior Engineer', description: 'Short excerpt' }]);
    expect(s.jobs).toHaveLength(1); expect(s.refs).toHaveLength(1);
    expect(s.jobs[0]).toMatchObject({ id: 'job-0', title: 'Senior Engineer', description: listing.description, responsibilities: ['Build APIs'] });
  });
  it('merges strong evidence across sources but retains an open copy after another source closes', async () => {
    const s = setup(); await s.store('one', [listing]); await s.store('two', [listing]);
    expect(s.jobs).toHaveLength(1); expect(s.refs).toHaveLength(2);
    await s.store('one', [{ ...listing, status: 'CLOSED' }]); expect(s.jobs[0].status).toBe('OPEN');
    await s.store('two', [{ ...listing, status: 'CLOSED' }]); expect(s.jobs[0].status).toBe('CLOSED');
  });
  it('never deduplicates unknown employers or different salary evidence using title alone', async () => {
    const s = setup(); await s.store('one', [{ ...listing, companyName: null }]); await s.store('two', [{ ...listing, companyName: null }]);
    await s.store('three', [listing]); await s.store('four', [{ ...listing, salaryMin: 5000, salaryMax: 6000 }]);
    expect(s.jobs).toHaveLength(4);
  });
});

 describe('fuzzy duplicate evidence', () => {
  it('requires detailed overlap and rejects conflicting references and locations', () => {
    const description = Array.from({ length: 35 }, (_, index) => `skill${index}`).join(' ');
    const a = { ...listing, description }, b = { ...listing, id: 'other', description: description + ' bonus' };
    expect(sameVacancy(a, b)).toBe(true);
    expect(sameVacancy(a, { ...b, location: 'Paris' })).toBe(false);
    expect(sameVacancy({ ...a, reference: 'A' }, { ...b, reference: 'B' })).toBe(false);
  });
});
