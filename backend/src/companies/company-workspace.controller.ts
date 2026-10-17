import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyWorkspaceService } from './company-workspace.service';
import { AssignmentDto, CommunicationDto, EmailTemplateDto, FeedbackDto, RecruitmentSettingsDto, WorkspaceQuery } from './dto/workspace.dto';

@ApiTags('company-workspace') @ApiBearerAuth()
@Controller('companies/:companyId/workspace')
export class CompanyWorkspaceController {
  constructor(private readonly service: CompanyWorkspaceService) {}
  @Get('jobs/:jobId/assignments') assignments(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('jobId') j: string) { return this.service.assignments(u, c, j); }
  @Get('applications/:applicationId/messages') messages(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('applicationId') a: string, @Query() q: WorkspaceQuery) { return this.service.communications(u, c, a, q); }
  @Get('billing') billing(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Query() q: WorkspaceQuery) { return this.service.billing(u, c, q); }
  @Get('overview') overview(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Query() q: WorkspaceQuery) { return this.service.overview(u, c, q); }
  @Get('settings') settings(@CurrentUser('userId') u: string, @Param('companyId') c: string) { return this.service.settings(u, c); }
  @Patch('settings') saveSettings(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Body() d: RecruitmentSettingsDto) { return this.service.saveSettings(u, c, d); }
  @Get('interviews') interviews(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Query() q: WorkspaceQuery) { return this.service.interviews(u, c, q); }
  @Get('candidates') candidates(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Query() q: WorkspaceQuery) { return this.service.candidates(u, c, q); }
  @Get('search') search(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Query() q: WorkspaceQuery) { return this.service.search(u, c, q); }
  @Patch('jobs/:jobId/assignments') assign(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('jobId') j: string, @Body() d: AssignmentDto) { return this.service.assign(u, c, j, d); }
  @Get('templates') templates(@CurrentUser('userId') u: string, @Param('companyId') c: string) { return this.service.templates(u, c); }
  @Post('templates') saveTemplate(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Body() d: EmailTemplateDto) { return this.service.saveTemplate(u, c, d); }
  @Post('applications/:applicationId/messages') communicate(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('applicationId') a: string, @Body() d: CommunicationDto) { return this.service.communicate(u, c, a, d); }
  @Post('interviews/:interviewId/feedback') feedback(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('interviewId') i: string, @Body() d: FeedbackDto) { return this.service.feedback(u, c, i, d); }
  @Get('audit') audit(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Query() q: WorkspaceQuery) { return this.service.auditLog(u, c, q); }
}
