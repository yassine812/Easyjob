import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { AiAnalysisType } from '@prisma/client';
import { QUEUES } from '../common/constants/queues';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { AiClient } from './ai-client';
import { NotificationsService } from '../notifications/notifications.service';

@Processor(QUEUES.AI)
@Injectable()
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly aiClient: AiClient,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<{ analysisId: string }>): Promise<void> {
    const analysis = await this.prisma.aiAnalysis.findUnique({ where: { id: job.data.analysisId } });
    if (!analysis) return;

    await this.prisma.aiAnalysis.update({ where: { id: analysis.id }, data: { status: 'PROCESSING' } });
    try {
      const input = (analysis.inputReference ?? {}) as Record<string, unknown>;
      switch (analysis.type) {
        case AiAnalysisType.CV_ANALYZE:
          await this.handleCvAnalyze(analysis.id, input);
          break;
        case AiAnalysisType.CV_GENERATE:
          await this.handleCvGenerate(analysis.id, input);
          break;
        case AiAnalysisType.MATCH:
          await this.handleMatch(analysis.id, input);
          break;
        case AiAnalysisType.COVER_LETTER:
          await this.handleCoverLetter(analysis.id, input);
          break;
        case AiAnalysisType.INTERVIEW:
          await this.handleInterview(analysis.id, input);
          break;
        case AiAnalysisType.JOB_ANALYZE:
        case AiAnalysisType.CV_TAILOR:
          await this.prisma.aiAnalysis.update({
            where: { id: analysis.id },
            data: { status: 'FAILED', error: `Type ${analysis.type} not yet exposed via API` },
          });
          return;
        default:
          throw new Error(`Unknown analysis type ${analysis.type}`);
      }
      await this.prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await this.notifications.create({
        userId: analysis.userId,
        type: 'ai.completed',
        title: 'AI request completed',
        message: `Your ${analysis.type.replace(/_/g, ' ').toLowerCase()} request is ready.`,
        data: { analysisId: analysis.id },
        dedupeKey: `ai.completed:${analysis.id}`,
      });
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`AI analysis ${analysis.id} failed: ${message}`);
      await this.prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: { status: 'FAILED', error: message.slice(0, 1000), completedAt: new Date() },
      });
      throw err;
    }
  }

  private async handleCvAnalyze(analysisId: string, input: Record<string, unknown>): Promise<void> {
    const resumeId = String(input.resumeId);
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) throw new Error('Resume not found');

    let text = resume.parsedText;
    if (!text) {
      const bytes = await this.storage.getBytes(resume.storageKey);
      text = await this.aiClient.extractText(resume.filename, bytes);
      await this.prisma.resume.update({
        where: { id: resumeId },
        data: { parsedText: text, processingStatus: 'COMPLETED' },
      });
    }

    const result = await this.aiClient.analyzeCv({ text, filename: resume.filename });
    await this.prisma.aiAnalysis.update({
      where: { id: analysisId },
      data: {
        output: result as object,
        scores: { overall: result.overall_score, ats: result.ats_compatibility } as object,
        metadata: { resumeId, filename: resume.filename },
      },
    });
  }

  private async handleCvGenerate(analysisId: string, input: Record<string, unknown>): Promise<void> {
    const candidateId = String(input.candidateId);
    const profile = await this.buildCandidatePayload(candidateId);
    const result = await this.aiClient.generateCv(profile);
    await this.prisma.aiAnalysis.update({
      where: { id: analysisId },
      data: { output: result as object, metadata: { candidateId } },
    });
  }

  private async handleMatch(analysisId: string, input: Record<string, unknown>): Promise<void> {
    const candidateId = String(input.candidateId);
    const jobId = String(input.jobId);
    const candidate = await this.buildCandidatePayload(candidateId);
    const job = await this.buildJobPayload(jobId);
    const result = await this.aiClient.match(candidate, job);
    await this.prisma.aiAnalysis.update({
      where: { id: analysisId },
      data: {
        output: result as object,
        scores: {
          skill: result.skill_match,
          experience: result.experience_match,
          location: result.location_match,
          seniority: result.seniority_match,
          overall: result.overall_match,
        } as object,
        metadata: { candidateId, jobId },
      },
    });

    // Expose the match score to the automation engine (CANDIDATE_MATCH_SCORE_UPDATED).
    const application = await this.prisma.application.findUnique({
      where: { jobId_candidateId: { jobId, candidateId } },
      include: { job: { select: { companyId: true } } },
    });
    if (application) {
      this.events.emit('candidate.match_score_updated', {
        applicationId: application.id,
        jobId,
        companyId: application.job.companyId,
        overall: result.overall_match,
      });
    }
  }

  private async handleCoverLetter(analysisId: string, input: Record<string, unknown>): Promise<void> {
    const candidateId = String(input.candidateId);
    const jobId = String(input.jobId);
    const candidate = await this.buildCandidatePayload(candidateId);
    const job = await this.buildJobPayload(jobId);
    const result = await this.aiClient.coverLetter(candidate, job);
    await this.prisma.aiAnalysis.update({
      where: { id: analysisId },
      data: { output: result as object, metadata: { candidateId, jobId } },
    });
  }

  private async handleInterview(analysisId: string, input: Record<string, unknown>): Promise<void> {
    const candidateId = String(input.candidateId);
    const jobId = String(input.jobId);
    const candidate = await this.buildCandidatePayload(candidateId);
    const job = await this.buildJobPayload(jobId);
    const result = await this.aiClient.interviewPrep(job, candidate);
    await this.prisma.aiAnalysis.update({
      where: { id: analysisId },
      data: { output: result as object, metadata: { candidateId, jobId } },
    });
  }

  private async buildCandidatePayload(candidateId: string): Promise<Record<string, unknown>> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        user: true,
        skills: { include: { skill: true } },
        experiences: { orderBy: { startDate: 'desc' } },
        educations: { orderBy: { startDate: 'desc' } },
        jobPreference: true,
      },
    });
    if (!profile) throw new Error('Candidate not found');
    return {
      name: profile.user.name,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      yearsExperience: profile.yearsExperience,
      remotePreference: profile.remotePreference,
      employmentTypePreference: profile.employmentTypePreference,
      skills: profile.skills.map((s) => ({ name: s.skill.name, level: s.level })),
      experiences: profile.experiences.map((e) => ({
        companyName: e.companyName,
        title: e.title,
        description: e.description,
        startDate: e.startDate.toISOString().slice(0, 10),
        endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
        current: e.current,
      })),
      educations: profile.educations.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        startDate: e.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: e.endDate?.toISOString().slice(0, 10) ?? null,
      })),
      preferences: profile.jobPreference,
    };
  }

  private async buildJobPayload(jobId: string): Promise<Record<string, unknown>> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: { select: { commercialName: true, industry: true, city: true, country: true } },
        skills: { include: { skill: true } },
      },
    });
    if (!job) throw new Error('Job not found');
    return {
      id: job.id,
      title: job.title,
      description: job.description,
      responsibilities: job.responsibilities,
      requirements: job.requirements,
      location: job.location,
      remote: job.remote,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      company: job.company.commercialName,
      industry: job.company.industry,
      skills: job.skills.map((s) => ({ name: s.skill.name, required: s.required, level: s.level })),
    };
  }
}
