import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
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
import { ApplicationMessageDto } from './dto/application.dto';
import type { RequestMeta } from '../companies/companies.service';
import { atsReport, matchCandidate, matchesPreferences } from '../career/career-engine';
import { StorageService } from '../files/storage.service';
import { isLocalTestJob } from '../jobs/job-availability';
import { applicationQuality } from '../career/application-quality';
import { mergePlanFeatures } from '../subscriptions/plan-catalog';
import { DEFAULT_THRESHOLDS, recruitmentClassification, type RecruitmentClassification } from '../companies/recruitment-metrics';
import { analyzeGrowthPotential } from '../career/growth-potential';
import { EntitlementService } from '../entitlements/entitlement.service';
import { applicationWorkflow, criticalGapCount, potentialAssessment, rankingScoreForApplication } from './recruitment-policy';
import { copySubmittedCv, submittedCv, publicSubmittedCv } from './submitted-cv';

type MatchEvidence = {
  requirements?: Array<{ priority?: string; status?: string }>;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

type GrowthPotentialPayload = {
  score: number | null;
  level: string;
  reasons: string[];
  developmentPoints: string[];
};

function growthPotentialPayload(
  matchExplanation: Prisma.JsonValue | null | undefined,
  potentialScore: string | null | undefined,
  potentialReason: string | null | undefined,
  analysisStatus: string | null | undefined,
): GrowthPotentialPayload | null {
  const raw = matchExplanation && typeof matchExplanation === 'object' && !Array.isArray(matchExplanation)
    ? (matchExplanation as { growthAnalysis?: unknown }).growthAnalysis
    : null;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const value = raw as { score?: unknown; category?: unknown; why?: unknown; gaps?: unknown };
    const reasons = Array.isArray(value.why) ? value.why.filter((item): item is string => typeof item === 'string') : [];
    const developmentPoints = Array.isArray(value.gaps)
      ? value.gaps.map(gap => gap && typeof gap === 'object' && 'skill' in gap ? String((gap as { skill: unknown }).skill) : '').filter(Boolean)
      : [];
    return {
      score: typeof value.score === 'number' ? value.score : null,
      level: typeof value.category === 'string' ? value.category : potentialScore ?? 'UNDETERMINED',
      reasons,
      developmentPoints,
    };
  }
  if (potentialScore || potentialReason) return { score: null, level: potentialScore ?? 'UNDETERMINED', reasons: potentialReason ? [potentialReason] : [], developmentPoints: [] };
  if (analysisStatus === 'COMPLETED' || analysisStatus === 'READY') return { score: null, level: 'INCOMPLETE', reasons: ['Growth potential data is missing from a completed analysis. Re-run the deterministic profile analysis.'], developmentPoints: [] };
  return null;
}

function analysisStatusForApplication(application: {
  aiScreeningStatus?: string | null;
  aiMatchScore?: number | null;
  growthPotential: GrowthPotentialPayload | null;
}): string {
  if (application.aiScreeningStatus === 'COMPLETED' || application.aiScreeningStatus === 'READY') {
    return application.aiMatchScore != null && application.growthPotential?.score != null && application.growthPotential.level !== 'INCOMPLETE' ? 'READY' : 'PARTIAL';
  }
  return application.aiScreeningStatus ?? 'PENDING';
}

function logAnalysisConsistency(match: { score: number | null; evidenceAnalysis?: { requirements?: Array<{ status?: string }> } }, growth: { score?: number | null; category?: string }, context: string): void {
  if ((process.env.NODE_ENV ?? 'development').toLowerCase() === 'production') return;
  const requirements = match.evidenceAnalysis?.requirements ?? [];
  const gaps = requirements.filter(requirement => ['NOT_FOUND', 'CONFLICTING'].includes(requirement.status ?? '')).length;
  if (match.score != null && match.score < DEFAULT_THRESHOLDS.review && gaps === 0) {
    console.warn(`[application-analysis] low match score without requirement gaps (${context})`, { score: match.score, growthScore: growth.score ?? null });
  }
  if (match.score != null && (growth.score == null || !growth.category)) {
    console.warn(`[application-analysis] match is available but growth potential is incomplete (${context})`, { score: match.score });
  }
}

function recommendationForAnalysis(match: { score: number | null; evidenceAnalysis?: { score?: number | null; requirements?: Array<{ status?: string }> } }, growth: { category?: string; score?: number | null }): string {
  if (match.score == null) return 'Analysis pending. Review the candidate evidence before making a decision.';
  const coverage = match.evidenceAnalysis?.score ?? match.score;
  const transferable = (match.evidenceAnalysis?.requirements ?? []).filter(requirement => ['TRANSFERABLE', 'PARTIALLY_SUPPORTED'].includes(requirement.status ?? '')).length;
  if (match.score >= 85) return `Strong Match. The candidate covers ${coverage}% of the assessed requirements with direct evidence.`;
  if (match.score >= 60 || growth.category === 'HIGH' || transferable > 0) return `Promising. The candidate covers ${coverage}% of the assessed requirements; transferable evidence supports a recruiter review.`;
  return `Low alignment. Only ${coverage}% of the assessed requirements is evidenced; verify the documented gaps before progressing.`;
}


function classificationForApplication(
  application: { aiMatchScore: number | null; potentialScore: string | null; matchExplanation?: Prisma.JsonValue | null },
  thresholds: typeof DEFAULT_THRESHOLDS,
): RecruitmentClassification {
  return recruitmentClassification(application.aiMatchScore, application.potentialScore, thresholds, criticalGapCount(application.matchExplanation));
}


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
    private readonly entitlements?: EntitlementService,
  ) {}

  private async hasRecruitmentIntelligence(companyId: string): Promise<boolean> {
    return this.entitlements ? this.entitlements.hasRecruitmentIntelligence(companyId) : true;
  }

  private async assertRecruitmentIntelligence(companyId: string): Promise<void> {
    if (this.entitlements) await this.entitlements.assertRecruitmentIntelligence(companyId);
  }

  async apply(userId: string, jobId: string, dto: ApplyDto, meta: RequestMeta,
    automatic?: { resumeId: string; settingsVersion: Date }) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { company: { include: { verification: true } }, skills: { include: { skill: true } } } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== 'PUBLISHED') {
      throw new BadRequestException('This job is not accepting applications');
    }
    if (!isLocalTestJob(job) && ['OFFRE DE DÉMONSTRATION', 'OFFRE DE TEST', 'Source officielle et candidature :', 'Source et candidature :'].some(marker => job.description?.includes(marker))) throw new BadRequestException('This legacy imported or demonstration offer does not accept native applications');
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

    if (!automatic && !dto.candidateSnapshot) throw new BadRequestException('Review your candidate information before applying');
    if (!dto.resumeId) throw new BadRequestException('Select a CV before applying');
    if (dto.consent !== true) throw new BadRequestException('Application sharing consent is required');
    const selectedResume = profile.resumes.find(r => r.id === dto.resumeId);
    const quality = applicationQuality(job, selectedResume, automatic && !dto.candidateSnapshot ? { ...dto, candidateSnapshot: { fullName: user.name, email: user.email } } : dto, profile.resumes.map(r => r.id));
    if (!quality.ready) throw new BadRequestException({ message: 'Vérifie la qualité de la candidature avant l’envoi.', quality, fieldErrors: quality.fieldErrors });
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

    const cvText = profile.resumes.find(r => r.id === dto.resumeId)?.parsedText || '';
    const recruitmentIntelligenceEnabled = await this.hasRecruitmentIntelligence(job.companyId);
    const match = matchCandidate({ ...profile, resumes: cvText ? [{ parsedText: cvText }] : profile.resumes }, job);
    const growth = analyzeGrowthPotential(profile, job, match, dto.coverLetter ?? dto.motivation ?? '');
    logAnalysisConsistency(match, growth, `create:${job.id}:${profile.id}`);
    let cvFile: Awaited<ReturnType<typeof copySubmittedCv>> | undefined;
    const application = await this.prisma.$transaction(async (tx) => {
      const resumeId = dto.resumeId!;
      if (automatic) {
        await tx.$queryRaw`SELECT "candidateId" FROM "CareerSettings" WHERE "candidateId" = ${profile.id} FOR UPDATE`;
        const settings = await tx.careerSettings.findUnique({ where: { candidateId: profile.id } });
        const subscription = await tx.subscription.findFirst({ where: { candidateId: profile.id, ownerType: 'CANDIDATE', status: { in: ['ACTIVE', 'TRIALING'] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
        const features = subscription
          ? mergePlanFeatures(subscription.plan.type, subscription.plan.name, subscription.plan.features)
          : undefined;
        if (!settings?.autoApply || !settings.autoConsentAt || settings.approvalRequired || !settings.unattendedConsentAt || settings.updatedAt.getTime() !== automatic.settingsVersion.getTime() || settings.preferredResumeId !== automatic.resumeId || dto.resumeId !== automatic.resumeId || features?.['career.auto_apply'] !== true) throw new ForbiddenException('Auto Apply authorization changed');
        const resume = await tx.resume.findFirst({ where: { id: automatic.resumeId, candidateId: profile.id, mimeType: 'application/pdf' } });
        if (!resume) throw new BadRequestException('The selected PDF CV is no longer available');
        if (match.score === null || match.score < settings.autoMinimumScore || !match.matchedSkills.length || !matchesPreferences(job, settings)) throw new ForbiddenException('Job does not meet Auto Apply preferences');
        const midnight = new Date(); midnight.setUTCHours(0, 0, 0, 0);
        if (await tx.application.count({ where: { candidateId: profile.id, autoApplied: true, appliedAt: { gte: midnight } } }) >= Math.min(settings.maxPerDay, Number(features?.['career.auto_apply.daily_limit']) || 3)) throw new BadRequestException('Daily Auto Apply limit reached (UTC)');
        const weekStart = new Date(midnight); weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() + 6) % 7);
        if (await tx.application.count({ where: { candidateId: profile.id, autoApplied: true, appliedAt: { gte: weekStart } } }) >= Math.min(settings.maxPerWeek, Number(features?.['career.auto_apply.weekly_limit']) || 10)) throw new BadRequestException('Weekly Auto Apply limit reached (UTC)');
        const currentJob = await tx.job.findFirst({ where: { id: job.id, status: 'PUBLISHED', company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
        if (!currentJob) throw new BadRequestException('Job is no longer available');

      }
      cvFile = await copySubmittedCv(this.storage, selectedResume!);
      const created = await tx.application.create({
        data: {
          jobId,
          consentAt: new Date(),
          candidateId: profile.id,
          resumeId,
          sourceType: 'COMPANY_DIRECT',
          applicationMethod: 'NATIVE_EASYJOB',
          motivation: dto.motivation ?? dto.coverLetter ?? null,
          coverLetter: dto.coverLetter ?? null,
          candidateSnapshot: { ...(dto.candidateSnapshot ?? {}), submittedCv: cvFile } as unknown as Prisma.InputJsonValue,
          answers: dto.answers ? dto.answers as Prisma.InputJsonValue : Prisma.JsonNull,
          status: 'APPLIED',
          aiMatchScore: recruitmentIntelligenceEnabled ? match.score : null,
          atsScore: recruitmentIntelligenceEnabled && cvText ? atsReport(cvText).score : null,
          aiQualification: recruitmentIntelligenceEnabled ? match.classification : null,
          aiRecommendation: recruitmentIntelligenceEnabled ? recommendationForAnalysis(match, growth) : null,
          aiSummary: recruitmentIntelligenceEnabled ? match.summary : null,
          matchExplanation: recruitmentIntelligenceEnabled ? JSON.parse(JSON.stringify({ ...match, growthAnalysis: growth, applicationQuality: quality, jobSnapshot: { title: job.title, requirements: job.requirements, skills: job.skills.map(s => s.skill.name), description: job.description } })) as Prisma.InputJsonValue : Prisma.JsonNull,
          potentialScore: recruitmentIntelligenceEnabled ? growth.category : null,
          potentialReason: recruitmentIntelligenceEnabled ? growth.summary : null,
          strengths: recruitmentIntelligenceEnabled ? match.matchedSkills.join(', ') : null,
          missingRequirements: recruitmentIntelligenceEnabled ? [...match.missingSkills, ...match.unverifiedRequirements].join('; ') : null,
          aiScreeningStatus: recruitmentIntelligenceEnabled && match.score !== null && growth.score != null ? 'READY' : recruitmentIntelligenceEnabled ? 'PARTIAL' : 'PENDING',
          aiScreenedAt: recruitmentIntelligenceEnabled && match.score !== null && growth.score != null ? new Date() : null,
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
    }, { timeout: 20000 }).catch(async error => { if (cvFile) await this.storage.delete(cvFile.storageKey).catch(() => undefined); throw error; });

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
    if (!isLocalTestJob(job)) await this.notifyCompanyOfApplication(job, profile.id, { score: application.aiMatchScore, potential: application.potentialScore });

    this.events.emit('candidate.applied', {
      applicationId: application.id,
      jobId,
      companyId: job.companyId,
      candidateId: profile.id,
    });
    this.events.emit('analytics.invalidate.company', { companyId: job.companyId });
    this.realtime.emitToCompany(job.companyId, 'application.created', { id: application.id, jobId });

    if (process.env.NODE_ENV !== 'production') {
      console.info('[application-analysis]', {
        applicationId: application.id,
        jobId,
        matchScore: application.aiMatchScore,
        potentialScore: application.potentialScore,
        potentialCategory: growth.category,
        classification: application.aiQualification,
        analysisStatus: application.aiMatchScore == null || growth.score == null || !recruitmentIntelligenceEnabled ? 'PARTIAL' : 'READY',
      });
    }

    return this.getById(application.id, userId);
  }

  async listForCandidate(userId: string, query: { page?: number; limit?: number; status?: ApplicationStatus }) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) return paginate([], query.page ?? 1, query.limit ?? 20, 0);
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.ApplicationWhereInput = {
      candidateId: profile.id,
      ...(query.status ? { status: query.status === 'UNDER_REVIEW' ? { in: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.SCREENING] } : query.status === 'INTERVIEW' ? { in: [ApplicationStatus.INTERVIEW, ApplicationStatus.ASSESSMENT] } : query.status } : {}),
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
    return paginate(items.map(item => this.withAnalysisContract(item)), total, page, limit);
  }

  async listJobSummaries(userId: string, companyId: string, query: { page?: number; limit?: number; search?: string; status?: import('@prisma/client').JobStatus; sort?: string }) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    const advancedAnalysisAvailable = await this.hasRecruitmentIntelligence(companyId);
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.JobWhereInput = { ...(await this.access.jobScope(userId, companyId)), ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}), ...(query.status ? { status: query.status } : {}) };
    const orderBy: Prisma.JobOrderByWithRelationInput[] = query.sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }] : query.sort === 'title' ? [{ title: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({ where, select: { id: true, title: true, domain: true, location: true, employmentType: true, workMode: true, remote: true, salaryMin: true, salaryMax: true, currency: true, expiresAt: true, status: true, publishedAt: true, createdAt: true }, orderBy, skip, take }),
      this.prisma.job.count({ where }),
    ]);
    const scope = { ...(await this.access.applicationScope(userId, companyId)), jobId: { in: jobs.map(job => job.id) } };
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { recruitmentSettings: true } });
    const thresholds = (company?.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS } | null)?.thresholds ?? DEFAULT_THRESHOLDS;
    const strongThreshold = thresholds.strong;
    const [counts, averages, strong, scoredApplications] = await Promise.all([
      this.prisma.application.groupBy({ by: ['jobId', 'status'], where: scope, _count: { _all: true } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: scope, _avg: { aiMatchScore: true, atsScore: true } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: { ...scope, aiMatchScore: { gte: strongThreshold } }, _count: { _all: true } }),
      this.prisma.application.findMany({ where: scope, select: { id: true, jobId: true, aiMatchScore: true, potentialScore: true, matchExplanation: true } }),
    ]);
    const paginated = paginate(jobs.map(job => {
      const stages = counts.filter(row => row.jobId === job.id);
      const average = averages.find(row => row.jobId === job.id)?._avg;
      const jobApplications = scoredApplications.filter(application => application.jobId === job.id);
      const classificationCounts = advancedAnalysisAvailable
        ? Object.fromEntries(['STRONG_MATCH', 'PROMISING', 'REVIEW', 'LOW_ALIGNMENT'].map(classification => [classification, jobApplications.filter(application => classificationForApplication(application, thresholds) === classification).length]))
        : {};
      return { ...job, applications: stages.reduce((sum, row) => sum + row._count._all, 0),
        newApplications: stages.find(row => row.status === 'APPLIED')?._count._all ?? 0,
        shortlisted: stages.find(row => row.status === 'SHORTLISTED')?._count._all ?? 0,
        strongMatches: advancedAnalysisAvailable ? strong.find(row => row.jobId === job.id)?._count._all ?? 0 : 0,
        classificationCounts,
        topCandidates: advancedAnalysisAvailable ? jobApplications.filter(application => classificationForApplication(application, thresholds) !== 'LOW_ALIGNMENT').slice().sort((a, b) => rankingScoreForApplication(b) - rankingScoreForApplication(a) || a.id.localeCompare(b.id)).slice(0, 10).map(application => application.id) : [],
        averageMatch: advancedAnalysisAvailable ? average?.aiMatchScore ?? null : null, averageAts: advancedAnalysisAvailable ? average?.atsScore ?? null : null };
    }), total, page, limit);
    return { ...paginated, advancedAnalysisAvailable };
  }

  async listForCompany(userId: string, companyId: string, query: { page?: number; limit?: number; status?: ApplicationStatus; jobId?: string; search?: string; minimumMatch?: number; sort?: string; classification?: RecruitmentClassification; topN?: number; includeLowAlignment?: string; overdue?: string; activeOnly?: string; from?: string; to?: string }) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    if (query.jobId) await this.access.assertJobPermission(userId, companyId, query.jobId, 'application.view');
    const member = await this.access.assertMembership(userId, companyId);
    const advancedAnalysisAvailable = await this.hasRecruitmentIntelligence(companyId);
    const company = await this.prisma.company?.findUnique({ where: { id: companyId }, select: { recruitmentSettings: true } });
    const settings = company?.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS; stageSlaHours?: Partial<Record<ApplicationStatus, number>> } | null;
    const thresholds = settings?.thresholds ?? DEFAULT_THRESHOLDS;
    const configuredTargets = settings?.stageSlaHours ?? {};
    const defaultTargets: Partial<Record<ApplicationStatus, number>> = { APPLIED: 24, SCREENING: 1, UNDER_REVIEW: 72, SHORTLISTED: 72, ASSESSMENT: 120, INTERVIEW: 120, OFFER: 120 };
    const { page, limit, skip, take } = resolvePagination(query);
    const baseWhere: Prisma.ApplicationWhereInput = {
      ...(await this.access.applicationScope(userId, companyId)),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...((query.from || query.to) ? { appliedAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
      ...(query.minimumMatch != null ? { aiMatchScore: { gte: query.minimumMatch } } : {}),
      ...(query.search ? { candidate: { user: { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } } } : {}),
    };
    const where: Prisma.ApplicationWhereInput = { ...baseWhere, ...(query.status ? { status: query.status === 'UNDER_REVIEW' ? { in: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.SCREENING] } : query.status === 'INTERVIEW' ? { in: [ApplicationStatus.INTERVIEW, ApplicationStatus.ASSESSMENT] } : query.status } : {}) };
    const scopedAnd = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
    if (query.activeOnly === 'true') scopedAnd.push({ status: { notIn: [...TERMINAL] } });
    where.AND = scopedAnd;
    if (query.overdue === 'true') scopedAnd.push({ OR: Object.keys(defaultTargets).map(stage => {
      const status = stage as ApplicationStatus;
      const cutoff = new Date(Date.now() - (configuredTargets[status] ?? defaultTargets[status] ?? 72) * 3600000);
      return { status, OR: [{ stageChangedAt: { lt: cutoff } }, { stageChangedAt: null, appliedAt: { lt: cutoff } }] };
    }) });
    const sortByPotential = query.sort === 'potential';
    const showLowAlignment = query.includeLowAlignment === 'true' || query.classification === 'LOW_ALIGNMENT' || query.status === 'REJECTED';
    const useInMemoryWorkflow = advancedAnalysisAvailable && (sortByPotential || !!query.classification || (!!query.topN && !!query.jobId) || !showLowAlignment);
    const findManyArgs: Prisma.ApplicationFindManyArgs = {
      where,
      include: this.applicationInclude,
      orderBy: query.sort === 'match'
        ? [{ aiMatchScore: { sort: 'desc', nulls: 'last' } }, { appliedAt: 'asc' }, { id: 'asc' }]
        : query.sort === 'oldest'
          ? [{ appliedAt: 'asc' }, { id: 'asc' }]
          : query.sort === 'stageTime'
            ? [{ stageChangedAt: 'asc' }, { id: 'asc' }]
            : [{ appliedAt: 'desc' }, { id: 'asc' }],
      ...(useInMemoryWorkflow ? {} : { skip, take }),
    };
    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.application.findMany(findManyArgs),
      this.prisma.application.count({ where }),
    ]);
    let items = rawItems;
    let workflowTotal = rawItems.length;
    if (useInMemoryWorkflow) {
      if (!showLowAlignment) items = items.filter(item => classificationForApplication(item, thresholds) !== 'LOW_ALIGNMENT');
      if (query.classification) items = items.filter(item => classificationForApplication(item, thresholds) === query.classification);
      workflowTotal = items.length;
      items = items.slice().sort((a, b) => {
        if (query.sort === 'potential') {
          const rank = (value: string | null) => value === 'HIGH' ? 3 : value === 'MEDIUM' ? 2 : value === 'LOW' ? 1 : 0;
          const difference = rank(b.potentialScore) - rank(a.potentialScore);
          if (difference !== 0) return difference;
        } else if (query.sort === 'match' || query.topN) {
          const difference = rankingScoreForApplication(b) - rankingScoreForApplication(a);
          if (difference !== 0) return difference;
        }
        const date = (item: typeof a) => (query.sort === 'stageTime' ? item.stageChangedAt ?? item.appliedAt : item.appliedAt).getTime();
        const difference = query.sort === 'oldest' || query.sort === 'stageTime' ? date(a) - date(b) : date(b) - date(a);
        return difference || a.id.localeCompare(b.id);
      });
      if (query.topN && query.jobId) items = items.slice(0, query.topN);
      items = items.slice(skip, skip + take);
    }
    const visibleItems = await this.filterAssignedInterviews(items, userId, companyId);
    const now = Date.now();
    const withWorkflow = visibleItems.map(item => {
      const stageEnteredAt = item.stageChangedAt ?? item.appliedAt;
      const targetSeconds = Math.round((configuredTargets[item.status] ?? defaultTargets[item.status] ?? 72) * 3600);
      return {
        ...this.withAnalysisContract(item, advancedAnalysisAvailable),
        ...(advancedAnalysisAvailable ? { classification: classificationForApplication(item, thresholds), rankingScore: rankingScoreForApplication(item) } : {}),
        workflow: applicationWorkflow(item.status, stageEnteredAt, targetSeconds / 3600, now),
      };
    });
    const effectiveTotal = useInMemoryWorkflow ? (query.topN && query.jobId ? Math.min(query.topN, workflowTotal) : workflowTotal) : total;
    const paginated = paginate(withWorkflow, effectiveTotal, page, limit);
    const groupedStages = member.role === 'INTERVIEWER' ? [] : await this.prisma.application.groupBy({ where: baseWhere, by: ['status'], orderBy: { status: 'asc' }, _count: { _all: true } });
    const stageCounts = Object.fromEntries(groupedStages.map(stage => [stage.status, typeof stage._count === 'object' ? stage._count._all ?? 0 : 0]));
    return { ...paginated, stageCounts, advancedAnalysisAvailable };
  }

  private withAnalysisContract<T extends {
    aiScreeningStatus?: string | null;
    aiMatchScore?: number | null;
    potentialScore?: string | null;
    potentialReason?: string | null;
    matchExplanation?: Prisma.JsonValue | null;
  }>(application: T, advancedAnalysisAvailable = true): any {
    const snapshot = (application as T & { candidateSnapshot?: Prisma.JsonValue }).candidateSnapshot;
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      application = { ...application, candidateSnapshot: { ...snapshot, submittedCv: publicSubmittedCv(snapshot) }, submittedCv: publicSubmittedCv(snapshot) };
    }
    if (!advancedAnalysisAvailable) {
      const { aiMatchScore: _match, atsScore: _ats, aiQualification: _qualification, aiRecommendation: _recommendation, aiSummary: _summary, potentialScore: _potential, potentialReason: _reason, strengths: _strengths, missingRequirements: _missing, matchExplanation: _explanation, ...safe } = application as T & Record<string, unknown>;
      return { ...safe, analysisStatus: 'LOCKED', growthPotential: null, advancedAnalysisAvailable: false };
    }
    const growthPotential = growthPotentialPayload(application.matchExplanation, application.potentialScore, application.potentialReason, application.aiScreeningStatus);
    const assessment = potentialAssessment(application.aiMatchScore, application.matchExplanation);
    return {
      ...application,
      analysisStatus: analysisStatusForApplication({ ...application, growthPotential }),
      growthPotential: assessment.applicable ? growthPotential : { ...growthPotential, score: null, level: 'NOT_APPLICABLE', reasons: [], developmentPoints: [] },
      potentialAssessment: assessment,
      advancedAnalysisAvailable: true,
    };
  }

  async getById(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: this.applicationInclude,
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(userId, application);
    const isCandidate = application.candidate.userId === userId;
    const visible = application.candidate.userId === userId
      ? application
      : (await this.filterAssignedInterviews([application], userId, application.job.companyId))[0];
    const advanced = isCandidate || await this.hasRecruitmentIntelligence(application.job.companyId);
    const company = await this.prisma.company.findUnique({ where: { id: application.job.companyId }, select: { recruitmentSettings: true } });
    const thresholds = (company?.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS } | null)?.thresholds ?? DEFAULT_THRESHOLDS;
    return { ...this.withAnalysisContract(visible, advanced), ...(advanced ? { classification: classificationForApplication(application, thresholds) } : {}) };
  }

  private async filterAssignedInterviews<T extends { id: string; interviews?: { id: string }[] }>(items: T[], userId: string, companyId: string): Promise<T[]> {
    const member = await this.access.assertMembership(userId, companyId);
    if (member.role !== 'INTERVIEWER') return items;
    const assigned = await this.prisma.interview.findMany({ where: { applicationId: { in: items.map(i => i.id) }, participants: { some: { memberId: member.memberId } } }, select: { id: true } });
    const allowed = new Set(assigned.map(i => i.id));
    return items.map(item => ({ ...item, interviews: (item.interviews ?? []).filter(i => allowed.has(i.id)) })) as T[];
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

    if (dto.newStatus === 'OFFER') throw new BadRequestException('Send an employment offer to move the application to this stage');
    assertTransition(application.status, dto.newStatus);

    const source = dto.source || 'HR';
    if (source !== 'HR' && ['REJECTED', 'HIRED', 'OFFER', 'WITHDRAWN'].includes(dto.newStatus)) {
      throw new BadRequestException('A human recruiter must make this decision');
    }
    const thresholds = (application.job.company.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS } | null)?.thresholds ?? DEFAULT_THRESHOLDS;
    const classification = classificationForApplication(application, thresholds);
    const activeWorkflowStatuses: ApplicationStatus[] = [ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER, ApplicationStatus.HIRED];
    const isAlignmentOverride = classification === 'LOW_ALIGNMENT' && activeWorkflowStatuses.includes(dto.newStatus);
    if (isAlignmentOverride && !dto.alignmentOverride) {
      throw new BadRequestException({ code: 'LOW_ALIGNMENT_OVERRIDE_REQUIRED', message: 'This candidate is in Low Alignment. Explicit recruiter override is required before moving them into interview, offer, or hired.' });
    }
    if (dto.alignmentOverride && source !== 'HR') throw new BadRequestException('Only a recruiter can override Low Alignment routing');
    if (isAlignmentOverride && (dto.overrideReason ?? dto.note ?? '').trim().length < 5) throw new BadRequestException('Explain the recruiter override in at least 5 characters');
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.application.update({
        where: { id: applicationId, status: application.status },
        data: {
          status: dto.newStatus,
          stageChangedAt: new Date(),
          stageChangedById: userId,
          stageChangeSource: source,
          ...(dto.alignmentOverride ? { alignmentOverrideById: userId, alignmentOverriddenAt: new Date(), alignmentOverrideReason: dto.overrideReason ?? dto.note ?? null } : {}),
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
            ...(dto.alignmentOverride ? { alignmentOverride: true, alignmentOverrideReason: dto.overrideReason ?? dto.note ?? null } : {}),
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
      metadata: { jobId: application.jobId, companyId: application.job.companyId, from: application.status, to: dto.newStatus, ...(dto.alignmentOverride ? { alignmentOverride: true, overrideReason: dto.overrideReason ?? dto.note ?? null } : {}) },
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
  async listMessages(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId }, include: { job: { select: { companyId: true, title: true } }, candidate: { select: { userId: true } } } });
    if (!application) throw new NotFoundException('Application not found');
    const isCandidate = application.candidate.userId === userId;
    if (!isCandidate) await this.access.assertApplicationPermission(userId, application.job.companyId, applicationId, 'application.view');
    await this.prisma.candidateCommunication.updateMany({ where: { applicationId, senderType: isCandidate ? 'RECRUITER' : 'CANDIDATE', readAt: null }, data: { readAt: new Date() } });
    const items = await this.prisma.candidateCommunication.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } });
    return { applicationId, items };
  }

  async sendMessage(applicationId: string, userId: string, dto: ApplicationMessageDto) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId }, include: { job: { select: { companyId: true, title: true } }, candidate: { include: { user: true } } } });
    if (!application) throw new NotFoundException('Application not found');
    const isCandidate = application.candidate.userId === userId;
    if (!isCandidate) await this.access.assertApplicationPermission(userId, application.job.companyId, applicationId, 'application.update');
    const subject = dto.subject?.trim() || `Message · ${application.job.title}`;
    const record = await this.prisma.candidateCommunication.create({ data: { applicationId, senderId: userId, senderType: isCandidate ? 'CANDIDATE' : 'RECRUITER', subject, body: dto.body.trim(), channel: 'BOTH', status: 'QUEUED', requestId: `thread:${applicationId}:${dto.requestId || randomUUID()}` } });
    const html = `<p>${escapeHtml(record.body).replace(/\n/g, '<br>')}</p><p><a href="/candidate/applications/${applicationId}">Voir la conversation</a></p>`;
    const notify = async (recipient: { id: string; email: string }, title: string) => {
      await Promise.allSettled([
        this.notifications.create({ userId: recipient.id, type: 'recruitment.message', title, message: record.body, data: { applicationId, companyId: application.job.companyId }, dedupeKey: `communication:${record.id}:${recipient.id}` }),
        this.emailService.enqueue({ to: recipient.email, subject: title, html, dedupeKey: `communication:${record.id}:${recipient.id}` }),
      ]);
    };
    if (isCandidate) {
      const members = await this.prisma.companyMember.findMany({ where: { companyId: application.job.companyId, status: 'ACTIVE' }, include: { user: { select: { id: true, email: true } } } });
      await Promise.all(members.map(member => notify(member.user, `${application.candidate.user.name} vous a répondu`)));
    } else {
      await notify({ id: application.candidate.userId, email: application.candidate.user.email }, `Nouveau message concernant ${application.job.title}`);
    }
    return record;
  }

  async getCvUrl(userId: string, applicationId: string, meta: RequestMeta) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { companyId: true } }, candidate: { select: { userId: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertCanView(userId, application);
    if (application.candidate.userId !== userId) await this.access.assertApplicationPermission(userId, application.job.companyId, application.id, 'candidate.cv.view');
    const snapshot = submittedCv(application.candidateSnapshot);
    if (snapshot) {
      await this.audit.log({ actorId: userId, action: 'cv.download', entityType: 'Application', entityId: applicationId, metadata: { version: snapshot.version }, ipAddress: meta.ip, userAgent: meta.userAgent });
      return { ...publicSubmittedCv(application.candidateSnapshot), url: await this.storage.presignedGet(snapshot.storageKey) };
    }
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
    match: { score: number | null; potential: string | null },
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: job.companyId }, select: { recruitmentSettings: true } });
    const thresholds = (company?.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS } | null)?.thresholds ?? DEFAULT_THRESHOLDS;
    const strongThreshold = thresholds.strong;
    const isStrong = match.score != null && match.score >= strongThreshold;
    const isPromising = match.potential === 'HIGH';
    if (!isStrong && !isPromising) return;
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
        title: isStrong ? 'Strong-match candidate' : 'Promising candidate identified',
        message: isStrong ? `A strong-match candidate applied to "${job.title}".` : `A promising candidate applied to "${job.title}".`,
        data: { jobId: job.id, candidateId, companyId: job.companyId },
        email: { subject: template.subject, html: template.html, to: recipient.email },
        dedupeKey: `candidate.applied:${job.id}:${candidateId}:${recipient.id}`,
      });
    }
  }

  async rankCandidatesForJob(userId: string, companyId: string, jobId: string) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    await this.assertRecruitmentIntelligence(companyId);
    const company = await this.prisma.company?.findUnique({ where: { id: companyId }, select: { recruitmentSettings: true } });
    const thresholds = (company?.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS } | null)?.thresholds ?? DEFAULT_THRESHOLDS;
    const apps = await this.prisma.application.findMany({
      where: { jobId, ...(await this.access.applicationScope(userId, companyId)) },
      include: this.applicationInclude,
      orderBy: [
        { aiMatchScore: { sort: 'desc', nulls: 'last' } },
        { atsScore: { sort: 'desc', nulls: 'last' } },
        { appliedAt: 'asc' },
      ],
    });

    const ranked = apps
      .filter(app => classificationForApplication(app, thresholds) !== 'LOW_ALIGNMENT')
      .sort((a, b) => rankingScoreForApplication(b) - rankingScoreForApplication(a) || a.id.localeCompare(b.id));
    return ranked.map((app, index) => ({
      rank: app.aiMatchScore === null ? null : index + 1,
      applicationId: app.id,
      candidateName: app.candidate.user.name,
      candidateEmail: app.candidate.user.email,
      aiMatchScore: app.aiMatchScore,
      atsScore: app.atsScore,
      aiRecommendation: app.aiRecommendation,
      potentialScore: app.potentialScore,
      potentialReason: app.potentialReason,
      analysisStatus: analysisStatusForApplication({
        aiScreeningStatus: app.aiScreeningStatus,
        aiMatchScore: app.aiMatchScore,
        growthPotential: growthPotentialPayload(app.matchExplanation, app.potentialScore, app.potentialReason, app.aiScreeningStatus),
      }),
      growthPotential: growthPotentialPayload(app.matchExplanation, app.potentialScore, app.potentialReason, app.aiScreeningStatus),
      summary: app.aiSummary,
      status: app.status,
      classification: classificationForApplication(app, thresholds),
      rankingScore: rankingScoreForApplication(app),
    }));
  }

  private readonly applicationInclude = {
    events: { select: { id: true, newStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
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
