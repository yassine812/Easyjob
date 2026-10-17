import { EasyJobMeetingProvider } from './meeting-provider';
import { EntitlementService } from '../entitlements/entitlement.service';
import { InterviewInvitationsService } from './interview-invitations.service';
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
import { InterviewBriefService } from './interview-brief.service';
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
    private readonly meetings: EasyJobMeetingProvider,
    private readonly entitlements: EntitlementService,
    private readonly invitations: InterviewInvitationsService,
    private readonly briefs?: InterviewBriefService,
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

    if (['HIRED','REJECTED','WITHDRAWN'].includes(application.status)) throw new BadRequestException('Application is closed');
    if (new Date(dto.startAt).getTime() <= Date.now()) throw new BadRequestException('Schedule interviews in the future');
    const config = await this.validateConfiguration(application.job.companyId, dto);
    const interview = await this.prisma.interview.create({
      data: {
        ...config,
        applicationId: dto.applicationId,
        jobId: application.job.id,
        scheduledById: userId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        type: dto.type,
        location: dto.location ?? null,
        notes: dto.notes ?? null,
        status: 'SCHEDULED',
        participants: { create: memberIds.map(memberId => ({ memberId, invitedAt: new Date() })) },
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

    await this.invitations.send(interview.id, 'scheduled');
    if (interview.assistantEnabled) await this.briefs?.generate(interview.id);

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
        participants: { include: { member: { include: { user: { select: { id: true, name: true } } } } } }, feedback: true,
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

    if (interview.status === InterviewStatus.COMPLETED || interview.status === InterviewStatus.CANCELLED || interview.status === InterviewStatus.NO_SHOW) {
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

    const config = await this.validateConfiguration(interview.application.job.companyId, { timezone: dto.timezone ?? interview.timezone, locationType: dto.locationType ?? interview.locationType, assistantEnabled: dto.assistantEnabled ?? interview.assistantEnabled, location: dto.location ?? interview.location ?? undefined }, interview.meetingRoomId);
    const updated = await this.prisma.interview.update({
      where: { id: interviewId, updatedAt: interview.updatedAt },
      data: {
        ...config, calendarSequence: { increment: 1 },
        startAt,
        endAt,
        type: dto.type ?? interview.type,
        location: dto.location !== undefined ? dto.location : interview.location,
        notes: dto.notes !== undefined ? dto.notes : interview.notes,
        status,
        ...(dto.memberIds ? { participants: { deleteMany: {}, create: [...new Set(dto.memberIds)].map(memberId => ({ memberId, invitedAt: new Date() })) } } : {}),
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        ...(['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status) ? { endedAt: new Date() } : {}),
        ...(startAt.getTime() !== interview.startAt.getTime() ? { reminderSentAt: null, reminderHourSentAt: null } : {}),
      },
    });

    if (updated.meetingRoomId && ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) await this.meetings.closeRoom(updated.meetingRoomId);

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

    if (!['COMPLETED','NO_SHOW'].includes(status)) await this.invitations.send(interviewId, status === 'CANCELLED' ? 'cancelled' : 'updated');
    if (updated.assistantEnabled && (dto.assistantEnabled === true || !interview.assistantEnabled)) await this.briefs?.generate(interviewId);

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

  private async validateConfiguration(companyId: string, dto: { timezone?: string; locationType?: string; assistantEnabled?: boolean; location?: string }, room?: string | null) {
    const timezone = dto.timezone ?? 'Africa/Tunis';
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { throw new BadRequestException('Invalid timezone'); }
    const locationType = dto.locationType ?? 'EXTERNAL';
    if (dto.assistantEnabled) await this.entitlements.assertRecruitmentIntelligence(companyId);
    if (locationType === 'EXTERNAL' && dto.location && !/^https:\/\//i.test(dto.location)) throw new BadRequestException('External meeting link must use HTTPS');
    if (locationType === 'ONSITE' && !dto.location?.trim()) throw new BadRequestException('Specify a physical location');
    const meetingRoomId = locationType === 'EASYJOB' ? room ?? this.meetings.createRoom() : null;
    return { timezone, locationType, assistantEnabled: dto.assistantEnabled ?? false, meetingProvider: meetingRoomId ? 'EASYJOB' : null, meetingRoomId, meetingUrl: null };
  }
  private candidateView<T extends { notes: string | null; aiReport: unknown }>(item: T) {
    const { notes: _notes, aiReport: _report, assistantNotes: _assistant, feedback: _feedback, questions: _questions, answers: _answers, ...publicInterview } = item as T & Record<string, unknown>;
    return publicInterview;
  }

  private assertTimeRange(startAt: string, endAt: string): void {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid interview times');
    }
    if (end.getTime() - start.getTime() > 8 * 3600000) throw new BadRequestException('Interview duration cannot exceed eight hours');
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
