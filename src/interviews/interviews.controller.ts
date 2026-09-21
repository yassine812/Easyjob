import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

@ApiTags('interviews')
@ApiBearerAuth()
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateInterviewDto, @Req() req: AuthRequest) {
    return this.interviewsService.create(userId, dto, requestMeta(req));
  }

  @Get(':id')
  async getById(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.interviewsService.getById(id, userId);
  }

  @Get('applications/:applicationId')
  async listForApplication(
    @CurrentUser('userId') userId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.interviewsService.listForApplication(applicationId, userId);
  }

  @Patch(':id')
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
    @Req() req: AuthRequest,
  ) {
    return this.interviewsService.update(userId, id, dto, requestMeta(req));
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
