import { JobDraftingClient } from './job-drafting.client';
import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobAutofillService, JobQualityValidator } from './job-creation.service';
import { ExternalResearchModule } from '../external-research/external-research.module';

@Module({
  imports: [ExternalResearchModule],
  controllers: [JobsController],
  providers: [JobsService, JobDraftingClient, JobQualityValidator, JobAutofillService],
  exports: [JobsService],
})
export class JobsModule {}
