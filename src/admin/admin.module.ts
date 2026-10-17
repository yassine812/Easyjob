import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CompanyVerificationModule } from '../company-verification/company-verification.module';
import { JobsModule } from '../jobs/jobs.module';
import { CompanyProvisioningService } from './company-provisioning.service';
import { JobAggregationModule } from '../jobs/job-aggregation.module';
import { RedisModule } from '../redis/redis.module';
import { ExternalResearchModule } from '../external-research/external-research.module';

@Module({
  imports: [CompanyVerificationModule, JobsModule, JobAggregationModule, RedisModule, ExternalResearchModule],
  controllers: [AdminController],
  providers: [AdminService, CompanyProvisioningService],
  exports: [AdminService],
})
export class AdminModule {}
