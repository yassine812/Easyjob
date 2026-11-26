import { JobAggregationService } from '../../src/jobs/job-aggregation.service';
import { SourceRequestError } from '../../src/jobs/sources/licensed-feed.adapter';

describe('paginated source lifecycle revalidation', () => {
  function setup(detail: jest.Mock) {
    const prisma = { aggregatedJobSource: {
      findMany: jest.fn().mockResolvedValue([{ id: 'reference', sourceJobId: 'slug' }]),
      update: jest.fn().mockResolvedValue({}),
    } };
    const service = new JobAggregationService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never) as any;
    service.storeListings = jest.fn().mockResolvedValue({});
    const adapter = { revalidationBatchSize: 100, fetchJobDetails: detail };
    return { prisma, service, adapter };
  }
  it('checks oldest source references within a fixed budget and imports explicit closures', async () => {
    const closed = { id: 'slug', status: 'CLOSED' };
    const { service, prisma, adapter } = setup(jest.fn().mockResolvedValue(closed));
    const now = new Date();
    await service.revalidateListings('source', adapter, now);
    expect(prisma.aggregatedJobSource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { sourceId: 'source', status: 'OPEN', lastSyncedAt: { lt: now } }, take: 100,
      orderBy: [{ lastSyncedAt: 'asc' }, { id: 'asc' }],
    }));
    expect(service.storeListings).toHaveBeenCalledWith('source', [closed], now);
    expect(prisma.aggregatedJobSource.update).not.toHaveBeenCalled();
  });
  it('removes only a source reference after confirmed 404, preserving other sources', async () => {
    const { service, prisma, adapter } = setup(jest.fn().mockResolvedValue(null));
    const now = new Date();
    await service.revalidateListings('source', adapter, now);
    expect(prisma.aggregatedJobSource.update).toHaveBeenCalledWith({ where: { id: 'reference' }, data: { status: 'REMOVED', lastSyncedAt: now } });
  });
  it('never closes records on timeout or upstream errors', async () => {
    const { service, prisma, adapter } = setup(jest.fn().mockRejectedValue(new SourceRequestError('FREEHIRE_UNREACHABLE')));
    await expect(service.revalidateListings('source', adapter, new Date())).rejects.toThrow('FREEHIRE_UNREACHABLE');
    expect(prisma.aggregatedJobSource.update).not.toHaveBeenCalled();
    expect(service.storeListings).not.toHaveBeenCalled();
  });
});
