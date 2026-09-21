import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RecruitmentAiService } from './recruitment-ai.service';
import { InterviewAnswersDto, InterviewQuestionsDto, RecruitmentAiDto } from './dto/workspace.dto';
@ApiTags('recruitment-ai') @ApiBearerAuth() @Controller()
export class RecruitmentAiController {
  constructor(private readonly service: RecruitmentAiService) {}
  @Post('companies/:companyId/workspace/ai') assist(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Body() d: RecruitmentAiDto) { return this.service.assist(u, c, d); }
  @Post('companies/:companyId/workspace/interviews/:id/questions') questions(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('id') id: string, @Body() d: InterviewQuestionsDto) { return this.service.publishQuestions(u, c, id, d); }
  @Post('companies/:companyId/workspace/interviews/:id/report') report(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('id') id: string) { return this.service.report(u, c, id); }
  @Get('recruitment-interviews/:id') candidate(@CurrentUser('userId') u: string, @Param('id') id: string) { return this.service.candidateInterview(u, id); }
  @Post('recruitment-interviews/:id/answers') answers(@CurrentUser('userId') u: string, @Param('id') id: string, @Body() d: InterviewAnswersDto) { return this.service.submitAnswers(u, id, d); }
}
