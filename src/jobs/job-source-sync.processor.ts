import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { JobSourceType } from '@prisma/client';
import { QUEUES } from '../common/constants/queues';
import { JobAggregationService } from './job-aggregation.service';

@Processor(QUEUES.JOB_SOURCES, { settings: { backoffStrategy: (attempts, _type, error) => Math.max(30_000 * 2 ** (attempts - 1), (error as Error & { retryAfterMs?: number }).retryAfterMs || 0) } })
export class JobSourceSyncProcessor extends WorkerHost {
  constructor(private readonly aggregation: JobAggregationService) { super(); }

  async process(job: Job<{ type: string }>) {
    if (job.name !== 'sync-source') return;
    const type = Object.values(JobSourceType).find(value => value === job.data.type);
    if (!type) return;
    const result = await this.aggregation.syncSource(type);
    if (result.status === 'AUTHORIZATION_REQUIRED') throw new UnrecoverableError('Source authorization required');
    if (result.status === 'TEMPORARILY_UNAVAILABLE' || result.status === 'ERROR') throw Object.assign(new Error('Source synchronization failed; see source diagnostics'), { retryAfterMs: result.retryAfterMs });
    return result;
  }
}
