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
import { logicalResumeId, resumeDesign, resumeGroups, resumeLocale } from './resume-versioning';
import { copySubmittedCv, submittedCv } from '../applications/submitted-cv';
import { toJson } from '../common/utils/json';

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
    if (validated.extension === '.pdf' && validated.mimeType !== 'application/pdf') throw new BadRequestException('A PDF CV must have the application/pdf content type');
    await this.entitlements.assertCandidateLimit(profile.id, 'cv.uploads', async () => {
      const rows = await this.prisma.resume.findMany({ where: { candidateId: profile.id }, select: { id: true, design: true, createdAt: true } });
      return resumeGroups(rows).size;
    });

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
    const resumes = await this.prisma.resume.findMany({
      where: { candidateId: profile.id },
      orderBy: [{ isPrimary: 'desc' }, { version: 'desc' }],
      select: {
        id: true,
        filename: true,
        mimeType: true,
        design: true,
        fileSize: true,
        version: true,
        isPrimary: true,
        processingStatus: true,
        createdAt: true,
        updatedAt: true,
        atsReport: true,
      },
    });
    const drafts = await this.prisma.cvDraft.findMany({ where: { candidateId: profile.id }, select: { id: true, sourceResumeId: true, version: true, updatedAt: true, language: true, afterScore: true, analysisStatus: true } });
    const groups = resumeGroups(resumes);
    return [...groups.entries()].map(([logicalCvId, versions]) => {
      const byLocale = new Map<string, typeof versions>();
      for (const row of versions) { const locale = resumeLocale(row); byLocale.set(locale, [...(byLocale.get(locale) ?? []), row]); }
      const variantRows = [...byLocale.entries()].map(([locale, rows]) => ({ locale, rows, current: rows.at(-1)! }));
      const preferred = variantRows.find(variant => variant.rows.some(row => row.isPrimary)) ?? variantRows.sort((a, b) => b.current.updatedAt.getTime() - a.current.updatedAt.getTime())[0];
      const current = preferred.current, currentVersions = preferred.rows;
      const groupIds = new Set(versions.map(row => row.id));
      const publishedDraftVersions = new Map<string, number>();
      for (const row of versions) {
        const design = resumeDesign(row.design);
        if (design.draftId && typeof design.draftVersion === 'number') publishedDraftVersions.set(design.draftId, Math.max(publishedDraftVersions.get(design.draftId) ?? 0, design.draftVersion));
      }
      const currentDesign = resumeDesign(current.design);
      const working = drafts.filter(d => ((!d.language && preferred.locale === 'fr-FR') || d.language === preferred.locale || d.language === preferred.locale.slice(0, 2)) && (currentDesign.restoredFromResumeId ? d.sourceResumeId === current.id : (d.sourceResumeId && groupIds.has(d.sourceResumeId)) || publishedDraftVersions.has(d.id)))
        .filter(d => d.version > (publishedDraftVersions.get(d.id) ?? 0)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
      const { atsReport, ...resume } = current;
      const report = atsReport as { score?: unknown; documentInspection?: { pageCount?: number; pages?: unknown[] } } | null;
      const savedScore = current.processingStatus === 'COMPLETED' && typeof report?.score === 'number' && Number.isFinite(report.score) && report.score >= 0 && report.score <= 100 ? report.score : null;
      const analysisStatus = working ? working.analysisStatus : current.processingStatus;
      const score = working ? working.analysisStatus === 'COMPLETED' && typeof working.afterScore === 'number' ? working.afterScore : null : savedScore;
      const pages = report?.documentInspection?.pageCount ?? report?.documentInspection?.pages?.length;
      const variants = variantRows.map(variant => ({ id: variant.current.id, locale: variant.locale, language: variant.locale.slice(0, 2), version: variant.rows.length, current: variant.current.id === current.id }));
      return { ...resume, updatedAt: working?.updatedAt ?? resume.updatedAt, logicalCvId, locale: preferred.locale, language: preferred.locale.slice(0, 2), variants, version: currentVersions.length, versionCount: currentVersions.length, isPrimary: versions.some(row => row.isPrimary), workingDraftId: working?.id ?? null, workingDraftUpdatedAt: working?.updatedAt ?? null, analysisSummary: { score, status: analysisStatus, source: working ? 'draft' : 'version', pageCount: Number.isInteger(pages) && pages! > 0 ? pages : null } };
    }).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  private async ownedGroup(userId: string, resumeId: string) {
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Candidate profile not found');
    const rows = await this.prisma.resume.findMany({ where: { candidateId: profile.id }, orderBy: { createdAt: 'asc' } });
    const selected = rows.find(row => row.id === resumeId);
    if (!selected) throw new NotFoundException('Resume not found');
    const logicalCvId = logicalResumeId(selected, rows), versions = resumeGroups(rows).get(logicalCvId)!, locale = resumeLocale(selected), variantVersions = versions.filter(row => resumeLocale(row) === locale);
    return { profile, logicalCvId, versions, locale, variantVersions, current: variantVersions.at(-1)! };
  }

  async history(userId: string, resumeId: string) {
    const { logicalCvId, locale, variantVersions: versions, current } = await this.ownedGroup(userId, resumeId);
    return [...versions].reverse().map((row, index) => {
      const report = row.atsReport as { score?: unknown } | null;
      return { id: row.id, logicalCvId, locale, version: versions.length - index, current: row.id === current.id, createdAt: row.createdAt, filename: row.filename, score: typeof report?.score === 'number' ? report.score : null };
    });
  }

  async duplicate(userId: string, resumeId: string) {
    const { profile, current } = await this.ownedGroup(userId, resumeId);
    await this.entitlements.assertCandidateLimit(profile.id, 'cv.uploads', async () => {
      const rows = await this.prisma.resume.findMany({ where: { candidateId: profile.id }, select: { id: true, design: true, createdAt: true } });
      return resumeGroups(rows).size;
    });
    const bytes = await this.storage.getBytes(current.storageKey), id = crypto.randomUUID(), extension = current.filename.match(/\.[^.]+$/)?.[0] || '.pdf';
    const filename = `${current.filename.replace(/\.[^.]+$/, '')} — copie${extension}`, storageKey = `resumes/${profile.id}/copy-${id}${extension}`;
    const { logicalCvId: _logicalCvId, sourceResumeId: _sourceResumeId, draftId: _draftId, draftVersion: _draftVersion, ...copyDesign } = resumeDesign(current.design);
    await this.storage.put(storageKey, bytes, current.mimeType);
    try {
      return await this.prisma.resume.create({ data: { candidateId: profile.id, filename, storageKey, mimeType: current.mimeType, fileSize: bytes.length, version: 1, isPrimary: false, parsedText: current.parsedText, atsReport: current.atsReport ?? undefined, extractedProfile: current.extractedProfile ?? undefined, processingStatus: current.processingStatus, design: { ...copyDesign, logicalCvId: `resume:${id}` } } });
    } catch (error) { await this.storage.delete(storageKey).catch(() => undefined); throw error; }
  }

  async restore(userId: string, resumeId: string, versionId: string) {
    const { profile, logicalCvId, versions: logicalVersions, variantVersions: versions, current } = await this.ownedGroup(userId, resumeId);
    const source = versions.find(row => row.id === versionId);
    if (!source) throw new NotFoundException('CV version not found');
    if (source.id === current.id) throw new BadRequestException('This is already the current version');
    const bytes = await this.storage.getBytes(source.storageKey), nextVersion = versions.length + 1;
    const extension = current.filename.match(/\.[^.]+$/)?.[0] || '.pdf', storageKey = `resumes/${profile.id}/restore-${current.id}-v${nextVersion}-${Date.now()}${extension}`;
    const { draftId: _draftId, draftVersion: _draftVersion, logicalCvId: _logicalCvId, ...restoredDesign } = resumeDesign(source.design);
    await this.storage.put(storageKey, bytes, source.mimeType);
    try {
      return await this.prisma.$transaction(async tx => {
        if (logicalVersions.some(row => row.isPrimary)) await tx.resume.updateMany({ where: { id: { in: logicalVersions.map(row => row.id) } }, data: { isPrimary: false } });
        return tx.resume.create({ data: { candidateId: profile.id, filename: current.filename, storageKey, mimeType: source.mimeType, fileSize: bytes.length, version: nextVersion, isPrimary: logicalVersions.some(row => row.isPrimary), parsedText: source.parsedText, atsReport: source.atsReport ?? undefined, extractedProfile: source.extractedProfile ?? undefined, processingStatus: source.processingStatus, design: { ...restoredDesign, logicalCvId, restoredFromResumeId: source.id, sourceResumeId: current.id } } });
      });
    } catch (error) { await this.storage.delete(storageKey).catch(() => undefined); throw error; }
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
  async rename(userId: string, resumeId: string, name: string) {
    const { versions, current: resume } = await this.ownedGroup(userId, resumeId);
    const clean = name.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\p{Cc}/gu, '').replace(/\.(pdf|docx|txt|md)$/i, '').trim();
    if (!clean) throw new BadRequestException('Indique un nom de CV');
    await this.preserveSubmittedVersions(versions);
    const extension = resume.filename.match(/\.[^.]+$/)?.[0] || '';
    await this.prisma.resume.updateMany({ where: { id: { in: versions.map(row => row.id) } }, data: { filename: clean + extension } });
    return { ...resume, filename: clean + extension };
  }

  async remove(userId: string, resumeId: string) {
    const { profile, versions, current: resume } = await this.ownedGroup(userId, resumeId);
    await this.preserveSubmittedVersions(versions);
    await this.prisma.resume.deleteMany({ where: { id: { in: versions.map(row => row.id) } } });
    await Promise.all(versions.map(row => this.storage.delete(row.storageKey).catch(() => undefined)));

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

  /** Preserve legacy submissions before their library file is renamed or removed. */
  private async preserveSubmittedVersions(versions: Array<{ id: string; storageKey: string; filename: string; mimeType: string; version: number }>) {
    const applications = await this.prisma.application.findMany({ where: { resumeId: { in: versions.map(row => row.id) } }, select: { id: true, resumeId: true, appliedAt: true, candidateSnapshot: true } });
    for (const application of applications) {
      if (submittedCv(application.candidateSnapshot)) continue;
      const resume = versions.find(row => row.id === application.resumeId)!;
      const file = await copySubmittedCv(this.storage, resume);
      file.submittedAt = application.appliedAt.toISOString();
      try {
        const snapshot = application.candidateSnapshot;
        await this.prisma.application.update({ where: { id: application.id }, data: { candidateSnapshot: toJson({ ...(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {}), submittedCv: file }) } });
      } catch (error) { await this.storage.delete(file.storageKey).catch(() => undefined); throw error; }
    }
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
