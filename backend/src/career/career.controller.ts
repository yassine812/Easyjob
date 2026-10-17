import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CareerService } from './career.service';
import { JobMarketplaceService } from './job-marketplace.service';
import { ApplicationRequirementsService } from './application-requirements.service';
import { ApplyDto } from '../applications/dto/application.dto';
import { BuildDraftDto, CareerSearchDto, CareerSettingsDto, CoachAnswerDto, CoachTurnDto, CreateCoachDto, InterviewAutoTestDto, ProfessionalDataDto, SaveDraftDto, RegenerateSectionDto } from './career.dto';
import { CareerOpsService } from './career-ops.service';

@ApiTags('candidate-career')
@ApiBearerAuth()
@Controller('career')
export class CareerController {
  constructor(private readonly career: CareerService, private readonly marketplace: JobMarketplaceService, private readonly requirements: ApplicationRequirementsService, private readonly careerOps: CareerOpsService) {}
  @Get('overview') overview(@CurrentUser('userId') uid: string) { return this.career.overview(uid); }
  @Get('jobs') jobs(@CurrentUser('userId') uid: string, @Query() query: CareerSearchDto) { return this.marketplace.search(uid, query); }
  @Get('jobs/:id') job(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.marketplace.getJob(uid, id); }
  @Get('jobs/:id/preparation') preparation(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.marketplace.preparationWorkspace(uid, id); }
  @Get('jobs/:id/application-requirements') applicationRequirements(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.requirements.getRequirements(uid, id); }
  @Post('jobs/:id/quality-check') qualityCheck(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: ApplyDto) { return this.marketplace.qualityCheck(uid, id, dto); }
  @Get('jobs/:id/evidence') evidence(@CurrentUser('userId') uid: string, @Param('id') id: string, @Query('resumeId') resumeId: string) { return this.marketplace.evidenceForResume(uid, id, resumeId); }
  @Get('jobs/:id/tailoring') tailoring(@CurrentUser('userId') uid: string, @Param('id') id: string, @Query('resumeId') resumeId?: string, @Query('locale') locale?: string) { return this.careerOps.tailor(uid, id, resumeId, locale); }
  @Get('jobs/:id/fit') fit(@CurrentUser('userId') uid: string, @Param('id') id: string, @Query('resumeId') resumeId?: string, @Query('locale') locale?: string) { return this.careerOps.fit(uid, id, resumeId, locale); }
  @Get('jobs/:id/interview-prep') interviewPrep(@CurrentUser('userId') uid: string, @Param('id') id: string, @Query('resumeId') resumeId?: string, @Query('locale') locale?: string) { return this.careerOps.interviewPrep(uid, id, resumeId, locale); }
  @Get('jobs/:id/duplicates') duplicates(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.careerOps.duplicates(uid, id); }
  @Post('jobs/:id/negotiation-prep') negotiation(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.careerOps.negotiation(uid, id, body); }
  @Get('applications/:id/follow-up') followup(@CurrentUser('userId') uid: string, @Param('id') id: string, @Query('locale') locale?: string) { return this.careerOps.followup(uid, id, locale); }
  @Get('saved-external') savedExternalJobs(@CurrentUser('userId') uid: string) { return this.marketplace.savedExternalJobs(uid); }
  @Post('jobs/:id/save') saveJob(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.marketplace.save(uid, id, true); }
  @Delete('jobs/:id/save') removeSavedJob(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.marketplace.save(uid, id, false); }
  @Post('jobs/:id/cover-letter') jobCoverLetter(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body('resumeId') resumeId?: string, @Body('locale') locale?: string, @Body('length') length?: string) { return this.marketplace.generateNativeCoverLetter(uid, id, resumeId, locale, length); }
  @Post('external-jobs/:id/cover-letter') externalCoverLetter(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body('resumeId') resumeId?: string, @Body('locale') locale?: string, @Body('length') length?: string) { return this.marketplace.generateExternalCoverLetter(uid, id, resumeId, locale, length); }
  @Post('external-jobs/:id/prepare') prepareExternal(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: ApplyDto) { return this.marketplace.prepareExternal(uid, id, dto); }
  @Post('external-jobs/:id/open') openExternal(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.marketplace.openExternal(uid, id); }
  @Get('external-applications') externalApplications(@CurrentUser('userId') uid: string) { return this.marketplace.externalApplications(uid); }
  @Get('facets') async facets(@CurrentUser('userId') uid: string) { await this.career.profile(uid); return this.career.facets(); }
  @Get('recommendations') recommendations(@CurrentUser('userId') uid: string, @Query() query: CareerSearchDto) { return this.marketplace.search(uid, query, true); }
  @Get('resumes/:id/report') report(@CurrentUser('userId') uid: string, @Param('id') id: string, @Query('jobId') jobId?: string) { return this.career.report(uid, id, jobId); }
  @Post('resumes/:id/import') import(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.importResume(uid, id); }
  @Get('profile-details') details(@CurrentUser('userId') uid: string) { return this.career.professionalData(uid); }
  @Put('profile-details') saveDetails(@CurrentUser('userId') uid: string, @Body() dto: ProfessionalDataDto) { return this.career.professionalData(uid, dto); }
  @Get('drafts') drafts(@CurrentUser('userId') uid: string) { return this.career.drafts(uid); }
  @Get('drafts/:id/revisions') revisions(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.revisions(uid, id); }
  @Post('drafts') build(@CurrentUser('userId') uid: string, @Body() dto: BuildDraftDto) { return this.career.buildDraft(uid, dto); }
  @Patch('drafts/:id') save(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: SaveDraftDto) { return this.career.saveDraft(uid, id, dto); }
  @Post('drafts/:id/publish') publish(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.publishDraft(uid, id); }
  @Post('drafts/:id/sections/regenerate') regenerate(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: RegenerateSectionDto) { return this.career.regenerateSection(uid, id, dto); }
  @Get('settings') settings(@CurrentUser('userId') uid: string) { return this.career.settings(uid); }
  @Patch('settings') updateSettings(@CurrentUser('userId') uid: string, @Body() dto: CareerSettingsDto) { return this.career.updateSettings(uid, dto); }
  @Get('history') history(@CurrentUser('userId') uid: string) { return this.career.history(uid); }
  @Get('auto-stats') autoStats(@CurrentUser('userId') uid: string) { return this.career.autoStats(uid); }
  @Get('star-stories') starStories(@CurrentUser('userId') uid: string) { return this.careerOps.listStories(uid); }
  @Post('star-stories') createStarStory(@CurrentUser('userId') uid: string, @Body() body: Record<string, unknown>) { return this.careerOps.createStory(uid, body); }
  @Patch('star-stories/:id') updateStarStory(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.careerOps.updateStory(uid, id, body); }
  @Delete('star-stories/:id') deleteStarStory(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.careerOps.deleteStory(uid, id); }
  @Get('coach') sessions(@CurrentUser('userId') uid: string) { return this.career.coachSessions(uid); }
  @Get('coach/analyze/:jobId') analyzeCoachJob(@CurrentUser('userId') uid: string, @Param('jobId') jobId: string) { return this.career.analyzeCoachJob(uid, jobId); }
  @Get('company-suggestions') companySuggestions(@CurrentUser('userId') uid: string, @Query('q') query = '') { return this.career.companySuggestions(uid, query); }
  @Post('coach') createCoach(@CurrentUser('userId') uid: string, @Body() dto: CreateCoachDto) { return this.career.createCoach(uid, dto); }
  @Post('coach/:id/answers') answer(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: CoachAnswerDto) { return this.career.answerCoach(uid, id, dto); }
  @Patch('coach/:id/turn') saveTurn(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: CoachTurnDto) { return this.career.saveCoachTurn(uid, id, dto); }
  @Post('coach/:id/autotest') startAutoTest(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: InterviewAutoTestDto) { return this.career.startCoachAutoTest(uid, id, dto); }
  @Post('coach/:id/autotest/answer') autoTestAnswer(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.answerCoachAutoTest(uid, id); }
  @Post('coach/:id/autotest/complete') completeAutoTest(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.completeCoachAutoTest(uid, id); }
  @Post('coach/:id/autotest/stop') stopAutoTest(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.stopCoachAutoTest(uid, id); }
  @Post('coach/:id/targeted-practice') targetedPractice(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.targetedCoach(uid, id); }
  @Post('coach/:id/vision-consent') enableVision(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.career.enableVision(uid, id); }
  @Post('coach/:id/vision')
  @UseInterceptors(FileInterceptor('frame', { limits: { fileSize: 1024 * 1024 } }))
  vision(@CurrentUser('userId') uid: string, @Param('id') id: string, @UploadedFile() frame: Express.Multer.File) { return this.career.vision(uid, id, frame); }
}
