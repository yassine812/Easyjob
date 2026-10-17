import { publicJobSalary } from '../jobs/job-content';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { prefillFromCv } from './cv-prefill';
import { guidedCoach } from './coach-fallback';
import { analyzeTurn, decideFollowUp, interviewRubric, Conversation } from './interview-conversation';
import { CoachTurnDto, InterviewAutoTestDto } from './career.dto';
import { SimulatedCandidate } from './simulated-candidate';
import { resumeGroups } from '../candidates/resume-versioning';
import { cvSkillItems, splitCvCertifications, splitCvEducations, splitCvExperiences, splitCvLanguages } from './cv-experience';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { AiClient } from '../ai/ai-client';
import { StorageService } from '../files/storage.service';
import { atsReport, extractProfile, matchCandidate, matchesPreferences, normalize, renderProfile, unique } from './career-engine';
import { BuildDraftDto, CareerSearchDto, CareerSettingsDto, CoachAnswerDto, CreateCoachDto, ProfessionalDataDto, SaveDraftDto, RegenerateSectionDto } from './career.dto';

import { availableJobWhere } from '../jobs/job-availability';
import { analyzeInterviewJob, type InterviewJobAnalysis } from './interview-intelligence';
import { speechMetrics } from './interview-coaching-metrics';
import { buildAutoApplyDefaultsFromCv } from './auto-apply-prefill';
import { analyzeDeterministicInterview, selectDeterministicQuestions } from './deterministic-interview';
export { availableJobWhere } from '../jobs/job-availability';
export const careerJobInclude = { company: { select: { id: true, commercialName: true, industry: true, slug: true, website: true, logoKey: true } }, skills: { include: { skill: true } } } satisfies Prisma.JobInclude;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
type TestTrace = { timestamp: string; sessionId?: string; stateBefore: string; event: string; stateAfter: string; questionIndex?: number; followUpDecision?: string; reason?: string };
type AutoTest = { mode: 'AUTOMATED_INTERVIEW_TEST'; status: 'RUNNING' | 'PASSED' | 'FAILED' | 'STOPPED'; persona: 'strong' | 'average' | 'weak' | 'inconsistent'; speed: number; disableTts: boolean; seed: number; maxTopics: number; startedAt: string; initialQuestionCount: number; trace: TestTrace[]; result?: Record<string, unknown> };
type CoachPreparation = { method?: string; jobDescription?: string; skills?: string[]; cvTextSnapshot?: string; analysis?: InterviewJobAnalysis; rubric?: unknown; conversation?: Conversation & { pendingAnswer?: CoachAnswerDto }; autoTest?: AutoTest; [key: string]: unknown };
function withTestTrace(preparation: CoachPreparation, event: string, stateBefore: string, stateAfter: string, detail: Omit<TestTrace, 'timestamp' | 'event' | 'stateBefore' | 'stateAfter'> = {}) {
  if (!preparation.autoTest) return preparation;
  const trace: TestTrace = { timestamp: new Date().toISOString(), stateBefore, event, stateAfter, ...detail };
  return { ...preparation, autoTest: { ...preparation.autoTest, trace: [...preparation.autoTest.trace, trace].slice(-250) } };
}

@Injectable()
export class CareerService {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: EntitlementService,
    private readonly ai: AiClient, private readonly storage: StorageService) {}

  async profile(userId: string) {
    const p = await this.prisma.candidateProfile.findUnique({ where: { userId }, include: {
      user: { select: { id: true, name: true, email: true, status: true, emailVerifiedAt: true } },
      skills: { include: { skill: true } }, experiences: true, educations: true, jobPreference: true,
      resumes: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] }, careerSettings: true,
      savedJobs: { select: { jobId: true } },
    } });
    if (!p) throw new ForbiddenException('A candidate account is required');
    return p;
  }
  async requireFeature(candidateId: string, key: string) {
    await this.entitlements.assertCan({ ownerType: 'CANDIDATE', ownerId: candidateId }, key);
  }
  async overview(userId: string) {
    const profile = await this.profile(userId);
    const advancedAnalytics = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: profile.id }, 'advanced_analytics');
    const now = new Date();
    const weekStart = new Date(now); weekStart.setUTCHours(0, 0, 0, 0); weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const activityStart = new Date(now); activityStart.setUTCHours(0, 0, 0, 0); activityStart.setUTCDate(activityStart.getUTCDate() - 6);
    const applicationWhere = { candidateId: profile.id };
    const [applications, applicationsThisWeek, matchAverage, monthMatchAverage, statusGroups, activityRows, recentApplications, roleGroups, appliedJobs] = await Promise.all([
      this.prisma.application.count({ where: applicationWhere }),
      this.prisma.application.count({ where: { ...applicationWhere, appliedAt: { gte: weekStart } } }),
      this.prisma.application.aggregate({ where: applicationWhere, _avg: { aiMatchScore: true } }),
      this.prisma.application.aggregate({ where: { ...applicationWhere, appliedAt: { gte: monthStart } }, _avg: { aiMatchScore: true } }),
      this.prisma.application.groupBy({ by: ['status'], where: applicationWhere, _count: { _all: true } }),
      this.prisma.application.findMany({ where: { ...applicationWhere, appliedAt: { gte: activityStart } }, select: { appliedAt: true }, orderBy: { appliedAt: 'asc' } }),
      this.prisma.application.findMany({ where: applicationWhere, orderBy: { appliedAt: 'desc' }, take: 6, select: { id: true, status: true, appliedAt: true, aiMatchScore: true, job: { select: { id: true, title: true, company: { select: { commercialName: true } } } } } }),
      this.prisma.application.groupBy({ by: ['jobId'], where: applicationWhere, _count: { _all: true }, orderBy: { _count: { jobId: 'desc' } }, take: 1 }),
      this.prisma.job.findMany({ where: { applications: { some: applicationWhere } }, select: { skills: { select: { skill: { select: { name: true } } } } } }),
    ]);
    const statusCount = (status: string) => statusGroups.find(group => group.status === status)?._count._all ?? 0;
    const reviewCount = ['UNDER_REVIEW', 'SCREENING', 'SHORTLISTED', 'ASSESSMENT'].reduce((sum, status) => sum + statusCount(status), 0);
    const activity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(activityStart); date.setUTCDate(activityStart.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, count: activityRows.filter(row => row.appliedAt.toISOString().slice(0, 10) === key).length };
    });
    const skillCounts = new Map<string, number>();
    for (const job of appliedJobs) for (const item of job.skills) skillCounts.set(item.skill.name, (skillCounts.get(item.skill.name) ?? 0) + 1);
    const topSkill = [...skillCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topRole = roleGroups[0] ? (await this.prisma.job.findUnique({ where: { id: roleGroups[0].jobId }, select: { title: true } }))?.title ?? null : null;
    return { name: profile.user.name,
      dashboard: {
        stats: { applicationsSent: applications, applicationsThisWeek, inReview: reviewCount, interviews: statusCount('INTERVIEW'), offers: statusCount('OFFER'), averageMatch: advancedAnalytics ? matchAverage._avg.aiMatchScore : null },
        activity: advancedAnalytics ? activity : [],
        pipeline: { applied: statusCount('APPLIED'), review: reviewCount, interview: statusCount('INTERVIEW'), offer: statusCount('OFFER'), hired: statusCount('HIRED') },
        recentApplications,
        insights: { mostAppliedRole: advancedAnalytics ? topRole : null, mostRequestedSkill: advancedAnalytics ? topSkill : null, averageMatchThisMonth: advancedAnalytics ? monthMatchAverage._avg.aiMatchScore : null },
        weeklyProgress: advancedAnalytics && profile.careerSettings?.maxPerWeek ? { current: applicationsThisWeek, limit: profile.careerSettings.maxPerWeek } : null,
      },
    };
  }
  async search(userId: string, query: CareerSearchDto, recommended = false) {
    const p = await this.profile(userId);
    const advanced = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: p.id }, 'detailed_matching');
    if (query.salaryMin != null && query.salaryMax != null && query.salaryMin > query.salaryMax) throw new BadRequestException('Invalid salary range');
    const filters: Prisma.JobWhereInput[] = [availableJobWhere()];
    if (query.companyId) filters.push({ companyId: query.companyId });
    if (query.company) filters.push({ company: { commercialName: { contains: query.company, mode: 'insensitive' } } });
    if (query.publishedWithin) filters.push({ publishedAt: { gte: new Date(Date.now() - query.publishedWithin * 86400000) } });
    for (const term of (query.keyword ?? '').split(/\s+/).filter(Boolean).slice(0, 12)) filters.push({ OR: [{ title: { contains: term, mode: 'insensitive' } }, { description: { contains: term, mode: 'insensitive' } }, { domain: { contains: term, mode: 'insensitive' } }, { skills: { some: { skill: { name: { contains: term, mode: 'insensitive' } } } } }] });
    if (query.domain) filters.push({ OR: [{ domain: { equals: query.domain, mode: 'insensitive' } }, { domain: null, company: { industry: { equals: query.domain, mode: 'insensitive' } } }] });
    if (query.location) filters.push({ location: { contains: query.location, mode: 'insensitive' } });
    if (query.workMode) filters.push({ OR: [{ workMode: query.workMode }, ...(query.workMode !== 'HYBRID' ? [{ workMode: null, remote: query.workMode === 'REMOTE' }] : [])] });
    if (query.employmentType) filters.push({ employmentType: query.employmentType });
    if (query.contractType) filters.push({ contractType: query.contractType });
    if (query.experienceLevel) filters.push({ experienceLevel: query.experienceLevel });
    if (query.salaryMin != null || query.salaryMax != null) filters.push({ salaryVisible: true });
    if (query.salaryMin != null) filters.push({ salaryMax: { gte: query.salaryMin } });
    if (query.salaryMax != null) filters.push({ salaryMin: { lte: query.salaryMax } });
    if (query.currency) filters.push({ currency: query.currency });
    for (const skill of unique((query.skills || '').split(','))) filters.push({ skills: { some: { skill: { normalizedName: normalize(skill) } } } });
    const jobs = await this.prisma.job.findMany({ where: { AND: filters }, include: careerJobInclude, orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }] });
    let scored = jobs.map(stored => { const job = publicJobSalary(stored); return ({ ...job, isSaved: p.savedJobs?.some(saved => saved.jobId === job.id) ?? false, match: matchCandidate(p, job) }); });
    if (recommended) {
      const settings = await this.settings(userId);
      const minimumRecommendationScore = advanced ? settings.minimumScore : null;
      scored = scored.filter(job => matchesPreferences(job, settings) && job.match.score !== null
        && (minimumRecommendationScore === null || job.match.score >= minimumRecommendationScore));
    }
    if (query.minimumScore != null) scored = scored.filter(job => job.match.score !== null && job.match.score >= query.minimumScore!);
    if (query.sort === 'match' || recommended) scored.sort((a, b) => (b.match.score ?? -1) - (a.match.score ?? -1));
    else if (query.sort === 'relevance' && query.keyword) {
      const q = normalize(query.keyword);
      const rank = (j: typeof scored[number]) => Number(normalize(j.title).includes(q)) * 3 + j.skills.filter(s => normalize(s.skill.name).includes(q)).length;
      scored.sort((a, b) => rank(b) - rank(a));
    }
    const limit = query.limit || 12, page = query.page || 1;
    return { items: scored.slice((page - 1) * limit, page * limit).map(job => ({ ...job, match: advanced ? job.match : { ...job.match, evidenceAnalysis: undefined } })), total: scored.length, page, limit, advanced };
  }
  async facets() {
    const rows = await this.prisma.job.findMany({ where: availableJobWhere(), select: { domain: true, location: true, company: { select: { id: true, commercialName: true, industry: true } } } });
    return { domains: unique(rows.map(j => j.domain || j.company.industry || '')).sort(), locations: unique(rows.map(j => j.location || '')).sort(),
      companies: [...new Map(rows.map(j => [j.company.id, { id: j.company.id, name: j.company.commercialName }])).values()] };
  }
  async report(userId: string, resumeId: string, jobId?: string) {
    const p = await this.profile(userId);
    const resume = p.resumes.find(r => r.id === resumeId);
    if (!resume) throw new NotFoundException('CV not found');
    // Keep the owned-resume API easy to unit-test with the narrow profile
    // fixture used by older integrations, while production still supports
    // native and aggregated jobs through targetJob.
    const job = jobId ? this.prisma.job ? await this.targetJob(jobId) : await this.job(jobId) : null;
    const previous = resume.atsReport as Record<string, unknown> | null;
    const advanced = typeof this.entitlements.can === 'function'
      ? await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: p.id }, 'advanced_ats')
      : false;
    let documentInspection = previous?.documentInspection ?? null;
    if (resume.mimeType === 'application/pdf' && !documentInspection && advanced) {
      try {
        documentInspection = await this.ai.inspectPdf(await this.storage.getBytes(resume.storageKey));
        await this.prisma.resume.update({ where: { id: resume.id }, data: { atsReport: json({ ...previous, documentInspection }) } });
      } catch { documentInspection = { status: 'UNAVAILABLE', limitations: ['Document inspection is temporarily unavailable. Text checks remain available.'] }; }
    }
    return { id: resume.id, filename: resume.filename, status: resume.processingStatus,
      report: resume.parsedText ? { ...atsReport(resume.parsedText, job?.skills.map(s => s.skill.name), { selected: !!job, title: job?.title, company: job?.company.commercialName }), ...(!advanced ? { audit: undefined } : {}), documentInspection: advanced ? documentInspection : null } : null,
      extracted: resume.parsedText ? extractProfile(resume.parsedText) : null };
  }
  async importResume(userId: string, resumeId: string) {
    const p = await this.profile(userId), resume = p.resumes.find(r => r.id === resumeId);
    if (!resume?.parsedText) throw new BadRequestException('Wait for CV processing before importing');
    const extracted = extractProfile(resume.parsedText);
    await this.prisma.$transaction(tx => prefillFromCv(tx, p.id, extracted));
    return extracted;
  }
  async professionalData(userId: string, dto?: ProfessionalDataDto) {
    const p = await this.profile(userId);
    if (!dto) {
      let stored = (p.professionalData ?? { sections: {} }) as { sections: Record<string, string[]>; method?: string };
      if (stored.method === 'verbatim_sections_v1') {
        const reparsed = extractProfile(Object.entries(stored.sections ?? {}).flatMap(([key, lines]) => [key, ...lines]).join('\n').replace(/\\n/g, '\n'));
        stored = { ...stored, sections: reparsed.sections };
      }
      const parsed = extractProfile(Object.entries(stored.sections ?? {}).flatMap(([key, lines]) => [key, ...lines]).join('\n').replace(/\\n/g, '\n'));
      const storedCertifications = Array.isArray((stored as any).certifications)
        ? (stored as any).certifications.flatMap((entry: unknown) => typeof entry === 'string' ? [entry] : entry && typeof entry === 'object' && 'name' in entry ? [String((entry as { name?: unknown }).name ?? '')] : [])
        : stored.sections?.certifications ?? [];
      return { ...stored, headline: parsed.headline, location: parsed.location, phone: parsed.phone, email: parsed.email, summary: parsed.summary,
        experiences: (stored as any).experiences ?? splitCvExperiences(stored.sections?.experience ?? []),
        educations: (stored as any).educations ?? splitCvEducations(stored.sections?.education ?? []),
        languages: (stored as any).languages ?? splitCvLanguages(stored.sections?.languages ?? []),
        certifications: splitCvCertifications(storedCertifications), skills: (stored as any).skills ?? cvSkillItems(stored.sections?.skills ?? []) };
    }
    const sections = Object.fromEntries(Object.entries(dto).map(([key, value]) => [key, String(value).split('\n').map((l: string) => l.trim()).filter(Boolean)]));
    const parsed = extractProfile(Object.entries(sections).flatMap(([key, lines]) => [key, ...lines]).join('\n'));
    const result = { sections, headline: parsed.headline, location: parsed.location, phone: parsed.phone, summary: sections.summary?.join('\n') || '', experiences: splitCvExperiences(sections.experience ?? []), educations: splitCvEducations(sections.education ?? []), languages: splitCvLanguages(sections.languages ?? []), certifications: splitCvCertifications(sections.certifications ?? []), skills: cvSkillItems(sections.skills ?? []), method: 'candidate_reviewed', needsReview: false };
    await this.prisma.candidateProfile.update({ where: { id: p.id }, data: { professionalData: json(result) } });
    return result;
  }
  async job(id: string) {
    const job = await this.prisma.job.findFirst({ where: { AND: [{ id }, availableJobWhere()] }, include: careerJobInclude });
    if (!job) throw new NotFoundException('Published job from a verified company not found');
    return publicJobSalary(job);
  }
  async drafts(userId: string) {
    const p = await this.profile(userId);
    await this.requireFeature(p.id, 'career.builder');
    const drafts = await this.prisma.cvDraft.findMany({ where: { candidateId: p.id }, orderBy: { updatedAt: 'desc' } });
    return drafts.map(d => ({ ...d, report: atsReport(d.content, d.keywords) }));
  }
  async assertCvUploadLimit(candidateId: string) {
    await this.entitlements.assertCandidateLimit(candidateId, 'cv.uploads', async () => {
      const rows = await this.prisma.resume.findMany({ where: { candidateId }, select: { id: true, design: true, createdAt: true } });
      return resumeGroups(rows).size;
    });
  }
  async targetJob(id: string) {
    const native = await this.prisma.job.findFirst({ where: { AND: [{ id }, availableJobWhere()] }, include: careerJobInclude });
    if (native) return publicJobSalary(native);
    const external = await this.prisma.aggregatedJob.findFirst({ where: { id, status: 'OPEN', OR: [{ closingAt: null }, { closingAt: { gt: new Date() } }] } });
    if (!external) throw new NotFoundException('Target job unavailable');
    return { ...external, company: { commercialName: external.companyName || '' }, skills: external.skills.map(name => ({ skill: { name }, required: false })) };
  }
  async revisions(userId: string, id: string) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.builder');
    if (!await this.prisma.cvDraft.findFirst({ where: { id, candidateId: p.id } })) throw new NotFoundException('Draft not found');
    return this.prisma.cvDraftRevision.findMany({ where: { draftId: id }, orderBy: { version: 'desc' }, take: 100 });
  }
  async buildDraft(userId: string, dto: BuildDraftDto) {
    const p = await this.profile(userId);
    await this.requireFeature(p.id, dto.mode === 'tailor' || dto.mode === 'optimize' ? 'cv_tailoring' : 'career.builder');
    const resume = dto.resumeId ? p.resumes.find(r => r.id === dto.resumeId) : p.resumes[0];
    if (dto.resumeId && !resume) throw new NotFoundException('CV not found');
    if (dto.mode !== 'profile' && !resume?.parsedText?.trim()) throw new BadRequestException('Select a processed CV first');
    const job = dto.jobId ? await this.targetJob(dto.jobId) : null;
    if (dto.mode === 'tailor' && !job) throw new BadRequestException('Select a target job');
    const design = resume?.design as { editableContent?: string } | null;
    const sourceText = design?.editableContent || resume?.parsedText || renderProfile(p);
    const knownHeadings = new Set(Object.values(extractProfile(sourceText).sections).flat());
    const original = sourceText; // Original bytes/text are never replaced during normalization.
    if (dto.mode === 'manual') {
      const existing = await this.prisma.cvDraft.findFirst({ where: { candidateId: p.id, sourceResumeId: resume?.id, targetJobId: job?.id ?? null, originalContent: original }, orderBy: { updatedAt: 'desc' } });
      if (existing) return { ...existing, report: atsReport(existing.content, existing.keywords) };
    }
    let content = original;
    // Uploaded evidence is included in the provider payload; prompts prohibit adding unsupported facts.
    if (dto.mode === 'manual') {
      content = original;
    } else if (dto.mode === 'tailor' || dto.mode === 'optimize') {
      const editable = original.split(/\r?\n/).map(line => !knownHeadings.has(line.trim()) && /^(profil professionnel|summary|skills|compétences(?: techniques)?|expérience(?:s)?(?: professionnelle(?:s)?)?|work experience|formation(?:s)?|education|languages|langues|certifications?|projects?|projets?)\s*:?$/i.test(line.trim()) ? `## ${line.trim()}` : line).join('\n');
      const result = await this.ai.tailorCv({ cv_text: editable, job: job ? { ...job, skills: job.skills.map(s => ({ name: s.skill.name })) } : { title: dto.title, requirements: [], skills: [] } });
      if (!result.tailored_cv?.trim()) throw new BadRequestException('CV generation returned no content');
      content = result.tailored_cv;
    } else {
      const result = await this.ai.generateCv({ name: p.user.name, email: p.user.email, headline: p.headline, bio: p.bio, location: p.location,
        skills: p.skills.map(s => ({ name: s.skill.name })), experiences: p.experiences, educations: p.educations,
        professionalData: p.professionalData, sourceCvText: resume?.parsedText || null });
      if (!result.cv_markdown?.trim()) throw new BadRequestException('CV generation returned no content');
      content = result.cv_markdown;
    }
    if (content.length > 50000) throw new BadRequestException('Generated CV is too long');
    const keywords = job?.skills.map(s => s.skill.name) || [];
    const draft = await this.prisma.cvDraft.create({ data: { candidateId: p.id, title: dto.title, targetJobId: job?.id, sourceResumeId: resume?.id,
      originalContent: original, content, template: 'modern', language: dto.language || 'fr', targetRole: dto.targetRole || job?.title, beforeScore: atsReport(original, keywords).score, afterScore: atsReport(content, keywords).score, keywords } });
    return { ...draft, report: atsReport(content, keywords) };
  }
  async saveDraft(userId: string, id: string, dto: SaveDraftDto) {
    const p = await this.profile(userId);
    await this.requireFeature(p.id, 'career.builder');
    const draft = await this.prisma.cvDraft.findFirst({ where: { id, candidateId: p.id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (dto.expectedVersion != null && dto.expectedVersion !== draft.version) throw new ConflictException('This CV has changed. Reload before saving.');
    const saved = await this.prisma.$transaction(async tx => {
      await tx.cvDraftRevision.upsert({ where: { draftId_version: { draftId: id, version: draft.version } }, create: { draftId: id, version: draft.version, content: draft.content, title: draft.title, template: draft.template, fontSize: draft.fontSize, report: json(atsReport(draft.content, draft.keywords)) }, update: {} });
      const updated = await tx.cvDraft.updateMany({ where: { id, version: draft.version }, data: { content: dto.content, title: dto.title, template: dto.template, fontSize: dto.fontSize, version: { increment: 1 }, afterScore: atsReport(dto.content, draft.keywords).score, approvedAt: dto.approve ? new Date() : null } });
      if (updated.count !== 1) throw new ConflictException('This CV has changed. Reload before saving.');
      return tx.cvDraft.findUniqueOrThrow({ where: { id } });
    });
    return { ...saved, report: atsReport(saved.content, saved.keywords) };
  }
  async regenerateSection(userId: string, id: string, dto: RegenerateSectionDto) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'cv_tailoring');
    const draft = await this.prisma.cvDraft.findFirst({ where: { id, candidateId: p.id } });
    if (!draft) throw new NotFoundException('Draft not found');
    const sections = dto.content.split(/(?=^## )/m);
    const source = sections[dto.sectionIndex];
    if (!source?.trim()) throw new BadRequestException('Select a CV section');
    const heading = source.match(/^## [^\r\n]*\r?\n/)?.[0] ?? '';
    const body = source.slice(heading.length).trim();
    const lines = body.split('\n');
    const selectedLine = dto.lineIndex === undefined ? undefined : lines[dto.lineIndex];
    if (dto.lineIndex !== undefined && (!selectedLine?.trim() || /^#/.test(selectedLine))) throw new BadRequestException('Select a CV text line');
    const scope = dto.lineIndex === undefined ? 'section' : 'line';
    const before = selectedLine ?? source.trim();
    const job = draft.targetJobId ? await this.targetJob(draft.targetJobId) : null;
    const result = await this.ai.tailorCv({ cv_text: before, job: job
      ? { title: job.title, requirements: job.requirements, skills: job.skills.map(s => ({ name: s.skill.name })), editing_scope: scope }
      : { title: draft.title, requirements: [], skills: [], editing_scope: scope } });
    if (!result.tailored_cv?.trim()) throw new BadRequestException('No section generated');
    const after = scope === 'line' ? result.tailored_cv.trim().replace(/\r?\n+/g, ' ') : result.tailored_cv.trim();
    if (dto.lineIndex !== undefined) {
      // Replace by position, not string search: identical lines may appear in other roles.
      const offset = source.indexOf(body) + lines.slice(0, dto.lineIndex).reduce((total, line) => total + line.length + 1, 0);
      sections[dto.sectionIndex] = source.slice(0, offset) + after + source.slice(offset + selectedLine!.length);
    } else {
      sections[dto.sectionIndex] = after + '\n\n';
    }
    const content = sections.join('');
    if (content.length > 50000) throw new BadRequestException('Generated CV is too long');
    // Return a proposal. Only an explicit save/approval replaces the user's draft.
    const beforeReport = atsReport(dto.content, draft.keywords), report = atsReport(content, draft.keywords);
    return { content, before: before.trim(), after, scope, beforeScore: beforeReport.score, score: report.score, beforeReport, report,
      improvedChecks: report.criteria.filter(c => c.passed && beforeReport.criteria.some(previous => previous.key === c.key && !previous.passed)).map(c => c.key) };
  }
  async publishDraft(userId: string, id: string) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.builder');
    const draft = await this.prisma.cvDraft.findFirst({ where: { id, candidateId: p.id, approvedAt: { not: null } } });
    if (!draft) throw new BadRequestException('Review and approve this CV first');
    await this.entitlements.assertCandidateLimit(p.id, 'cv.uploads');
    const rendered = await this.ai.renderCvPdf({ content: draft.content, template: draft.template, fontSize: draft.fontSize });
    const filename = `${draft.title.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 100)}.pdf`;
    const key = `resumes/${p.id}/draft-${id}-${Date.now()}.pdf`, bytes = Buffer.from(rendered.pdfBase64, 'base64');
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new BadRequestException('PDF generation failed');
    await this.storage.put(key, bytes, 'application/pdf');
    return this.prisma.resume.create({ data: { candidateId: p.id, filename, storageKey: key, fileSize: bytes.length, mimeType: 'application/pdf',
      design: { template: draft.template, fontSize: draft.fontSize, editableContent: draft.content, sourceResumeId: draft.sourceResumeId, targetJobId: draft.targetJobId, targetRole: draft.targetRole, language: draft.language, draftVersion: draft.version, layout: rendered.layout },
      version: Math.max(0, ...p.resumes.map(r => r.version)) + 1, isPrimary: p.resumes.length === 0,
      parsedText: rendered.inspection.text, atsReport: json({ ...atsReport(rendered.inspection.text, draft.keywords), documentInspection: rendered.inspection }), processingStatus: 'COMPLETED' } });
  }
  async settings(userId: string) {
    const p = await this.profile(userId);
    const professional = p.professionalData as { domains?: string[]; summary?: string; sections?: { summary?: string[] } } | null;
    const cvPrefill = buildAutoApplyDefaultsFromCv({
      yearsExperience: p.yearsExperience,
      experiences: p.experiences,
      skills: (p.skills ?? []).map(item => ({ name: item.skill?.name })),
      location: p.location,
      jobPreference: p.jobPreference,
      headline: p.headline,
      summary: p.bio ?? professional?.summary ?? professional?.sections?.summary?.join(' '),
      explicitDomains: professional?.domains,
    });
    const activeResume = p.resumes.find(r => r.mimeType === 'application/pdf' && r.isPrimary)
      ?? p.resumes.find(r => r.mimeType === 'application/pdf')
      ?? null;
    const careerSettings = this.prisma.careerSettings as typeof this.prisma.careerSettings & { findUnique?: (args: { where: { candidateId: string } }) => Promise<any> };
    // Keep lightweight service tests and older adapters compatible while the
    // real Prisma delegate uses the initialization-aware path below.
    if (typeof careerSettings.findUnique !== 'function') {
      const legacy = await careerSettings.upsert({ where: { candidateId: p.id }, create: { candidateId: p.id, salaryCurrency: 'TND' }, update: { salaryCurrency: 'TND' } });
      const eligible = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: p.id }, 'auto_apply');
      return { ...legacy, activeCv: activeResume ? { id: activeResume.id, filename: activeResume.filename, processingStatus: activeResume.processingStatus } : null, cvPrefill,
        autoApplyAccess: { eligible, enabled: eligible && Boolean(legacy.autoApply), status: eligible ? (legacy.autoApply ? 'active' : 'paused') : 'locked' } };
    }
    let settings = await careerSettings.findUnique({ where: { candidateId: p.id } });
    if (!settings) {
      settings = await this.prisma.careerSettings.create({
        data: {
          candidateId: p.id, salaryCurrency: 'TND', preferencesInitialized: true,
          preferredResumeId: activeResume?.id,
          domains: cvPrefill.domains, requiredSkills: cvPrefill.skills,
          experienceLevels: cvPrefill.experienceLevels, locations: cvPrefill.locations,
          targetTitles: cvPrefill.targetTitles,
        },
      });
    } else if (!settings.preferencesInitialized) {
      // Rows created by older versions were empty shells. Initialize them once;
      // later edits, including intentional empty arrays, are always preserved.
      settings = await this.prisma.careerSettings.update({
        where: { candidateId: p.id },
        data: {
          preferencesInitialized: true,
          preferredResumeId: settings.preferredResumeId ?? activeResume?.id,
          domains: cvPrefill.domains, requiredSkills: cvPrefill.skills,
          experienceLevels: cvPrefill.experienceLevels, locations: cvPrefill.locations,
          targetTitles: cvPrefill.targetTitles, salaryCurrency: 'TND',
        },
      });
    } else if (settings.salaryCurrency !== 'TND' || (activeResume && settings.preferredResumeId !== activeResume.id)) {
      settings = await this.prisma.careerSettings.update({ where: { candidateId: p.id }, data: {
        salaryCurrency: 'TND', ...(activeResume ? { preferredResumeId: activeResume.id } : {}),
      } });
    }
    const eligible = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: p.id }, 'auto_apply');
    return {
      ...settings,
      activeCv: activeResume ? { id: activeResume.id, filename: activeResume.filename, processingStatus: activeResume.processingStatus } : null,
      cvPrefill,
      autoApplyAccess: { eligible, enabled: eligible && Boolean(settings.autoApply), status: eligible ? (settings.autoApply ? 'active' : 'paused') : 'locked' },
    };
  }
  async updateSettings(userId: string, dto: CareerSettingsDto) {
    const p = await this.profile(userId), current = await this.settings(userId);
    if (dto.emailAlerts) await this.requireFeature(p.id, 'email_alerts');
    if (dto.autoApply === true) {
      await this.requireFeature(p.id, 'auto_apply');
      const plan = await this.entitlements.getActivePlan({ ownerType: 'CANDIDATE', ownerId: p.id });
      const dailyLimit = Number(plan.features['career.auto_apply.daily_limit']) || 3;
      const weeklyLimit = Number(plan.features['career.auto_apply.weekly_limit']) || 10;
      if ((dto.maxPerDay ?? current.maxPerDay) > dailyLimit || (dto.maxPerWeek ?? current.maxPerWeek) > weeklyLimit) throw new BadRequestException(`Your plan allows up to ${dailyLimit} applications per day and ${weeklyLimit} per week`);
      if (!p.user.emailVerifiedAt) throw new BadRequestException('Verify your email first');
      if (!current.autoApply && dto.consent !== true) throw new BadRequestException('Explicit Auto Apply consent is required');
      const activeResume = p.resumes.find(r => r.mimeType === 'application/pdf' && r.isPrimary)
        ?? p.resumes.find(r => r.mimeType === 'application/pdf');
      if (!activeResume) throw new BadRequestException('Upload a PDF CV before enabling Auto Apply');
    }
    if (dto.approvedDraftId && !await this.prisma.cvDraft.findFirst({ where: { id: dto.approvedDraftId, candidateId: p.id, approvedAt: { not: null } } })) throw new BadRequestException('Approved CV not found');
    if (dto.approvalRequired === false && current.approvalRequired && dto.unattendedConsent !== true) throw new BadRequestException('Explicit consent is required to submit without review');
    const { consent, unattendedConsent, preferredResumeId: _requestedResumeId, ...data } = dto;
    const activeResume = p.resumes.find(r => r.mimeType === 'application/pdf' && r.isPrimary)
      ?? p.resumes.find(r => r.mimeType === 'application/pdf');
    const requestedResume = _requestedResumeId
      ? p.resumes.find(r => r.id === _requestedResumeId && r.mimeType === 'application/pdf')
      : activeResume;
    if (dto.autoApply === true && _requestedResumeId && !requestedResume) throw new BadRequestException('Selected CV not found');
    return this.prisma.careerSettings.update({ where: { candidateId: p.id }, data: { ...data, salaryCurrency: 'TND',
      preferencesInitialized: true,
      ...(dto.autoApply === true && requestedResume ? { preferredResumeId: requestedResume.id } : {}),
      ...(dto.approvalRequired === false && unattendedConsent ? { unattendedConsentAt: new Date() } : {}),
      ...(dto.approvalRequired === true ? { unattendedConsentAt: null } : {}),
      ...(dto.autoApply === true && consent ? { autoConsentAt: new Date() } : {}),
      ...(dto.autoApply === false ? { autoConsentAt: null } : {}) } });
  }
  async history(userId: string) {
    const p = await this.profile(userId);
    await this.requireFeature(p.id, 'auto_apply');
    const deliveries = await this.prisma.careerDelivery.findMany({ where: { candidateId: p.id }, orderBy: { createdAt: 'desc' } });
    const jobs = await this.prisma.job.findMany({ where: { id: { in: deliveries.map(d => d.jobId) } }, select: { id: true, title: true, company: { select: { commercialName: true } } } });
    return deliveries.map(d => ({ ...d, job: jobs.find(j => j.id === d.jobId) || null }));
  }
  async autoStats(userId: string) {
    const p = await this.profile(userId);
    await this.requireFeature(p.id, 'auto_apply');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [sent, applicationsToday, analyzed, skipped] = await Promise.all([
      this.prisma.application.aggregate({ where: { candidateId: p.id, autoApplied: true }, _count: { _all: true }, _avg: { aiMatchScore: true } }),
      this.prisma.application.count({ where: { candidateId: p.id, autoApplied: true, appliedAt: { gte: today } } }),
      this.prisma.careerDelivery.count({ where: { candidateId: p.id, kind: 'AUTO_APPLY' } }),
      this.prisma.careerDelivery.count({ where: { candidateId: p.id, kind: 'AUTO_APPLY', status: 'SKIPPED' } }),
    ]);
    return { applicationsToday, applicationsSent: sent._count._all, averageMatch: sent._avg.aiMatchScore, jobsAnalyzed: analyzed, jobsSkipped: skipped };
  }
  async coachSessions(userId: string) {
    const p = await this.profile(userId);
    const sessions = await this.prisma.coachSession.findMany({ where: { candidateId: p.id }, orderBy: { updatedAt: 'desc' }, take: 30 });
    return sessions.map(session => this.candidateCoachSession(session));
  }
  async analyzeCoachJob(userId: string, jobId: string) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    const job = await this.targetJob(jobId);
    const resume = p.resumes.find(r => r.isPrimary) || p.resumes[0];
    const normalizedJob = { ...job, skills: job.skills.map(item => ({ name: item.skill.name, required: item.required })) };
    const candidateText = resume?.parsedText || renderProfile(p);
    const local = analyzeInterviewJob(normalizedJob, candidateText);
    const deterministic = analyzeDeterministicInterview(normalizedJob, candidateText, 'fr', jobId);
    return { ...this.candidateInterviewSummary(local), method: deterministic.method, analysis_engine: deterministic.analysis_engine, evidenceScore: deterministic.score, requirements: deterministic.requirements, evidence: deterministic.evidence, gaps: deterministic.gaps, topics: deterministic.topics.map(topic => ({ concept: topic.concept, label: topic.label, priority: topic.priority, status: topic.status })) };
  }
  async companySuggestions(userId: string, rawQuery: string) {
    await this.profile(userId);
    const query = rawQuery.trim().slice(0, 80);
    if (query.length < 2) return [];
    const local = await this.prisma.company.findMany({ where: { status: 'ACTIVE', OR: [
      { commercialName: { contains: query, mode: 'insensitive' } }, { legalName: { contains: query, mode: 'insensitive' } },
    ] }, select: { id: true, commercialName: true, website: true, industry: true }, take: 5 });
    const result = local.map(company => { let domain = ''; try { domain = company.website ? new URL(company.website).hostname.replace(/^www\./, '') : ''; } catch { /* malformed legacy website */ } return { name: company.commercialName, domain, website: company.website || '', source: 'easyjob', industry: company.industry }; });
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      if (response.ok) {
        const remote = await response.json() as { name?: string; domain?: string }[];
        for (const company of remote.slice(0, 5)) if (company.name && company.domain && !result.some(item => item.domain === company.domain)) result.push({ name: company.name, domain: company.domain, website: `https://${company.domain}`, source: 'directory', industry: null });
      }
    } catch { /* Directory is optional; local EasyJob companies still work. */ }
    return result.slice(0, 8);
  }
  async createCoach(userId: string, dto: CreateCoachDto) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    if (dto.visionConsent) await this.requireFeature(p.id, 'career.vision');
    const job = dto.jobId ? await this.targetJob(dto.jobId) : null;
    const resume = dto.resumeId ? p.resumes.find(r => r.id === dto.resumeId) : p.resumes[0];
    if (dto.resumeId && !resume) throw new NotFoundException('CV not found');
    const companyProfile = job && 'id' in job.company ? await this.prisma.company.findUnique({ where: { id: job.company.id },
      select: { commercialName: true, website: true, industry: true, description: true, city: true, country: true, slug: true } }) : null;
    if (companyProfile && !companyProfile.website && dto.companyWebsite) companyProfile.website = dto.companyWebsite;
    const jobInput = job ? { ...job, company: companyProfile, skills: job.skills.map(s => ({ name: s.skill.name, required: s.required })) }
      : { title: dto.jobTitle, description: dto.jobDescription, company: { commercialName: dto.company, website: dto.companyWebsite } };
    const analysis: InterviewJobAnalysis = analyzeInterviewJob(jobInput, resume?.parsedText || renderProfile(p));
    const codingEnabled = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: p.id }, 'coding_interview');
    const selectedType = dto.interviewType === 'RECOMMENDED'
      ? analysis.recommendedTypes.find(type => type !== 'CODING' || codingEnabled) || 'HR'
      : dto.interviewType;
    if (selectedType === 'CODING' && !codingEnabled) await this.requireFeature(p.id, 'coding_interview');
    const adaptiveEnabled = typeof (this.entitlements as EntitlementService & { can?: unknown }).can === 'function'
      ? await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: p.id }, 'adaptive_interview')
      : true;
    const deterministic = analyzeDeterministicInterview(jobInput, resume?.parsedText || renderProfile(p), dto.locale, `${p.id}:${job?.id || dto.jobTitle}`);
    const questions = selectDeterministicQuestions(deterministic, dto.locale, 10, `${p.id}:${job?.id || dto.jobTitle}`);
    if (!questions?.length) throw new BadRequestException('Interview generation returned no questions');
    const created = await this.prisma.coachSession.create({ data: { candidateId: p.id, jobId: job?.id, jobTitle: job?.title || dto.jobTitle,
      company: job?.company.commercialName || dto.company, interviewType: selectedType, locale: dto.locale, questions, visionConsent: dto.visionConsent,
      preparation: json({ method: deterministic.method, research: { status: 'not_used', sources: [] },
        jobDescription: job?.description || dto.jobDescription || '', skills: job?.skills.map(s => s.skill.name) || [], sourceResumeId: resume?.id, cvTextSnapshot: resume?.parsedText || renderProfile(p),
        companyDescription: companyProfile?.description || '', website: companyProfile?.website || dto.companyWebsite || '', analysis,
        deterministicInterview: deterministic, rubric: interviewRubric(analysis, selectedType), adaptiveEnabled, conversation: { state: 'READY', questionIndex: 0, transcript: '', code: '' } }) } });
    return this.candidateCoachSession(created);
  }
  private assertAutoTestEnabled() {
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_INTERVIEW_AUTOTEST !== 'true') throw new NotFoundException('Not found');
  }
  async startCoachAutoTest(userId: string, id: string, dto: InterviewAutoTestDto) {
    this.assertAutoTestEnabled();
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    const source = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!source) throw new NotFoundException('Session not found');
    const preparation = source.preparation as CoachPreparation;
    const maxTopics = Math.min(dto.maxTopics || (source.questions as string[]).length, 10);
    const seed = dto.seed ?? 12345;
    const autoTest: AutoTest = { mode: 'AUTOMATED_INTERVIEW_TEST', status: 'RUNNING', persona: dto.persona, speed: dto.speed || 1,
      disableTts: dto.disableTts ?? true, seed, maxTopics, startedAt: new Date().toISOString(), initialQuestionCount: maxTopics,
      trace: [{ timestamp: new Date().toISOString(), sessionId: source.id, stateBefore: 'PREPARING', event: 'AUTOTEST_STARTED', stateAfter: 'READY', questionIndex: 0 }] };
    const created = await this.prisma.coachSession.create({ data: { candidateId: p.id, jobId: source.jobId, jobTitle: source.jobTitle,
      company: source.company, interviewType: source.interviewType, locale: source.locale, visionConsent: false,
      questions: (source.questions as string[]).slice(0, maxTopics), answers: [],
      preparation: json({ ...preparation, conversation: { state: 'READY', questionIndex: 0, transcript: '', code: '' }, autoTest }) } });
    return this.candidateCoachSession(created);
  }
  async answerCoachAutoTest(userId: string, id: string) {
    this.assertAutoTestEnabled();
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!session) throw new NotFoundException('Session not found');
    const preparation = session.preparation as CoachPreparation, autoTest = preparation.autoTest;
    if (!autoTest || autoTest.status !== 'RUNNING') throw new ConflictException('Auto test is not running');
    const answers = session.answers as Prisma.JsonArray, questions = session.questions as string[];
    if (answers.length >= questions.length) return this.completeCoachAutoTest(userId, id);
    const questionIndex = answers.length, question = questions[questionIndex];
    const answer = new SimulatedCandidate().generateAnswer({ question, jobTitle: session.jobTitle, locale: session.locale,
      analysis: preparation.analysis, rubric: preparation.rubric as { competencies?: Array<{ label?: string; expectedEvidence?: string[] }> },
      previousAnswers: answers as Array<{ answer?: string }>, persona: autoTest.persona, seed: autoTest.seed });
    const code = session.interviewType === 'CODING' ? `// Simulated test solution for ${session.jobTitle}\nfunction solve(items: unknown[]) { return items.filter(Boolean); }` : '';
    const completed = await this.answerCoach(userId, id, { questionIndex, answer: code ? `${code}\n\n${answer}` : answer, transcript: answer, code });
    const after = await this.prisma.coachSession.findUnique({ where: { id } });
    if (!after || !completed) return completed;
    const afterPreparation = after.preparation as CoachPreparation;
    const savedAnswer = (after.answers as Array<{ decision?: { action?: string; reason?: string } }>)[questionIndex];
    await this.prisma.coachSession.update({ where: { id }, data: { preparation: json(withTestTrace(afterPreparation, 'ANSWER_ANALYZED', 'ANALYZING', afterPreparation.conversation?.state || 'INTERVIEWER_FEEDBACK', {
      sessionId: id, questionIndex, followUpDecision: savedAnswer?.decision?.action, reason: savedAnswer?.decision?.reason,
    })) } });
    return this.candidateCoachSession((await this.prisma.coachSession.findUnique({ where: { id } }))!);
  }
  async completeCoachAutoTest(userId: string, id: string) {
    this.assertAutoTestEnabled();
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!session) throw new NotFoundException('Session not found');
    const preparation = session.preparation as CoachPreparation, autoTest = preparation.autoTest;
    if (!autoTest) throw new ConflictException('Not an auto test session');
    const answers = session.answers as Array<{ transcript?: string; analysis?: unknown; decision?: { action?: string } }>, questions = session.questions as string[];
    const failures: string[] = [];
    if (answers.length !== questions.length || !answers.length) failures.push('Every question must have one persisted answer.');
    if (answers.some(answer => !answer.transcript)) failures.push('An answer is missing its transcript.');
    if (answers.some(answer => !answer.analysis)) failures.push('An answer is missing AnswerAnalysis.');
    if (answers.some(answer => !answer.decision?.action)) failures.push('An answer is missing the follow-up decision.');
    const followUps = answers.filter(answer => answer.decision?.action === 'FOLLOW_UP').length;
    if (['average', 'weak', 'inconsistent'].includes(autoTest.persona) && !followUps) failures.push('This persona should have triggered at least one follow-up.');
    const durationMs = Math.max(0, Date.now() - new Date(autoTest.startedAt).getTime());
    const result = { passed: failures.length === 0, errors: failures, durationMs, persona: autoTest.persona, mainQuestions: autoTest.initialQuestionCount,
      followUps, answersAnalyzed: answers.length, stateMachine: failures.length === 0, adaptiveQuestions: ['strong'].includes(autoTest.persona) || followUps > 0,
      persistence: failures.length === 0, finalDebrief: answers.length > 0 };
    const status = failures.length ? 'FAILED' : 'PASSED';
    const nextPreparation = withTestTrace({ ...preparation, conversation: { state: 'COMPLETED', questionIndex: answers.length, transcript: '', code: '' }, autoTest: { ...autoTest, status, result } as AutoTest }, 'AUTOTEST_COMPLETED', preparation.conversation?.state || 'INTERVIEWER_FEEDBACK', 'COMPLETED', { sessionId: id, questionIndex: answers.length });
    const updated = await this.prisma.coachSession.update({ where: { id }, data: { preparation: json(nextPreparation) } });
    return this.candidateCoachSession(updated);
  }
  async stopCoachAutoTest(userId: string, id: string) {
    this.assertAutoTestEnabled();
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!session) throw new NotFoundException('Session not found');
    const preparation = session.preparation as CoachPreparation, autoTest = preparation.autoTest;
    if (!autoTest) throw new ConflictException('Not an auto test session');
    const updated = await this.prisma.coachSession.update({ where: { id }, data: { preparation: json(withTestTrace({ ...preparation, autoTest: { ...autoTest, status: 'STOPPED' } }, 'AUTOTEST_STOPPED', preparation.conversation?.state || 'READY', preparation.conversation?.state || 'READY', { sessionId: id })) } });
    return this.candidateCoachSession(updated);
  }
  async answerCoach(userId: string, id: string, dto: CoachAnswerDto) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!session) throw new NotFoundException('Session not found');
    const questions = session.questions as string[], answers = session.answers as Prisma.JsonArray;
    if (dto.questionIndex < answers.length && (answers[dto.questionIndex] as { answer?: string })?.answer === dto.answer) return this.candidateCoachSession(session);
    if (dto.questionIndex !== answers.length || !questions[dto.questionIndex]) throw new BadRequestException('Answer the current question');
    const job = session.jobId ? await this.prisma.job.findUnique({ where: { id: session.jobId }, include: careerJobInclude }) : null;
    const preparation = session.preparation as CoachPreparation;
    const pending = (preparation.conversation as Conversation & { pendingAnswer?: CoachAnswerDto })?.pendingAnswer;
    if (preparation.conversation?.state === 'ANALYZING' && pending && pending.answer !== dto.answer) throw new ConflictException('The submitted answer is still being analyzed');
    const rubric = preparation.rubric || interviewRubric(preparation.analysis || analyzeInterviewJob({ title: session.jobTitle, description: preparation.jobDescription, skills: preparation.skills || [] }, preparation.cvTextSnapshot), session.interviewType);
    const lockedPreparation = withTestTrace({ ...preparation, rubric, conversation: { ...preparation.conversation, state: 'ANALYZING', questionIndex: dto.questionIndex, transcript: dto.transcript ?? dto.answer, code: dto.code ?? preparation.conversation?.code ?? '', pendingAnswer: dto } }, 'ANALYSIS_STARTED', preparation.conversation?.state || 'ANSWERING', 'ANALYZING', { sessionId: id, questionIndex: dto.questionIndex });
    const locked = await this.prisma.coachSession.updateMany({ where: { id, candidateId: p.id, updatedAt: session.updatedAt }, data: { preparation: json(lockedPreparation) } });
    if (!locked.count) throw new ConflictException('Session changed; retry the current answer');
    const input = { action: 'feedback', question: questions[dto.questionIndex], answer: dto.answer,
      locale: session.locale, interviewType: session.interviewType, job: { title: session.jobTitle, company: session.company,
        description: job?.description || preparation.jobDescription, requirements: job?.requirements, skills: job?.skills.map(s => ({ name: s.skill.name })) ?? preparation.skills?.map(name => ({ name })) ?? [], analysis: preparation.analysis },
      candidate: { text: preparation.cvTextSnapshot || renderProfile(p) }, speakingSeconds: dto.speakingSeconds, pauses: dto.pauses,
      analysis: preparation.analysis, rubric, history: answers.slice(-4),
      idempotencyKey: createHash('sha256').update(`${id}:${dto.questionIndex}:${dto.answer}`).digest('hex') };
    // Interview preparation and feedback stay fully local and deterministic.
    let feedback = guidedCoach(input);
    if (!['ai_coaching', 'local_deterministic'].includes(String(feedback.method)) || !['good', 'improve', 'keywords'].every(k => Array.isArray(feedback[k]) && (feedback[k] as unknown[]).every(v => typeof v === 'string')) || !['betterAnswer', 'clarity', 'relevance'].every(k => typeof feedback[k] === 'string')) feedback = guidedCoach(input);
    const metrics = speechMetrics(dto.transcript ?? dto.answer, dto.speakingSeconds, dto.fillerCount, dto.longPauses);
    feedback = { ...feedback, speechMetrics: metrics };
    const turn = analyzeTurn(feedback, dto.answer, questions[dto.questionIndex], session.locale, session.interviewType);
    const maxQuestions = preparation.autoTest ? Math.min(20, preparation.autoTest.maxTopics + 3) : 20;
    const adaptiveEnabled = typeof (this.entitlements as EntitlementService & { can?: unknown }).can === 'function'
      ? await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: p.id }, 'adaptive_interview')
      : true;
    const followUp = adaptiveEnabled ? decideFollowUp(turn.analysis, answers, questions.length, maxQuestions) : null;
    const decision = { action: followUp ? 'FOLLOW_UP' : 'NEXT_TOPIC', reason: turn.analysis.follow_up_reason || 'Continue the preparation plan', nextQuestion: followUp ? turn.followUpQuestion : questions[dto.questionIndex + 1] || null };
    const nextAnswers = [...answers, { questionIndex: dto.questionIndex, question: questions[dto.questionIndex], answer: dto.answer, transcript: dto.transcript ?? dto.answer, code: dto.code ?? preparation.conversation?.code ?? '', feedback, analysis: turn.analysis, decision, createdAt: new Date().toISOString() }];
    const nextQuestions = [...questions];
    if (followUp) nextQuestions.splice(dto.questionIndex + 1, 0, turn.followUpQuestion);
    const current = await this.prisma.coachSession.findUnique({ where: { id } });
    if ((current?.answers as Prisma.JsonArray)?.length !== answers.length) return current ? this.candidateCoachSession(current) : null;
    const updated = await this.prisma.coachSession.updateMany({ where: { id, candidateId: p.id, updatedAt: current!.updatedAt }, data: {
      answers: json(nextAnswers), questions: json(nextQuestions), preparation: json(withTestTrace({ ...preparation, rubric, conversation: { state: nextAnswers.length >= nextQuestions.length ? 'COMPLETED' : 'INTERVIEWER_FEEDBACK', questionIndex: nextAnswers.length, transcript: '', code: '' } }, 'ANSWER_SAVED', 'ANALYZING', nextAnswers.length >= nextQuestions.length ? 'COMPLETED' : 'INTERVIEWER_FEEDBACK', { sessionId: id, questionIndex: dto.questionIndex, followUpDecision: decision.action, reason: decision.reason })) } });
    if (!updated.count) throw new BadRequestException('Session changed; reload before answering');
    const updatedSession = await this.prisma.coachSession.findUnique({ where: { id } });
    return updatedSession ? this.candidateCoachSession(updatedSession) : updatedSession;
  }
  async targetedCoach(userId: string, id: string) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    const previous = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!previous) throw new NotFoundException('Session not found');
    const preparation = previous.preparation as { jobDescription?: string; skills?: string[]; cvTextSnapshot?: string; analysis?: InterviewJobAnalysis; sourceResumeId?: string };
    const previousAnswers = Array.isArray(previous.answers) ? previous.answers as Array<{ feedback?: { improve?: string[] } }> : [];
    const focusAreas = [...new Set(previousAnswers.flatMap(answer => answer.feedback?.improve || []).filter(Boolean))].slice(0, 5);
    const job = previous.jobId ? await this.prisma.job.findUnique({ where: { id: previous.jobId }, include: careerJobInclude }) : null;
    const jobInput = job ? { ...job, skills: job.skills.map(item => ({ name: item.skill.name, required: item.required })) } : { title: previous.jobTitle, description: preparation.jobDescription, company: { commercialName: previous.company }, skills: preparation.skills?.map(name => ({ name })) || [] };
    const deterministic = analyzeDeterministicInterview(jobInput, preparation.cvTextSnapshot || renderProfile(p), previous.locale, `${previous.id}:targeted`);
    const questions = selectDeterministicQuestions(deterministic, previous.locale, 10, `${previous.id}:targeted`);
    if (!questions?.length) throw new BadRequestException('Targeted practice generation returned no questions');
    const created = await this.prisma.coachSession.create({ data: { candidateId: p.id, jobId: previous.jobId, jobTitle: previous.jobTitle, company: previous.company, interviewType: previous.interviewType, locale: previous.locale, questions, visionConsent: false,
      preparation: json({ method: deterministic.method, sourceResumeId: preparation.sourceResumeId, cvTextSnapshot: preparation.cvTextSnapshot || renderProfile(p), jobDescription: preparation.jobDescription || '', skills: preparation.skills || [], focusAreas,
        analysis: preparation.analysis, deterministicInterview: deterministic, rubric: interviewRubric(preparation.analysis || analyzeInterviewJob(jobInput, preparation.cvTextSnapshot), previous.interviewType), conversation: { state: 'READY', questionIndex: 0, transcript: '', code: '' } }) } });
    return this.candidateCoachSession(created);
  }
  private candidateInterviewSummary(analysis: InterviewJobAnalysis) {
    return { role: analysis.role, company: analysis.company, seniority: analysis.seniority, recommendedTypes: analysis.recommendedTypes, optionalTypes: analysis.optionalTypes, difficulty: analysis.difficulty };
  }
  async saveCoachTurn(userId: string, id: string, dto: CoachTurnDto) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'interview_preparation');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!session) throw new NotFoundException('Session not found');
    const preparation = session.preparation as CoachPreparation;
    if (dto.questionIndex !== (session.answers as Prisma.JsonArray).length || dto.questionIndex >= (session.questions as string[]).length || (preparation.conversation as Conversation)?.state === 'ANALYZING') throw new ConflictException('The current turn has changed');
    const nextPreparation = withTestTrace({ ...preparation, conversation: dto }, 'STATE_TRANSITION', preparation.conversation?.state || 'READY', dto.state, { sessionId: id, questionIndex: dto.questionIndex });
    const updated = await this.prisma.coachSession.updateMany({ where: { id, candidateId: p.id, updatedAt: session.updatedAt }, data: { preparation: json(nextPreparation) } });
    if (!updated.count) throw new ConflictException('The current turn has changed');
    return { saved: true };
  }
  private candidateCoachSession(session: { id: string; jobId: string | null; jobTitle: string; company: string | null; interviewType: string; locale: string; questions: Prisma.JsonValue; answers: Prisma.JsonValue; preparation: Prisma.JsonValue; visionConsent: boolean; createdAt: Date; updatedAt: Date }) {
    const preparation = session.preparation && typeof session.preparation === 'object' && !Array.isArray(session.preparation) ? session.preparation as CoachPreparation : {};
    const deterministic = preparation.deterministicInterview as { topicCount?: number; topics?: unknown[]; score?: number | null; analysis_engine?: string } | undefined;
    return { id: session.id, jobId: session.jobId, jobTitle: session.jobTitle, company: session.company, interviewType: session.interviewType, locale: session.locale, questions: session.questions, answers: session.answers, visionConsent: session.visionConsent, conversation: preparation.conversation, autoTest: preparation.autoTest, preparation: { method: preparation.method, analysis_engine: deterministic?.analysis_engine || 'local_deterministic_fallback', topicCount: deterministic?.topicCount ?? 0, topics: deterministic?.topics ?? [], score: deterministic?.score ?? null, adaptiveEnabled: preparation.adaptiveEnabled !== false } };
  }
  async vision(userId: string, id: string, file?: Express.Multer.File) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.vision');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id, visionConsent: true } });
    if (!session) throw new ForbiddenException('Camera coaching requires consent for this session');
    if (!file || !['image/jpeg', 'image/png'].includes(file.mimetype) || file.size > 1024 * 1024) throw new BadRequestException('A JPEG or PNG frame up to 1 MB is required');
    return this.ai.careerVision(file.buffer, file.mimetype);
  }
  async enableVision(userId: string, id: string) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.vision');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!session) throw new NotFoundException('Session not found');
    const updated = await this.prisma.coachSession.update({ where: { id }, data: { visionConsent: true } });
    return this.candidateCoachSession(updated);
  }
}
