import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyAccessService } from '../companies/company-access.service';
import { ExternalResearchService } from './external-research.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('companies/:companyId/research')
export class ExternalResearchController {
  constructor(private readonly research: ExternalResearchService, private readonly access: CompanyAccessService, private readonly prisma: PrismaService) {}
  @Get()
  async get(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string) {
    await this.access.assertPermission(userId, companyId, 'team.view');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { commercialName: true, website: true } });
    return this.research.getCachedCompany({ companyName: company.commercialName, website: company.website });
  }
  @Get('job-context')
  async jobContext(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string, @Query('title') title = '', @Query('seniority') seniority?: string, @Query('technologies') technologies = '') {
    await this.access.assertPermission(userId, companyId, 'team.view');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { commercialName: true, website: true } });
    return this.research.getCachedJobContext({ companyName: company.commercialName, website: company.website, title, seniority, technologies: technologies.split(',').map(value => value.trim()).filter(Boolean) });
  }
  @Post('job-context')
  async enqueueJobContext(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string, @Body() body: { title?: string; seniority?: string; technologies?: string[] }) {
    await this.access.assertPermission(userId, companyId, 'team.view');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { commercialName: true, website: true } });
    return this.research.enqueueJobContext({ companyName: company.commercialName, website: company.website, title: body.title ?? '', seniority: body.seniority, technologies: body.technologies ?? [] });
  }
  @Get('doctor') doctor(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string) { return this.access.assertPermission(userId, companyId, 'team.view').then(() => this.research.doctor()); }
  @Post() async enqueue(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string) {
    await this.access.assertPermission(userId, companyId, 'team.view');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { commercialName: true, website: true } });
    return this.research.enqueueCompany({ companyName: company.commercialName, website: company.website });
  }
}
