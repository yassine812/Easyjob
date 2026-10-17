import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { JobAggregationModule } from '../jobs/job-aggregation.module';
import { RUN_WORKERS } from '../common/utils/env';
import { CareerController } from './career.controller';
import { CareerService } from './career.service';
import { CareerScheduler } from './career.scheduler';
import { JobMarketplaceService } from './job-marketplace.service';
import { ApplicationRequirementsService } from './application-requirements.service';
import { CvStudioService } from './cv-studio.service';
import { CvStudioController } from './cv-studio.controller';
import { WritingQualityService } from './writing-quality.service';
import { CareerOpsService } from './career-ops.service';

@Module({ imports: [ApplicationsModule, JobAggregationModule], controllers: [CareerController, CvStudioController], providers: [CareerService, CareerOpsService, CvStudioService, WritingQualityService, JobMarketplaceService, ApplicationRequirementsService, ...(RUN_WORKERS ? [CareerScheduler] : [])] })
export class CareerModule {}
