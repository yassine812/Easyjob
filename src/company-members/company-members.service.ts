import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole, MemberStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestMeta } from '../companies/companies.service';

@Injectable()
export class CompanyMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CompanyAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async changeRole(
    actorUserId: string,
    companyId: string,
    memberId: string,
    newRole: MemberRole,
    meta: RequestMeta,
  ) {
    await this.access.assertPermission(actorUserId, companyId, 'team.manage');

    const member = await this.prisma.companyMember.findUnique({ where: { id: memberId } });
    if (!member || member.companyId !== companyId) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === MemberRole.COMPANY_ADMIN && newRole !== MemberRole.COMPANY_ADMIN) {
      if (member.isOwner) throw new BadRequestException('The company owner cannot be demoted');
      const adminCount = await this.prisma.companyMember.count({
        where: { companyId, role: MemberRole.COMPANY_ADMIN, status: 'ACTIVE' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('A company must keep at least one admin');
      }
    }

    const updated = await this.prisma.companyMember.update({
      where: { id: memberId },
      data: { role: newRole },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.log({
      actorId: actorUserId,
      action: 'team.role_changed',
      entityType: 'CompanyMember',
      entityId: memberId,
      metadata: { companyId, from: member.role, to: newRole },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.notifications.create({
      userId: updated.userId,
      type: 'team.role_changed',
      title: 'Your role changed',
      message: `Your role was updated to ${newRole}.`,
      data: { companyId },
    });

    return {
      id: updated.id,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      status: updated.status,
    };
  }

  async removeMember(actorUserId: string, companyId: string, memberId: string, meta: RequestMeta) {
    await this.access.assertPermission(actorUserId, companyId, 'team.manage');

    const member = await this.prisma.companyMember.findUnique({ where: { id: memberId } });
    if (!member || member.companyId !== companyId) {
      throw new NotFoundException('Member not found');
    }
    if (member.userId === actorUserId) {
      throw new BadRequestException('You cannot remove yourself; ask another admin');
    }
    if (member.isOwner) throw new BadRequestException('The company owner cannot be removed');
    if (member.role === MemberRole.COMPANY_ADMIN) {
      const adminCount = await this.prisma.companyMember.count({
        where: { companyId, role: MemberRole.COMPANY_ADMIN, status: 'ACTIVE' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('A company must keep at least one admin');
      }
    }

    await this.prisma.companyMember.update({
      where: { id: memberId },
      data: { status: MemberStatus.INACTIVE },
    });

    await this.audit.log({
      actorId: actorUserId,
      action: 'team.member_removed',
      entityType: 'CompanyMember',
      entityId: memberId,
      metadata: { companyId, removedUserId: member.userId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { success: true };
  }

  async listByUser(userId: string): Promise<Prisma.CompanyMemberGetPayload<object>[]> {
    return this.prisma.companyMember.findMany({ where: { userId } });
  }
}
