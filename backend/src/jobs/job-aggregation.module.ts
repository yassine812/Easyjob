import { PartnerSourceRegistry } from './sources/partner-source.registry';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../common/constants/queues';
import { RUN_WORKERS } from '../common/utils/env';
import { JobAggregationService } from './job-aggregation.service';
import { JoobleAdapter } from './sources/jooble.adapter';
import { AnetiAdapter } from './sources/aneti.adapter';
import { AnetiInternationalAdapter } from './sources/aneti-international.adapter';
import { TanitJobsAdapter } from './sources/tanitjobs.adapter';
import { LinkedInAdapter } from './sources/linkedin.adapter';
import { JobSourceSyncProcessor } from './job-source-sync.processor';
import { JobSourceSyncScheduler } from './job-source-sync.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.JOB_SOURCES })],
  providers: [
    JobAggregationService,
    PartnerSourceRegistry,
    JoobleAdapter,
    AnetiAdapter,
    AnetiInternationalAdapter,
    TanitJobsAdapter,
    LinkedInAdapter,
    ...(RUN_WORKERS ? [JobSourceSyncProcessor, JobSourceSyncScheduler] : []),
  ],
  exports: [JobAggregationService, BullModule],
})
export class JobAggregationModule {}
