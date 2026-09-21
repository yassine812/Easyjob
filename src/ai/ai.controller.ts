import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';

class AnalyzeCvDto {
  @IsString()
  @IsNotEmpty()
  resumeId!: string;
}

class JobRefDto {
  @IsString()
  @IsNotEmpty()
  jobId!: string;
}

class ListAnalysesQuery {
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

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('cv/analyze')
  async analyzeCv(@CurrentUser('userId') userId: string, @Body() dto: AnalyzeCvDto) {
    return this.aiService.analyzeCv(userId, dto.resumeId);
  }

  @Post('cv/generate')
  async generateCv(@CurrentUser('userId') userId: string) {
    return this.aiService.generateCv(userId);
  }

  @Post('match')
  async matchJob(@CurrentUser('userId') userId: string, @Body() dto: JobRefDto) {
    return this.aiService.matchJob(userId, dto.jobId);
  }

  @Post('cover-letter')
  async coverLetter(@CurrentUser('userId') userId: string, @Body() dto: JobRefDto) {
    return this.aiService.coverLetter(userId, dto.jobId);
  }

  @Post('interview')
  async interviewPrep(@CurrentUser('userId') userId: string, @Body() dto: JobRefDto) {
    return this.aiService.interviewPrep(userId, dto.jobId);
  }

  @Get('analyses')
  async listAnalyses(@CurrentUser('userId') userId: string, @Query() query: ListAnalysesQuery) {
    return this.aiService.listAnalyses(userId, query);
  }

  @Get('analyses/:id')
  async getAnalysis(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.aiService.getAnalysis(userId, id);
  }
}
