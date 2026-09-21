import { Body, Controller, Get, Param, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CareerService } from './career.service';
import { BuildDraftDto, CareerSearchDto, CareerSettingsDto, CoachAnswerDto, CreateCoachDto, ProfessionalDataDto, SaveDraftDto, RegenerateSectionDto } from './career.dto';

@ApiTags('candidate-career')
@ApiBearerAuth()
@Controller('career')
export class CareerController {
  constructor(private readonly career: CareerService) {}
  @Get('overview') overview(@CurrentUser('userId') uid: string) { return this.career.overview(uid); }
  @Get('jobs') jobs(@CurrentUser('userId') uid: string, @Query() query: CareerSearchDto) { return this.career.search(uid, query); }
  @Get('facets') async facets(@CurrentUser('userId') uid: string) { await this.career.profile(uid); return this.career.facets(); }
  @Get('recommendations') recommendations(@CurrentUser('userId') uid: string, @Query() query: CareerSearchDto) { return this.career.search(uid, query, true); }
  @Get('resumes/:id/report') report(@CurrentUser('userId') uid: string, @Param('id') id: string, @Query('jobId') jobId?: string) { return this.career.report(uid, id, jobId); }
  @Post('resumes/:id/import') import(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.importResume(uid, id); }
  @Get('profile-details') details(@CurrentUser('userId') uid: string) { return this.career.professionalData(uid); }
  @Put('profile-details') saveDetails(@CurrentUser('userId') uid: string, @Body() dto: ProfessionalDataDto) { return this.career.professionalData(uid, dto); }
  @Get('drafts') drafts(@CurrentUser('userId') uid: string) { return this.career.drafts(uid); }
  @Post('drafts') build(@CurrentUser('userId') uid: string, @Body() dto: BuildDraftDto) { return this.career.buildDraft(uid, dto); }
  @Patch('drafts/:id') save(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: SaveDraftDto) { return this.career.saveDraft(uid, id, dto); }
  @Post('drafts/:id/publish') publish(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.publishDraft(uid, id); }
  @Post('drafts/:id/sections/regenerate') regenerate(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: RegenerateSectionDto) { return this.career.regenerateSection(uid, id, dto); }
  @Get('settings') settings(@CurrentUser('userId') uid: string) { return this.career.settings(uid); }
  @Patch('settings') updateSettings(@CurrentUser('userId') uid: string, @Body() dto: CareerSettingsDto) { return this.career.updateSettings(uid, dto); }
  @Get('history') history(@CurrentUser('userId') uid: string) { return this.career.history(uid); }
  @Get('auto-stats') autoStats(@CurrentUser('userId') uid: string) { return this.career.autoStats(uid); }
  @Get('coach') sessions(@CurrentUser('userId') uid: string) { return this.career.coachSessions(uid); }
  @Get('company-suggestions') companySuggestions(@CurrentUser('userId') uid: string, @Query('q') query = '') { return this.career.companySuggestions(uid, query); }
  @Post('coach') createCoach(@CurrentUser('userId') uid: string, @Body() dto: CreateCoachDto) { return this.career.createCoach(uid, dto); }
  @Post('coach/:id/answers') answer(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: CoachAnswerDto) { return this.career.answerCoach(uid, id, dto); }
  @Post('coach/:id/vision')
  @UseInterceptors(FileInterceptor('frame', { limits: { fileSize: 1024 * 1024 } }))
  vision(@CurrentUser('userId') uid: string, @Param('id') id: string, @UploadedFile() frame: Express.Multer.File) { return this.career.vision(uid, id, frame); }
}
