import { JobDraftingClient } from './job-drafting.client';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmploymentType, ExperienceLevel, JobStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyContextParam } from '../common/decorators/company-context.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { JobsService } from './jobs.service';
import { SearchService } from '../search/search.service';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';
import type { AuthRequest, CompanyContext } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';
import { JobAutofillDtoShape, JobAutofillService } from './job-creation.service';

class SearchJobsQuery {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  remote?: boolean;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  skills?: string;

  @IsOptional()
  @IsString()
  companySlug?: string;

  @IsOptional()
  @IsString()
  sort?: string;

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

class CompanyJobsQuery {
  @IsOptional()
  @IsIn(['active', 'paused', 'draft', 'closed', 'ACTIVE', 'SUSPENDED', ...Object.values(JobStatus)])
  status?: string;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() workMode?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsIn(['newest', 'oldest', 'closingSoon', 'title']) sort?: string;

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

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly searchService: SearchService,
    private readonly taxonomy: JobDraftingClient,
    private readonly autofill: JobAutofillService,
  ) {}

  @Public()
  @Get()
  async search(@Query() query: SearchJobsQuery) {
    const skills = query.skills?.split(',').map((s) => s.trim()).filter(Boolean);
    const parsed = {
      keyword: query.keyword,
      location: query.location,
      remote: query.remote,
      employmentType: query.employmentType,
      experienceLevel: query.experienceLevel,
      salaryMin: query.salaryMin,
      salaryMax: query.salaryMax,
      skills,
      companySlug: query.companySlug,
      status: JobStatus.PUBLISHED,
      sort: query.sort as 'relevance' | 'newest' | 'salaryHigh' | 'salaryLow' | 'title' | undefined,
      page: query.page,
      limit: query.limit,
    };
    if (query.keyword && query.sort === 'relevance') {
      return this.searchService.searchJobsFts(query.keyword, parsed);
    }
    return this.searchService.searchJobs(parsed);
  }

  @Get('title-suggestions')
  @ApiBearerAuth()
  async titleSuggestions(@Query('q') query = '') {
    return this.taxonomy.suggest(query);
  }

  @Post('autofill')
  @ApiBearerAuth()
  @CompanyPermissions('job.create')
  async autofillJob(@Body() dto: JobAutofillDtoShape, @CompanyContextParam() company: CompanyContext) {
    return this.autofill.build(company.companyId, dto);
  }

  @Get('company/:companyId')
  @ApiBearerAuth()
  @CompanyPermissions('application.view')
  async companyJobs(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Query() query: CompanyJobsQuery,
  ) {
    return this.jobsService.listCompanyJobs(userId, companyId, query);
  }

  @Get('managed/:id')
  async managed(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.jobsService.getById(id, userId, true);
  }

  @Public()
  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser('userId') userId?: string) {
    return this.jobsService.getById(id, userId);
  }

  @Post()
  @ApiBearerAuth()
  @CompanyPermissions('job.create')
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateJobDto,
    @CompanyContextParam() company: CompanyContext,
    @Req() req: AuthRequest,
  ) {
    return this.jobsService.create(userId, company.companyId, dto, requestMeta(req));
  }

  @Patch(':id')
  @ApiBearerAuth()
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
    @Req() req: AuthRequest,
  ) {
    return this.jobsService.update(userId, id, dto, requestMeta(req));
  }

  @Post(':id/submit')
  @ApiBearerAuth()
  async submit(@CurrentUser('userId') userId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.jobsService.submit(userId, id, requestMeta(req));
  }

  @Post(':id/publish')
  @ApiBearerAuth()
  async publish(@CurrentUser('userId') userId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.jobsService.publish(userId, id, requestMeta(req));
  }

  @Post(':id/close')
  @ApiBearerAuth()
  async close(@CurrentUser('userId') userId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.jobsService.close(userId, id, requestMeta(req));
  }

  @Post(':id/pause')
  pause(@CurrentUser('userId') userId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.jobsService.pause(userId, id, requestMeta(req));
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser('userId') userId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.jobsService.duplicate(userId, id, requestMeta(req));
  }

  @Delete(':id')
  @ApiBearerAuth()
  async delete(@CurrentUser('userId') userId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.jobsService.delete(userId, id, requestMeta(req));
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
