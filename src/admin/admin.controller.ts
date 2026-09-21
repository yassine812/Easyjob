import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyStatus, JobStatus, VerificationStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ROLES } from '../common/constants/roles';
import { AdminService } from './admin.service';
import { CompanyProvisioningService } from './company-provisioning.service';
import { ProvisionCompanyDto } from './provision-company.dto';
import { CompanyVerificationService } from '../company-verification/company-verification.service';
import { JobsService } from '../jobs/jobs.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

class PaginatedQuery {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}

class VerificationsQuery extends PaginatedQuery {
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}

class CompaniesQuery extends PaginatedQuery {
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

class AdminJobsQuery extends PaginatedQuery {
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

class AuditLogsQuery extends PaginatedQuery {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  actorId?: string;
}

class RejectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

class AdminRejectJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(ROLES.PLATFORM_ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly provisioning: CompanyProvisioningService,
    private readonly verificationService: CompanyVerificationService,
    private readonly jobsService: JobsService,
  ) {}

  // ---------------- verifications ----------------

  @Get('verifications')
  @Permissions('admin.verifications')
  async verifications(@Query() query: VerificationsQuery) {
    return this.adminService.listVerifications(query);
  }

  @Get('verifications/:id')
  @Permissions('admin.verifications')
  async verification(@Param('id') id: string) {
    return this.adminService.getVerification(id);
  }

  @Post('verifications/:id/approve')
  @Permissions('admin.verifications')
  async approveVerification(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return this.verificationService.review(adminId, id, 'approve', undefined, requestMeta(req));
  }

  @Post('verifications/:id/reject')
  @Permissions('admin.verifications')
  async rejectVerification(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @Req() req: AuthRequest,
  ) {
    return this.verificationService.review(adminId, id, 'reject', dto.reason, requestMeta(req));
  }

  // ---------------- companies ----------------

  @Post('companies')
  @Permissions('admin.companies')
  provision(@CurrentUser('userId') adminId: string, @Body() dto: ProvisionCompanyDto) {
    return this.provisioning.create(adminId, dto);
  }

  @Get('company-deliveries')
  @Permissions('admin.companies')
  deliveries() { return this.provisioning.deliveries(); }

  @Post('company-deliveries/:id/retry')
  @Permissions('admin.companies')
  retryDelivery(@Param('id') id: string) { return this.provisioning.retry(id); }

  @Get('companies')
  @Permissions('admin.companies')
  async companies(@Query() query: CompaniesQuery) {
    return this.adminService.listCompanies(query);
  }

  // ---------------- jobs ----------------

  @Get('jobs')
  @Permissions('admin.jobs')
  async jobs(@Query() query: AdminJobsQuery) {
    return this.adminService.listJobs(query);
  }

  @Post('jobs/:id/approve')
  @Permissions('admin.jobs')
  async approveJob(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.jobsService.adminApprove(adminId, id, requestMeta(req));
  }

  @Post('jobs/:id/reject')
  @Permissions('admin.jobs')
  async rejectJob(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Body() dto: AdminRejectJobDto,
    @Req() req: AuthRequest,
  ) {
    return this.jobsService.adminReject(adminId, id, dto.reason, requestMeta(req));
  }

  // ---------------- subscriptions ----------------

  @Get('subscriptions')
  @Permissions('admin.subscriptions')
  async subscriptions(@Query() query: PaginatedQuery) {
    return this.adminService.listSubscriptions(query);
  }

  // ---------------- audit logs ----------------

  @Get('audit-logs')
  @Permissions('admin.audit')
  async auditLogs(@Query() query: AuditLogsQuery) {
    return this.adminService.listAuditLogs(query);
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
