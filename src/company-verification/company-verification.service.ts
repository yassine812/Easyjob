import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { StorageService } from '../files/storage.service';
import { FileValidationService } from '../files/file-validation.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { emailTemplates } from '../queues/email/templates';
import type { RequestMeta } from '../companies/companies.service';

@Injectable()
export class CompanyVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly storage: StorageService,
    private readonly fileValidation: FileValidationService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async uploadDocument(
    userId: string,
    companyId: string,
    file: Express.Multer.File,
    meta: RequestMeta,
  ) {
    await this.access.assertPermission(userId, companyId, 'team.manage');
    const verification = await this.prisma.companyVerification.findUnique({
      where: { companyId },
    });
    if (!verification) throw new NotFoundException('Verification record not found');
    if (verification.status === VerificationStatus.VERIFIED) {
      throw new BadRequestException('Company is already verified');
    }

    const validated = this.fileValidation.validate(file);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const storageKey = `verification/${companyId}/${Date.now()}-${safeName}`;
    await this.storage.put(storageKey, validated.buffer, validated.mimeType);

    const doc = await this.prisma.verificationDocument.create({
      data: {
        verificationId: verification.id,
        storageKey,
        filename: safeName,
        mimeType: validated.mimeType,
        fileSize: validated.size,
        uploadedById: userId,
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'company_verification.document_uploaded',
      entityType: 'VerificationDocument',
      entityId: doc.id,
      metadata: { companyId, filename: safeName },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: doc.id, filename: doc.filename, mimeType: doc.mimeType, fileSize: doc.fileSize };
  }

  async submit(userId: string, companyId: string, meta: RequestMeta) {
    await this.access.assertPermission(userId, companyId, 'team.manage');
    const verification = await this.prisma.companyVerification.findUnique({
      where: { companyId },
      include: { documents: true },
    });
    if (!verification) throw new NotFoundException('Verification record not found');
    if (verification.status === VerificationStatus.VERIFIED) {
      return { status: VerificationStatus.VERIFIED };
    }
    if (verification.documents.length === 0) {
      throw new BadRequestException('Upload at least one verification document before submitting');
    }
    const updated = await this.prisma.companyVerification.update({
      where: { companyId },
      data: { status: VerificationStatus.UNDER_REVIEW, submittedAt: new Date(), notes: null, rejectionReason: null },
    });
    await this.audit.log({
      actorId: userId,
      action: 'company_verification.submitted',
      entityType: 'CompanyVerification',
      entityId: verification.id,
      metadata: { companyId, documents: verification.documents.length },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { status: updated.status, submittedAt: updated.submittedAt };
  }

  async getForCompany(userId: string, companyId: string) {
    await this.access.assertMembership(userId, companyId);
    return this.prisma.companyVerification.findUnique({
      where: { companyId },
      include: { documents: { select: { id: true, filename: true, mimeType: true, fileSize: true, createdAt: true } } },
    });
  }

  /** Admin-only review actions (authorization enforced in the admin controller). */
  async review(
    reviewerUserId: string,
    verificationId: string,
    decision: 'approve' | 'reject',
    reason?: string,
    meta?: RequestMeta,
  ) {
    const verification = await this.prisma.companyVerification.findUnique({
      where: { id: verificationId },
      include: { company: true },
    });
    if (!verification) throw new NotFoundException('Verification not found');

    if (decision === 'approve') {
      await this.prisma.$transaction([
        this.prisma.companyVerification.update({
          where: { id: verificationId },
          data: {
            status: VerificationStatus.VERIFIED,
            reviewedAt: new Date(),
            reviewedById: reviewerUserId,
            rejectionReason: null,
          },
        }),
        this.prisma.company.update({
          where: { id: verification.companyId },
          data: { status: 'ACTIVE' },
        }),
      ]);
      await this.notifyCompanyAdmins(
        verification.companyId,
        'company.verified',
        'Company verified',
        `${verification.company.commercialName} has been verified.`,
        emailTemplates.companyVerified(verification.company.commercialName),
      );
      await this.audit.log({
        actorId: reviewerUserId,
        action: 'company_verification.approved',
        entityType: 'CompanyVerification',
        entityId: verificationId,
        metadata: { companyId: verification.companyId },
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
      return { status: VerificationStatus.VERIFIED };
    }

    await this.prisma.companyVerification.update({
      where: { id: verificationId },
      data: {
        status: VerificationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: reviewerUserId,
        rejectionReason: reason ?? 'Documents did not meet verification requirements',
      },
    });
    await this.notifyCompanyAdmins(
      verification.companyId,
      'company.rejected',
      'Verification rejected',
      `Your verification was rejected. Reason: ${reason ?? 'Please resubmit with correct documents'}.`,
      emailTemplates.companyRejected(
        verification.company.commercialName,
        reason ?? 'Documents did not meet verification requirements',
      ),
    );
    await this.audit.log({
      actorId: reviewerUserId,
      action: 'company_verification.rejected',
      entityType: 'CompanyVerification',
      entityId: verificationId,
      metadata: { companyId: verification.companyId, reason },
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { status: VerificationStatus.REJECTED };
  }

  private async notifyCompanyAdmins(
    companyId: string,
    type: string,
    title: string,
    message: string,
    email: { subject: string; html: string },
  ): Promise<void> {
    const admins = await this.prisma.companyMember.findMany({
      where: { companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
      include: { user: { select: { id: true, email: true } } },
    });
    for (const admin of admins) {
      await this.notifications.create({
        userId: admin.user.id,
        type,
        title,
        message,
        data: { companyId },
        email: { subject: email.subject, html: email.html, to: admin.user.email },
        dedupeKey: `${type}:${companyId}:${admin.user.id}`,
      });
    }
  }
}
