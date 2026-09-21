import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prefillFromCv } from './cv-prefill';
import { guidedCoach } from './coach-fallback';
import { cvSkillItems, splitCvCertifications, splitCvEducations, splitCvExperiences, splitCvLanguages } from './cv-experience';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { AiClient } from '../ai/ai-client';
import { StorageService } from '../files/storage.service';
import { atsReport, extractProfile, matchCandidate, matchesPreferences, normalize, renderProfile, unique } from './career-engine';
import { BuildDraftDto, CareerSearchDto, CareerSettingsDto, CoachAnswerDto, CreateCoachDto, ProfessionalDataDto, SaveDraftDto, RegenerateSectionDto } from './career.dto';

export const availableJobWhere = (): Prisma.JobWhereInput => ({
  status: 'PUBLISHED',
  // Reserved example.com domains identify the old fixture companies. Keep their
  // records for admin/company testing, but never expose their jobs to candidates.
  company: { status: 'ACTIVE', verification: { status: 'VERIFIED' }, NOT: { website: { contains: '.example.com', mode: 'insensitive' } } },
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});
export const careerJobInclude = { company: { select: { id: true, commercialName: true, industry: true, slug: true, website: true } }, skills: { include: { skill: true } } } satisfies Prisma.JobInclude;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class CareerService {
  constructor(private readonly prisma: PrismaService, private readonly entitlements: EntitlementService,
    private readonly ai: AiClient, private readonly storage: StorageService) {}

  async profile(userId: string) {
    const p = await this.prisma.candidateProfile.findUnique({ where: { userId }, include: {
      user: { select: { id: true, name: true, email: true, status: true, emailVerifiedAt: true } },
      skills: { include: { skill: true } }, experiences: true, educations: true,
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
    const plan = await this.entitlements.getActivePlan({ ownerType: 'CANDIDATE', ownerId: profile.id });
    const resume = profile.resumes[0];
    const extra = profile.professionalData as { sections?: Record<string, string[]> } | null;
    const fields = { headline: !!profile.headline || !!extra?.sections?.summary?.length,
      location: !!profile.location, skills: profile.skills.length > 0 || !!extra?.sections?.skills?.length,
      experience: profile.experiences.length > 0 || !!extra?.sections?.experience?.length,
      education: profile.educations.length > 0 || !!extra?.sections?.education?.length, cv: !!resume?.parsedText };
    const [applications, interviews, savedJobs, upcomingInterview] = await Promise.all([
      this.prisma.application.count({ where: { candidateId: profile.id } }),
      this.prisma.interview.count({ where: { application: { candidateId: profile.id }, status: { in: ['SCHEDULED', 'CONFIRMED'] } } }),
      this.prisma.savedJob.count({ where: { candidateId: profile.id } }),
      this.prisma.interview.findFirst({ where: { application: { candidateId: profile.id }, startAt: { gte: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] } }, select: { id: true, startAt: true, type: true, application: { select: { id: true, job: { select: { title: true } } } } }, orderBy: { startAt: 'asc' } }),
    ]);
    const recommendations = plan.features['career.match'] === true ? await this.search(userId, { sort: 'match', limit: 4 }, true) : null;
    return { name: profile.user.name, plan, profileCompletion: Math.round(Object.values(fields).filter(Boolean).length / Object.keys(fields).length * 100),
      completionFields: fields, applications, interviews, recommendations, savedJobs, upcomingInterview, autoApply: profile.careerSettings?.autoApply ?? false,
      resume: resume ? { id: resume.id, filename: resume.filename, status: resume.processingStatus, createdAt: resume.createdAt, ats: resume.parsedText ? atsReport(resume.parsedText) : null } : null,
    };
  }
  async search(userId: string, query: CareerSearchDto, recommended = false) {
    const p = await this.profile(userId);
    const advanced = await this.entitlements.can({ ownerType: 'CANDIDATE', ownerId: p.id }, 'career.match');
    if (recommended && !advanced) throw new ForbiddenException('PRO is required for advanced matching');
    if (query.salaryMin != null && query.salaryMax != null && query.salaryMin > query.salaryMax) throw new BadRequestException('Invalid salary range');
    const filters: Prisma.JobWhereInput[] = [availableJobWhere()];
    if (query.companyId) filters.push({ companyId: query.companyId });
    if (query.publishedWithin) filters.push({ publishedAt: { gte: new Date(Date.now() - query.publishedWithin * 86400000) } });
    if (query.keyword) filters.push({ OR: [{ title: { contains: query.keyword, mode: 'insensitive' } }, { description: { contains: query.keyword, mode: 'insensitive' } }, { domain: { contains: query.keyword, mode: 'insensitive' } }, { skills: { some: { skill: { name: { contains: query.keyword, mode: 'insensitive' } } } } }] });
    if (query.domain) filters.push({ OR: [{ domain: { equals: query.domain, mode: 'insensitive' } }, { domain: null, company: { industry: { equals: query.domain, mode: 'insensitive' } } }] });
    if (query.location) filters.push({ location: { contains: query.location, mode: 'insensitive' } });
    if (query.workMode) filters.push({ OR: [{ workMode: query.workMode }, ...(query.workMode !== 'HYBRID' ? [{ workMode: null, remote: query.workMode === 'REMOTE' }] : [])] });
    if (query.employmentType) filters.push({ employmentType: query.employmentType });
    if (query.contractType) filters.push({ contractType: query.contractType });
    if (query.experienceLevel) filters.push({ experienceLevel: query.experienceLevel });
    if (query.salaryMin != null) filters.push({ salaryMax: { gte: query.salaryMin } });
    if (query.salaryMax != null) filters.push({ salaryMin: { lte: query.salaryMax } });
    for (const skill of unique((query.skills || '').split(','))) filters.push({ skills: { some: { skill: { normalizedName: normalize(skill) } } } });
    const jobs = await this.prisma.job.findMany({ where: { AND: filters }, include: careerJobInclude, orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }] });
    const settings = await this.settings(userId);
    let scored = jobs.map(job => ({ ...job, isSaved: p.savedJobs?.some(saved => saved.jobId === job.id) ?? false, match: matchCandidate(p, job) }));
    if (recommended) scored = scored.filter(job => matchesPreferences(job, settings) && job.match.score !== null && job.match.score >= settings.minimumScore);
    if (query.sort === 'match' || recommended) scored.sort((a, b) => (b.match.score ?? -1) - (a.match.score ?? -1));
    else if (query.sort === 'relevance' && query.keyword) {
      const q = normalize(query.keyword);
      const rank = (j: typeof scored[number]) => Number(normalize(j.title).includes(q)) * 3 + j.skills.filter(s => normalize(s.skill.name).includes(q)).length;
      scored.sort((a, b) => rank(b) - rank(a));
    }
    const limit = query.limit || 12, page = query.page || 1;
    return { items: scored.slice((page - 1) * limit, page * limit).map(job => ({ ...job, match: advanced ? job.match : { score: job.match.score, classification: job.match.classification, method: job.match.method, estimated: true } })), total: scored.length, page, limit, advanced };
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
    const job = jobId ? await this.job(jobId) : null;
    return { id: resume.id, filename: resume.filename, status: resume.processingStatus,
      report: resume.parsedText ? atsReport(resume.parsedText, job?.skills.map(s => s.skill.name), { selected: !!job, title: job?.title, company: job?.company.commercialName }) : null,
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
    return job;
  }
  async drafts(userId: string) {
    const p = await this.profile(userId);
    return this.prisma.cvDraft.findMany({ where: { candidateId: p.id }, orderBy: { updatedAt: 'desc' } });
  }
  async buildDraft(userId: string, dto: BuildDraftDto) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.builder');
    const resume = dto.resumeId ? p.resumes.find(r => r.id === dto.resumeId) : p.resumes[0];
    if (dto.resumeId && !resume) throw new NotFoundException('CV not found');
    const job = dto.jobId ? await this.job(dto.jobId) : null;
    if (dto.mode === 'tailor' && !job) throw new BadRequestException('Select a target job');
    const original = resume?.parsedText || renderProfile(p);
    let content = renderProfile(p);
    // Uploaded evidence is included in the provider payload; prompts prohibit adding unsupported facts.
    if (dto.mode === 'tailor' || dto.mode === 'optimize') {
      const result = await this.ai.tailorCv({ cv_text: original, job: job ? { ...job, skills: job.skills.map(s => ({ name: s.skill.name })) } : { title: dto.title, requirements: [], skills: [] } });
      if (!result.tailored_cv?.trim()) throw new BadRequestException('CV generation returned no content');
      content = result.tailored_cv;
    } else {
      const result = await this.ai.generateCv({ name: p.user.name, email: p.user.email, headline: p.headline, bio: p.bio, location: p.location,
        skills: p.skills.map(s => ({ name: s.skill.name })), experiences: p.experiences, educations: p.educations,
        professionalData: p.professionalData, sourceCvText: resume?.parsedText || null });
      if (!result.cv_markdown?.trim()) throw new BadRequestException('CV generation returned no content');
      content = result.cv_markdown;
    }
    const keywords = job?.skills.map(s => s.skill.name) || [];
    return this.prisma.cvDraft.create({ data: { candidateId: p.id, title: dto.title, targetJobId: job?.id, sourceResumeId: resume?.id,
      originalContent: original, content, beforeScore: atsReport(original, keywords).score, afterScore: atsReport(content, keywords).score, keywords } });
  }
  async saveDraft(userId: string, id: string, dto: SaveDraftDto) {
    const p = await this.profile(userId);
    const draft = await this.prisma.cvDraft.findFirst({ where: { id, candidateId: p.id } });
    if (!draft) throw new NotFoundException('Draft not found');
    return this.prisma.cvDraft.update({ where: { id }, data: { content: dto.content, title: dto.title,
      afterScore: atsReport(dto.content, draft.keywords).score, approvedAt: dto.approve ? new Date() : null } });
  }
  async regenerateSection(userId: string, id: string, dto: RegenerateSectionDto) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.builder');
    const draft = await this.prisma.cvDraft.findFirst({ where: { id, candidateId: p.id } });
    if (!draft) throw new NotFoundException('Draft not found');
    const sections = dto.content.split(/(?=^## )/m);
    const source = sections[dto.sectionIndex];
    if (!source?.trim()) throw new BadRequestException('Select a CV section');
    const job = draft.targetJobId ? await this.prisma.job.findUnique({ where: { id: draft.targetJobId }, include: careerJobInclude }) : null;
    const result = await this.ai.tailorCv({ cv_text: source, job: job
      ? { title: job.title, requirements: job.requirements, skills: job.skills.map(s => ({ name: s.skill.name })) }
      : { title: draft.title, requirements: [], skills: [] } });
    if (!result.tailored_cv?.trim()) throw new BadRequestException('No section generated');
    sections[dto.sectionIndex] = result.tailored_cv.trim() + '\n\n';
    const content = sections.join('');
    if (content.length > 50000) throw new BadRequestException('Generated CV is too long');
    // Return a proposal. Only an explicit save/approval replaces the user's draft.
    return { content, score: atsReport(content, draft.keywords).score };
  }
  async publishDraft(userId: string, id: string) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.builder');
    const draft = await this.prisma.cvDraft.findFirst({ where: { id, candidateId: p.id, approvedAt: { not: null } } });
    if (!draft) throw new BadRequestException('Review and approve this CV first');
    await this.entitlements.assertCandidateLimit(p.id, 'cv.uploads');
    const filename = `${draft.title.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 100)}.md`;
    const key = `resumes/${p.id}/draft-${id}-${Date.now()}.md`, bytes = Buffer.from(draft.content, 'utf8');
    await this.storage.put(key, bytes, 'text/markdown');
    return this.prisma.resume.create({ data: { candidateId: p.id, filename, storageKey: key, fileSize: bytes.length, mimeType: 'text/markdown',
      version: Math.max(0, ...p.resumes.map(r => r.version)) + 1, isPrimary: p.resumes.length === 0,
      parsedText: draft.content, atsReport: json(atsReport(draft.content)), processingStatus: 'COMPLETED' } });
  }
  async settings(userId: string) {
    const p = await this.profile(userId);
    return this.prisma.careerSettings.upsert({ where: { candidateId: p.id }, create: { candidateId: p.id }, update: {} });
  }
  async updateSettings(userId: string, dto: CareerSettingsDto) {
    const p = await this.profile(userId), current = await this.settings(userId);
    if (dto.emailAlerts) await this.requireFeature(p.id, 'career.alerts');
    if (dto.autoApply) {
      await this.requireFeature(p.id, 'career.auto_apply');
      if (!p.user.emailVerifiedAt) throw new BadRequestException('Verify your email first');
      if (!current.autoApply && dto.consent !== true) throw new BadRequestException('Explicit Auto Apply consent is required');
      const approved = await this.prisma.cvDraft.findFirst({ where: { id: dto.approvedDraftId || current.approvedDraftId || '', candidateId: p.id, approvedAt: { not: null } } });
      if (!approved) throw new BadRequestException('Select a reviewed and approved CV');
    }
    if (dto.approvedDraftId && !await this.prisma.cvDraft.findFirst({ where: { id: dto.approvedDraftId, candidateId: p.id, approvedAt: { not: null } } })) throw new BadRequestException('Approved CV not found');
    const { consent, ...data } = dto;
    return this.prisma.careerSettings.update({ where: { candidateId: p.id }, data: { ...data,
      ...(dto.autoApply === true && consent ? { autoConsentAt: new Date() } : {}),
      ...(dto.autoApply === false ? { autoConsentAt: null } : {}) } });
  }
  async history(userId: string) {
    const p = await this.profile(userId);
    const deliveries = await this.prisma.careerDelivery.findMany({ where: { candidateId: p.id }, orderBy: { createdAt: 'desc' } });
    const jobs = await this.prisma.job.findMany({ where: { id: { in: deliveries.map(d => d.jobId) } }, select: { id: true, title: true, company: { select: { commercialName: true } } } });
    return deliveries.map(d => ({ ...d, job: jobs.find(j => j.id === d.jobId) || null }));
  }
  async autoStats(userId: string) {
    const p = await this.profile(userId);
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
    return this.prisma.coachSession.findMany({ where: { candidateId: p.id }, orderBy: { updatedAt: 'desc' }, take: 30 });
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
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.coach');
    if (dto.visionConsent) await this.requireFeature(p.id, 'career.vision');
    const job = dto.jobId ? await this.job(dto.jobId) : null;
    const companyProfile = job ? await this.prisma.company.findUnique({ where: { id: job.company.id },
      select: { commercialName: true, website: true, industry: true, description: true, city: true, country: true, slug: true } }) : null;
    if (companyProfile && !companyProfile.website && dto.companyWebsite) companyProfile.website = dto.companyWebsite;
    const input = { action: 'questions', locale: dto.locale, interviewType: dto.interviewType,
      job: job ? { ...job, company: companyProfile, skills: job.skills.map(s => ({ name: s.skill.name })) }
        : { title: dto.jobTitle, description: dto.jobDescription, company: { commercialName: dto.company, website: dto.companyWebsite } },
      candidate: { text: renderProfile(p) } };
    let result = await this.ai.careerCoach(input).catch(() => guidedCoach(input));
    if (result.method !== 'ai_coaching' || !Array.isArray(result.questions) || !result.questions.some(q => typeof q === 'string' && q.trim())) result = { ...guidedCoach(input), research: result.research };
    const questions = (result.questions as unknown[] | undefined)?.filter((q): q is string => typeof q === 'string' && q.length > 0).slice(0, 10);
    if (!questions?.length) throw new BadRequestException('Interview generation returned no questions');
    return this.prisma.coachSession.create({ data: { candidateId: p.id, jobId: job?.id, jobTitle: job?.title || dto.jobTitle,
      company: job?.company.commercialName || dto.company, interviewType: dto.interviewType, locale: dto.locale, questions, visionConsent: dto.visionConsent,
      preparation: json({ method: result.method || 'guided_practice', research: result.research || { status: 'unavailable', sources: [] },
        jobDescription: job?.description || dto.jobDescription || '', skills: job?.skills.map(s => s.skill.name) || [],
        companyDescription: companyProfile?.description || '', website: companyProfile?.website || dto.companyWebsite || '' }) } });
  }
  async answerCoach(userId: string, id: string, dto: CoachAnswerDto) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.coach');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id } });
    if (!session) throw new NotFoundException('Session not found');
    const questions = session.questions as string[], answers = session.answers as Prisma.JsonArray;
    if (dto.questionIndex !== answers.length || !questions[dto.questionIndex]) throw new BadRequestException('Answer the current question');
    const job = session.jobId ? await this.prisma.job.findUnique({ where: { id: session.jobId }, include: careerJobInclude }) : null;
    const preparation = session.preparation as { jobDescription?: string; skills?: string[] };
    const input = { action: 'feedback', question: questions[dto.questionIndex], answer: dto.answer,
      locale: session.locale, interviewType: session.interviewType, job: { title: session.jobTitle, company: session.company,
        description: job?.description || preparation.jobDescription, requirements: job?.requirements, skills: job?.skills.map(s => ({ name: s.skill.name })) ?? preparation.skills?.map(name => ({ name })) ?? [] },
      candidate: { text: renderProfile(p) }, speakingSeconds: dto.speakingSeconds, pauses: dto.pauses };
    let feedback = await this.ai.careerCoach(input).catch(() => guidedCoach(input));
    if (!['good', 'improve', 'keywords'].every(k => Array.isArray(feedback[k]) && (feedback[k] as unknown[]).every(v => typeof v === 'string')) || !['betterAnswer', 'clarity', 'relevance'].every(k => typeof feedback[k] === 'string')) feedback = guidedCoach(input);
    const updated = await this.prisma.coachSession.updateMany({ where: { id, candidateId: p.id, updatedAt: session.updatedAt }, data: {
      answers: json([...answers, { questionIndex: dto.questionIndex, answer: dto.answer, feedback, createdAt: new Date().toISOString() }]) } });
    if (!updated.count) throw new BadRequestException('Session changed; reload before answering');
    return this.prisma.coachSession.findUnique({ where: { id } });
  }
  async vision(userId: string, id: string, file?: Express.Multer.File) {
    const p = await this.profile(userId); await this.requireFeature(p.id, 'career.vision');
    const session = await this.prisma.coachSession.findFirst({ where: { id, candidateId: p.id, visionConsent: true } });
    if (!session) throw new ForbiddenException('Camera coaching requires consent for this session');
    if (!file || !['image/jpeg', 'image/png'].includes(file.mimetype) || file.size > 1024 * 1024) throw new BadRequestException('A JPEG or PNG frame up to 1 MB is required');
    return this.ai.careerVision(file.buffer, file.mimetype);
  }
}
