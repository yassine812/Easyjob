import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InterviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { emailTemplates } from '../queues/email/templates';
import { RealtimeService } from '../realtime/realtime.service';
import { toJson } from '../common/utils/json';
import { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto';
import type { RequestMeta } from '../companies/companies.service';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
    private readonly realtime: RealtimeService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateInterviewDto, meta: RequestMeta) {
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: { job: { select: { id: true, title: true, companyId: true } }, candidate: { include: { user: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    const member = await this.access.assertPermission(userId, application.job.companyId, 'interview.create');
    if (member.role === 'INTERVIEWER') throw new ForbiddenException('Only recruiters and hiring managers can schedule interviews');
    await this.access.assertApplicationPermission(userId, application.job.companyId, application.id, 'interview.create');
    const memberIds = [...new Set(dto.memberIds ?? [])];
    await this.validateParticipants(application.job.companyId, memberIds);
    this.assertTimeRange(dto.startAt, dto.endAt);

    const interview = await this.prisma.interview.create({
      data: {
        applicationId: dto.applicationId,
        jobId: application.job.id,
        scheduledById: userId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        type: dto.type,
        location: dto.location ?? null,
        notes: dto.notes ?? null,
        status: 'SCHEDULED',
        participants: { create: memberIds.map(memberId => ({ memberId })) },
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'interview.scheduled',
      entityType: 'Interview',
      entityId: interview.id,
      metadata: { applicationId: dto.applicationId, companyId: application.job.companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    const when = interview.startAt.toISOString();
    await this.notifications.create({
      userId: application.candidate.userId,
      type: 'interview.scheduled',
      title: 'Interview scheduled',
      message: `An interview for "${application.job.title}" was scheduled on ${when}.`,
      data: { interviewId: interview.id, applicationId: application.id },
      email: {
        subject: emailTemplates.interviewScheduled(application.job.title, when).subject,
        html: emailTemplates.interviewScheduled(application.job.title, when).html,
        to: application.candidate.user.email,
      },
      dedupeKey: `interview.scheduled:${interview.id}:${Date.now()}`,
    });

    this.realtime.emitToCompany(application.job.companyId, 'interview.updated', { id: interview.id });
    this.realtime.emitToUser(application.candidate.userId, 'interview.scheduled', { id: interview.id });

    this.events.emit('interview.scheduled', {
      interviewId: interview.id,
      applicationId: application.id,
      jobId: application.job.id,
      companyId: application.job.companyId,
      candidateId: application.candidateId,
    });
    this.events.emit('analytics.invalidate.company', { companyId: application.job.companyId });

    return this.getById(interview.id, userId);
  }

  async getById(interviewId: string, userId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: {
            job: { select: { id: true, title: true, companyId: true, company: { select: { commercialName: true } } } },
            candidate: { select: { userId: true, user: { select: { name: true, email: true } } } },
          },
        },
        scheduledBy: { select: { id: true, name: true } },
      },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    await this.assertCanView(userId, interview);
    return interview.application.candidate.userId === userId ? this.candidateView(interview) : interview;
  }

  async listForApplication(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { companyId: true } }, candidate: { select: { userId: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    const isCandidate = application.candidate.userId === userId;
    if (!isCandidate) {
      await this.access.assertApplicationPermission(userId, application.job.companyId, applicationId, 'application.view');
    }
    const interviews = await this.prisma.interview.findMany({
      where: { applicationId, ...(!isCandidate ? await this.access.interviewScope(userId, application.job.companyId) : {}) },
      orderBy: { startAt: 'asc' },
    });
    return isCandidate ? interviews.map(item => this.candidateView(item)) : interviews;
  }

  async update(userId: string, interviewId: string, dto: UpdateInterviewDto, meta: RequestMeta) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { job: { select: { companyId: true, title: true } }, candidate: { include: { user: true } } } } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    await this.access.assertInterviewPermission(userId, interview.application.job.companyId, interviewId, 'interview.update');
    if (dto.memberIds) await this.validateParticipants(interview.application.job.companyId, dto.memberIds);

    if (interview.status === InterviewStatus.COMPLETED || interview.status === InterviewStatus.CANCELLED) {
      throw new BadRequestException(`Cannot update a ${interview.status} interview`);
    }
    const startAt = dto.startAt ? new Date(dto.startAt) : interview.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : interview.endAt;
    this.assertTimeRange(startAt.toISOString(), endAt.toISOString());

    const status = dto.status ?? interview.status;
    if (interview.status === InterviewStatus.SCHEDULED && status === InterviewStatus.CANCELLED) {
      // cancellation is allowed; other jumps validated below
    } else if (status !== interview.status && !['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) {
      throw new BadRequestException(`Invalid status transition to ${status}`);
    }

    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        startAt,
        endAt,
        type: dto.type ?? interview.type,
        location: dto.location !== undefined ? dto.location : interview.location,
        notes: dto.notes !== undefined ? dto.notes : interview.notes,
        status,
        ...(dto.memberIds ? { participants: { deleteMany: {}, create: [...new Set(dto.memberIds)].map(memberId => ({ memberId })) } } : {}),
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        ...(startAt.getTime() !== interview.startAt.getTime() ? { reminderSentAt: null } : {}),
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'interview.updated',
      entityType: 'Interview',
      entityId: interviewId,
      metadata: toJson({
        applicationId: interview.applicationId,
        companyId: interview.application.job.companyId,
        changes: dto,
      }),
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    const when = startAt.toISOString();
    await this.notifications.create({
      userId: interview.application.candidate.userId,
      type: 'interview.updated',
      title: 'Interview updated',
      message: `Your interview for "${interview.application.job.title}" is now scheduled on ${when} (${status}).`,
      data: { interviewId },
      email: {
        subject: emailTemplates.interviewScheduled(interview.application.job.title, when).subject,
        html: emailTemplates.interviewScheduled(interview.application.job.title, when).html,
        to: interview.application.candidate.user.email,
      },
      dedupeKey: `interview.updated:${interviewId}:${Date.now()}`,
    });

    this.realtime.emitToCompany(interview.application.job.companyId, 'interview.updated', { id: interviewId });
    this.realtime.emitToUser(interview.application.candidate.userId, 'interview.updated', { id: interviewId, status });
    this.events.emit('interview.updated', {
      interviewId,
      applicationId: interview.applicationId,
      jobId: interview.application.jobId,
      companyId: interview.application.job.companyId,
      status,
    });

    return updated;
  }

  private candidateView<T extends { notes: string | null; aiReport: unknown }>(item: T) {
    const { notes: _notes, aiReport: _report, ...publicInterview } = item;
    return publicInterview;
  }

  private assertTimeRange(startAt: string, endAt: string): void {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid interview times');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('Interview end time must be after start time');
    }
  }

  private async validateParticipants(companyId: string, memberIds: string[]) {
    if (await this.prisma.companyMember.count({ where: { id: { in: memberIds }, companyId, status: 'ACTIVE' } }) !== new Set(memberIds).size) {
      throw new BadRequestException('Interviewers must be active members of this company');
    }
  }

  private async assertCanView(
    userId: string,
    interview: { id: string; application: { candidate: { userId: string }; job: { companyId: string } } },
  ): Promise<void> {
    if (interview.application.candidate.userId === userId) return;
    try {
      await this.access.assertInterviewPermission(userId, interview.application.job.companyId, interview.id, 'application.view');
    } catch {
      throw new ForbiddenException('You are not authorized to view this interview');
    }
  }
}
