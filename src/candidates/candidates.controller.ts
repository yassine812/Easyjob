import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyContextParam } from '../common/decorators/company-context.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { CandidatesService } from './candidates.service';
import { ResumesService } from './resumes.service';
import {
  AddSkillDto,
  EducationDto,
  ExperienceDto,
  JobPreferenceDto,
  SaveJobDto,
  UpdateCandidateProfileDto,
} from './dto/candidate.dto';
import type { AuthRequest, CompanyContext } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

@ApiTags('candidates')
@ApiBearerAuth()
@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly resumesService: ResumesService,
  ) {}

  // ---- own profile ----

  @Get('me')
  async getMe(@CurrentUser('userId') userId: string) {
    return this.candidatesService.getMyProfile(userId);
  }

  @Patch('me')
  async updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateCandidateProfileDto) {
    return this.candidatesService.updateProfile(userId, dto);
  }

  // ---- skills ----

  @Post('me/skills')
  async addSkill(@CurrentUser('userId') userId: string, @Body() dto: AddSkillDto) {
    return this.candidatesService.addSkill(userId, dto);
  }

  @Delete('me/skills/:skillId')
  async removeSkill(@CurrentUser('userId') userId: string, @Param('skillId') skillId: string) {
    return this.candidatesService.removeSkill(userId, skillId);
  }

  // ---- experiences ----

  @Post('me/experiences')
  async addExperience(@CurrentUser('userId') userId: string, @Body() dto: ExperienceDto) {
    return this.candidatesService.addExperience(userId, dto);
  }

  @Patch('me/experiences/:id')
  async updateExperience(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ExperienceDto,
  ) {
    return this.candidatesService.updateExperience(userId, id, dto);
  }

  @Delete('me/experiences/:id')
  async deleteExperience(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.candidatesService.deleteExperience(userId, id);
  }

  // ---- education ----

  @Post('me/education')
  async addEducation(@CurrentUser('userId') userId: string, @Body() dto: EducationDto) {
    return this.candidatesService.addEducation(userId, dto);
  }

  @Patch('me/education/:id')
  async updateEducation(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: EducationDto,
  ) {
    return this.candidatesService.updateEducation(userId, id, dto);
  }

  @Delete('me/education/:id')
  async deleteEducation(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.candidatesService.deleteEducation(userId, id);
  }

  // ---- resumes ----

  @Post('me/resumes')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async uploadResume(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    if (!file) {
      return this.resumesService.badRequest();
    }
    return this.resumesService.upload(userId, file, requestMeta(req));
  }

  @Get('me/resumes')
  async listResumes(@CurrentUser('userId') userId: string) {
    return this.resumesService.list(userId);
  }

  @Post('me/resumes/:id/primary')
  async setPrimaryResume(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.resumesService.setPrimary(userId, id);
  }

  @Delete('me/resumes/:id')
  async deleteResume(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.resumesService.remove(userId, id);
  }

  @Get('me/resumes/:id/download')
  async downloadResume(@CurrentUser('userId') userId: string, @Param('id') id: string, @Req() req: AuthRequest) {
    return this.resumesService.getDownloadUrl(userId, id, requestMeta(req));
  }

  // ---- saved jobs ----

  @Post('me/saved-jobs')
  async saveJob(@CurrentUser('userId') userId: string, @Body() dto: SaveJobDto) {
    return this.candidatesService.saveJob(userId, dto);
  }

  @Get('me/saved-jobs')
  async listSavedJobs(@CurrentUser('userId') userId: string) {
    return this.candidatesService.listSavedJobs(userId);
  }

  @Delete('me/saved-jobs/:jobId')
  async removeSavedJob(@CurrentUser('userId') userId: string, @Param('jobId') jobId: string) {
    return this.candidatesService.removeSavedJob(userId, jobId);
  }

  // ---- job preferences ----

  @Get('me/job-preferences')
  async getJobPreferences(@CurrentUser('userId') userId: string) {
    return this.candidatesService.getJobPreferences(userId);
  }

  @Put('me/job-preferences')
  async updateJobPreferences(@CurrentUser('userId') userId: string, @Body() dto: JobPreferenceDto) {
    return this.candidatesService.updateJobPreferences(userId, dto);
  }

  // ---- company view ----

  @Get(':id')
  @CompanyPermissions('candidate.view')
  async viewCandidate(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @CompanyContextParam() company: CompanyContext,
  ) {
    return this.candidatesService.viewCandidateAsCompany(userId, id, company);
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
