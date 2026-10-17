import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InterviewBriefService } from './interview-brief.service';

class BriefQuestionDto {
  @IsOptional() @IsString() @MaxLength(2000) question?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsIn(['HIGH', 'MEDIUM', 'OPTIONAL']) priority?: string;
  @IsOptional() @IsString() @MaxLength(5000) recruiterNote?: string;
  @IsOptional() @IsBoolean() covered?: boolean;
}
class AddBriefQuestionDto { @IsString() @MaxLength(2000) question!: string; }

@Controller('interviews')
export class InterviewBriefController {
  constructor(private readonly briefs: InterviewBriefService) {}
  @Get(':id/brief') get(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.briefs.get(userId, id); }
  @Post(':id/brief/regenerate') regenerate(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.briefs.generate(id, userId); }
  @Get(':id/brief/research') research(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.briefs.researchContext(userId, id); }
  @Post(':id/brief/research') refreshResearch(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.briefs.refreshResearchContext(userId, id); }
  @Patch(':id/brief/questions/:questionId') updateQuestion(@CurrentUser('userId') userId: string, @Param('id') id: string, @Param('questionId') questionId: string, @Body() body: BriefQuestionDto) { return this.briefs.updateQuestion(userId, id, questionId, body); }
  @Delete(':id/brief/questions/:questionId') deleteQuestion(@CurrentUser('userId') userId: string, @Param('id') id: string, @Param('questionId') questionId: string) { return this.briefs.deleteQuestion(userId, id, questionId); }
  @Post(':id/brief/questions') addQuestion(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() body: AddBriefQuestionDto) { return this.briefs.addQuestion(userId, id, body.question); }
  @Get(':id/brief/pdf') async pdf(@CurrentUser('userId') userId: string, @Param('id') id: string, @Res() response: Response): Promise<void> {
    const file = await this.briefs.pdf(userId, id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="easyjob-interview-brief-${id}.pdf"`);
    Readable.from(file).pipe(response);
  }
}
