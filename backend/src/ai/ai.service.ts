import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AiAnalysisType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../common/constants/queues';
import { safeJobId } from '../common/utils/job-ids';
import { paginate, resolvePagination } from '../common/utils/pagination';
import { EntitlementService } from '../entitlements/entitlement.service';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.AI) private readonly aiQueue: Queue,
    private readonly entitlements: EntitlementService,
  ) {}

  async analyzeCv(userId: string, resumeId: string): Promise<{ analysisId: string }> {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    const resume = await this.prisma.resume.findFirst({
      where: { id: resumeId, candidateId: profile.id },
    });
    if (!resume) throw new NotFoundException('Resume not found');

    return this.enqueue(userId, AiAnalysisType.CV_ANALYZE, { resumeId, candidateId: profile.id });
  }

  async generateCv(userId: string): Promise<{ analysisId: string }> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: { user: true, skills: { include: { skill: true } } },
    });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    return this.enqueue(userId, AiAnalysisType.CV_GENERATE, { candidateId: profile.id });
  }

  async matchJob(userId: string, jobId: string): Promise<{ analysisId: string }> {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    const job = await this.prisma.job.findFirst({ where: { id: jobId, status: 'PUBLISHED', company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!job) throw new NotFoundException('Job not found');
    return this.enqueue(userId, AiAnalysisType.MATCH, { candidateId: profile.id, jobId });
  }

  async coverLetter(userId: string, jobId: string): Promise<{ analysisId: string }> {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    const job = await this.prisma.job.findFirst({ where: { id: jobId, status: 'PUBLISHED', company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!job) throw new NotFoundException('Job not found');
    return this.enqueue(userId, AiAnalysisType.COVER_LETTER, { candidateId: profile.id, jobId });
  }

  async interviewPrep(userId: string, jobId: string): Promise<{ analysisId: string }> {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    const job = await this.prisma.job.findFirst({ where: { id: jobId, status: 'PUBLISHED', company: { status: 'ACTIVE', verification: { status: 'VERIFIED' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!job) throw new NotFoundException('Job not found');
    return this.enqueue(userId, AiAnalysisType.INTERVIEW, { candidateId: profile.id, jobId });
  }

  async getAnalysis(userId: string, analysisId: string) {
    const analysis = await this.prisma.aiAnalysis.findUnique({ where: { id: analysisId } });
    if (!analysis) throw new NotFoundException('Analysis not found');
    if (analysis.userId !== userId) {
      throw new ForbiddenException('You do not own this analysis');
    }
    return analysis;
  }

  async listAnalyses(userId: string, query: { page?: number; limit?: number }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aiAnalysis.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.aiAnalysis.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  private async enqueue(
    userId: string,
    type: AiAnalysisType,
    inputReference: Record<string, unknown>,
  ): Promise<{ analysisId: string }> {
    const feature: Partial<Record<AiAnalysisType, string>> = { CV_GENERATE: 'career.builder', CV_TAILOR: 'cv_tailoring', MATCH: 'detailed_matching', COVER_LETTER: 'ai.cover_letter', INTERVIEW: 'interview_preparation' };
    if (feature[type]) await this.entitlements.assertCan({ ownerType: 'CANDIDATE', ownerId: String(inputReference.candidateId) }, feature[type]!);
    const analysis = await this.prisma.aiAnalysis.create({
      data: {
        userId,
        type,
        status: 'PENDING',
        inputReference: inputReference as object,
      },
    });
    await this.aiQueue.add(
      'process',
      { analysisId: analysis.id },
      {
        jobId: safeJobId(`ai:${analysis.id}`),
        attempts: 4,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 60 * 60 * 24 * 7 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      },
    );
    return { analysisId: analysis.id };
  }
}

