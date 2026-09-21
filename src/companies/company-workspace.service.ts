import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from './company-access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { RealtimeService } from '../realtime/realtime.service';
import { paginate, resolvePagination } from '../common/utils/pagination';
import { toJson } from '../common/utils/json';
import { AssignmentDto, CommunicationDto, EmailTemplateDto, FeedbackDto, RecruitmentSettingsDto, WorkspaceQuery } from './dto/workspace.dto';
import { DEFAULT_THRESHOLDS, matchCategory, validThresholds } from './recruitment-metrics';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

@Injectable()
export class CompanyWorkspaceService {
  constructor(private readonly prisma: PrismaService, private readonly access: CompanyAccessService,
    private readonly audit: AuditService, private readonly notifications: NotificationsService,
    private readonly email: EmailService, private readonly realtime: RealtimeService) {}

  async settings(userId: string, companyId: string) {
    const member = await this.access.assertMembership(userId, companyId);
    const company = await this.access.getCompanyOrThrow(companyId);
    const profile = member.role === 'COMPANY_ADMIN' ? company : { id: company.id, commercialName: company.commercialName, industry: company.industry, description: company.description, city: company.city, country: company.country, website: company.website, size: company.size };
    return { company: profile, preferences: company.recruitmentSettings ?? { domains: [], positions: [], locations: [], languages: [], workModes: [], hiringVolume: 0, thresholds: DEFAULT_THRESHOLDS } };
  }

  async saveSettings(userId: string, companyId: string, dto: RecruitmentSettingsDto) {
    await this.access.assertPermission(userId, companyId, 'team.manage');
    if (!validThresholds(dto.thresholds)) throw new BadRequestException('Match thresholds must be in descending order');
    const { completeOnboarding, ...preferences } = dto;
    const previous = await this.access.getCompanyOrThrow(companyId);
    const result = await this.prisma.company.update({ where: { id: companyId }, data: {
      recruitmentSettings: toJson(preferences), ...(completeOnboarding ? { onboardingCompletedAt: new Date() } : {}),
    } });
    await this.audit.log({ actorId: userId, action: 'company.preferences_updated', entityType: 'Company', entityId: companyId,
      metadata: toJson({ companyId, previous: previous.recruitmentSettings, next: preferences }) });
    return { preferences: result.recruitmentSettings, onboardingCompletedAt: result.onboardingCompletedAt };
  }

  async overview(userId: string, companyId: string, query: WorkspaceQuery) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    const scope = await this.access.jobScope(userId, companyId);
    const jobWhere: Prisma.JobWhereInput = { AND: [scope, ...(query.jobId ? [{ id: query.jobId }] : [])] };
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86400000);
    const to = query.to ? new Date(query.to) : new Date();
    if (from > to || to.getTime() - from.getTime() > 366 * 86400000) throw new BadRequestException('Choose a date range of at most one year');
    const applicationScope = await this.access.applicationScope(userId, companyId);
    const interviewScope = await this.access.interviewScope(userId, companyId);
    const where: Prisma.ApplicationWhereInput = { ...applicationScope, job: jobWhere, appliedAt: { gte: from, lte: to } };
    const [jobCounts, applications, upcoming, company] = await Promise.all([
      this.prisma.job.groupBy({ by: ['status'], where: jobWhere, _count: { _all: true } }),
      this.prisma.application.findMany({ where, select: {
        id: true, status: true, aiMatchScore: true, aiScreeningStatus: true, appliedAt: true, autoApplied: true,
        missingRequirements: true, jobId: true, job: { select: { title: true } },
        candidate: { select: { id: true, user: { select: { name: true } } } },
        events: { select: { newStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      }, orderBy: { appliedAt: 'desc' } }),
      this.prisma.interview.findMany({ where: { ...interviewScope, application: { job: jobWhere }, status: { in: ['SCHEDULED', 'CONFIRMED'] }, startAt: { gte: new Date() } },
        include: { application: { select: { id: true, candidate: { select: { user: { select: { name: true } } } }, job: { select: { title: true } } } } }, orderBy: { startAt: 'asc' }, take: 6 }),
      this.prisma.company.findUnique({ where: { id: companyId }, select: { recruitmentSettings: true } }),
    ]);
    const thresholds = (company?.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS } | null)?.thresholds ?? DEFAULT_THRESHOLDS;
    const stages: Record<string, number> = {}, distribution: Record<string, number> = {};
    const daily: Record<string, number> = {}, jobs: Record<string, { id: string; title: string; total: number; hired: number }> = {};
    const interviewDays: number[] = [], hireDays: number[] = [];
    for (const app of applications) {
      stages[app.status] = (stages[app.status] ?? 0) + 1;
      const category = matchCategory(app.aiMatchScore, thresholds);
      distribution[category] = (distribution[category] ?? 0) + 1;
      const day = app.appliedAt.toISOString().slice(0, 10); daily[day] = (daily[day] ?? 0) + 1;
      jobs[app.jobId] ??= { id: app.jobId, title: app.job.title, total: 0, hired: 0 };
      jobs[app.jobId].total++; if (app.status === 'HIRED') jobs[app.jobId].hired++;
      const firstInterview = app.events.find(e => e.newStatus === 'INTERVIEW');
      const firstHire = app.events.find(e => e.newStatus === 'HIRED');
      if (firstInterview) interviewDays.push((firstInterview.createdAt.getTime() - app.appliedAt.getTime()) / 86400000);
      if (firstHire) hireDays.push((firstHire.createdAt.getTime() - app.appliedAt.getTime()) / 86400000);
    }
    const average = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;
    return { from, to, jobs: Object.fromEntries(jobCounts.map(j => [j.status, j._count._all])), stages,
      totalApplications: applications.length, analyzed: applications.filter(a => a.aiScreeningStatus === 'COMPLETED').length,
      distribution, thresholds, averageMatch: average(applications.flatMap(a => a.aiMatchScore === null ? [] : [a.aiMatchScore])),
      averageTimeToInterviewDays: average(interviewDays), averageTimeToHireDays: average(hireDays),
      hiringRate: applications.length ? Math.round((stages.HIRED ?? 0) / applications.length * 1000) / 10 : null,
      sources: { manual: applications.filter(a => !a.autoApplied).length, autoApply: applications.filter(a => a.autoApplied).length },
      daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
      applicationsByJob: Object.values(jobs).sort((a, b) => b.total - a.total),
      recent: applications.slice(0, 8).map(({ events: _events, ...app }) => ({ ...app, category: matchCategory(app.aiMatchScore, thresholds) })), upcoming };
  }

  async interviews(userId: string, companyId: string, query: WorkspaceQuery) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    const scope = await this.access.jobScope(userId, companyId);
    const { page, limit, skip, take } = resolvePagination(query);
    const membership = await this.access.assertMembership(userId, companyId);
    const where: Prisma.InterviewWhereInput = { application: { job: { AND: [scope, ...(query.jobId ? [{ id: query.jobId }] : [])] } },
      ...(membership.role === 'INTERVIEWER' ? { participants: { some: { memberId: membership.memberId } } } : {}),
      ...(query.from || query.to ? { startAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
      ...(query.q ? { application: { job: { AND: [scope, ...(query.jobId ? [{ id: query.jobId }] : [])] }, candidate: { user: { name: { contains: query.q, mode: 'insensitive' } } } } } : {}) };
    if (query.status && ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(query.status)) where.status = query.status as Prisma.EnumInterviewStatusFilter['equals'];
    if (query.type) where.type = query.type as Prisma.EnumInterviewTypeFilter['equals'];
    if (query.memberId) where.AND = [{ participants: { some: { memberId: query.memberId } } }];
    const [items, total] = await Promise.all([
      this.prisma.interview.findMany({ where, skip, take, orderBy: { startAt: 'asc' }, include: {
        application: { select: { id: true, candidate: { select: { id: true, user: { select: { name: true } } } }, job: { select: { id: true, title: true } } } },
        participants: { include: { member: { select: { id: true, user: { select: { name: true } } } } } }, feedback: true,
      } }), this.prisma.interview.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async candidates(userId: string, companyId: string, query: WorkspaceQuery) {
    await this.access.assertPermission(userId, companyId, 'candidate.view');
    const scope = await this.access.jobScope(userId, companyId);
    const { page, limit, skip, take } = resolvePagination(query);
    const appScope = await this.access.applicationScope(userId, companyId);
    if (query.jobId) appScope.jobId = query.jobId;
    if (query.minimumMatch != null) appScope.aiMatchScore = { gte: query.minimumMatch };
    if (query.matchCategory) {
      const company = await this.access.getCompanyOrThrow(companyId);
      const thresholds = (company.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS } | null)?.thresholds ?? DEFAULT_THRESHOLDS;
      const ranges: Record<string, Prisma.IntNullableFilter | null> = { EXCELLENT: { gte: thresholds.excellent }, STRONG: { gte: thresholds.strong, lt: thresholds.excellent }, GOOD: { gte: thresholds.good, lt: thresholds.strong }, POTENTIAL: { gte: thresholds.potential, lt: thresholds.good }, WEAK: { lt: thresholds.potential }, UNANALYZED: null };
      appScope.aiMatchScore = ranges[query.matchCategory];
    }
    const where: Prisma.CandidateProfileWhereInput = { applications: { some: appScope }, ...(query.q ? { OR: [
      { user: { name: { contains: query.q, mode: 'insensitive' } } }, { headline: { contains: query.q, mode: 'insensitive' } },
      { skills: { some: { skill: { name: { contains: query.q, mode: 'insensitive' } } } } }, { location: { contains: query.q, mode: 'insensitive' } },
    ] } : {}) };
    const additional: Prisma.CandidateProfileWhereInput[] = [];
    if (query.skill) additional.push({ skills: { some: { skill: { name: { contains: query.skill, mode: 'insensitive' } } } } });
    if (query.location) additional.push({ location: { contains: query.location, mode: 'insensitive' } });
    if (query.education) additional.push({ educations: { some: { OR: ['degree', 'institution', 'field'].map(key => ({ [key]: { contains: query.education, mode: 'insensitive' } })) } } });
    if (query.minimumExperience != null) additional.push({ yearsExperience: { gte: query.minimumExperience } });
    if (query.workMode) additional.push({ remotePreference: query.workMode === 'REMOTE' });
    if (query.language) additional.push({ professionalData: { path: ['sections', 'languages'], array_contains: [query.language] } });
    if (query.certification) additional.push({ professionalData: { path: ['sections', 'certifications'], array_contains: [query.certification] } });
    if (additional.length) where.AND = additional;
    const [items, total] = await Promise.all([this.prisma.candidateProfile.findMany({ where, skip, take, select: {
      id: true, headline: true, location: true, user: { select: { name: true } }, skills: { include: { skill: true } },
      applications: { where: appScope, select: { id: true, status: true, aiMatchScore: true, job: { select: { id: true, title: true } } } },
    }, orderBy: { updatedAt: 'desc' } }), this.prisma.candidateProfile.count({ where })]);
    return paginate(items, total, page, limit);
  }

  async search(userId: string, companyId: string, query: WorkspaceQuery) {
    await this.access.assertMembership(userId, companyId);
    if (!query.q || query.q.trim().length < 2) return { jobs: [], candidates: [], applications: [], interviews: [], members: [] };
    const scope = await this.access.jobScope(userId, companyId);
    const jobs = await this.prisma.job.findMany({ where: { AND: [scope, { title: { contains: query.q, mode: 'insensitive' } }] }, select: { id: true, title: true, status: true }, take: 6 });
    const allowed = async (permission: string) => { try { await this.access.assertPermission(userId, companyId, permission); return true; } catch { return false; } };
    const candidates = await allowed('candidate.view') ? (await this.candidates(userId, companyId, { q: query.q, limit: 6 })).items : [];
    const interviews = await allowed('application.view') ? (await this.interviews(userId, companyId, { q: query.q, limit: 6 })).items : [];
    const members = await allowed('team.view') ? await this.prisma.companyMember.findMany({ where: { companyId, status: 'ACTIVE', user: { name: { contains: query.q, mode: 'insensitive' } } }, select: { id: true, role: true, user: { select: { name: true } } }, take: 6 }) : [];
    const applications = candidates.flatMap(candidate => candidate.applications.map(app => ({ id: app.id, candidateName: candidate.user.name, jobTitle: app.job.title, status: app.status }))).slice(0, 6);
    return { jobs, candidates, applications, interviews, members };
  }

  async assign(userId: string, companyId: string, jobId: string, dto: AssignmentDto) {
    await this.access.assertJobPermission(userId, companyId, jobId, 'job.update');
    const memberIds = [...new Set(dto.memberIds)];
    if (await this.prisma.companyMember.count({ where: { id: { in: memberIds }, companyId, status: 'ACTIVE' } }) !== memberIds.length) throw new BadRequestException('All assignees must be active company members');
    await this.prisma.$transaction(async tx => {
      await tx.jobAssignment.deleteMany({ where: { jobId } });
      await tx.jobAssignment.createMany({ data: memberIds.map(memberId => ({ jobId, memberId })) });
    });
    await this.audit.log({ actorId: userId, action: 'job.assignments_updated', entityType: 'Job', entityId: jobId, metadata: { companyId, memberIds } });
    return { memberIds };
  }

  async assignments(userId: string, companyId: string, jobId: string) {
    await this.access.assertJobPermission(userId, companyId, jobId, 'application.view');
    return this.prisma.jobAssignment.findMany({ where: { jobId }, select: { memberId: true, member: { select: { role: true, user: { select: { name: true } } } } } });
  }

  async communications(userId: string, companyId: string, applicationId: string, query: WorkspaceQuery) {
    await this.access.assertApplicationPermission(userId, companyId, applicationId, 'application.view');
    const { page, limit, skip, take } = resolvePagination(query);
    const where = { applicationId };
    const [items, total] = await Promise.all([this.prisma.candidateCommunication.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }), this.prisma.candidateCommunication.count({ where })]);
    return paginate(items, total, page, limit);
  }

  async templates(userId: string, companyId: string) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    return this.prisma.companyEmailTemplate.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }
  async saveTemplate(userId: string, companyId: string, dto: EmailTemplateDto) {
    await this.access.assertPermission(userId, companyId, 'team.manage');
    const result = await this.prisma.companyEmailTemplate.upsert({ where: { companyId_name: { companyId, name: dto.name } }, create: { companyId, ...dto }, update: { subject: dto.subject, body: dto.body } });
    await this.audit.log({ actorId: userId, action: 'company.template_updated', entityType: 'CompanyEmailTemplate', entityId: result.id, metadata: { companyId } });
    return result;
  }
  async communicate(userId: string, companyId: string, applicationId: string, dto: CommunicationDto) {
    const app = await this.prisma.application.findFirst({ where: { id: applicationId, job: { companyId } }, include: { candidate: { include: { user: true } } } });
    if (!app) throw new NotFoundException('Application not found');
    await this.access.assertApplicationPermission(userId, companyId, applicationId, 'application.update');
    const requestId = `${companyId}:${applicationId}:${dto.requestId}`;
    const record = await this.prisma.candidateCommunication.upsert({ where: { requestId },
      create: { applicationId, senderId: userId, subject: dto.subject, body: dto.body, channel: dto.channel, requestId }, update: {} });
    if (record.status === 'QUEUED') return record;
    const html = `<p>${escapeHtml(record.body).replace(/\n/g, '<br>')}</p>`;
    if (record.channel !== 'IN_APP') await this.email.enqueue({ to: app.candidate.user.email, subject: record.subject, html, dedupeKey: `communication:${record.id}` });
    if (record.channel !== 'EMAIL') await this.notifications.create({ userId: app.candidate.userId, type: 'recruitment.message', title: record.subject, message: record.body, data: { applicationId, companyId }, dedupeKey: `communication:${record.id}` });
    await this.prisma.candidateCommunication.update({ where: { id: record.id }, data: { status: 'QUEUED' } });
    await this.audit.log({ actorId: userId, action: 'application.communication_queued', entityType: 'Application', entityId: applicationId, metadata: { companyId, communicationId: record.id } });
    return { ...record, status: 'QUEUED' };
  }

  async feedback(userId: string, companyId: string, interviewId: string, dto: FeedbackDto) {
    const interview = await this.prisma.interview.findFirst({ where: { id: interviewId, application: { job: { companyId } } }, include: { application: true } });
    if (!interview) throw new NotFoundException('Interview not found');
    await this.access.assertInterviewPermission(userId, companyId, interviewId, 'interview.update');
    const result = await this.prisma.interviewFeedback.create({ data: { interviewId, authorId: userId, ...dto } });
    await this.audit.log({ actorId: userId, action: 'interview.feedback_added', entityType: 'Interview', entityId: interviewId, metadata: { companyId, feedbackId: result.id } });
    this.realtime.emitToCompany(companyId, 'interview.updated', { id: interviewId });
    return result;
  }

  async auditLog(userId: string, companyId: string, query: WorkspaceQuery) {
    await this.access.assertPermission(userId, companyId, 'team.manage');
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.AuditLogWhereInput = { OR: [{ entityType: 'Company', entityId: companyId }, { metadata: { path: ['companyId'], equals: companyId } }] };
    const [items, total] = await Promise.all([this.prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true, actor: { select: { name: true } } } }), this.prisma.auditLog.count({ where })]);
    return paginate(items, total, page, limit);
  }
  async billing(userId: string, companyId: string, query: WorkspaceQuery) {
    await this.access.assertPermission(userId, companyId, 'billing.view');
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.PaymentWhereInput = { subscription: { companyId } };
    const [jobs, applications, analyses, interviews, team, assessments, payments, total] = await Promise.all([
      this.prisma.job.count({ where: { companyId, status: 'PUBLISHED' } }),
      this.prisma.application.count({ where: { job: { companyId } } }),
      this.prisma.aiAnalysis.count({ where: { inputReference: { path: ['companyId'], equals: companyId } } }),
      this.prisma.interview.count({ where: { type: 'AI', application: { job: { companyId } } } }),
      this.prisma.companyMember.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.assessment.count({ where: { companyId } }),
      this.prisma.payment.findMany({ where, skip, take, select: { id: true, amountCents: true, currency: true, status: true, createdAt: true, invoiceUrl: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.payment.count({ where }),
    ]);
    return { usage: { jobs, applications, analyses, interviews, team, assessments }, payments: paginate(payments, total, page, limit) };
  }
}
