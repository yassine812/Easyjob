import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../common/constants/queues';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsProcessor } from './analytics.processor';
import { RUN_WORKERS } from '../common/utils/env';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.ANALYTICS })],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ...(RUN_WORKERS ? [AnalyticsProcessor] : [])],
  exports: [AnalyticsService, BullModule],
})
export class AnalyticsModule {}
