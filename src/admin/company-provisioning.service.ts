import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { AuditService } from '../audit/audit.service';
import { sealCredentials } from '../queues/email/credential-envelope';
import { ProvisionCompanyDto } from './provision-company.dto';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

@Injectable()
export class CompanyProvisioningService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig) {}

  async create(adminId: string, dto: ProvisionCompanyDto) {
    const email = dto.ownerEmail.trim().toLowerCase();
    if (!dto.ownerName.trim() || !dto.commercialName.trim() || !dto.legalName.trim()) throw new BadRequestException('Names cannot be blank');
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('This email already has an account. Use a separate professional email.');
    const password = `Ej9!${randomBytes(18).toString('base64url')}`;
    const passwordHash = await bcrypt.hash(password, this.config.bcryptRounds);
    const expiresAt = new Date(Date.now() + 24 * 3600_000);
    const url = `${this.config.frontendUrl}/login`;
    const html = `<h1>Votre espace EasyJob est prêt</h1><p>Bonjour ${escapeHtml(dto.ownerName)},</p><p>L’administrateur a créé votre espace ${escapeHtml(dto.commercialName)}.</p><p>Identifiant : ${escapeHtml(email)}<br>Mot de passe temporaire : <strong>${escapeHtml(password)}</strong></p><p><a href="${escapeHtml(url)}">Se connecter à EasyJob</a></p><p>Choisissez votre propre mot de passe à la première connexion. Cet accès temporaire expire dans 24 heures. Ensuite, utilisez « Mot de passe oublié ».</p>`;
    try {
      const company = await this.prisma.$transaction(async tx => {
        const role = await tx.role.findUniqueOrThrow({ where: { name: 'COMPANY_ADMIN' } });
        const owner = await tx.user.create({ data: { name: dto.ownerName.trim(), email, passwordHash,
          mustChangePassword: true, temporaryPasswordExpiresAt: expiresAt, emailVerifiedAt: new Date(),
          roles: { create: { roleId: role.id } } } });
        const { ownerName: _name, ownerEmail: _email, ...fields } = dto;
        const created = await tx.company.create({ data: { ...fields, legalName: dto.legalName.trim(), commercialName: dto.commercialName.trim(),
          professionalEmail: email, slug: `${slugify(dto.commercialName, { lower: true, strict: true }) || 'company'}-${randomBytes(4).toString('hex')}`, status: 'ACTIVE',
          members: { create: { userId: owner.id, role: 'COMPANY_ADMIN', isOwner: true, status: 'ACTIVE' } },
          verification: { create: { status: 'VERIFIED', reviewedById: adminId, reviewedAt: new Date(), notes: 'Provisioned by platform administrator' } } } });
        await tx.companyAccessDelivery.create({ data: { companyId: created.id, userId: owner.id, email,
          companyName: created.commercialName, expiresAt, encryptedBody: sealCredentials(html, this.config.jwt.refreshSecret) } });
        return created;
      });
      await this.audit.log({ actorId: adminId, action: 'admin.company_provisioned', entityType: 'Company', entityId: company.id });
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

  async retry(id: string) {
    const result = await this.prisma.companyAccessDelivery.updateMany({ where: { id, status: 'FAILED', expiresAt: { gt: new Date() }, encryptedBody: { not: null } },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date() } });
    if (result.count !== 1) throw new BadRequestException('Delivery cannot be retried. For expired credentials, use password recovery.');
    return { queued: true };
  }
}
