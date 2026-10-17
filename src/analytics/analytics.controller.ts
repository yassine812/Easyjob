import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyAccessService } from '../companies/company-access.service';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PLATFORM_ADMIN_ROLES } from '../common/constants/roles';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService, private readonly access: CompanyAccessService) {}

  @Get('analytics/company/:companyId')
  @CompanyPermissions('analytics.view')
  async companyMetrics(@Param('companyId') companyId: string, @CurrentUser('userId') userId: string) {
    return this.analyticsService.scopedCompanyMetrics(companyId, await this.access.jobScope(userId, companyId));
  }

  @Get(['admin/analytics', 'platform-admin/analytics'])
  @Roles(...PLATFORM_ADMIN_ROLES)
  @Permissions('admin.dashboard')
  async platformMetrics() {
    return this.analyticsService.platformMetrics();
  }
}
