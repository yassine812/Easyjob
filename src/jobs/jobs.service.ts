import { removeSkillRequirements, publicJobSalary } from './job-content';
import { availableJobWhere } from './job-availability';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { EmploymentType, JobStatus, Prisma } from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { emailTemplates } from '../queues/email/templates';
import { EntitlementService } from '../entitlements/entitlement.service';
import { paginate, resolvePagination } from '../common/utils/pagination';
import { isPast } from '../common/utils/dates';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';
import type { RequestMeta } from '../companies/companies.service';
import { JobQualityValidator } from './job-creation.service';

const JOB_SELECT = {
  id: true,
  companyId: true,
  createdById: true,
  title: true,
  department: true, benefits: true, preferredEducation: true, preferredLanguages: true, positions: true, interviewProcess: true,
  slug: true,
  description: true,
  responsibilities: true,
  requirements: true,
  applicationFields: true,
  location: true,
  contractType: true, languages: true, remote: true, domain: true, workMode: true, educationRequirement: true, minimumYearsExperience: true,
  employmentType: true,
  experienceLevel: true,
  salaryVisible: true,
  salaryMin: true,
  salaryMax: true,
  currency: true,
  status: true,
  expiresAt: true,
  publishedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, commercialName: true, slug: true, logoKey: true } },
  skills: { include: { skill: true } },
} satisfies Prisma.JobSelect;

const COMPANY_JOB_SELECT = {
  ...JOB_SELECT,
  applications: { select: { status: true } },
  _count: { select: { interviews: true } },
} satisfies Prisma.JobSelect;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly entitlements: EntitlementService,
    private readonly events: EventEmitter2,
  ) {}

  private normalizeSalary(dto: { salaryMin?: number | null; salaryMax?: number | null; currency?: string }) {
    if (dto.salaryMin != null && dto.salaryMax != null && dto.salaryMax < dto.salaryMin) {
      throw new BadRequestException('Maximum salary must be greater than or equal to minimum salary');
    }
    return dto.currency?.toUpperCase() ?? 'TND';
  }

  async create(userId: string, companyId: string, dto: CreateJobDto, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'job.create');
    await this.entitlements.assertCompanyLimit(companyId, 'activeJobs');

    const slug = await this.uniqueJobSlug(companyId, dto.title);
    const currency = this.normalizeSalary(dto);

    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          companyId,
          createdById: userId,
          title: dto.title.trim(),
          department: dto.department, benefits: dto.benefits, preferredEducation: dto.preferredEducation, preferredLanguages: dto.preferredLanguages, positions: dto.positions, interviewProcess: dto.interviewProcess,
          slug,
          description: dto.description.trim(),
          responsibilities: dto.responsibilities ?? [],
          requirements: removeSkillRequirements(dto.requirements ?? [], dto.skills ?? []),
          applicationFields: dto.applicationFields ? JSON.parse(JSON.stringify(dto.applicationFields)) : [],
          location: dto.location ?? null,
          contractType: dto.contractType || null, languages: dto.languages || [], remote: dto.workMode ? dto.workMode === 'REMOTE' : dto.remote ?? false,
          domain: dto.domain?.trim() || null, workMode: dto.workMode, educationRequirement: dto.educationRequirement?.trim() || null, minimumYearsExperience: dto.minimumYearsExperience,
          employmentType: dto.employmentType,
          experienceLevel: dto.experienceLevel,
          salaryVisible: dto.salaryVisible ?? true,
          salaryMin: dto.salaryMin ?? null,
          salaryMax: dto.salaryMax ?? null,
          currency,
          status: 'DRAFT',
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
      if (dto.skills && dto.skills.length > 0) {
        for (const skillDto of dto.skills) {
          const skill = await this.upsertSkill(tx, skillDto.name);
          await tx.jobSkill.create({
            data: {
              jobId: created.id,
              skillId: skill.id,
              required: skillDto.required ?? false,
              level: skillDto.level ?? 'INTERMEDIATE',
            },
          });
        }
      }
      return created;
    });

    await this.audit.log({
      actorId: userId,
      action: 'job.created',
      entityType: 'Job',
      entityId: job.id,
      metadata: { companyId, title: job.title },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.prisma.job.findUnique({ where: { id: job.id }, select: JOB_SELECT });
  }

  async update(userId: string, jobId: string, dto: UpdateJobDto, meta: RequestMeta) {
    const job = await this.loadJob(jobId);
    await this.access.assertPermission(userId, job.companyId, 'job.update');
    if (['EXPIRED', 'CLOSED'].includes(job.status)) {
      throw new BadRequestException(`Jobs in status ${job.status} cannot be edited`);
    }
    const salaryMin = dto.salaryMin === undefined ? job.salaryMin : dto.salaryMin;
    const salaryMax = dto.salaryMax === undefined ? job.salaryMax : dto.salaryMax;
    const currency = this.normalizeSalary({ salaryMin, salaryMax, currency: dto.currency ?? job.currency ?? 'TND' });

    const data: Prisma.JobUpdateInput = {
      ...(['APPROVED', 'PAUSED'].includes(job.status) ? { status: 'DRAFT' as const, approvedAt: null, approvedBy: { disconnect: true } } : {}),
      title: dto.title?.trim() ?? undefined,
      department: dto.department, benefits: dto.benefits, preferredEducation: dto.preferredEducation, preferredLanguages: dto.preferredLanguages, positions: dto.positions, interviewProcess: dto.interviewProcess,
      description: dto.description?.trim() ?? undefined,
      responsibilities: dto.responsibilities ?? undefined,
      requirements: dto.skills ? removeSkillRequirements(dto.requirements ?? job.requirements, dto.skills) : dto.requirements,
      applicationFields: dto.applicationFields ? JSON.parse(JSON.stringify(dto.applicationFields)) : undefined,
      location: dto.location ?? undefined,
      contractType: dto.contractType === undefined ? undefined : dto.contractType || null, languages: dto.languages, remote: dto.workMode ? dto.workMode === 'REMOTE' : dto.remote ?? undefined,
      domain: dto.domain === undefined ? undefined : dto.domain.trim() || null, workMode: dto.workMode,
      educationRequirement: dto.educationRequirement === undefined ? undefined : dto.educationRequirement.trim() || null,
      minimumYearsExperience: dto.minimumYearsExperience,
      employmentType: dto.employmentType ?? undefined,
      experienceLevel: dto.experienceLevel ?? undefined,
      salaryVisible: dto.salaryVisible,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      currency: dto.currency === undefined ? undefined : currency,
      expiresAt: dto.expiresAt === undefined ? undefined : dto.expiresAt ? new Date(dto.expiresAt) : null,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: jobId }, data });
      if (dto.skills) {
        await tx.jobSkill.deleteMany({ where: { jobId } });
        for (const skillDto of dto.skills) {
          const skill = await this.upsertSkill(tx, skillDto.name);
          await tx.jobSkill.create({
            data: {
              jobId,
              skillId: skill.id,
              required: skillDto.required ?? false,
              level: skillDto.level ?? 'INTERMEDIATE',
            },
          });
        }
      }
    });

    await this.audit.log({
      actorId: userId,
      action: 'job.updated',
      entityType: 'Job',
      entityId: jobId,
      metadata: { companyId: job.companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.prisma.job.findUnique({ where: { id: jobId }, select: JOB_SELECT });
  }

  async submit(userId: string, jobId: string, meta: RequestMeta) {
    const job = await this.loadJob(jobId);
    await this.access.assertPermission(userId, job.companyId, 'job.update');
    const qualityWarnings = new JobQualityValidator().validate(job);
    if (qualityWarnings.length) {
      throw new BadRequestException({ code: 'JOB_QUALITY_INVALID', warnings: qualityWarnings });
    }
    if (!['DRAFT', 'REJECTED'].includes(job.status)) {
      throw new BadRequestException(`Only DRAFT or REJECTED jobs can be submitted (current: ${job.status})`);
    }
    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'PENDING_APPROVAL', rejectionReason: null },
    });
    await this.audit.log({
      actorId: userId,
      action: 'job.submitted',
      entityType: 'Job',
      entityId: jobId,
      metadata: { companyId: job.companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id: updated.id, status: updated.status };
  }

  async publish(userId: string, jobId: string, meta: RequestMeta) {
    const job = await this.loadJob(jobId);
    await this.access.assertPermission(userId, job.companyId, 'job.publish');
    const qualityWarnings = new JobQualityValidator().validate(job);
    if (qualityWarnings.length) {
      throw new BadRequestException({ code: 'JOB_QUALITY_INVALID', warnings: qualityWarnings });
    }
    if (!['APPROVED', 'PAUSED'].includes(job.status)) {
      throw new BadRequestException('Only approved jobs can be published');
    }
    if (job.expiresAt && isPast(job.expiresAt)) {
      throw new BadRequestException('Job expiry date is in the past');
    }
    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    this.events.emit('analytics.invalidate.company', { companyId: job.companyId });
    await this.audit.log({
      actorId: userId,
      action: 'job.published',
      entityType: 'Job',
      entityId: jobId,
      metadata: { companyId: job.companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id: updated.id, status: updated.status, publishedAt: updated.publishedAt };
  }

  async close(userId: string, jobId: string, meta: RequestMeta) {
    const job = await this.loadJob(jobId);
    await this.access.assertPermission(userId, job.companyId, 'job.update');
    if (job.status === 'CLOSED') return { id: job.id, status: job.status };
    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'CLOSED' },
    });
    await this.audit.log({
      actorId: userId,
      action: 'job.closed',
      entityType: 'Job',
      entityId: jobId,
      metadata: { companyId: job.companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id: updated.id, status: updated.status };
  }

  async pause(userId: string, jobId: string, meta: RequestMeta) {
    const job = await this.loadJob(jobId);
    await this.access.assertPermission(userId, job.companyId, 'job.publish');
    if (job.status !== 'PUBLISHED') throw new BadRequestException('Only published jobs can be paused');
    const updated = await this.prisma.job.update({ where: { id: jobId, status: 'PUBLISHED' }, data: { status: 'PAUSED' } });
    await this.audit.log({ actorId: userId, action: 'job.paused', entityType: 'Job', entityId: jobId, metadata: { companyId: job.companyId }, ipAddress: meta.ip, userAgent: meta.userAgent });
    return { id: updated.id, status: updated.status };
  }

  async duplicate(userId: string, jobId: string, meta: RequestMeta) {
    const job = await this.loadJob(jobId);
    await this.access.assertPermission(userId, job.companyId, 'job.create');
    const skills = await this.prisma.jobSkill.findMany({ where: { jobId }, include: { skill: true } });
    return this.create(userId, job.companyId, {
      title: job.title, description: job.description, responsibilities: job.responsibilities, requirements: job.requirements,
      department: job.department ?? undefined, benefits: job.benefits, preferredEducation: job.preferredEducation ?? undefined, preferredLanguages: job.preferredLanguages, positions: job.positions, interviewProcess: job.interviewProcess ?? undefined,
      location: job.location ?? undefined, remote: job.remote, domain: job.domain ?? undefined,
      workMode: (job.workMode || (job.remote ? 'REMOTE' : 'ONSITE')) as CreateJobDto['workMode'],
      contractType: job.contractType ?? undefined, languages: job.languages, educationRequirement: job.educationRequirement ?? undefined, minimumYearsExperience: job.minimumYearsExperience ?? undefined,
      employmentType: job.employmentType, experienceLevel: job.experienceLevel, salaryMin: job.salaryMin ?? undefined,
      salaryMax: job.salaryMax ?? undefined, salaryVisible: job.salaryVisible, currency: job.currency ?? undefined,
      skills: skills.map(item => ({ name: item.skill.name, required: item.required, level: item.level })),
    }, meta);
  }

  async delete(userId: string, jobId: string, meta: RequestMeta) {
    const job = await this.loadJob(jobId);
    await this.access.assertPermission(userId, job.companyId, 'job.delete');
    const applications = await this.prisma.application.count({ where: { jobId } });
    if (applications > 0) {
      throw new ConflictException('Cannot delete a job that has applications; close it instead');
    }
    await this.prisma.job.delete({ where: { id: jobId } });
    await this.audit.log({
      actorId: userId,
      action: 'job.deleted',
      entityType: 'Job',
      entityId: jobId,
      metadata: { companyId: job.companyId, title: job.title },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { success: true };
  }

  /** Admin approval/rejection. Authorization enforced by the admin controller. */
  async adminApprove(adminId: string, jobId: string, meta?: RequestMeta) {
    const job = await this.loadJob(jobId);
    if (job.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Job is not pending approval (current: ${job.status})`);
    }
    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: adminId, rejectionReason: null },
    });
    await this.audit.log({
      actorId: adminId,
      action: 'job.approved',
      entityType: 'Job',
      entityId: jobId,
      metadata: { companyId: job.companyId },
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });
    await this.notifyJobOwner(
      job.companyId,
      job.createdById,
      'job.approved',
      'Job approved',
      `Your job "${job.title}" has been approved.`,
      emailTemplates.jobApproved(job.title),
    );
    return { id: updated.id, status: updated.status };
  }

  async adminReject(adminId: string, jobId: string, reason: string, meta?: RequestMeta) {
    const job = await this.loadJob(jobId);
    if (job.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Job is not pending approval (current: ${job.status})`);
    }
    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'REJECTED', rejectionReason: reason },
    });
    await this.audit.log({
      actorId: adminId,
      action: 'job.rejected',
      entityType: 'Job',
      entityId: jobId,
      metadata: { companyId: job.companyId, reason },
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });
    await this.notifyJobOwner(
      job.companyId,
      job.createdById,
      'job.rejected',
      'Job rejected',
      `Your job "${job.title}" was rejected. Reason: ${reason}`,
      emailTemplates.jobRejected(job.title, reason),
    );
    return { id: updated.id, status: updated.status };
  }

  async getById(jobId: string, userId?: string, managed = false) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: JOB_SELECT,
    });
    if (!job) throw new NotFoundException('Job not found');
    const publicCompany = await this.prisma.company.findFirst({ where: { id: job.companyId, status: 'ACTIVE', verification: { status: 'VERIFIED' } }, select: { id: true } });
    const publiclyAvailable = await this.prisma.job.findFirst({ where: { id: jobId, ...availableJobWhere() }, select: { id: true } });
    if (!publiclyAvailable || !publicCompany) {
      if (!userId) throw new NotFoundException('Job not found');
      try {
        await this.access.assertJobPermission(userId, job.companyId, job.id, 'application.view');
      } catch {
        throw new NotFoundException('Job not found');
      }
    }
    if (managed && userId) {
      await this.access.assertJobPermission(userId, job.companyId, job.id, 'application.view');
      return job;
    }
    return publicJobSalary(job);
  }

  async listCompanyJobs(userId: string, companyId: string, query: { page?: number; limit?: number; status?: string; search?: string; workMode?: string; employmentType?: EmploymentType; sort?: string }) {
    await this.access.assertMembership(userId, companyId);
    const { page, limit, skip, take } = resolvePagination(query);
    const statusMap: Record<string, JobStatus[]> = {
      active: ['PUBLISHED', 'APPROVED'],
      published: ['PUBLISHED'],
      approved: ['APPROVED'],
      paused: ['PAUSED'],
      suspended: ['PAUSED'],
      draft: ['DRAFT', 'PENDING_APPROVAL'],
      pending_approval: ['PENDING_APPROVAL'],
      closed: ['CLOSED', 'EXPIRED', 'REJECTED'],
      expired: ['EXPIRED'],
      rejected: ['REJECTED'],
    };
    const normalizedStatus = query.status?.trim().toLowerCase();
    const statusValues = normalizedStatus ? statusMap[normalizedStatus] ?? [normalizedStatus.toUpperCase() as JobStatus] : undefined;
    const where: Prisma.JobWhereInput = {
      ...(await this.access.jobScope(userId, companyId)),
      ...(statusValues ? { status: { in: statusValues } } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.workMode ? { workMode: query.workMode } : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
    };
    const orderBy = query.sort === 'oldest' ? { createdAt: 'asc' as const }
      : query.sort === 'closingSoon' ? { expiresAt: 'asc' as const }
        : query.sort === 'title' ? { title: 'asc' as const }
          : { createdAt: 'desc' as const };
    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({ where, select: COMPANY_JOB_SELECT, orderBy, skip, take }),
      this.prisma.job.count({ where }),
    ]);
    const jobIds = rawItems.map(job => job.id);
    const applicationScope = await this.access.applicationScope(userId, companyId);
    const visibleApplications = jobIds.length ? await this.prisma.application.findMany({
      where: { ...applicationScope, jobId: { in: jobIds } },
      select: { jobId: true, status: true },
    }) : [];
    const applicationsByJob = new Map<string, { status: string }[]>();
    for (const application of visibleApplications) applicationsByJob.set(application.jobId, [...(applicationsByJob.get(application.jobId) ?? []), application]);
    const interviewScope = await this.access.interviewScope(userId, companyId);
    const visibleInterviews = jobIds.length ? await this.prisma.interview.groupBy({
      by: ['jobId'], where: { ...interviewScope, jobId: { in: jobIds } }, _count: { _all: true },
    }) : [];
    const items = rawItems.map(({ applications: _applications, _count: _count, ...job }) => {
      const applications = applicationsByJob.get(job.id) ?? [];
      return {
        ...job,
        _count: { applications: applications.length, interviews: visibleInterviews.find(row => row.jobId === job.id)?._count._all ?? 0 },
        applicationMetrics: {
          new: applications.filter(application => application.status === 'APPLIED').length,
          shortlisted: applications.filter(application => application.status === 'SHORTLISTED').length,
        },
      };
    });
    return paginate(items, total, page, limit);
  }

  async listPendingApproval(query: { page?: number; limit?: number }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.JobWhereInput = { status: 'PENDING_APPROVAL' };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({ where, select: JOB_SELECT, orderBy: { createdAt: 'asc' }, skip, take }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  /**
   * Automatic job expiration: PUBLISHED jobs past their expiry become EXPIRED.
   * Runs every hour. Emits job.expired events for automation triggers.
   */
  @Cron('0 * * * *')
  async expireJobs(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.job.findMany({
      where: { status: 'PUBLISHED', expiresAt: { not: null, lt: now } },
      select: { id: true, companyId: true, title: true },
    });
    for (const job of expired) {
      await this.prisma.job.update({ where: { id: job.id }, data: { status: 'EXPIRED' } });
      this.events.emit('job.expired', { jobId: job.id, companyId: job.companyId, title: job.title });
    }
    return expired.length;
  }

  /** Emits JOB_EXPIRING triggers for jobs expiring within 24h (deduped by automation executions). */
  @Cron('30 * * * *')
  async warnExpiringJobs(): Promise<number> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const jobs = await this.prisma.job.findMany({
      where: { status: 'PUBLISHED', expiresAt: { not: null, gt: now, lt: in24h } },
      select: { id: true, companyId: true, title: true, expiresAt: true },
    });
    for (const job of jobs) {
      this.events.emit('job.expiring', {
        jobId: job.id,
        companyId: job.companyId,
        title: job.title,
        expiresAt: job.expiresAt,
      });
    }
    return jobs.length;
  }

  private async loadJob(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { skills: { include: { skill: true } } } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private async uniqueJobSlug(companyId: string, title: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true, trim: true }) || 'job';
    let candidate = base;
    for (let i = 1; i < 20; i++) {
      const existing = await this.prisma.job.findUnique({
        where: { companyId_slug: { companyId, slug: candidate } },
      });
      if (!existing) return candidate;
      candidate = `${base}-${i}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private async upsertSkill(tx: Prisma.TransactionClient, name: string) {
    const normalized = name.trim().toLowerCase();
    return tx.skill.upsert({
      where: { normalizedName: normalized },
      create: { name: name.trim(), normalizedName: normalized },
      update: {},
    });
  }

  private async notifyJobOwner(
    companyId: string,
    ownerUserId: string,
    type: string,
    title: string,
    message: string,
    email?: { subject: string; html: string },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: ownerUserId } });
    await this.notifications.create({
      userId: ownerUserId,
      type,
      title,
      message,
      data: { companyId },
      email: email && user ? { subject: email.subject, html: email.html, to: user.email } : undefined,
      dedupeKey: `${type}:${companyId}:${Date.now()}`,
    });
  }
}

