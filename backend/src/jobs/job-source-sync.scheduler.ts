import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '../common/constants/queues';
import { JobAggregationService } from './job-aggregation.service';
import { externalCatalogEnabled } from './external-catalog-mode';

@Injectable()
export class JobSourceSyncScheduler implements OnModuleInit {
  constructor(@InjectQueue(QUEUES.JOB_SOURCES) private readonly queue: Queue, private readonly aggregation: JobAggregationService) {}
  async onModuleInit() {
    const adapters = this.aggregation.getAdapters();
    if (!externalCatalogEnabled()) {
      // A previous deployment may have left legacy BullMQ repeatable jobs in
      // Redis. Remove them so an old schedule cannot repopulate the catalogue.
      for (const repeatable of await this.queue.getRepeatableJobs()) {
        await this.queue.removeRepeatableByKey(repeatable.key);
      }
      await this.queue.drain(true);
    }
    const configured = new Map<string, number>(externalCatalogEnabled() ? adapters.filter(a => a.isConfigured()).map(a => [`easyjob-source-${a.type}`, a.syncIntervalMs]) : []);
    // Redis persists these stable scheduler IDs; restarting containers must not
    // delete/recreate active schedules or create one schedule per worker replica.
    await this.queue.setGlobalConcurrency(1);
    for (const scheduled of await this.queue.getJobSchedulers(0, -1, true)) {
      if (scheduled.name === 'sync-source' && !configured.has(scheduled.key)) await this.queue.removeJobScheduler(scheduled.key);
    }
    for (const adapter of externalCatalogEnabled() ? adapters : []) {
      if (!adapter.isConfigured()) continue;
      const options = { attempts: 3, backoff: { type: 'source', delay: 30_000 }, removeOnComplete: { age: 172800, count: 1000 }, removeOnFail: { age: 2592000, count: 1000 } };
      await this.queue.add('sync-source', { type: adapter.type }, { ...options,
        jobId: `job-source-sync-initial-${adapter.type}-${Math.floor(Date.now() / 86400000)}` });
      await this.queue.upsertJobScheduler(`easyjob-source-${adapter.type}`, { every: adapter.syncIntervalMs },
        { name: 'sync-source', data: { type: adapter.type }, opts: options });
    }
  }
}
