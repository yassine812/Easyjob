import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays } from '../common/utils/dates';
import { generateToken, hashToken } from '../common/utils/tokens';
import {
  CreateAssessmentDto,
  InviteCandidateDto,
  SubmitAttemptDto,
  UpdateAssessmentDto,
  GradeAttemptDto,
} from './dto/assessment.dto';
import type { RequestMeta } from '../companies/companies.service';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------- company CRUD ----------------

  async create(userId: string, companyId: string, dto: CreateAssessmentDto, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'assessment.manage');
    if (dto.jobId) await this.access.assertJobPermission(userId, companyId, dto.jobId, 'assessment.manage');
    const assessment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assessment.create({
        data: {
          companyId,
          jobId: dto.jobId,
          createdById: userId,
          title: dto.title,
          description: dto.description ?? null,
          type: dto.type,
          durationMinutes: dto.durationMinutes ?? null,
          status: dto.status ?? 'DRAFT',
        },
      });
      if (dto.questions) {
        for (const [index, q] of dto.questions.entries()) {
          await tx.assessmentQuestion.create({
            data: {
              assessmentId: created.id,
              prompt: q.prompt,
              type: q.type,
              options: q.options ? (q.options as object) : undefined,
              correctAnswer: q.correctAnswer ?? null,
              points: q.points ?? 1,
              order: q.order ?? index,
            },
          });
        }
      }
      return created;
    });
    await this.audit.log({
      actorId: userId,
      action: 'assessment.created',
      entityType: 'Assessment',
      entityId: assessment.id,
      metadata: { companyId, type: dto.type },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.getById(assessment.id, userId);
  }

  async list(companyId: string, query: { page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assessment.findMany({
        where: { companyId },
        include: { _count: { select: { questions: true, invitations: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assessment.count({ where: { companyId } }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getById(assessmentId: string, userId: string, companyId?: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!assessment || (companyId && assessment.companyId !== companyId)) throw new NotFoundException('Assessment not found');
    await this.access.assertPermission(userId, assessment.companyId, 'assessment.manage');
    return assessment;
  }

  async update(userId: string, companyId: string, assessmentId: string, dto: UpdateAssessmentDto, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'assessment.manage');
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.companyId !== companyId) throw new NotFoundException('Assessment not found');
    if (dto.jobId) await this.access.assertJobPermission(userId, companyId, dto.jobId, 'assessment.manage');
    const updated = await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        jobId: dto.jobId,
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        type: dto.type ?? undefined,
        durationMinutes: dto.durationMinutes ?? undefined,
        status: dto.status ?? undefined,
      },
    });
    await this.audit.log({
      actorId: userId,
      action: 'assessment.updated',
      entityType: 'Assessment',
      entityId: assessmentId,
      metadata: { companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  async delete(userId: string, companyId: string, assessmentId: string, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'assessment.manage');
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.companyId !== companyId) throw new NotFoundException('Assessment not found');
    await this.prisma.assessment.delete({ where: { id: assessmentId } });
    await this.audit.log({
      actorId: userId,
      action: 'assessment.deleted',
      entityType: 'Assessment',
      entityId: assessmentId,
      metadata: { companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { success: true };
  }

  // ---------------- invitations ----------------

  async invite(userId: string, companyId: string, assessmentId: string, dto: InviteCandidateDto, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'assessment.manage');
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.companyId !== companyId) throw new NotFoundException('Assessment not found');

    if (assessment.status === 'ARCHIVED') throw new BadRequestException('Assessment is archived');
    const related = await this.prisma.application.findFirst({ where: { candidateId: dto.candidateId,
      job: { companyId }, ...(assessment.jobId ? { jobId: assessment.jobId } : {}) }, select: { id: true } });
    if (!related) throw new NotFoundException('Candidate application not found for this assessment');
    if (dto.expiresAt && new Date(dto.expiresAt).getTime() <= Date.now()) throw new BadRequestException('Expiry must be in the future');
    const rawToken = generateToken();
    const invitation = await this.prisma.assessmentInvitation.create({
      data: {
        assessmentId,
        candidateId: dto.candidateId,
        invitedById: userId,
        tokenHash: hashToken(rawToken),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : addDays(new Date(), 7),
        status: 'PENDING',
      },
    });

    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { id: dto.candidateId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (candidate) {
      await this.notifications.create({
        userId: candidate.user.id,
        type: 'assessment.invited',
        title: `Assessment invitation: ${assessment.title}`,
        message: `You have been invited to complete the "${assessment.title}" assessment.`,
        data: { assessmentId, invitationId: invitation.id, href: `/assessments/attempt/${rawToken}` },
        dedupeKey: `assessment.invited:${invitation.id}`,
      });
    }

    await this.audit.log({
      actorId: userId,
      action: 'assessment.invited',
      entityType: 'AssessmentInvitation',
      entityId: invitation.id,
      metadata: { companyId, assessmentId, candidateId: dto.candidateId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return { invitationId: invitation.id, token: rawToken, expiresAt: invitation.expiresAt };
  }

  async listInvitations(companyId: string, assessmentId: string) {
    return this.prisma.assessmentInvitation.findMany({
      where: { assessment: { id: assessmentId, companyId } },
      include: {
        candidate: { select: { id: true, user: { select: { name: true, email: true } } } },
        attempt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------- attempts (candidate side) ----------------

  async startAttempt(userId: string, rawToken: string) {
    const invitation = await this.prisma.assessmentInvitation.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { assessment: { include: { questions: { orderBy: { order: 'asc' } } } }, candidate: true },
    });
    if (!invitation || invitation.status === 'COMPLETED' || invitation.status === 'EXPIRED') {
      throw new BadRequestException('Invalid or expired invitation');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.assessmentInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }
    if (invitation.candidate.userId !== userId) {
      throw new ForbiddenException('This invitation belongs to another candidate');
    }

    const existingAttempt = await this.prisma.assessmentAttempt.findUnique({
      where: { invitationId: invitation.id },
    });
    if (existingAttempt) {
      if (existingAttempt.status === 'COMPLETED') {
        throw new BadRequestException('Assessment already completed');
      }
      return {
        id: existingAttempt.id,
        attemptId: existingAttempt.id,
        startedAt: existingAttempt.startedAt,
        questions: this.questionsForCandidate(invitation.assessment.questions),
        durationMinutes: invitation.assessment.durationMinutes,
      };
    }

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        invitationId: invitation.id,
        status: 'STARTED',
        startedAt: new Date(),
        maxScore: invitation.assessment.questions.reduce((sum, q) => sum + q.points, 0),
      },
    });
    await this.prisma.assessmentInvitation.update({
      where: { id: invitation.id },
      data: { status: 'STARTED', startedAt: new Date() },
    });

    return {
      id: attempt.id,
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      questions: this.questionsForCandidate(invitation.assessment.questions),
      durationMinutes: invitation.assessment.durationMinutes,
    };
  }

  async submitAttempt(userId: string, attemptId: string, dto: SubmitAttemptDto) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        invitation: { include: { candidate: true, assessment: { include: { questions: true } } } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.invitation.candidate.userId !== userId) {
      throw new ForbiddenException('You do not own this attempt');
    }
    if (attempt.status === 'COMPLETED') {
      throw new BadRequestException('Assessment already submitted');
    }

    if (attempt.invitation.expiresAt.getTime() < Date.now()) throw new BadRequestException('Invitation has expired');
    const questions = attempt.invitation.assessment.questions;
    const questionMap = new Map(questions.map(q => [q.id, q]));
    const seen = new Set<string>();
    const rows = dto.answers.map(answer => {
      const question = questionMap.get(answer.questionId);
      if (!question || seen.has(answer.questionId)) throw new BadRequestException('Unknown or repeated question');
      seen.add(answer.questionId);
      const automatic = question.type === QuestionType.MULTIPLE_CHOICE && question.correctAnswer !== null;
      const isCorrect = automatic ? answer.answer === question.correctAnswer : null;
      return { attemptId, questionId: question.id, answer: answer.answer, isCorrect,
        score: automatic ? (isCorrect ? question.points : 0) : null };
    });
    const score = rows.reduce((sum, row) => sum + (row.score ?? 0), 0);
    const maxScore = questions.reduce((sum, question) => sum + question.points, 0);
    await this.prisma.$transaction(async tx => {
      const claimed = await tx.assessmentAttempt.updateMany({ where: { id: attemptId, status: 'STARTED' },
        data: { status: 'COMPLETED', completedAt: new Date(), score, maxScore } });
      if (claimed.count !== 1) throw new BadRequestException('Assessment already submitted');
      if (rows.length) await tx.assessmentAnswer.createMany({ data: rows });
      await tx.assessmentInvitation.update({ where: { id: attempt.invitationId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    });
    return { attemptId, score, maxScore, status: 'COMPLETED', pendingReview: rows.some(row => row.score === null) };
  }

  async gradeAttempt(userId: string, companyId: string, attemptId: string, dto: GradeAttemptDto, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'assessment.manage');
    const attempt = await this.prisma.assessmentAttempt.findFirst({ where: { id: attemptId, invitation: { assessment: { companyId } } },
      include: { answers: { include: { question: true } } } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'COMPLETED') throw new BadRequestException('Wait for the candidate to submit');
    const marks = new Map<string, number>();
    for (const mark of dto.answers) {
      const answer = attempt.answers.find(item => item.questionId === mark.questionId);
      if (!answer || marks.has(mark.questionId) || mark.score > answer.question.points) throw new BadRequestException('Invalid question or score');
      marks.set(mark.questionId, mark.score);
    }
    const score = attempt.answers.reduce((sum, answer) => sum + (marks.get(answer.questionId) ?? answer.score ?? 0), 0);
    await this.prisma.$transaction(async tx => {
      for (const [questionId, points] of marks) await tx.assessmentAnswer.update({
        where: { attemptId_questionId: { attemptId, questionId } }, data: { score: points } });
      await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { score } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'assessment.graded', entityType: 'AssessmentAttempt',
        entityId: attemptId, metadata: { companyId, score, marks: dto.answers.map(mark => ({ ...mark })) }, ipAddress: meta.ip, userAgent: meta.userAgent } });
    }, { isolationLevel: 'Serializable' });
    return this.getAttempt(userId, attemptId);
  }

  async getAttempt(userId: string, attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        invitation: {
          include: {
            candidate: { include: { user: { select: { id: true, name: true, email: true } } } },
            assessment: { include: { company: { select: { id: true, commercialName: true } } } },
          },
        },
        answers: { include: { question: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const isCandidate = attempt.invitation.candidate.userId === userId;
    if (!isCandidate) {
      await this.access.assertPermission(
        userId,
        attempt.invitation.assessment.companyId,
        'assessment.manage',
      );
    }
    if (isCandidate) return { ...attempt, answers: attempt.answers.map(answer => {
      const { correctAnswer: _correctAnswer, ...question } = answer.question;
      return { ...answer, question };
    }) };
    return attempt;
  }

  private questionsForCandidate(
    questions: Array<{ id: string; prompt: string; type: QuestionType; options: unknown; points: number; order: number }>,
  ) {
    return questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.type === QuestionType.MULTIPLE_CHOICE ? q.options : undefined,
      points: q.points,
      order: q.order,
    }));
  }
}
