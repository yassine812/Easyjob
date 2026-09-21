import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { AssessmentsService } from './assessments.service';
import {
  CreateAssessmentDto,
  GradeAttemptDto,
  InviteCandidateDto,
  StartAttemptDto,
  SubmitAttemptDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

class PaginatedQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

@ApiTags('assessments')
@ApiBearerAuth()
@Controller()
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  // ---- company side ----

  @Post('companies/:companyId/assessments')
  @CompanyPermissions('assessment.manage')
  async create(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Body() dto: CreateAssessmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.assessmentsService.create(userId, companyId, dto, requestMeta(req));
  }

  @Get('companies/:companyId/assessments')
  @CompanyPermissions('assessment.manage')
  async list(@Param('companyId') companyId: string, @Query() query: PaginatedQuery) {
    return this.assessmentsService.list(companyId, query);
  }

  @Get('companies/:companyId/assessments/:assessmentId')
  @CompanyPermissions('assessment.manage')
  async get(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string, @Param('assessmentId') assessmentId: string) {
    return this.assessmentsService.getById(assessmentId, userId, companyId);
  }

  @Patch('companies/:companyId/assessments/:assessmentId')
  @CompanyPermissions('assessment.manage')
  async update(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UpdateAssessmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.assessmentsService.update(userId, companyId, assessmentId, dto, requestMeta(req));
  }

  @Delete('companies/:companyId/assessments/:assessmentId')
  @CompanyPermissions('assessment.manage')
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('assessmentId') assessmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.assessmentsService.delete(userId, companyId, assessmentId, requestMeta(req));
  }

  @Post('companies/:companyId/assessments/:assessmentId/invitations')
  @CompanyPermissions('assessment.manage')
  async invite(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: InviteCandidateDto,
    @Req() req: AuthRequest,
  ) {
    return this.assessmentsService.invite(userId, companyId, assessmentId, dto, requestMeta(req));
  }

  @Get('companies/:companyId/assessments/:assessmentId/invitations')
  @CompanyPermissions('assessment.manage')
  async invitations(@Param('companyId') companyId: string, @Param('assessmentId') assessmentId: string) {
    return this.assessmentsService.listInvitations(companyId, assessmentId);
  }

  @Post('companies/:companyId/assessment-attempts/:attemptId/grade')
  @CompanyPermissions('assessment.manage')
  async grade(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string,
    @Param('attemptId') attemptId: string, @Body() dto: GradeAttemptDto, @Req() req: AuthRequest) {
    return this.assessmentsService.gradeAttempt(userId, companyId, attemptId, dto, requestMeta(req));
  }

  // ---- candidate side ----

  @Post('assessments/attempts/start')
  async start(@CurrentUser('userId') userId: string, @Body() dto: StartAttemptDto) {
    return this.assessmentsService.startAttempt(userId, dto.token);
  }

  @Post('assessments/attempts/:attemptId/submit')
  async submit(
    @CurrentUser('userId') userId: string,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.assessmentsService.submitAttempt(userId, attemptId, dto);
  }

  @Get('assessments/attempts/:attemptId')
  async attempt(@CurrentUser('userId') userId: string, @Param('attemptId') attemptId: string) {
    return this.assessmentsService.getAttempt(userId, attemptId);
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
