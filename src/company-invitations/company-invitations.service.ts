import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { emailTemplates } from '../queues/email/templates';
import { EntitlementService } from '../entitlements/entitlement.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { addDays } from '../common/utils/dates';
import { generateToken, hashToken } from '../common/utils/tokens';
import type { RequestMeta } from '../companies/companies.service';

@Injectable()
export class CompanyInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
    private readonly entitlements: EntitlementService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async invite(actorUserId: string, companyId: string, dto: { email: string; role: MemberRole }, meta: RequestMeta) {
    await this.access.assertPermission(actorUserId, companyId, 'team.invite');
    const company = await this.access.getCompanyOrThrow(companyId);
    const email = dto.email.trim().toLowerCase();

    // Enforce the company plan's team size limit.
    await this.entitlements.assertCompanyLimit(companyId, 'team.members');

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: existingUser.id } },
      });
      if (alreadyMember) {
        throw new BadRequestException('This user is already a member of the company');
      }
    }

    const pending = await this.prisma.companyInvitation.findFirst({
      where: { companyId, email, status: 'PENDING' },
    });
    if (pending) {
      throw new BadRequestException('An invitation is already pending for this email');
    }

    const rawToken = generateToken();
    const invitation = await this.prisma.companyInvitation.create({
      data: {
        companyId,
        email,
        role: dto.role,
        tokenHash: hashToken(rawToken),
        expiresAt: addDays(new Date(), 7),
        invitedById: actorUserId,
        status: 'PENDING',
      },
    });

    const url = `${this.config.frontendUrl}/invitations/accept?token=${rawToken}`;
    const rendered = emailTemplates.companyInvitation(url, company.commercialName, dto.role);
    await this.emailService.enqueue({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      dedupeKey: `invitation:${invitation.id}`,
    });

    await this.audit.log({
      actorId: actorUserId,
      action: 'team.invitation_sent',
      entityType: 'CompanyInvitation',
      entityId: invitation.id,
      metadata: { companyId, email, role: dto.role },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    // In dev/test the frontend may not send emails — expose the acceptance URL
    // only when the email provider is console (never in production).
    const devUrl = this.config.email.provider === 'console' ? url : undefined;

    return {
      id: invitation.id,
      email,
      role: dto.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      ...(devUrl ? { invitationUrl: devUrl } : {}),
    };
  }

  async list(actorUserId: string, companyId: string) {
    await this.access.assertPermission(actorUserId, companyId, 'team.invite');
    return this.prisma.companyInvitation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(actorUserId: string, companyId: string, invitationId: string, meta: RequestMeta) {
    await this.access.assertPermission(actorUserId, companyId, 'team.manage');
    const invitation = await this.prisma.companyInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.companyId !== companyId) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.companyInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });
    await this.audit.log({
      actorId: actorUserId,
      action: 'team.invitation_revoked',
      entityType: 'CompanyInvitation',
      entityId: invitationId,
      metadata: { companyId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { success: true };
  }

  /**
   * Accepts an invitation for the authenticated user. The user's email must
   * match the invited email; the token is single-use and expires.
   */
  async accept(userId: string, rawToken: string, meta: RequestMeta) {
    const invitation = await this.prisma.companyInvitation.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { company: true },
    });
    if (!invitation || invitation.status !== 'PENDING') {
      throw new BadRequestException('Invalid or already-used invitation token');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.companyInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('Invitation has expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException('This invitation was issued for a different email address');
    }

    await this.prisma.$transaction([
      this.prisma.companyInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date(), acceptedByUserId: userId },
      }),
      this.prisma.companyMember.upsert({
        where: { companyId_userId: { companyId: invitation.companyId, userId } },
        create: { companyId: invitation.companyId, userId, role: invitation.role, status: 'ACTIVE' },
        update: { role: invitation.role, status: 'ACTIVE' },
      }),
    ]);

    // Grant the tenant role at the platform level too (used by tenant-scoped guards).
    await this.ensurePlatformRole(userId, invitation.role);

    await this.audit.log({
      actorId: userId,
      action: 'team.invitation_accepted',
      entityType: 'CompanyInvitation',
      entityId: invitation.id,
      metadata: { companyId: invitation.companyId, role: invitation.role },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.notifications.create({
      userId,
      type: 'team.invitation_accepted',
      title: `Welcome to ${invitation.company.commercialName}`,
      message: `You joined ${invitation.company.commercialName} as ${invitation.role}.`,
      data: { companyId: invitation.companyId },
    });

    return {
      success: true,
      companyId: invitation.companyId,
      companyName: invitation.company.commercialName,
      role: invitation.role,
    };
  }

  private async ensurePlatformRole(userId: string, role: MemberRole): Promise<void> {
    const roleName = role as string;
    const roleRow = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!roleRow) return;
    const exists = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: roleRow.id } },
    });
    if (!exists) {
      await this.prisma.userRole.create({ data: { userId, roleId: roleRow.id } });
    }
  }
}
