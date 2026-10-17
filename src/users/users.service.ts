import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginate, resolvePagination } from '../common/utils/pagination';
import { toJson } from '../common/utils/json';
import { Inject } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';
import type { RequestMeta } from '../companies/companies.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async updateMe(userId: string, dto: { name?: string; phone?: string; password?: string }, meta: RequestMeta) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.password !== undefined) {
      throw new BadRequestException('Use /auth/change-password with your current password');
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: data as never,
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
    });
    await this.audit.log({
      actorId: userId,
      action: 'user.updated',
      entityType: 'User',
      entityId: userId,
      metadata: { fields: Object.keys(data) },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return user;
  }

  // ---------------- admin ----------------

  async adminList(query: { page?: number; limit?: number; search?: string; status?: UserStatus }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { include: { role: true } },
          candidateProfile: { select: { subscriptions: { where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, currentPeriodStart: true, currentPeriodEnd: true, plan: { select: { name: true, type: true } } } } } },
          companyMemberships: { where: { status: 'ACTIVE' }, take: 1, select: { company: { select: { commercialName: true, subscriptions: { where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, currentPeriodStart: true, currentPeriodEnd: true, plan: { select: { name: true, type: true } } } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    const now = Date.now();
    return paginate(items.map((user) => {
      const subscription = user.candidateProfile?.subscriptions[0] ?? user.companyMemberships[0]?.company.subscriptions[0] ?? null;
      return { ...user, subscription: subscription ? { ...subscription, remainingDays: subscription.currentPeriodEnd ? Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - now) / 86400000)) : null, organization: user.companyMemberships[0]?.company.commercialName ?? null } : null };
    }), total, page, limit);
  }

  async adminGet(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { include: { role: true } },
        candidateProfile: { select: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, canceledAt: true, provider: true, plan: { select: { id: true, name: true, type: true, priceCents: true, currency: true, billingInterval: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, providerPaymentId: true, amountCents: true, currency: true, status: true, createdAt: true, paidAt: true, invoiceUrl: true } } } } } },
        companyMemberships: {
          include: { company: { select: { id: true, commercialName: true, status: true, subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, canceledAt: true, provider: true, plan: { select: { id: true, name: true, type: true, priceCents: true, currency: true, billingInterval: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, providerPaymentId: true, amountCents: true, currency: true, status: true, createdAt: true, paidAt: true, invoiceUrl: true } } } } } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const candidateSubscription = user.candidateProfile?.subscriptions[0] ?? null;
    const companySubscription = user.companyMemberships[0]?.company.subscriptions[0] ?? null;
    const subscription = candidateSubscription ?? companySubscription;
    return { ...user, candidateProfile: undefined, subscription: subscription ? { ...subscription, remainingDays: subscription.currentPeriodEnd ? Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / 86400000)) : null, organization: user.companyMemberships[0]?.company.commercialName ?? null, source: candidateSubscription ? 'CANDIDATE' : 'COMPANY' } : null };
  }

  async adminUpdate(adminId: string, userId: string, dto: { status?: UserStatus; email?: string }, meta: RequestMeta) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (adminId === userId && dto.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('You cannot suspend your own account');
    }
    const data: Record<string, unknown> = {};
    if (dto.status) data.status = dto.status;
    if (dto.email) {
      const email = dto.email.toLowerCase();
      const clash = await this.prisma.user.findUnique({ where: { email } });
      if (clash && clash.id !== userId) {
        throw new BadRequestException('Email is already in use');
      }
      data.email = email;
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: data as never,
      select: { id: true, name: true, email: true, status: true },
    });
    await this.audit.log({
      actorId: adminId,
      action: 'admin.user_updated',
      entityType: 'User',
      entityId: userId,
      metadata: toJson({ changes: data }),
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  async adminAssignRoles(adminId: string, userId: string, roleNames: string[], meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const roles = await this.prisma.role.findMany({ where: { name: { in: roleNames } } });
    const found = new Set(roles.map((r) => r.name));
    const missing = roleNames.filter((r) => !found.has(r));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown roles: ${missing.join(', ')}`);
    }
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      ...roles.map((role) =>
        this.prisma.userRole.create({ data: { userId, roleId: role.id } }),
      ),
    ]);
    await this.audit.log({
      actorId: adminId,
      action: 'admin.roles_assigned',
      entityType: 'User',
      entityId: userId,
      metadata: { roles: roleNames },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { roles: roleNames };
  }
}
