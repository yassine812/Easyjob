import { JobSourceType } from '@prisma/client';
import { JobAggregationService } from '../../src/jobs/job-aggregation.service';
import type { ExternalJobSearchResult } from '../../src/jobs/sources/job-source.types';

function adapter(type: JobSourceType, fetchJobs: () => Promise<ExternalJobSearchResult>) {
  return {
    type,
    name: type,
    syncIntervalMs: 60_000,
    isConfigured: () => true,
    healthCheck: async () => ({ status: 'ACTIVE' as const, detail: null }),
    fetchJobs,
  };
}

describe('JobAggregationService', () => {
  it('keeps central search in the database and applies source, keyword and location filters', async () => {
    const prisma = {
      aggregatedJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(18),
        findMany: jest.fn().mockResolvedValue([]),
      },
      jobSource: { findMany: jest.fn().mockResolvedValue([{ lastSyncAt: null }]) },
    };
    const noNetwork = jest.fn(async (): Promise<ExternalJobSearchResult> => ({ jobs: [], total: 0 }));
    const service = new JobAggregationService(
      prisma as never,
      adapter(JobSourceType.JOOBLE, noNetwork) as never,
      adapter(JobSourceType.ANETI, noNetwork) as never,
      adapter(JobSourceType.ANETI_INTERNATIONAL, noNetwork) as never,
      adapter(JobSourceType.TANITJOBS, noNetwork) as never,
      adapter(JobSourceType.LINKEDIN, noNetwork) as never,
    );

    const result = await service.search({ keyword: 'Django', location: 'Tunis', sourceType: JobSourceType.ANETI, page: 2, limit: 10 });
    const where = prisma.aggregatedJob.findMany.mock.calls[0][0].where;

    expect(result.total).toBe(18);
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ sources: { some: { source: { type: JobSourceType.ANETI } } } }),
      expect.objectContaining({ location: { contains: 'Tunis', mode: 'insensitive' } }),
    ]));
    expect(where.AND.some((condition: Record<string, unknown>) => 'OR' in condition && JSON.stringify(condition).includes('Django'))).toBe(true);
    expect(prisma.aggregatedJob.findMany.mock.calls[0][0]).toEqual(expect.objectContaining({ skip: 10, take: 10 }));
    expect(noNetwork).not.toHaveBeenCalled();
  });

  it('marks expired jobs closed and lets one source fail without stopping another', async () => {
    const prisma = {
      aggregatedJob: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      aggregatedJobSource: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      jobSourceSyncRun: { create: jest.fn().mockResolvedValue({ id: 'run' }), update: jest.fn().mockResolvedValue({}) },
      jobSource: {
        upsert: jest.fn(({ create }) => Promise.resolve({ id: `source-${create.type}`, ...create })),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new JobAggregationService(
      prisma as never,
      adapter(JobSourceType.JOOBLE, async () => ({ jobs: [], total: 0 })) as never,
      adapter(JobSourceType.ANETI, async () => { throw new Error('upstream down'); }) as never,
      adapter(JobSourceType.ANETI_INTERNATIONAL, async () => ({ jobs: [], total: 0 })) as never,
      adapter(JobSourceType.TANITJOBS, async () => ({ jobs: [], total: 0 })) as never,
      adapter(JobSourceType.LINKEDIN, async () => ({ jobs: [], total: 0 })) as never,
    );
    (service as unknown as { storeListings: jest.Mock }).storeListings = jest.fn().mockResolvedValue({ imported: 0, updated: 0, rejected: 0, duplicatesMerged: 0 });

    const results = await Promise.all([
      service.syncSource(JobSourceType.ANETI),
      service.syncSource(JobSourceType.ANETI_INTERNATIONAL),
    ]);

    expect(results.map(result => result.status)).toEqual(['TEMPORARILY_UNAVAILABLE', 'ACTIVE']);
    expect(prisma.aggregatedJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ closingAt: { lte: expect.any(Date) } }),
      data: { status: 'EXPIRED' },
    }));
    expect(prisma.jobSource.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: `source-${JobSourceType.ANETI_INTERNATIONAL}` },
      data: expect.objectContaining({ syncStatus: 'ACTIVE' }),
    }));
  });
});
