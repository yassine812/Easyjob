import { JobSourceSyncScheduler } from '../../src/jobs/job-source-sync.scheduler';

describe('persistent job source schedules', () => {
  it('removes legacy and current external schedules in platform-only mode without importing jobs', async () => {
    const previous = process.env.JOB_CATALOG_MODE;
    process.env.JOB_CATALOG_MODE = 'PLATFORM_ONLY';
    const queue = {
      getRepeatableJobs: jest.fn().mockResolvedValue([{ key: 'legacy-source' }]),
      removeRepeatableByKey: jest.fn(), drain: jest.fn(), setGlobalConcurrency: jest.fn(),
      getJobSchedulers: jest.fn().mockResolvedValue([{ key: 'easyjob-source-COMPANY_DIRECT', name: 'sync-source' }]),
      removeJobScheduler: jest.fn(), add: jest.fn(), upsertJobScheduler: jest.fn(),
    };
    try {
      const service = new JobSourceSyncScheduler(queue as never, { getAdapters: () => [{ type: 'COMPANY_DIRECT', isConfigured: () => true, syncIntervalMs: 86400000 }] } as never);
      await service.onModuleInit();
      expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('legacy-source');
      expect(queue.drain).toHaveBeenCalledWith(true);
      expect(queue.removeJobScheduler).toHaveBeenCalledWith('easyjob-source-COMPANY_DIRECT');
      expect(queue.add).not.toHaveBeenCalled();
      expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.JOB_CATALOG_MODE;
      else process.env.JOB_CATALOG_MODE = previous;
    }
  });
  it('upserts a stable daily schedule, removes legacy/disabled schedules, and preserves active schedules', async () => {
    const queue = { setGlobalConcurrency: jest.fn(),
      getJobSchedulers: jest.fn().mockResolvedValue([{ key: 'legacy-hash', name: 'sync-source' }, { key: 'easyjob-source-COMPANY_DIRECT', name: 'sync-source' }]),
      removeJobScheduler: jest.fn(), add: jest.fn(), upsertJobScheduler: jest.fn() };
    const service = new JobSourceSyncScheduler(queue as never, { getAdapters: () => [{ type: 'COMPANY_DIRECT', isConfigured: () => true, syncIntervalMs: 86400000 }] } as never);
    await service.onModuleInit();
    await service.onModuleInit();
    expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(1);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('legacy-hash');
    expect(queue.removeJobScheduler).not.toHaveBeenCalledWith('easyjob-source-COMPANY_DIRECT');
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith('easyjob-source-COMPANY_DIRECT', { every: 86400000 }, expect.objectContaining({ name: 'sync-source', data: { type: 'COMPANY_DIRECT' } }));
    expect(queue.add.mock.calls[0][2].jobId).toEqual(queue.add.mock.calls[1][2].jobId);
  });
});
