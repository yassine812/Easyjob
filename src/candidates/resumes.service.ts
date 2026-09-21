import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { FileValidationService, type ValidatedFile } from '../files/file-validation.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { QUEUES } from '../common/constants/queues';
import { safeJobId } from '../common/utils/job-ids';
import { CONFIG, type AppConfig } from '../config/configuration';
import type { RequestMeta } from '../companies/companies.service';

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly fileValidation: FileValidationService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementService,
    @InjectQueue(QUEUES.CV_PROCESSING) private readonly cvQueue: Queue,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  badRequest(): never {
    throw new BadRequestException('A file is required (field "file")');
  }

  async upload(userId: string, file: Express.Multer.File, meta: RequestMeta) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');

    const validated: ValidatedFile = this.fileValidation.validate(file);
    if (!['.pdf', '.docx', '.txt', '.md'].includes(validated.extension)) throw new BadRequestException('Upload a text-based PDF, DOCX, TXT or Markdown CV');
    await this.entitlements.assertCandidateLimit(profile.id, 'cv.uploads');

    const maxVersion = await this.prisma.resume.aggregate({
      where: { candidateId: profile.id },
      _max: { version: true },
    });
    const version = (maxVersion._max.version ?? 0) + 1;
    const resumeCount = await this.prisma.resume.count({ where: { candidateId: profile.id } });

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const storageKey = `resumes/${profile.id}/${version}-${Date.now()}-${safeName}`;

    await this.storage.put(storageKey, validated.buffer, validated.mimeType);

    const resume = await this.prisma.resume.create({
      data: {
        candidateId: profile.id,
        filename: safeName,
        storageKey,
        mimeType: validated.mimeType,
        fileSize: validated.size,
        version,
        isPrimary: resumeCount === 0,
        processingStatus: 'PENDING',
      },
    });

    await this.cvQueue.add(
      'process',
      { resumeId: resume.id },
      {
        jobId: safeJobId(`cv:${resume.id}`),
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 60 * 60 * 24 * 7 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      },
    );

    await this.audit.log({
      actorId: userId,
      action: 'cv.uploaded',
      entityType: 'Resume',
      entityId: resume.id,
      metadata: { filename: safeName, size: validated.size },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      id: resume.id,
      filename: resume.filename,
      mimeType: resume.mimeType,
      fileSize: resume.fileSize,
      version: resume.version,
      isPrimary: resume.isPrimary,
      processingStatus: resume.processingStatus,
    };
  }

  async list(userId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    return this.prisma.resume.findMany({
      where: { candidateId: profile.id },
      orderBy: [{ isPrimary: 'desc' }, { version: 'desc' }],
      select: {
        id: true,
        filename: true,
        mimeType: true,
        fileSize: true,
        version: true,
        isPrimary: true,
        processingStatus: true,
        createdAt: true,
      },
    });
  }

  async setPrimary(userId: string, resumeId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    const resume = await this.prisma.resume.findFirst({ where: { id: resumeId, candidateId: profile.id } });
    if (!resume) throw new NotFoundException('Resume not found');
    await this.prisma.$transaction([
      this.prisma.resume.updateMany({ where: { candidateId: profile.id }, data: { isPrimary: false } }),
      this.prisma.resume.update({ where: { id: resumeId }, data: { isPrimary: true } }),
    ]);
    return { success: true };
  }

  async remove(userId: string, resumeId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    const resume = await this.prisma.resume.findFirst({ where: { id: resumeId, candidateId: profile.id } });
    if (!resume) throw new NotFoundException('Resume not found');

    await this.prisma.resume.delete({ where: { id: resumeId } });
    await this.storage.delete(resume.storageKey).catch(() => undefined);

    if (resume.isPrimary) {
      const next = await this.prisma.resume.findFirst({
        where: { candidateId: profile.id },
        orderBy: { version: 'desc' },
      });
      if (next) {
        await this.prisma.resume.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }
    return { success: true };
  }

  /**
   * Returns a signed download URL for a candidate CV.
   * Allowed: the candidate themself, or a company member with candidate.cv.view
   * whose company received an application from this candidate. Every access is
   * recorded in the audit log.
   */
  async getDownloadUrl(userId: string, resumeId: string, meta: RequestMeta): Promise<{ url: string; filename: string }> {
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
      include: { candidate: { include: { user: true } } },
    });
    if (!resume) throw new NotFoundException('Resume not found');

    const isOwner = resume.candidate.userId === userId;
    if (!isOwner) {
      const membership = await this.authorizedCompanyMember(userId, resume);
      if (!membership) {
        throw new ForbiddenException('You are not authorized to access this CV');
      }
    }

    const url = await this.storage.presignedGet(resume.storageKey);
    await this.audit.log({
      actorId: userId,
      action: 'cv.download',
      entityType: 'Resume',
      entityId: resume.id,
      metadata: { candidateId: resume.candidateId, isOwner },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { url, filename: resume.filename };
  }

  private async authorizedCompanyMember(
    userId: string,
    resume: { candidateId: string },
  ): Promise<{ companyId: string } | null> {
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId, status: 'ACTIVE' },
        select: { id: true, companyId: true, role: true },
    });
    for (const membership of memberships) {
      const hasApplication = await this.prisma.application.count({
        where: {
          candidateId: resume.candidateId,
            job: { companyId: membership.companyId,
              ...(membership.role === 'HIRING_MANAGER' ? { assignments: { some: { memberId: membership.id } } } : {}),
              },
            ...(membership.role === 'INTERVIEWER' ? { interviews: { some: { participants: { some: { memberId: membership.id } } } } } : {}),
        },
      });
      if (hasApplication === 0) continue;
      const role = await this.prisma.role.findUnique({
        where: { name: membership.role },
        include: { permissions: { include: { permission: true } } },
      });
      const granted = role?.permissions.map((rp) => rp.permission.name) ?? [];
      if (granted.includes('candidate.cv.view')) {
        return { companyId: membership.companyId };
      }
    }
    return null;
  }
}
