import { publicJobSalary } from '../jobs/job-content';
import { validateApplicationAnswers } from '../applications/application-fields';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AggregatedJobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiClient } from '../ai/ai-client';
import { EntitlementService } from '../entitlements/entitlement.service';
import { JobAggregationService, type AggregatedSearch } from '../jobs/job-aggregation.service';
import { CareerService, availableJobWhere } from './career.service';
import { matchCandidate, matchesPreferences } from './career-engine';
import { jobIntelligence, requirementEvidence } from './recruitment-evidence';
import { analyzeDeterministicInterview } from './deterministic-interview';
import { applicationQuality } from './application-quality';
import { searchIntent } from './search-intent';
import type { CareerSearchDto } from './career.dto';
import type { ExternalJobSearchInput } from '../jobs/sources/job-source.types';
import type { ApplyDto } from '../applications/dto/application.dto';

const normalized = (value: string | null | undefined) => (value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const textIncludes = (text: string | null | undefined, term: string) => normalized(text).includes(normalized(term));
const pageLimit = (query: CareerSearchDto) => Math.min(query.limit || 12, 50);
const MARKETPLACE_SCAN_LIMIT = 10_000;

@Injectable()
export class JobMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly career: CareerService,
    private readonly aggregation: JobAggregationService,
    private readonly ai: AiClient,
    private readonly entitlements: EntitlementService,
  ) {}

  async search(userId: string, query: CareerSearchDto, recommended = false) {
    const intent = searchIntent(query); query = intent.query;
    recommended = recommended || intent.matchingCv;
    const profile = await this.career.profile(userId);
    const advanced = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'detailed_matching');
    const page = query.page || 1;
    const limit = pageLimit(query);
    // Score the complete filtered database set before pagination; otherwise page 2
    // has different counts and high-scoring jobs beyond the first prefix disappear.
    const scanLimit = Number.MAX_SAFE_INTEGER;
    const externalSource = query.source && query.source !== 'COMPANY_DIRECT';
    const localResult = externalSource
      ? { items: [], total: 0, page: 1, limit: scanLimit, advanced: false }
      : await this.career.search(userId, { ...query, page: 1, limit: scanLimit, source: undefined }, recommended);

    const externalSearch: AggregatedSearch = query.source === 'COMPANY_DIRECT'
      ? { items: [], total: 0, configured: false, lastSyncedAt: null }
      : await this.searchExternal(query, scanLimit);
    const externalJobs = externalSearch.items.filter(job => this.externalMatches(job, query));
    const localItems = localResult.items.map(job => ({
      ...job,
      isExternal: false,
      applicationMethod: 'NATIVE_EASYJOB' as const,
      sourceReferences: [{ type: 'COMPANY_DIRECT', name: 'EasyJob', label: 'EasyJob', url: null, applicationMethod: 'NATIVE_EASYJOB' }],
    }));
    // General browsing does not need thousands of CV analyses before returning
    // its first page. Score every match only when it affects filtering/ranking.
    const scoreBeforePagination = recommended || query.sort === 'match' || query.minimumScore != null;
    const externalItems = externalJobs.map(job => this.toExternalCareerJob(job, scoreBeforePagination ? profile : undefined, advanced));
    const preferences = recommended ? await this.career.settings(userId) : null;
    const recommendationMinimum = advanced ? preferences?.minimumScore : null;
    const filteredExternalItems = externalItems.filter(job => {
      if (preferences && !matchesPreferences({ ...job, company: job.company || undefined }, preferences)) return false;
      if (query.minimumScore != null && (job.match.score === null || job.match.score < query.minimumScore)) return false;
      return recommendationMinimum == null || (job.match.score !== null && job.match.score >= recommendationMinimum);
    });
    const combined = this.mergeDuplicates(localItems, filteredExternalItems, query.source === 'JOOBLE');
    this.sortResults(combined, query);

    const total = combined.length;
    const externalById = new Map(externalJobs.map(job => [job.id, job]));
    const items = combined.slice((page - 1) * limit, page * limit).map(job => {
      const external = !scoreBeforePagination && job.isExternal ? externalById.get(job.id) : undefined;
      return external ? { ...job, match: this.toExternalCareerJob(external, profile, advanced).match } : job;
    });

    return {
      items,
      total: Math.max(combined.length, total),
      page,
      limit,
      advanced: advanced || localResult.advanced,
      interpretedQuery: intent.inferred,
      sources: await this.sources(),
    };
  }

  async getJob(userId: string, id: string) {
    const profile = await this.career.profile(userId);
    const advanced = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'detailed_matching');
    const internal = await this.prisma.job.findFirst({
      where: { id, ...this.internalAvailableWhere() },
      include: { company: { select: { id: true, commercialName: true, industry: true, slug: true, website: true, logoKey: true } }, skills: { include: { skill: true } } },
    });
    if (internal) {
      const visible = publicJobSalary(internal);
      const match = matchCandidate(profile, visible);
      return {
        ...visible,
        isSaved: profile.savedJobs.some(saved => saved.jobId === internal.id),
        isExternal: false,
        applicationMethod: 'NATIVE_EASYJOB' as const,
        sourceReferences: [{ type: 'COMPANY_DIRECT', name: 'EasyJob', label: 'EasyJob', url: null, applicationMethod: 'NATIVE_EASYJOB' }],
        match: advanced ? match : { ...match, evidenceAnalysis: undefined },
        intelligence: jobIntelligence(visible),
      };
    }

    const external = await this.aggregation.getJob(id);
    const saved = await this.prisma.externalJobSave.findUnique({ where: { candidateId_aggregatedJobId: { candidateId: profile.id, aggregatedJobId: id } } });
    const result = this.toExternalCareerJob(external, profile, advanced);
    return { ...result, isSaved: !!saved };
  }

  async save(userId: string, id: string, save: boolean) {
    const profile = await this.career.profile(userId);
    if (save) {
      const job = await this.aggregation.findOpenJob(id);
      await this.prisma.externalJobSave.upsert({
        where: { candidateId_aggregatedJobId: { candidateId: profile.id, aggregatedJobId: job.id } },
        create: { candidateId: profile.id, aggregatedJobId: job.id },
        update: {},
      });
    } else {
      await this.prisma.externalJobSave.deleteMany({ where: { candidateId: profile.id, aggregatedJobId: id } });
    }
    return { success: true, isSaved: save };
  }

  async savedExternalJobs(userId: string) {
    const profile = await this.career.profile(userId);
    const advanced = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'detailed_matching');
    const saved = await this.prisma.externalJobSave.findMany({
      where: { candidateId: profile.id, aggregatedJob: { status: 'OPEN', OR: [{ closingAt: null }, { closingAt: { gt: new Date() } }] } },
      include: {
        aggregatedJob: {
          include: { sources: { include: { source: true }, orderBy: { lastSyncedAt: 'desc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return saved.map(item => ({ id: item.aggregatedJobId, createdAt: item.createdAt, job: { ...this.toExternalCareerJob(item.aggregatedJob, profile, advanced), isSaved: true } }));
  }

  async generateExternalCoverLetter(userId: string, id: string, resumeId?: string, locale = 'fr', length = 'standard') {
    const profile = await this.career.profile(userId);
    await this.entitlements.assertCan({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'ai.cover_letter');
    if (resumeId && !profile.resumes.some(resume => resume.id === resumeId)) throw new BadRequestException('Selected CV does not belong to your profile');
    const job = await this.aggregation.findOpenJob(id);
    const result = await this.ai.coverLetter(this.coverLetterCandidate(profile, resumeId), {
      locale: ['fr', 'en', 'ar'].includes(locale) ? locale : 'fr',
      length: ['short', 'standard', 'detailed'].includes(length) ? length : 'standard',
      title: job.title,
      company: job.companyName,
      location: job.location,
      description: job.description,
      requirements: job.requirements,
      skills: job.skills,
      source: job.sources[0]?.source.name,
      sourceSummaryOnly: job.description.length < 250,
    });
    if (!result.cover_letter?.trim()) throw new BadRequestException('Cover letter generation returned no text');
    return { coverLetter: result.cover_letter.trim() };
  }

  async preparationWorkspace(userId: string, id: string) {
    const profile = await this.career.profile(userId);
    await this.entitlements.assertCan({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'ai.cover_letter');
    const job = await this.getJob(userId, id);
    const scoredResumes = profile.resumes.filter(resume => resume.mimeType === 'application/pdf').map(resume => ({
      id: resume.id, filename: resume.filename,
      score: requirementEvidence(job, resume.parsedText ?? '').score,
    })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const selected = profile.resumes.find(r => r.id === scoredResumes[0]?.id);
    const fit = requirementEvidence(job, selected?.parsedText ?? '');
    const interview = analyzeDeterministicInterview(job, selected?.parsedText ?? '', 'fr', id);
    const supported = fit.requirements.filter(r => r.cvStatus === 'EXPLICITLY_SUPPORTED');
    const gaps = fit.requirements.filter(r => r.cvStatus !== 'EXPLICITLY_SUPPORTED');
    return {
      recommendedResume: scoredResumes[0] || null, resumes: scoredResumes,
      suggestedSummary: null,
      skillsToEmphasize: supported.map(r => r.label), missingEvidence: gaps.map(r => r.label), evidenceAnalysis: fit,
      relevantExperiences: profile.experiences.filter(experience => supported.some(r => textIncludes(`${experience.title} ${experience.description || ''}`, r.label)))
        .map(experience => ({ title: experience.title, company: experience.companyName, description: experience.description })),
      checklist: ['Vérifier les informations du profil.', 'Choisir et relire le PDF qui sera transmis.', 'Répondre aux questions obligatoires.', 'Vérifier chaque affirmation de la lettre avant l’envoi.'],
      cvChanges: gaps.slice(0, 4).map(r => `L’offre mentionne « ${r.label} ». Ajoute un exemple réel uniquement si tu peux l’attester.`),
      interviewTopics: interview.topics.map(topic => ({ concept: topic.concept, label: topic.label, priority: topic.priority, status: topic.status, questions: topic.questions })), interviewTopicCount: interview.topicCount,
      questions: job.applicationFields || [], requiresReview: true, submitted: false,
    };
  }

  async qualityCheck(userId: string, id: string, dto: ApplyDto) {
    const profile = await this.career.profile(userId), job = await this.getJob(userId, id);
    const resume = profile.resumes.find(r => r.id === dto.resumeId);
    if (dto.resumeId && !resume) throw new BadRequestException('Selected CV does not belong to your profile');
    const quality = applicationQuality(job, resume, dto, profile.resumes.map(r => r.id));
    const advanced = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'detailed_matching');
    return advanced ? quality : { ...quality, audit: undefined, fit: { ...quality.fit, requirements: [], limitations: quality.fit.limitations } };
  }

  async evidenceForResume(userId: string, id: string, resumeId: string) {
    const profile = await this.career.profile(userId), job = await this.getJob(userId, id);
    await this.career.requireFeature(profile.id, 'detailed_matching');
    const resume = profile.resumes.find(r => r.id === resumeId);
    if (!resume) throw new NotFoundException('CV not found');
    return { resumeId, filename: resume.filename, intelligence: jobIntelligence(job), evidenceAnalysis: requirementEvidence(job, resume.parsedText ?? '') };
  }

  async generateNativeCoverLetter(userId: string, id: string, resumeId?: string, locale = 'fr', length = 'standard') {
    const profile = await this.career.profile(userId);
    await this.entitlements.assertCan({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'ai.cover_letter');
    if (resumeId && !profile.resumes.some(resume => resume.id === resumeId)) throw new BadRequestException('Selected CV does not belong to your profile');
    const job = await this.career.job(id);
    const result = await this.ai.coverLetter(this.coverLetterCandidate(profile, resumeId), {
      locale: ['fr', 'en', 'ar'].includes(locale) ? locale : 'fr',
      length: ['short', 'standard', 'detailed'].includes(length) ? length : 'standard',
      title: job.title,
      company: job.company.commercialName,
      location: job.location,
      description: job.description,
      requirements: job.requirements,
      skills: job.skills.map(item => ({ name: item.skill.name, required: item.required })),
      sourceSummaryOnly: false,
    });
    if (!result.cover_letter?.trim()) throw new BadRequestException('Cover letter generation returned no text');
    return { coverLetter: result.cover_letter.trim() };
  }

  async prepareExternal(userId: string, id: string, dto: ApplyDto) {
    const profile = await this.career.profile(userId);
    await this.entitlements.assertCan({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'ai.cover_letter');
    const job = await this.aggregation.findOpenJob(id);
    if (dto.consent !== true) throw new BadRequestException('Review and consent to this preparation first');
    const quality = applicationQuality({ ...job, skills: job.skills.map(name => ({ skill: { name }, required: false })), applicationFields: job.sources.find(source => source.status === 'OPEN')?.applicationFields || [] }, profile.resumes.find(r => r.id === dto.resumeId), dto, profile.resumes.map(r => r.id));
    if (!quality.ready) throw new BadRequestException({ message: 'Application needs corrections', quality, fieldErrors: quality.fieldErrors });
    if (!dto.resumeId) throw new BadRequestException('Select a CV before preparing the external application');
    if (!profile.resumes.some(resume => resume.id === dto.resumeId)) throw new BadRequestException('Selected CV does not belong to your profile');
    if (!dto.candidateSnapshot) throw new BadRequestException('Review your candidate information before continuing');
    const snapshot = JSON.parse(JSON.stringify({ ...dto.candidateSnapshot, applicationQuality: quality, cvTextSnapshot: profile.resumes.find(r => r.id === dto.resumeId)?.parsedText, jobSnapshot: { title: job.title, description: job.description, requirements: job.requirements } })) as Prisma.InputJsonValue;
    const answers = (dto.answers || {}) as Prisma.InputJsonValue;
    const application = await this.prisma.externalApplicationPreparation.upsert({
      where: { candidateId_aggregatedJobId: { candidateId: profile.id, aggregatedJobId: job.id } },
      create: { candidateId: profile.id, aggregatedJobId: job.id, resumeId: dto.resumeId, candidateSnapshot: snapshot, answers, coverLetter: dto.coverLetter ?? dto.motivation ?? null },
      update: { resumeId: dto.resumeId, status: 'READY_TO_APPLY_EXTERNALLY', candidateSnapshot: snapshot, answers, coverLetter: dto.coverLetter ?? dto.motivation ?? null, externalSiteOpenedAt: null },
      select: { id: true, status: true, preparedAt: true, resume: { select: { id: true, filename: true } }, aggregatedJob: { select: { title: true, companyName: true } } },
    });
    return { ...application, applied: false };
  }

  async openExternal(userId: string, id: string) {
    const profile = await this.career.profile(userId);
    const job = await this.aggregation.findOpenJob(id);
    const listing = job.sources.find(source => source.status === 'OPEN' && source.applicationMethod === 'EXTERNAL_APPLICATION' && source.applicationUrl);
    if (!listing?.applicationUrl) throw new BadRequestException('This job has no verified external application link');
    const destination = new URL(listing.applicationUrl);
    if (destination.protocol !== 'https:' || destination.username || destination.password) throw new BadRequestException('Invalid external application URL');
    await this.prisma.externalApplicationPreparation.upsert({
      where: { candidateId_aggregatedJobId: { candidateId: profile.id, aggregatedJobId: id } },
      create: { candidateId: profile.id, aggregatedJobId: id, candidateSnapshot: {}, status: 'EXTERNAL_SITE_OPENED', externalSiteOpenedAt: new Date() },
      update: { status: 'EXTERNAL_SITE_OPENED', externalSiteOpenedAt: new Date() },
    });
    return { status: 'EXTERNAL_SITE_OPENED', applicationUrl: destination.toString(), submitted: false };
  }

  async externalApplications(userId: string) {
    const profile = await this.career.profile(userId);
    const advanced = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'detailed_matching');
    const items = await this.prisma.externalApplicationPreparation.findMany({
      where: { candidateId: profile.id },
      include: { aggregatedJob: { include: { sources: { include: { source: true } } } }, resume: { select: { id: true, filename: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return items.map(item => ({
      id: item.id,
      status: item.status,
      applied: false,
      preparedAt: item.preparedAt,
      externalSiteOpenedAt: item.externalSiteOpenedAt,
      resume: item.resume,
      job: this.toExternalCareerJob(item.aggregatedJob, profile, advanced),
    }));
  }

  private async searchExternal(query: CareerSearchDto, limit: number): Promise<AggregatedSearch> {
    if (query.companyId) return { items: [], total: 0, configured: false, lastSyncedAt: null };
    const input: ExternalJobSearchInput = {
      keyword: query.keyword,
      location: query.location,
      company: query.company,
      domain: query.domain,
      contractType: query.contractType,
      workMode: query.workMode,
      employmentType: query.employmentType,
      experienceLevel: query.experienceLevel,
      publishedWithin: query.publishedWithin,
      salaryMin: query.salaryMin,
      salaryMax: query.salaryMax,
      currency: query.currency,
      skills: query.skills,
      sourceType: query.source && query.source !== 'COMPANY_DIRECT' ? query.source as NonNullable<ExternalJobSearchInput['sourceType']> : undefined,
      sort: query.sort,
      page: 1,
      limit: 500,
    };
    const first = await this.aggregation.search(input);
    const items = [...first.items];
    for (let page = 2; items.length < first.total; page++) {
      const batch = await this.aggregation.search({ ...input, page });
      if (!batch.items.length) break;
      items.push(...batch.items);
    }
    return { ...first, items };

  }

  private externalMatches(job: Awaited<ReturnType<JobAggregationService['getJob']>>, query: CareerSearchDto) {
    if (query.companyId) return false;
    if (query.company && !textIncludes(job.companyName, query.company)) return false;
    if (query.workMode) {
      const mode = normalized(job.workplaceType || '');
      if (!mode || !mode.includes(normalized(query.workMode))) return false;
    }
    if (query.employmentType && !normalized(job.employmentType).includes(normalized(query.employmentType.replace('_', ' ')))) return false;
    if (query.experienceLevel) {
      const level = normalized(job.experienceLevel || '');
      if (!level || !level.includes(normalized(query.experienceLevel))) return false;
    }
    if (query.salaryMin != null && (job.salaryMax == null || job.salaryMax < query.salaryMin)) return false;
    if (query.salaryMax != null && (job.salaryMin == null || job.salaryMin > query.salaryMax)) return false;
    if (query.skills) {
      const body = `${job.title} ${job.description} ${job.requirements.join(' ')} ${job.skills.join(' ')}`;
      if (query.skills.split(',').map(value => value.trim()).filter(Boolean).some(skill => !textIncludes(body, skill))) return false;
    }
    return true;
  }

  private toExternalCareerJob(job: Awaited<ReturnType<JobAggregationService['getJob']>>, profile?: Awaited<ReturnType<CareerService['profile']>>, advanced = false) {
    const primary = job.sources.find(source => source.status === 'OPEN') || job.sources[0];
    const base = {
      id: job.id,
      reference: job.reference, benefits: job.benefits, niceToHave: job.niceToHave, languages: job.languages,
      education: job.education, experienceMax: job.experienceMax, contractType: job.contractType,
      contractDuration: job.contractDuration, country: job.country, region: job.region, city: job.city,
      address: job.address, salaryPeriod: job.salaryPeriod, positions: job.positions,
      applicationFields: primary?.applicationFields || [],
      companyId: '',
      createdById: '',
      title: job.title,
      slug: job.id,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      location: job.location,
      remote: job.workplaceType === 'REMOTE',
      workMode: job.workplaceType,
      domain: null,
      employmentType: job.employmentType || 'UNKNOWN',
      experienceLevel: job.experienceLevel || 'UNKNOWN',
      minimumYearsExperience: job.experienceMin,
      educationRequirement: job.education.join(", ") || null,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryText: job.salaryText,
      currency: job.currency,
      status: job.status,
      expiresAt: job.closingAt,
      publishedAt: job.publishedAt,
      sourceUpdatedAt: primary?.sourceUpdatedAt || null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      company: job.companyName ? { id: job.sourceCompanyId || job.id, commercialName: job.companyName, industry: job.companyIndustry, website: job.companyWebsite, logoKey: job.companyLogoUrl } : null,
      skills: job.skills.map(name => ({ skill: { name }, required: false })),
      isExternal: true,
      applicationMethod: primary?.applicationMethod || 'UNKNOWN',
      sourceReferences: job.sources.map(source => ({
        type: source.source.type,
        name: source.source.name,
        label: source.sourceLabel,
        url: source.originalUrl,
        status: source.status, applicationUrl: source.applicationUrl,
        applicationMethod: source.applicationMethod,
        lastSyncedAt: source.lastSyncedAt,
      })),
    };
    const match = profile ? matchCandidate(profile, { ...base, company: base.company ?? undefined }) : {
      score: null,
      classification: 'NOT_ANALYZED',
      matchedSkills: [],
      missingSkills: [],
      summary: 'The source supplies too little job information for a reliable match.',
      method: 'insufficient_source_detail',
      estimated: true,
    };
    return { ...base, match: advanced ? match : { ...match, evidenceAnalysis: undefined }, intelligence: jobIntelligence(base) };
  }

  private mergeDuplicates<Local extends { title: string; company?: { commercialName?: string | null } | null; location?: string | null; sourceReferences: unknown[] }, External extends { title: string; company?: { commercialName?: string | null } | null; location?: string | null; sourceReferences: unknown[] }>(local: Local[], external: External[], onlyExternal: boolean): Array<Local | External> {
    if (onlyExternal) return external;
    const combined: Array<Local | External> = [...local];
    for (const remote of external) {
      const key = this.dedupeKey(remote);
      const description = (remote as unknown as { description?: string }).description;
      const existing = remote.company?.commercialName && description && description.length >= 120 ? combined.find(item => this.dedupeKey(item) === key && normalized((item as unknown as { description?: string }).description) === normalized(description)) : undefined;
      if (existing) {
        (existing.sourceReferences as unknown[]).push(...remote.sourceReferences);
      } else {
        combined.push(remote);
      }
    }
    for (const item of combined) item.sourceReferences = [...new Map(item.sourceReferences.map(reference => [JSON.stringify(reference), reference])).values()];
    return combined;
  }

  private dedupeKey(job: { title: string; company?: { commercialName?: string | null } | null; location?: string | null }) {
    return [normalized(job.company?.commercialName), normalized(job.title), normalized(job.location)].join('|');
  }

  private coverLetterCandidate(profile: Awaited<ReturnType<CareerService['profile']>>, resumeId?: string) {
    const resume = resumeId ? profile.resumes.find(item => item.id === resumeId) : profile.resumes.find(item => item.isPrimary);
    if (resumeId && !resume?.parsedText?.trim()) throw new BadRequestException('Le CV sélectionné doit être analysé avant de générer la lettre.');
    return {
      name: profile.user.name,
      email: profile.user.email,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      skills: profile.skills.map(item => ({ name: item.skill.name })),
      experiences: profile.experiences,
      educations: profile.educations,
      professionalData: profile.professionalData,
      sourceCvText: resume?.parsedText || null,
    };
  }

  private sortResults<T extends { title: string; match?: { score?: number | null }; publishedAt?: Date | string | null; salaryMin?: number | null; salaryMax?: number | null; salaryText?: string | null; description?: string }>(jobs: T[], query: CareerSearchDto) {
    if (query.sort === 'match') jobs.sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1));
    else if (query.sort === 'relevance' && query.keyword) {
      const keyword = normalized(query.keyword);
      const rank = (job: T) => Number(normalized(job.title).includes(keyword)) * 4 + Number(normalized(job.description).includes(keyword)) * 2;
      jobs.sort((a, b) => rank(b) - rank(a));
    } else if (query.sort === 'salaryHigh') jobs.sort((a, b) => (b.salaryMax ?? b.salaryMin ?? -1) - (a.salaryMax ?? a.salaryMin ?? -1));
    else if (query.sort === 'salaryLow') jobs.sort((a, b) => (a.salaryMin ?? a.salaryMax ?? Number.MAX_SAFE_INTEGER) - (b.salaryMin ?? b.salaryMax ?? Number.MAX_SAFE_INTEGER));
    else jobs.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
  }

  private async sources() {
    const external = await this.aggregation.sourceStatuses(false);
    return [
      { type: 'COMPANY_DIRECT', name: 'EasyJob', enabled: true, syncStatus: 'ACTIVE', applicationMethod: 'NATIVE_EASYJOB' },
      ...external.map(({ type, name, enabled, status, lastSyncAt, listingCount, activeJobs }) => ({ type, name, enabled, syncStatus: status, lastSyncAt, listingCount, activeJobs })),
    ];
  }

  private internalAvailableWhere(): Prisma.JobWhereInput {
    return availableJobWhere();
  }
}
