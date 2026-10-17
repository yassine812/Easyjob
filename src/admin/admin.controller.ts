import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BillingInterval, CompanyStatus, JobStatus, PlanType, SubscriptionStatus, UserStatus, VerificationStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PLATFORM_ADMIN_ROLES } from '../common/constants/roles';
import { AdminService } from './admin.service';
import { CompanyProvisioningService } from './company-provisioning.service';
import { ProvisionCompanyDto } from './provision-company.dto';
import { CompanyVerificationService } from '../company-verification/company-verification.service';
import { JobsService } from '../jobs/jobs.service';
import { JobAggregationService } from '../jobs/job-aggregation.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';
import { EasyJobSkillsService } from '../skills/easyjob/easyjob-skills.service';

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

class CandidatesQuery extends PaginatedQuery {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

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

class CompanyStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;
}

class PlansQuery extends PaginatedQuery {
  @IsOptional()
  @IsEnum(PlanType)
  type?: PlanType;
}

class PlanStatusDto {
  @IsBoolean()
  active!: boolean;
}

class CreatePlanDto {
  @IsEnum(PlanType) type!: PlanType;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @Type(() => Number) @Min(0) priceCents!: number;
  @IsOptional() @IsString() currency?: string;
  @IsEnum(BillingInterval) billingInterval!: BillingInterval;
  @IsOptional() features?: Record<string, unknown>;
}

class NotificationsQuery extends PaginatedQuery {
  @IsOptional() @IsString() type?: string;
  @IsOptional() unreadOnly?: boolean;
}

class SubscriptionsQuery extends PaginatedQuery {
  @IsOptional() @IsEnum(PlanType) ownerType?: PlanType;
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus;
  @IsOptional() @IsString() expiring?: string;
}

class ExtendSubscriptionDto {
  @Type(() => Number) @Min(1) days!: number;
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}

class UpdateSubscriptionDto {
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsIn(['cancel', 'reactivate']) action?: 'cancel' | 'reactivate';
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller(['admin', 'platform-admin'])
@Roles(...PLATFORM_ADMIN_ROLES)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly provisioning: CompanyProvisioningService,
    private readonly verificationService: CompanyVerificationService,
    private readonly jobsService: JobsService,
    private readonly jobAggregation: JobAggregationService,
    private readonly skills: EasyJobSkillsService,
  ) {}

  @Get('job-sources')
  @Permissions('admin.jobs')
  jobSources() {
    return this.jobAggregation.sourceStatuses();
  }

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

  @Get('candidates')
  @Permissions('admin.users')
  async candidates(@Query() query: CandidatesQuery) {
    return this.adminService.listCandidates(query);
  }

  @Get('candidates/:id')
  @Permissions('admin.users')
  async candidate(@Param('id') id: string) {
    return this.adminService.getCandidate(id);
  }

  @Post('companies')
  @Permissions('admin.company_manage')
  provision(@CurrentUser('userId') adminId: string, @Body() dto: ProvisionCompanyDto) {
    return this.provisioning.create(adminId, dto);
  }

  @Get('company-deliveries')
  @Permissions('admin.companies')
  deliveries() { return this.provisioning.deliveries(); }

  @Post('company-deliveries/:id/retry')
  @Permissions('admin.company_manage')
  retryDelivery(@Param('id') id: string) { return this.provisioning.retry(id); }

  @Get('companies')
  @Permissions('admin.companies')
  async companies(@Query() query: CompaniesQuery) {
    return this.adminService.listCompanies(query);
  }

  @Get('dashboard')
  @Permissions('admin.dashboard')
  async dashboard() {
    return this.adminService.platformDashboard();
  }

  @Get('companies/:id')
  @Permissions('admin.companies')
  async company(@Param('id') id: string) {
    return this.adminService.getCompany(id);
  }

  @Patch('companies/:id/status')
  @Permissions('admin.company_manage')
  async companyStatus(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Body() dto: CompanyStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.adminService.updateCompanyStatus(adminId, id, dto.status, requestMeta(req));
  }

  // ---------------- jobs ----------------

  @Get('jobs')
  @Permissions('admin.jobs')
  async jobs(@Query() query: AdminJobsQuery) {
    return this.adminService.listJobs(query);
  }

  @Post('jobs/:id/approve')
  @Permissions('admin.job_moderate')
  async approveJob(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.jobsService.adminApprove(adminId, id, requestMeta(req));
  }

  @Post('jobs/:id/reject')
  @Permissions('admin.job_moderate')
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
  async subscriptions(@Query() query: SubscriptionsQuery) {
    return this.adminService.listSubscriptions(query);
  }

  @Post('subscriptions/:id/extend')
  @Permissions('admin.billing_manage')
  async extendSubscription(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() dto: ExtendSubscriptionDto, @Req() req: AuthRequest) {
    return this.adminService.extendSubscription(adminId, id, dto.days, dto.reason, requestMeta(req));
  }

  @Patch('subscriptions/:id')
  @Permissions('admin.billing_manage')
  async updateSubscription(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() dto: UpdateSubscriptionDto, @Req() req: AuthRequest) {
    return this.adminService.updateSubscription(adminId, id, dto, requestMeta(req));
  }

  @Get('invoices')
  @Permissions('admin.billing')
  async invoices(@Query() query: PaginatedQuery) {
    return this.adminService.listInvoices(query);
  }

  @Get('plans')
  @Permissions('admin.plans')
  async plans(@Query() query: PlansQuery) {
    return this.adminService.listPlans(query.type);
  }

  @Patch('plans/:id/status')
  @Permissions('admin.plan_manage')
  async planStatus(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() dto: PlanStatusDto, @Req() req: AuthRequest) {
    return this.adminService.updatePlan(adminId, id, dto.active, requestMeta(req));
  }

  @Post('plans')
  @Permissions('admin.plan_manage')
  async createPlan(@CurrentUser('userId') adminId: string, @Body() dto: CreatePlanDto, @Req() req: AuthRequest) {
    return this.adminService.createPlan(adminId, dto, requestMeta(req));
  }

  @Get('notifications')
  @Permissions('admin.notifications')
  async notifications(@Query() query: NotificationsQuery) {
    return this.adminService.listNotifications(query);
  }

  @Get('system/health')
  @Permissions('admin.system')
  async systemHealth() {
    return this.adminService.systemHealth();
  }

  @Get('system/transcription')
  @Permissions('admin.system')
  async transcriptionHealth() {
    const enabled = process.env.INTERVIEW_TRANSCRIPTION_ENABLED === 'true' || process.env.EASYJOB_TRANSCRIPTION_ENABLED === 'true';
    const vad = process.env.INTERVIEW_VAD_ENABLED !== 'false';
    if (!enabled) return { transcription: 'Degraded', vad: vad ? 'Healthy' : 'Down', worker: 'Disabled' };
    try {
      const response = await fetch(`${process.env.AI_SERVICE_URL ?? 'http://localhost:8000'}/health/ready`, { signal: AbortSignal.timeout(2000) });
      const payload = await response.json() as { stt?: boolean; vad?: boolean };
      return { transcription: payload.stt ? 'Healthy' : 'Degraded', vad: payload.vad ? 'Healthy' : 'Degraded', worker: response.ok ? 'Healthy' : 'Degraded' };
    } catch {
      return { transcription: 'Down', vad: vad ? 'Degraded' : 'Down', worker: 'Down' };
    }
  }

  @Get('system/skills')
  @Permissions('admin.system')
  skillsRegistry() {
    return { skills: this.skills.listSkills().map(skill => ({ name: skill.name, version: skill.version, purpose: skill.purpose, status: 'registered' })) };
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
