import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CompanyVerificationModule } from '../company-verification/company-verification.module';
import { JobsModule } from '../jobs/jobs.module';
import { CompanyProvisioningService } from './company-provisioning.service';

@Module({
  imports: [CompanyVerificationModule, JobsModule],
  controllers: [AdminController],
  providers: [AdminService, CompanyProvisioningService],
  exports: [AdminService],
})
export class AdminModule {}
