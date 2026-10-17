import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '../common/constants/queues';
import { JobAggregationService } from './job-aggregation.service';

@Injectable()
export class JobSourceSyncScheduler implements OnModuleInit {
  constructor(@InjectQueue(QUEUES.JOB_SOURCES) private readonly queue: Queue, private readonly aggregation: JobAggregationService) {}
  async onModuleInit() {
    const adapters = this.aggregation.getAdapters();
    const active = new Set(adapters.filter(a => a.isConfigured()).map(a => `job-source-sync-repeat-${a.type}`));
    for (const repeat of await this.queue.getRepeatableJobs()) {
      if (repeat.name === 'sync-source' && (!active.has(repeat.id || '') || Number(repeat.every) !== 86400000)) await this.queue.removeRepeatableByKey(repeat.key);
    }
    for (const adapter of adapters) {
      if (!adapter.isConfigured()) continue;
      const options = { attempts: 3, backoff: { type: 'source', delay: 30_000 }, removeOnComplete: { age: 172800, count: 1000 }, removeOnFail: { age: 2592000, count: 1000 } };
      await this.queue.add('sync-source', { type: adapter.type }, { ...options,
        jobId: `job-source-sync-initial-${adapter.type}-${Math.floor(Date.now() / 86400000)}` });
      await this.queue.add('sync-source', { type: adapter.type }, { ...options,
        jobId: `job-source-sync-repeat-${adapter.type}`, repeat: { every: 86400000 } });
    }
  }
}
