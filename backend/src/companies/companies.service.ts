import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from './company-access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import type { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async create(_userId: string, _dto: CreateCompanyDto, _meta: RequestMeta) {
    throw new ForbiddenException('Company accounts must be provisioned through the platform administration');
  }

  async getById(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Company not found');
    // Public profile excludes internal team, registration identifiers and preferences.
    return { id: company.id, commercialName: company.commercialName, slug: company.slug,
      website: company.website, industry: company.industry, description: company.description,
      city: company.city, country: company.country, size: company.size, culture: company.culture,
      benefits: company.benefits, logoKey: company.logoKey, status: company.status };
  }

  async privateProfile(userId: string, companyId: string) {
    await this.access.assertPermission(userId, companyId, 'team.manage');
    return this.access.getCompanyOrThrow(companyId);
  }

  async getBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!company || company.status === 'SUSPENDED') throw new NotFoundException('Company not found');
    return this.getById(company.id);
  }

  async update(userId: string, companyId: string, dto: UpdateCompanyDto, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'team.manage');
    const data: Prisma.CompanyUpdateInput = {};
    if (dto.size !== undefined) data.size = dto.size;
    if (dto.culture !== undefined) data.culture = dto.culture;
    if (dto.benefits !== undefined) data.benefits = dto.benefits;
    if (dto.legalName !== undefined) data.legalName = dto.legalName;
    if (dto.commercialName !== undefined) data.commercialName = dto.commercialName;
    if (dto.website !== undefined) data.website = dto.website ?? null;
    if (dto.industry !== undefined) data.industry = dto.industry ?? null;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.address !== undefined) data.address = dto.address ?? null;
    if (dto.city !== undefined) data.city = dto.city ?? null;
    if (dto.country !== undefined) data.country = dto.country ?? null;
    if (dto.phone !== undefined) data.phone = dto.phone ?? null;
    if (dto.professionalEmail !== undefined) data.professionalEmail = dto.professionalEmail ?? null;
    if (dto.registrationIdentifier !== undefined) data.registrationIdentifier = dto.registrationIdentifier ?? null;

    const company = await this.prisma.company.update({ where: { id: companyId }, data });
    await this.audit.log({
      actorId: userId,
      action: 'company.updated',
      entityType: 'Company',
      entityId: companyId,
      metadata: { fields: Object.keys(data) },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toDto(company);
  }

  async getMembers(companyId: string) {
    const members = await this.prisma.companyMember.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      isOwner: m.isOwner,
      position: m.position,
      status: m.status,
      createdAt: m.createdAt,
    }));
  }

  async myCompanies(userId: string) {
    const members = await this.access.getActiveMemberships(userId);
    const companies = await this.prisma.company.findMany({
      where: { id: { in: members.map((m) => m.companyId) } },
    });
    return companies.map((c) => ({ ...this.toDto(c), myRole: members.find((m) => m.companyId === c.id)?.role }));
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true, trim: true }) || 'company';
    let candidate = base;
    for (let i = 1; i < 10; i++) {
      const existing = await this.prisma.company.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
      candidate = `${base}-${i}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private toDto(company: {
    id: string;
    legalName: string;
    commercialName: string;
    slug: string;
    website: string | null;
    industry: string | null;
    description: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    professionalEmail: string | null;
    registrationIdentifier: string | null;
    logoKey: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    members?: Array<{ id: string; role: string; user: { id: string; name: string } }>;
  }) {
    return {
      id: company.id,
      legalName: company.legalName,
      commercialName: company.commercialName,
      slug: company.slug,
      website: company.website,
      industry: company.industry,
      description: company.description,
      address: company.address,
      city: company.city,
      country: company.country,
      phone: company.phone,
      professionalEmail: company.professionalEmail,
      registrationIdentifier: company.registrationIdentifier,
      status: company.status,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      ...(company.members
        ? { members: company.members.map((m) => ({ id: m.id, role: m.role, name: m.user.name, userId: m.user.id })) }
        : {}),
    };
  }
}
