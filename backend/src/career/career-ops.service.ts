import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EasyJobSkillRuntime } from '../skills/easyjob/easyjob-skill.runtime';

const clean = (value: unknown) => String(value ?? '').trim();
const localeOf = (value: unknown): 'fr' | 'en' | 'ar' => value === 'en' || value === 'ar' ? value : 'fr';

@Injectable()
export class CareerOpsService {
  constructor(private readonly prisma: PrismaService, private readonly skills: EasyJobSkillRuntime) {}

  private async candidate(userId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: { skills: { include: { skill: true } }, experiences: { orderBy: { startDate: 'desc' } }, educations: true, resumes: { orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }] } },
    });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    return profile;
  }

  private async job(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, include: { company: { select: { id: true, commercialName: true, website: true } }, skills: { include: { skill: true } } } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private async cvText(userId: string, resumeId?: string) {
    const candidate = await this.candidate(userId);
    const resume = resumeId ? candidate.resumes.find(item => item.id === resumeId) : candidate.resumes.find(item => item.isPrimary) ?? candidate.resumes[0];
    if (!resume?.parsedText?.trim()) throw new BadRequestException('A processed CV is required for this feature');
    return { candidate, resume, cvText: resume.parsedText };
  }

  private context(userId: string, input: Record<string, unknown>, permission: string, jobId?: string) {
    return { userId, jobId, locale: localeOf(input.locale), permissions: [permission], input };
  }

  private output(result: { output?: unknown }) { return (result.output && typeof result.output === 'object' ? result.output : {}) as Record<string, unknown>; }

  async tailor(userId: string, jobId: string, resumeId?: string, locale?: string) {
    const job = await this.job(jobId); const { resume, cvText } = await this.cvText(userId, resumeId);
    const result = await this.skills.execute('candidate-cv-tailoring', this.context(userId, { job, cvText, resumeId: resume.id, locale }, 'candidate.cv.edit', jobId));
    return { job: { id: job.id, title: job.title, company: job.company?.commercialName ?? null }, resume: { id: resume.id, filename: resume.filename }, ...this.output(result), skill: result.skill, skillStatus: result.status };
  }

  async fit(userId: string, jobId: string, resumeId?: string, locale?: string) {
    const job = await this.job(jobId); const { resume, cvText } = await this.cvText(userId, resumeId);
    const result = await this.skills.execute('candidate-job-fit-explainer', this.context(userId, { job, cvText, resumeId: resume.id, locale }, 'candidate.job.view', jobId));
    return { job: { id: job.id, title: job.title, company: job.company?.commercialName ?? null }, resume: { id: resume.id, filename: resume.filename }, ...this.output(result), skill: result.skill, skillStatus: result.status };
  }

  async interviewPrep(userId: string, jobId: string, resumeId?: string, locale?: string) {
    const job = await this.job(jobId); const { candidate, resume, cvText } = await this.cvText(userId, resumeId);
    const result = await this.skills.execute('candidate-interview-prep', this.context(userId, { job, cvText, resumeId: resume.id, jobId, locale }, 'candidate.job.view', jobId));
    const stories = await this.prisma.candidateStarStory.findMany({ where: { candidateId: candidate.id }, orderBy: { updatedAt: 'desc' }, take: 20 });
    return { job: { id: job.id, title: job.title, company: job.company?.commercialName ?? null }, resume: { id: resume.id, filename: resume.filename }, ...this.output(result), linkedStarStories: stories, skill: result.skill, skillStatus: result.status };
  }

  async followup(userId: string, applicationId: string, locale?: string) {
    const candidate = await this.candidate(userId);
    const application = await this.prisma.application.findFirst({ where: { id: applicationId, candidateId: candidate.id }, include: { job: { select: { id: true, title: true, company: { select: { commercialName: true } } } }, events: { orderBy: { createdAt: 'asc' }, select: { previousStatus: true, newStatus: true, createdAt: true } } } });
    if (!application) throw new NotFoundException('Application not found');
    const result = await this.skills.execute('candidate-application-followup', this.context(userId, { status: application.status, appliedAt: application.appliedAt.toISOString(), events: application.events, locale }, 'candidate.application.view'));
    return { application: { id: application.id, status: application.status, appliedAt: application.appliedAt, job: application.job }, timeline: application.events, ...this.output(result), skill: result.skill, skillStatus: result.status };
  }

  async duplicates(userId: string, jobId: string) {
    await this.candidate(userId);
    let jobs: Record<string, unknown>[];
    try {
      const job = await this.job(jobId);
      const related = await this.prisma.job.findMany({ where: { status: { in: ['PUBLISHED', 'DRAFT'] }, id: { not: jobId }, OR: [{ companyId: job.companyId }, { title: { contains: job.title, mode: 'insensitive' } }] }, take: 80, include: { company: { select: { commercialName: true } } } });
      jobs = [job, ...related].map(item => ({ id: item.id, title: item.title, companyName: item.company?.commercialName, location: item.location, description: item.description, reference: item.slug, sourceUrl: null }));
    } catch {
      const external = await this.prisma.aggregatedJob.findUnique({ where: { id: jobId }, include: { sourceCompany: true, sources: true } });
      if (!external) throw new NotFoundException('Job not found');
      const related = await this.prisma.aggregatedJob.findMany({ where: { status: 'OPEN', id: { not: jobId }, OR: [{ sourceCompanyId: external.sourceCompanyId }, { title: { contains: external.title, mode: 'insensitive' } }] }, take: 80, include: { sourceCompany: true, sources: true } });
      jobs = [external, ...related].map(item => ({ id: item.id, title: item.title, companyName: item.companyName || item.sourceCompany?.name, location: item.location, description: item.description, reference: item.reference || item.dedupeKey, sourceUrl: item.sources[0]?.originalUrl ?? null }));
    }
    const result = await this.skills.execute('duplicate-job-detector', this.context(userId, { jobs }, 'candidate.job.view', jobId));
    return { jobId, ...this.output(result), skill: result.skill, skillStatus: result.status };
  }

  async negotiation(userId: string, jobId: string, input: Record<string, unknown>) {
    await this.candidate(userId); const job = await this.job(jobId);
    const result = await this.skills.execute('negotiation-prep', this.context(userId, { ...input, currency: input.currency || job.currency || 'TND', rangeMin: input.rangeMin ?? job.salaryMin, rangeMax: input.rangeMax ?? job.salaryMax }, 'candidate.job.view', jobId));
    return { job: { id: job.id, title: job.title, currency: job.currency, salaryMin: job.salaryMin, salaryMax: job.salaryMax }, ...this.output(result), skill: result.skill, skillStatus: result.status };
  }

  listStories(userId: string) { return this.candidate(userId).then(profile => this.prisma.candidateStarStory.findMany({ where: { candidateId: profile.id }, orderBy: { updatedAt: 'desc' } })); }

  async createStory(userId: string, input: Record<string, unknown>) {
    const profile = await this.candidate(userId); const fields = ['title', 'situation', 'task', 'action', 'result'];
    if (fields.some(field => !clean(input[field]))) throw new BadRequestException('title, situation, task, action and result are required');
    return this.prisma.candidateStarStory.create({ data: { candidateId: profile.id, title: clean(input.title).slice(0, 160), situation: clean(input.situation).slice(0, 5000), task: clean(input.task).slice(0, 5000), action: clean(input.action).slice(0, 5000), result: clean(input.result).slice(0, 5000), relatedSkills: Array.isArray(input.relatedSkills) ? input.relatedSkills.map(clean).filter(Boolean).slice(0, 30) : [], relatedRoles: Array.isArray(input.relatedRoles) ? input.relatedRoles.map(clean).filter(Boolean).slice(0, 20) : [] } });
  }

  async updateStory(userId: string, id: string, input: Record<string, unknown>) {
    const profile = await this.candidate(userId); const story = await this.prisma.candidateStarStory.findFirst({ where: { id, candidateId: profile.id } }); if (!story) throw new NotFoundException('STAR story not found');
    return this.prisma.candidateStarStory.update({ where: { id }, data: { title: input.title === undefined ? undefined : clean(input.title).slice(0, 160), situation: input.situation === undefined ? undefined : clean(input.situation).slice(0, 5000), task: input.task === undefined ? undefined : clean(input.task).slice(0, 5000), action: input.action === undefined ? undefined : clean(input.action).slice(0, 5000), result: input.result === undefined ? undefined : clean(input.result).slice(0, 5000), relatedSkills: Array.isArray(input.relatedSkills) ? input.relatedSkills.map(clean).filter(Boolean).slice(0, 30) : undefined, relatedRoles: Array.isArray(input.relatedRoles) ? input.relatedRoles.map(clean).filter(Boolean).slice(0, 20) : undefined } });
  }

  async deleteStory(userId: string, id: string) { const profile = await this.candidate(userId); const deleted = await this.prisma.candidateStarStory.deleteMany({ where: { id, candidateId: profile.id } }); if (!deleted.count) throw new NotFoundException('STAR story not found'); return { success: true }; }
}
