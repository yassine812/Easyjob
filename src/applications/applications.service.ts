import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { emailTemplates } from '../queues/email/templates';
import { ResumesService } from '../candidates/resumes.service';
import { RealtimeService } from '../realtime/realtime.service';
import { paginate, resolvePagination } from '../common/utils/pagination';
import { assertTransition, TERMINAL_STATUSES as TERMINAL } from './pipeline';
import { ApplyDto, UpdateApplicationStatusDto } from './dto/application.dto';
import type { RequestMeta } from '../companies/companies.service';
import { atsReport, matchCandidate, matchesPreferences } from '../career/career-engine';
import { StorageService } from '../files/storage.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
    private readonly resumesService: ResumesService,
    private readonly realtime: RealtimeService,
    private readonly events: EventEmitter2,
    private readonly storage: StorageService,
  ) {}

  async apply(userId: string, jobId: string, dto: ApplyDto, meta: RequestMeta,
    automatic?: { draftId: string; settingsVersion: Date; cvText: string }) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { company: { include: { verification: true } }, skills: { include: { skill: true } } } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== 'PUBLISHED') {
      throw new BadRequestException('This job is not accepting applications');
    }
    if (job.company.status !== 'ACTIVE' || job.company.verification?.status !== 'VERIFIED') throw new BadRequestException('Company is not verified');
    if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This job has expired');
    }

    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId }, include: { skills: { include: { skill: true } }, experiences: true, educations: true, resumes: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] } } });
    if (!profile) {
      throw new ForbiddenException('Only candidates can apply to jobs');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.status !== 'ACTIVE' || !user?.emailVerifiedAt) {
      throw new ForbiddenException('Email verification is required to apply');
    }

    if (dto.resumeId) {
      const resume = await this.prisma.resume.findFirst({
        where: { id: dto.resumeId, candidateId: profile.id },
      });
      if (!resume) {
        throw new BadRequestException('Selected CV does not belong to your profile');
      }
    }

    const existing = await this.prisma.application.findUnique({
      where: { jobId_candidateId: { jobId, candidateId: profile.id } },
    });
    if (existing) {
      throw new BadRequestException('You have already applied to this job');
    }

    const cvText = automatic?.cvText || profile.resumes.find(r => r.id === dto.resumeId)?.parsedText || '';
    const match = matchCandidate({ ...profile, resumes: cvText ? [{ parsedText: cvText }] : profile.resumes }, job);
    const autoKey = automatic ? `resumes/${profile.id}/auto-${randomUUID()}.md` : null;
    const application = await this.prisma.$transaction(async (tx) => {
      let resumeId = dto.resumeId ?? null;
      if (automatic) {
        await tx.$queryRaw`SELECT "candidateId" FROM "CareerSettings" WHERE "candidateId" = ${profile.id} FOR UPDATE`;
        const settings = await tx.careerSettings.findUnique({ where: { candidateId: profile.id } });
        const subscription = await tx.subscription.findFirst({ where: { candidateId: profile.id, ownerType: 'CANDIDATE', status: { in: ['ACTIVE', 'TRIALING'] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
        const features = subscription?.plan.features as Record<string, unknown> | undefined;
        const draft = await tx.cvDraft.findFirst({ where: { id: automatic.draftId, candidateId: profile.id, approvedAt: { not: null } } });
        const sameReviewedText = draft && draft.content.split(/\n\s*\n/).sort().join('\n') === automatic.cvText.split(/\n\s*\n/).sort().join('\n');
        if (!settings?.autoApply || !settings.autoConsentAt || settings.updatedAt.getTime() !== automatic.settingsVersion.getTime() || settings.approvedDraftId !== automatic.draftId || !sameReviewedText || features?.['career.auto_apply'] !== true) throw new ForbiddenException('Auto Apply authorization changed');
        if (match.score === null || match.score < settings.autoMinimumScore || !match.matchedSkills.length || !matchesPreferences(job, settings)) throw new ForbiddenException('Job does not meet Auto Apply preferences');
        const midnight = new Date(); midnight.setUTCHours(0, 0, 0, 0);
        if (await tx.application.count({ where: { candidateId: profile.id, autoApplied: true, appliedAt: { gte: midnight } } }) >= settings.maxPerDay) throw new BadRequestException('Daily Auto Apply limit reached (UTC)');
        if (await tx.resume.count({ where: { candidateId: profile.id } }) >= Number(features?.['cv.uploads'] || 0)) throw new BadRequestException('CV storage limit reached');
        const currentJob = await tx.job.findFirst({ where: { id: job.id, status: 'PUBLISHED', company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
        if (!currentJob) throw new BadRequestException('Job is no longer available');
        const bytes = Buffer.from(automatic.cvText);
        await this.storage.put(autoKey!, bytes, 'text/markdown');
        const version = await tx.resume.aggregate({ where: { candidateId: profile.id }, _max: { version: true } });
        const resume = await tx.resume.create({ data: { candidateId: profile.id, filename: `${job.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`, storageKey: autoKey!, mimeType: 'text/markdown', fileSize: bytes.length, version: (version._max.version || 0) + 1, parsedText: automatic.cvText, processingStatus: 'COMPLETED' } });
        resumeId = resume.id;
      }
      const created = await tx.application.create({
        data: {
          jobId,
          candidateId: profile.id,
          resumeId,
          motivation: dto.motivation ?? null,
          status: 'APPLIED',
          aiMatchScore: match.score,
          atsScore: cvText ? atsReport(cvText).score : null,
          aiQualification: match.classification,
          aiRecommendation: match.classification,
          aiSummary: match.summary,
          matchExplanation: JSON.parse(JSON.stringify(match)) as Prisma.InputJsonValue,
          potentialScore: match.classification === 'POTENTIAL' ? 'POTENTIAL' : null,
          potentialReason: match.potentialEvidence.join(', ') || null,
          strengths: match.matchedSkills.join(', '),
          missingRequirements: [...match.missingSkills, ...match.unverifiedRequirements].join('; '),
          aiScreeningStatus: match.score === null ? 'PENDING' : 'COMPLETED',
          aiScreenedAt: match.score === null ? null : new Date(),
          stageChangedAt: new Date(),
          stageChangeSource: automatic ? 'AUTO_APPLY' : 'CANDIDATE',
          autoApplied: !!automatic,
          cvTextSnapshot: cvText || null,
        },
      });
      await tx.applicationEvent.create({
        data: {
          applicationId: created.id,
          actorId: userId,
          newStatus: 'APPLIED',
          metadata: { source: automatic ? 'AUTO_APPLY' : 'CANDIDATE', scoringMethod: match.method, score: match.score },
        },
      });
      return created;
    }, { timeout: 20000 }).catch(async err => { if (autoKey) await this.storage.delete(autoKey).catch(() => undefined); throw err; });

    await this.audit.log({
      actorId: userId,
      action: 'application.created',
      entityType: 'Application',
      entityId: application.id,
      metadata: { jobId, companyId: job.companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    // Notify the job owner + company admins.
    await this.notifyCompanyOfApplication(job, profile.id);

    this.events.emit('candidate.applied', {
      applicationId: application.id,
      jobId,
      companyId: job.companyId,
      candidateId: profile.id,
    });
    this.events.emit('analytics.invalidate.company', { companyId: job.companyId });
    this.realtime.emitToCompany(job.companyId, 'application.created', { id: application.id, jobId });

    return this.getById(application.id, userId);
  }

  async listForCandidate(userId: string, query: { page?: number; limit?: number; status?: ApplicationStatus }) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return paginate([], query.page ?? 1, query.limit ?? 20, 0);
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.ApplicationWhereInput = {
      candidateId: profile.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        include: this.applicationInclude,
        orderBy: { appliedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.application.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async listJobSummaries(userId: string, companyId: string, query: { page?: number; limit?: number; search?: string }) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.JobWhereInput = { ...(await this.access.jobScope(userId, companyId)), ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}) };
    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({ where, select: { id: true, title: true, domain: true, location: true, employmentType: true, status: true, publishedAt: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
      this.prisma.job.count({ where }),
    ]);
    const scope = { ...(await this.access.applicationScope(userId, companyId)), jobId: { in: jobs.map(job => job.id) } };
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { recruitmentSettings: true } });
    const strongThreshold = (company?.recruitmentSettings as { thresholds?: { strong?: number } } | null)?.thresholds?.strong ?? 80;
    const [counts, averages, strong] = await Promise.all([
      this.prisma.application.groupBy({ by: ['jobId', 'status'], where: scope, _count: { _all: true } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: scope, _avg: { aiMatchScore: true, atsScore: true } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: { ...scope, aiMatchScore: { gte: strongThreshold } }, _count: { _all: true } }),
    ]);
    return paginate(jobs.map(job => {
      const stages = counts.filter(row => row.jobId === job.id);
      const average = averages.find(row => row.jobId === job.id)?._avg;
      return { ...job, applications: stages.reduce((sum, row) => sum + row._count._all, 0),
        newApplications: stages.find(row => row.status === 'APPLIED')?._count._all ?? 0,
        shortlisted: stages.find(row => row.status === 'SHORTLISTED')?._count._all ?? 0,
        strongMatches: strong.find(row => row.jobId === job.id)?._count._all ?? 0,
        averageMatch: average?.aiMatchScore ?? null, averageAts: average?.atsScore ?? null };
    }), total, page, limit);
  }

  async listForCompany(userId: string, companyId: string, query: { page?: number; limit?: number; status?: ApplicationStatus; jobId?: string; search?: string; minimumMatch?: number; sort?: string }) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.ApplicationWhereInput = {
      ...(await this.access.applicationScope(userId, companyId)),
      ...(query.status ? { status: query.status } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.minimumMatch != null ? { aiMatchScore: { gte: query.minimumMatch } } : {}),
      ...(query.search ? { candidate: { user: { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({ where, include: this.applicationInclude, orderBy: query.sort === 'match' ? [{ aiMatchScore: { sort: 'desc', nulls: 'last' } }, { appliedAt: 'asc' }, { id: 'asc' }] : [{ appliedAt: 'desc' }, { id: 'asc' }], skip, take }),
      this.prisma.application.count({ where }),
    ]);
    return paginate(await this.filterAssignedInterviews(items, userId, companyId), total, page, limit);
  }

  async getById(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: this.applicationInclude,
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(userId, application);
    if (application.candidate.userId === userId) return application;
    return (await this.filterAssignedInterviews([application], userId, application.job.companyId))[0];
  }

  private async filterAssignedInterviews<T extends { id: string; interviews: { id: string }[] }>(items: T[], userId: string, companyId: string): Promise<T[]> {
    const member = await this.access.assertMembership(userId, companyId);
    if (member.role !== 'INTERVIEWER') return items;
    const assigned = await this.prisma.interview.findMany({ where: { applicationId: { in: items.map(i => i.id) }, participants: { some: { memberId: member.memberId } } }, select: { id: true } });
    const allowed = new Set(assigned.map(i => i.id));
    return items.map(item => ({ ...item, interviews: item.interviews.filter(i => allowed.has(i.id)) }));
  }

  async moveStatus(userId: string, applicationId: string, dto: UpdateApplicationStatusDto, meta: RequestMeta) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { include: { company: true } }, candidate: { include: { user: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');

    // Company members move candidates; the candidate may withdraw their own application.
    if (dto.newStatus === ApplicationStatus.WITHDRAWN && application.candidate.userId === userId) {
      return this.withdraw(userId, applicationId, meta);
    }
    await this.access.assertApplicationPermission(userId, application.job.companyId, application.id, 'application.move');

    assertTransition(application.status, dto.newStatus);

    const source = dto.source || 'HR';
    if (source !== 'HR' && ['REJECTED', 'HIRED', 'OFFER', 'WITHDRAWN'].includes(dto.newStatus)) {
      throw new BadRequestException('A human recruiter must make this decision');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.application.update({
        where: { id: applicationId, status: application.status },
        data: {
          status: dto.newStatus,
          stageChangedAt: new Date(),
          stageChangedById: userId,
          stageChangeSource: source,
        },
      });
      await tx.applicationEvent.create({
        data: {
          applicationId,
          actorId: userId,
          previousStatus: application.status,
          newStatus: dto.newStatus,
          metadata: {
            source,
            note: dto.note ?? null,
          },
        },
      });
      if (dto.note) {
        await tx.applicationNote.create({
          data: { applicationId, authorId: userId, content: dto.note },
        });
      }
      return result;
    });

    await this.audit.log({
      actorId: userId,
      action: 'application.status_changed',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { jobId: application.jobId, companyId: application.job.companyId, from: application.status, to: dto.newStatus },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    const job = application.job;
    this.realtime.emitToCompany(job.companyId, 'application.updated', { id: applicationId, status: dto.newStatus });
    this.realtime.emitToCompany(job.companyId, 'candidate.moved', { id: applicationId, status: dto.newStatus });
    this.realtime.emitToUser(application.candidate.userId, 'application.status_changed', {
      id: applicationId,
      jobId: job.id,
      status: dto.newStatus,
    });

    await this.notifications.create({
      userId: application.candidate.userId,
      type: 'application.status_changed',
      title: 'Application status updated',
      message: `The status of your application for "${job.title}" changed to ${dto.newStatus}.`,
      data: { applicationId, jobId: job.id, status: dto.newStatus },
      email: {
        subject: emailTemplates.applicationStatusChanged(job.title, dto.newStatus).subject,
        html: emailTemplates.applicationStatusChanged(job.title, dto.newStatus).html,
        to: application.candidate.user.email,
      },
      dedupeKey: `application.status_changed:${applicationId}:${dto.newStatus}:${Date.now()}`,
    });

    this.events.emit('application.status_changed', {
      applicationId,
      jobId: job.id,
      companyId: job.companyId,
      candidateId: application.candidateId,
      previousStatus: application.status,
      newStatus: dto.newStatus,
      actorId: userId,
    });
    this.events.emit('analytics.invalidate.company', { companyId: job.companyId });

    return { id: updated.id, status: updated.status };
  }

  async withdraw(userId: string, applicationId: string, meta: RequestMeta) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { candidate: { select: { userId: true } }, job: { select: { id: true, title: true, companyId: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.candidate.userId !== userId) {
      throw new ForbiddenException('You can only withdraw your own applications');
    }
    if (TERMINAL.has(application.status)) {
      throw new BadRequestException(`Application is already in terminal status ${application.status}`);
    }
    await this.prisma.$transaction([
      this.prisma.application.update({ where: { id: applicationId }, data: { status: 'WITHDRAWN' } }),
      this.prisma.applicationEvent.create({
        data: {
          applicationId,
          actorId: userId,
          previousStatus: application.status,
          newStatus: 'WITHDRAWN',
          metadata: { source: 'candidate' },
        },
      }),
    ]);
    await this.audit.log({
      actorId: userId,
      action: 'application.withdrawn',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { jobId: application.job.id, companyId: application.job.companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    this.events.emit('application.status_changed', {
      applicationId,
      jobId: application.job.id,
      companyId: application.job.companyId,
      previousStatus: application.status,
      newStatus: 'WITHDRAWN',
      actorId: userId,
    });
    this.realtime.emitToCompany(application.job.companyId, 'application.updated', { id: applicationId, status: 'WITHDRAWN' });
    return { id: applicationId, status: 'WITHDRAWN' };
  }

  async addNote(userId: string, applicationId: string, content: string, meta: RequestMeta) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { companyId: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.access.assertApplicationPermission(userId, application.job.companyId, application.id, 'application.update');
    const note = await this.prisma.applicationNote.create({
      data: { applicationId, authorId: userId, content },
    });
    await this.audit.log({
      actorId: userId,
      action: 'application.note_added',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { noteId: note.id },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return note;
  }

  async listEvents(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { companyId: true } }, candidate: { select: { userId: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(userId, application);
    const events = await this.prisma.applicationEvent.findMany({
      where: { applicationId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    // Internal recruiter notes are not candidate-facing messages.
    return application.candidate.userId === userId
      ? events.map(event => ({ ...event, metadata: null })) : events;
  }

  async listNotes(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { companyId: true } }, candidate: { select: { userId: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.access.assertApplicationPermission(userId, application.job.companyId, application.id, 'application.view');
    return this.prisma.applicationNote.findMany({
      where: { applicationId },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Company-side CV access through an application (fully audit-logged). */
  async getCvUrl(userId: string, applicationId: string, meta: RequestMeta) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { companyId: true } }, candidate: { select: { userId: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(userId, application);
    if (!application.resumeId) {
      throw new NotFoundException('The candidate did not attach a CV to this application');
    }
    return this.resumesService.getDownloadUrl(userId, application.resumeId, meta);
  }

  private async assertCanView(
    userId: string,
    application: {
      id: string;
      candidateId: string;
      jobId: string;
      candidate?: { userId: string } | null;
      job: { companyId: string };
    },
  ): Promise<void> {
    const isCandidateOwner = application.candidate?.userId === userId;
    if (isCandidateOwner) return;
    try {
      await this.access.assertApplicationPermission(userId, application.job.companyId, application.id, 'application.view');
    } catch {
      throw new ForbiddenException('You are not authorized to view this application');
    }
  }



  private async notifyCompanyOfApplication(
    job: { id: string; title: string; companyId: string; createdById: string },
    candidateId: string,
  ): Promise<void> {
    const template = emailTemplates.applicationReceived(job.title);
    const admins = await this.prisma.companyMember.findMany({
      where: { companyId: job.companyId, status: 'ACTIVE', role: { in: ['COMPANY_ADMIN', 'HR', 'RECRUITER'] } },
      include: { user: { select: { id: true, email: true } } },
    });
    // Recipients = company members (admins/HR/recruiters) ∪ job creator,
    // deduplicated by user id so the creator is notified exactly once.
    const recipients = new Map<string, { id: string; email: string }>();
    for (const admin of admins) recipients.set(admin.user.id, { id: admin.user.id, email: admin.user.email });
    if (job.createdById && !recipients.has(job.createdById)) {
      const creator = await this.prisma.user.findUnique({ where: { id: job.createdById } });
      if (creator) recipients.set(creator.id, { id: creator.id, email: creator.email });
    }
    for (const recipient of recipients.values()) {
      await this.notifications.create({
        userId: recipient.id,
        type: 'candidate.applied',
        title: 'New application',
        message: `A candidate applied to "${job.title}".`,
        data: { jobId: job.id, candidateId, companyId: job.companyId },
        email: { subject: template.subject, html: template.html, to: recipient.email },
        dedupeKey: `candidate.applied:${job.id}:${candidateId}:${recipient.id}`,
      });
    }
  }

  async rankCandidatesForJob(userId: string, companyId: string, jobId: string) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    const apps = await this.prisma.application.findMany({
      where: { jobId, ...(await this.access.applicationScope(userId, companyId)) },
      include: this.applicationInclude,
      orderBy: [
        { aiMatchScore: { sort: 'desc', nulls: 'last' } },
        { atsScore: { sort: 'desc', nulls: 'last' } },
        { appliedAt: 'asc' },
      ],
    });

    return apps.map((app, index) => ({
      rank: app.aiMatchScore === null ? null : index + 1,
      applicationId: app.id,
      candidateName: app.candidate.user.name,
      candidateEmail: app.candidate.user.email,
      aiMatchScore: app.aiMatchScore,
      atsScore: app.atsScore,
      aiRecommendation: app.aiRecommendation,
      potentialScore: app.potentialScore,
      potentialReason: app.potentialReason,
      summary: app.aiSummary,
      status: app.status,
    }));
  }

  private readonly applicationInclude = {
    job: {
      select: {
        id: true,
        title: true,
        slug: true,
        companyId: true,
        location: true,
        remote: true,
        employmentType: true,
        company: { select: { id: true, commercialName: true, slug: true } },
      },
    },
    candidate: {
      select: {
        id: true,
        userId: true,
        headline: true,
        location: true,
        user: { select: { id: true, name: true, email: true } },
      },
    },
    resume: { select: { id: true, filename: true, mimeType: true, fileSize: true, version: true } },
    interviews: { select: { id: true, startAt: true, endAt: true, status: true, type: true, location: true }, orderBy: { startAt: 'asc' } },
    _count: { select: { events: true, notes: true } },
  } satisfies Prisma.ApplicationInclude;
}
