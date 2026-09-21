import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { CompaniesService, type RequestMeta } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import type { AuthRequest } from '../common/types/auth';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Public() @Get('profile/:slug')
  async publicProfile(@Param('slug') slug: string) { return this.companiesService.getBySlug(slug); }

  @Get(':id/private')
  @ApiBearerAuth()
  @CompanyPermissions('team.manage')
  async privateProfile(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.companiesService.privateProfile(userId, id);
  }

  @Post()
  @ApiBearerAuth()
  async create(@CurrentUser('userId') userId: string, @Body() dto: CreateCompanyDto, @Req() req: AuthRequest) {
    return this.companiesService.create(userId, dto, requestMeta(req));
  }

  @Public()
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.companiesService.getById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @CompanyPermissions('team.manage')
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @Req() req: AuthRequest,
  ) {
    return this.companiesService.update(userId, id, dto, requestMeta(req));
  }

  @Get(':id/members')
  @ApiBearerAuth()
  @CompanyPermissions('team.view')
  async members(@Param('id') id: string) {
    return this.companiesService.getMembers(id);
  }

  @Get('me/list')
  @ApiBearerAuth()
  async myCompanies(@CurrentUser('userId') userId: string) {
    return this.companiesService.myCompanies(userId);
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
