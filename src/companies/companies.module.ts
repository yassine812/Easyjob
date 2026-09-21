import { Global, Module } from '@nestjs/common';
import { CompanyLogoController } from './company-logo.controller';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyAccessService } from './company-access.service';
import { CompanyWorkspaceService } from './company-workspace.service';
import { CompanyWorkspaceController } from './company-workspace.controller';
import { RecruitmentAiService } from './recruitment-ai.service';
import { RecruitmentAiController } from './recruitment-ai.controller';
import { RecruitmentOffersService } from './recruitment-offers.service';
import { RecruitmentOffersController } from './recruitment-offers.controller';

@Global()
@Module({
  controllers: [CompaniesController, CompanyWorkspaceController, RecruitmentAiController, RecruitmentOffersController, CompanyLogoController],
  providers: [CompaniesService, CompanyAccessService, CompanyWorkspaceService, RecruitmentAiService, RecruitmentOffersService],
  exports: [CompaniesService, CompanyAccessService],
})
export class CompaniesModule {}
