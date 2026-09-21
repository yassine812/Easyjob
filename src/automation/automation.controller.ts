import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { AutomationService } from './automation.service';
import { AutomationRuleDto } from './dto/automation.dto';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

class ExecutionsQuery {
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

@ApiTags('automation')
@ApiBearerAuth()
@Controller('companies/:companyId/automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('rules')
  @CompanyPermissions('automation.manage')
  async create(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Body() dto: AutomationRuleDto,
    @Req() req: AuthRequest,
  ) {
    return this.automationService.createRule(userId, companyId, dto, requestMeta(req));
  }

  @Get('rules')
  @CompanyPermissions('automation.manage')
  async list(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string) {
    return this.automationService.listRules(userId, companyId);
  }

  @Patch('rules/:ruleId')
  @CompanyPermissions('automation.manage')
  async update(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: Partial<AutomationRuleDto>,
    @Req() req: AuthRequest,
  ) {
    return this.automationService.updateRule(userId, companyId, ruleId, dto, requestMeta(req));
  }

  @Delete('rules/:ruleId')
  @CompanyPermissions('automation.manage')
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('ruleId') ruleId: string,
    @Req() req: AuthRequest,
  ) {
    return this.automationService.deleteRule(userId, companyId, ruleId, requestMeta(req));
  }

  @Get('executions')
  @CompanyPermissions('automation.manage')
  async executions(@Param('companyId') companyId: string, @Query() query: ExecutionsQuery) {
    return this.automationService.listExecutions(companyId, query);
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
