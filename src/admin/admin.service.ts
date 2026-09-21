import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyStatus, JobStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginate, resolvePagination } from '../common/utils/pagination';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listVerifications(query: { page?: number; limit?: number; status?: VerificationStatus }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyVerification.findMany({
        where,
        include: {
          company: { select: { id: true, commercialName: true, legalName: true, slug: true, status: true } },
          documents: { select: { id: true, filename: true, mimeType: true, fileSize: true, createdAt: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.companyVerification.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async getVerification(verificationId: string) {
    const verification = await this.prisma.companyVerification.findUnique({
      where: { id: verificationId },
      include: {
        company: {
          select: {
            id: true,
            commercialName: true,
            legalName: true,
            slug: true,
            status: true,
            registrationIdentifier: true,
            professionalEmail: true,
            city: true,
            country: true,
          },
        },
        documents: { select: { id: true, filename: true, mimeType: true, fileSize: true, createdAt: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!verification) throw new NotFoundException('Verification not found');
    return verification;
  }

  async listCompanies(query: { page?: number; limit?: number; status?: CompanyStatus; search?: string }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { commercialName: { contains: query.search, mode: 'insensitive' as const } },
              { legalName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: { _count: { select: { members: true, jobs: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.company.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async listJobs(query: { page?: number; limit?: number; status?: JobStatus; search?: string }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { company: { commercialName: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: {
          company: { select: { id: true, commercialName: true, slug: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async listSubscriptions(query: { page?: number; limit?: number }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        include: {
          plan: { select: { id: true, name: true, type: true, priceCents: true, currency: true } },
          candidate: { select: { id: true, user: { select: { name: true, email: true } } } },
          company: { select: { id: true, commercialName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.subscription.count(),
    ]);
    return paginate(items, total, page, limit);
  }

  async listAuditLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    actorId?: string;
  }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }
}
