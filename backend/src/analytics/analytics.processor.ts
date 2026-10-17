import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../common/constants/queues';
import { RedisService } from '../redis/redis.service';
import { redisKeys } from '../common/constants/redis-keys';

@Processor(QUEUES.ANALYTICS)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly redis: RedisService) {
    super();
  }

  async process(job: Job<{ companyId: string }>): Promise<void> {
    if (job.name === 'invalidate') {
      await this.redis.del(redisKeys.analyticsCompany(job.data.companyId));
      this.logger.log(`Analytics cache invalidated for company ${job.data.companyId}`);
    }
  }
}
