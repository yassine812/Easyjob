import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApplicationStatus, JobStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { ApplicationsService } from './applications.service';
import { AddApplicationNoteDto, ApplyDto, ApplicationMessageDto, UpdateApplicationStatusDto } from './dto/application.dto';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

class ListApplicationsQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['true', 'false']) overdue?: string;
  @IsOptional() @IsIn(['true', 'false']) activeOnly?: string;
  @IsOptional() @IsString() @MaxLength(150) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) minimumMatch?: number;
  @IsOptional() @IsIn(['newest', 'oldest', 'match', 'stageTime', 'potential']) sort?: string;
  @IsOptional() @IsIn(['STRONG_MATCH', 'PROMISING', 'REVIEW', 'LOW_ALIGNMENT']) classification?: 'STRONG_MATCH' | 'PROMISING' | 'REVIEW' | 'LOW_ALIGNMENT';
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([10, 20, 50]) topN?: number;
  @IsOptional() @IsIn(['true', 'false']) includeLowAlignment?: string;
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

  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  jobId?: string;
}

class ListJobSummariesQuery {
  @IsOptional() @IsString() @MaxLength(150) search?: string;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @IsIn(['newest', 'oldest', 'title']) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('applications')
@ApiBearerAuth()
@Controller()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('jobs/:jobId/apply')
  async apply(
    @CurrentUser('userId') userId: string,
    @Param('jobId') jobId: string,
    @Body() dto: ApplyDto,
    @Req() req: AuthRequest,
  ) {
    return this.applicationsService.apply(userId, jobId, dto, requestMeta(req));
  }

  @Get('applications/me')
  async listMine(@CurrentUser('userId') userId: string, @Query() query: ListApplicationsQuery) {
    return this.applicationsService.listForCandidate(userId, query);
  }

  @Get('companies/:companyId/applications')
  @CompanyPermissions('application.view')
  async listForCompany(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Query() query: ListApplicationsQuery,
  ) {
    return this.applicationsService.listForCompany(userId, companyId, query);
  }

  @Get('companies/:companyId/application-jobs')
  @CompanyPermissions('application.view')
  listJobs(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string, @Query() query: ListJobSummariesQuery) {
    return this.applicationsService.listJobSummaries(userId, companyId, query);
  }

  @Get('companies/:companyId/jobs/:jobId/ai-rank')
  @CompanyPermissions('application.view')
  async rankCandidates(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.applicationsService.rankCandidatesForJob(userId, companyId, jobId);
  }

  @Get('applications/:id')
  async getById(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.applicationsService.getById(id, userId);
  }

  @Patch('applications/:id/status')
  async moveStatus(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.applicationsService.moveStatus(userId, id, dto, requestMeta(req));
  }

  @Get('applications/:id/events')
  async listEvents(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.applicationsService.listEvents(id, userId);
  }

  @Get('applications/:id/notes')
  async listNotes(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.applicationsService.listNotes(id, userId);
  }

  @Post('applications/:id/notes')
  async addNote(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: AddApplicationNoteDto,
    @Req() req: AuthRequest,
  ) {
    return this.applicationsService.addNote(userId, id, dto.content, requestMeta(req));
  }

  @Get('applications/:id/cv')
  async getCv(@CurrentUser('userId') userId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.applicationsService.getCvUrl(userId, id, requestMeta(req));
  }

  @Get('applications/:id/messages')
  async listMessages(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.applicationsService.listMessages(id, userId);
  }

  @Post('applications/:id/messages')
  async sendMessage(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: ApplicationMessageDto) {
    return this.applicationsService.sendMessage(id, userId, dto);
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
