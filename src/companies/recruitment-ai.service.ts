import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from './company-access.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { AiClient } from '../ai/ai-client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toJson } from '../common/utils/json';
import { InterviewAnswersDto, InterviewQuestionsDto, RecruitmentAiDto } from './dto/workspace.dto';

@Injectable()
export class RecruitmentAiService {
  constructor(private readonly prisma: PrismaService, private readonly access: CompanyAccessService, private readonly ai: AiClient,
    private readonly entitlements: EntitlementService, private readonly audit: AuditService, private readonly notifications: NotificationsService) {}
  async assist(userId: string, companyId: string, dto: RecruitmentAiDto) {
    const permission = ['job', 'skills', 'criteria'].includes(dto.task) ? 'job.create' : dto.task === 'assessment' ? 'assessment.manage' : 'application.view';
    await this.access.assertPermission(userId, companyId, permission);
    await this.entitlements.assertCan({ ownerType: 'COMPANY', ownerId: companyId }, 'ai.enabled');
    await this.entitlements.assertCompanyAiQuota(companyId);
    let job: Record<string, unknown> = {};
    let evidence: Record<string, unknown> = {};
    if (dto.jobId) {
      await this.access.assertJobPermission(userId, companyId, dto.jobId, 'application.view');
      const source = await this.prisma.job.findUnique({ where: { id: dto.jobId }, include: { skills: { include: { skill: true } } } });
      if (!source) throw new NotFoundException('Job not found');
      job = { title: source.title, description: source.description, requirements: source.requirements, skills: source.skills.map(s => ({ name: s.skill.name, required: s.required })), experienceLevel: source.experienceLevel };
    }
    if (dto.applicationId) {
      const app = await this.prisma.application.findFirst({ where: { id: dto.applicationId, job: { companyId }, ...(dto.jobId ? { jobId: dto.jobId } : {}) } });
      if (!app) throw new NotFoundException('Application not found');
      await this.access.assertApplicationPermission(userId, companyId, app.id, 'candidate.cv.view');
      evidence = { cvText: app.cvTextSnapshot, matching: app.matchExplanation };
    }
    if (dto.task === 'insights') {
      await this.access.assertPermission(userId, companyId, 'analytics.view');
      const scope = await this.access.applicationScope(userId, companyId);
      const where = { ...scope, ...(dto.jobId ? { jobId: dto.jobId } : {}), appliedAt: { gte: new Date(Date.now() - 30 * 86400000) } };
      const [stages, total, analyzed, missing] = await Promise.all([
        this.prisma.application.groupBy({ by: ['status'], where, _count: { _all: true } }),
        this.prisma.application.count({ where }),
        this.prisma.application.count({ where: { ...where, aiScreeningStatus: 'COMPLETED' } }),
        this.prisma.application.findMany({ where, select: { missingRequirements: true }, take: 200, orderBy: { appliedAt: 'desc' } }),
      ]);
      evidence = { periodDays: 30, total, analyzed, stages, missingRequirementsSample: missing, sampleLimit: 200 };
    }
    const analysis = await this.prisma.aiAnalysis.create({ data: { userId, type: 'JOB_ANALYZE', status: 'PROCESSING', inputReference: { companyId, task: dto.task, jobId: dto.jobId ?? null } } });
    try {
      const result = await this.ai.recruitment({ task: dto.task, locale: dto.locale, instruction: dto.instruction, job, evidence });
      await this.prisma.aiAnalysis.update({ where: { id: analysis.id }, data: { status: 'COMPLETED', output: toJson(result), completedAt: new Date() } });
      await this.audit.log({ actorId: userId, action: 'company.ai_assistance', entityType: 'AiAnalysis', entityId: analysis.id, metadata: { companyId, task: dto.task } });
      return { ...result, analysisId: analysis.id };
    } catch {
      await this.prisma.aiAnalysis.update({ where: { id: analysis.id }, data: { status: 'FAILED', error: 'Recruitment assistance unavailable' } });
      throw new BadGatewayException('Recruitment assistance is temporarily unavailable');
    }
  }
  async publishQuestions(userId: string, companyId: string, id: string, dto: InterviewQuestionsDto) {
    const interview = await this.prisma.interview.findFirst({ where: { id, application: { job: { companyId } } }, include: { application: true } });
    if (!interview) throw new NotFoundException('Interview not found');
    await this.access.assertInterviewPermission(userId, companyId, id, 'interview.update');
    await this.entitlements.assertCan({ ownerType: 'COMPANY', ownerId: companyId }, 'ai.enabled');
    if (!['SCHEDULED', 'CONFIRMED'].includes(interview.status) || !dto.questions.length || dto.questions.some(q => !q.trim())) throw new BadRequestException('Review all questions before publishing');
    await this.prisma.interview.update({ where: { id, updatedAt: interview.updatedAt }, data: { type: 'AI', questions: toJson({ items: dto.questions, locale: dto.locale }), status: 'CONFIRMED' } });
    const candidate = await this.prisma.candidateProfile.findUniqueOrThrow({ where: { id: interview.application.candidateId }, select: { userId: true } });
    await this.notifications.create({ userId: candidate.userId, type: 'interview.ai_ready', title: 'Interview ready', message: 'Your interview questions are ready.', data: { interviewId: id, href: `/recruitment-interviews/${id}` }, dedupeKey: `interview.ready:${id}` });
    await this.audit.log({ actorId: userId, action: 'interview.questions_published', entityType: 'Interview', entityId: id, metadata: { companyId, count: dto.questions.length } });
    return { id, ready: true };
  }
  async candidateInterview(userId: string, id: string) {
    const item = await this.prisma.interview.findFirst({ where: { id, type: 'AI', application: { candidate: { userId } }, status: { in: ['CONFIRMED', 'COMPLETED'] } }, select: { id: true, startAt: true, endAt: true, status: true, questions: true, answers: true, application: { select: { job: { select: { title: true, company: { select: { commercialName: true } } } } } } } });
    if (!item) throw new NotFoundException('Interview not found');
    return item;
  }
  async submitAnswers(userId: string, id: string, dto: InterviewAnswersDto) {
    const interview = await this.candidateInterview(userId, id);
    const questions = (interview.questions as { items?: string[] } | null)?.items;
    if (!questions || questions.length !== dto.answers.length || dto.answers.some(a => !a.trim())) throw new BadRequestException('Answer every question');
    if (interview.status !== 'CONFIRMED' || interview.answers) throw new ConflictException('Interview already submitted');
    const count = await this.prisma.interview.updateMany({ where: { id, status: 'CONFIRMED', answers: { equals: Prisma.DbNull } }, data: { answers: toJson(dto.answers), status: 'COMPLETED', completedAt: new Date() } });
    if (count.count !== 1) throw new ConflictException('Interview already submitted');
    await this.audit.log({ actorId: userId, action: 'interview.answers_submitted', entityType: 'Interview', entityId: id });
    return { submitted: true };
  }
  async report(userId: string, companyId: string, id: string) {
    const interview = await this.prisma.interview.findFirst({ where: { id, application: { job: { companyId } } }, include: { application: { include: { job: true } } } });
    if (!interview) throw new NotFoundException('Interview not found');
    await this.access.assertInterviewPermission(userId, companyId, id, 'interview.update');
    await this.entitlements.assertCan({ ownerType: 'COMPANY', ownerId: companyId }, 'ai.enabled');
    await this.entitlements.assertCompanyAiQuota(companyId);
    if (!interview.answers) throw new BadRequestException('Interview answers are not available');
    try { const result = await this.ai.recruitment({ task: 'report', locale: (interview.questions as { locale?: string })?.locale ?? 'en', job: { title: interview.application.job.title, requirements: interview.application.job.requirements }, evidence: { questions: interview.questions, answers: interview.answers } });
      await this.prisma.interview.update({ where: { id }, data: { aiReport: toJson(result) } });
      await this.audit.log({ actorId: userId, action: 'interview.ai_report_created', entityType: 'Interview', entityId: id, metadata: { companyId } });
      return result;
    } catch { throw new BadGatewayException('Interview analysis is temporarily unavailable'); }
  }
}
