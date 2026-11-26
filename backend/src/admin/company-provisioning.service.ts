import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { sealCredentials } from '../queues/email/credential-envelope';
import { emailTemplates } from '../queues/email/templates';
import { generateToken, hashToken } from '../common/utils/tokens';
import { ProvisionCompanyDto } from './provision-company.dto';

@Injectable()
export class CompanyProvisioningService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(CONFIG) private readonly config: AppConfig) {}

  async create(adminId: string, dto: ProvisionCompanyDto) {
    const email = dto.ownerEmail.trim().toLowerCase();
    const companyEmail = dto.professionalEmail?.trim().toLowerCase() || email;
    if (!dto.ownerName.trim() || !dto.commercialName.trim() || !dto.legalName.trim()) throw new BadRequestException('Names cannot be blank');
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('This email already has an account. Use a separate professional email.');
    const passwordHash = await bcrypt.hash(`invite-${randomBytes(32).toString('hex')}`, this.config.bcryptRounds);
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 3600_000);
    const url = `${this.config.frontendUrl}/activate-company-account?token=${resetToken}`;
    const rendered = emailTemplates.companyOwnerInvitation(url, dto.commercialName, dto.ownerName, dto.planName ?? 'EasyJob Starter', email);
    try {
      const company = await this.prisma.$transaction(async tx => {
        const role = await tx.role.findUniqueOrThrow({ where: { name: 'COMPANY_ADMIN' } });
        const owner = await tx.user.create({ data: { name: dto.ownerName.trim(), email, phone: dto.ownerPhone?.trim() || null, passwordHash,
          mustChangePassword: true, temporaryPasswordExpiresAt: expiresAt, emailVerifiedAt: null,
          roles: { create: { roleId: role.id } } } });
        const { ownerName: _name, ownerEmail: _email, ownerPhone: _phone, planName: requestedPlan, timezone, currency, ...fields } = dto;
        void _name; void _email; void _phone;
        const plan = await tx.plan.findFirst({ where: { type: 'COMPANY', name: (requestedPlan ?? 'TRIAL').trim().toUpperCase(), active: true } });
        if (!plan) throw new BadRequestException('Unknown or inactive company plan');
        const created = await tx.company.create({ data: { ...fields, legalName: dto.legalName.trim(), commercialName: dto.commercialName.trim(),
          professionalEmail: companyEmail, slug: `${slugify(dto.commercialName, { lower: true, strict: true }) || 'company'}-${randomBytes(4).toString('hex')}`, status: 'ACTIVE',
          ...(timezone || currency ? { recruitmentSettings: { timezone: timezone ?? 'Africa/Tunis', currency: currency ?? 'TND' } } : {}),
          members: { create: { userId: owner.id, role: 'COMPANY_ADMIN', isOwner: true, status: 'ACTIVE' } } } });
        await tx.subscription.create({ data: { ownerType: 'COMPANY', companyId: created.id, planId: plan.id, provider: 'platform_admin', status: plan.name === 'TRIAL' ? 'TRIALING' : 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600_000) } });
        await tx.companyInvitation.create({ data: { companyId: created.id, email, role: 'COMPANY_ADMIN', tokenHash: hashToken(resetToken), expiresAt, invitedById: adminId } });
        await tx.passwordResetToken.create({ data: { userId: owner.id, tokenHash: hashToken(resetToken), expiresAt } });
        await tx.companyAccessDelivery.create({ data: { companyId: created.id, userId: owner.id, email,
          companyName: created.commercialName, expiresAt, encryptedBody: sealCredentials(rendered.html, this.config.jwt.refreshSecret) } });
        await tx.auditLog.createMany({ data: [
          { actorId: adminId, action: 'company_created', entityType: 'Company', entityId: created.id, metadata: {} },
          { actorId: adminId, action: 'owner_created', entityType: 'Company', entityId: created.id, metadata: {} },
          { actorId: adminId, action: 'subscription_assigned', entityType: 'Company', entityId: created.id, metadata: {} },
          { actorId: adminId, action: 'invitation_sent', entityType: 'Company', entityId: created.id, metadata: {} },
        ] });
        return created;
      });
      await Promise.all([
        this.audit.log({ actorId: adminId, action: 'admin.company_provisioned', entityType: 'Company', entityId: company.id }),
        this.notifications.create({ userId: adminId, type: 'company.created', title: 'Entreprise créée', message: `Invitation envoyée à ${email}.`, data: { companyId: company.id }, dedupeKey: `company-created:${company.id}` }),
      ]);
      return { company, deliveryStatus: 'PENDING' };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An account or company already exists');
      throw error;
    }
  }

  deliveries() {
    return this.prisma.companyAccessDelivery.findMany({ take: 50, orderBy: { createdAt: 'desc' }, select: {
      id: true, companyId: true, companyName: true, email: true, status: true, attempts: true, deliveredAt: true, expiresAt: true,
    } });
  }

  async resend(adminId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { members: { where: { isOwner: true }, take: 1, include: { user: true } } },
    });
    const owner = company?.members[0]?.user;
    if (!company || !owner) throw new BadRequestException('Company owner not found');
    if (!owner.mustChangePassword) throw new BadRequestException('This account is already activated');
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 3600_000);
    const url = `${this.config.frontendUrl}/activate-company-account?token=${resetToken}`;
    const rendered = emailTemplates.companyOwnerInvitation(url, company.commercialName, owner.name, 'EasyJob', owner.email);
    await this.prisma.$transaction(async tx => {
      await tx.passwordResetToken.updateMany({ where: { userId: owner.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.companyInvitation.updateMany({ where: { companyId, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      await tx.companyInvitation.create({ data: { companyId, email: owner.email, role: 'COMPANY_ADMIN', tokenHash: hashToken(resetToken), expiresAt, invitedById: adminId } });
      await tx.passwordResetToken.create({ data: { userId: owner.id, tokenHash: hashToken(resetToken), expiresAt } });
      await tx.companyAccessDelivery.upsert({ where: { companyId }, create: { companyId, userId: owner.id, email: owner.email, companyName: company.commercialName, expiresAt, encryptedBody: sealCredentials(rendered.html, this.config.jwt.refreshSecret) }, update: { userId: owner.id, email: owner.email, companyName: company.commercialName, expiresAt, encryptedBody: sealCredentials(rendered.html, this.config.jwt.refreshSecret), status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), deliveredAt: null } });
    });
    await Promise.all([
      this.audit.log({ actorId: adminId, action: 'invitation_resent', entityType: 'Company', entityId: companyId }),
      this.notifications.create({ userId: adminId, type: 'company.invitation_resent', title: 'Invitation renvoyée', message: `Nouvelle invitation envoyée à ${owner.email}.`, data: { companyId }, dedupeKey: `company-invitation-resent:${companyId}:${expiresAt.toISOString()}` }),
    ]);
    return { queued: true, expiresAt };
  }

  async retry(id: string) {
    const result = await this.prisma.companyAccessDelivery.updateMany({ where: { id, status: 'FAILED', expiresAt: { gt: new Date() }, encryptedBody: { not: null } },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date() } });
    if (result.count !== 1) throw new BadRequestException('Delivery cannot be retried. For expired credentials, use password recovery.');
    return { queued: true };
  }
}
