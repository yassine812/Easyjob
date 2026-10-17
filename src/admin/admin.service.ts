import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyStatus, JobStatus, PaymentStatus, PlanType, SubscriptionStatus, UserStatus, VerificationStatus, BillingInterval, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginate, resolvePagination } from '../common/utils/pagination';
import { RedisService } from '../redis/redis.service';
import { AgentReachResearchProvider } from '../external-research/agent-reach-research.provider';
import { CONFIG, type AppConfig } from '../config/configuration';
import { Inject } from '@nestjs/common';
import { EXTERNAL_RESEARCH_WORKER_HEALTH_KEY } from '../external-research/external-research-worker-heartbeat.service';
import { StorageService } from '../files/storage.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly externalResearch: AgentReachResearchProvider,
    private readonly storage: StorageService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async listVerifications(query: { page?: number; limit?: number; status?: VerificationStatus }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyVerification.findMany({
        where,
        include: {
          company: { select: { id: true, commercialName: true, legalName: true, slug: true, status: true } },
          documents: { select: { id: true, filename: true, mimeType: true, fileSize: true, createdAt: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.companyVerification.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async getVerification(verificationId: string) {
    const verification = await this.prisma.companyVerification.findUnique({
      where: { id: verificationId },
      include: {
        company: {
          select: {
            id: true,
            commercialName: true,
            legalName: true,
            slug: true,
            status: true,
            registrationIdentifier: true,
            professionalEmail: true,
            city: true,
            country: true,
          },
        },
        documents: { select: { id: true, filename: true, mimeType: true, fileSize: true, createdAt: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!verification) throw new NotFoundException('Verification not found');
    return verification;
  }

  async listCompanies(query: { page?: number; limit?: number; status?: CompanyStatus; search?: string }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { commercialName: { contains: query.search, mode: 'insensitive' as const } },
              { legalName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: { _count: { select: { members: true, jobs: true } }, subscriptions: { where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, plan: { select: { id: true, name: true, type: true, priceCents: true, currency: true, billingInterval: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.company.count({ where }),
    ]);
    const now = Date.now();
    return paginate(items.map((company) => ({ ...company, subscription: company.subscriptions[0] ? { ...company.subscriptions[0], remainingDays: company.subscriptions[0].currentPeriodEnd ? Math.max(0, Math.ceil((company.subscriptions[0].currentPeriodEnd.getTime() - now) / 86400000)) : null } : null })), total, page, limit);
  }

  async listCandidates(query: { page?: number; limit?: number; status?: UserStatus; search?: string }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      candidateProfile: { isNot: null },
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' as const } }, { email: { contains: query.search, mode: 'insensitive' as const } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          candidateProfile: {
            select: {
              subscriptions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  currentPeriodStart: true,
                  currentPeriodEnd: true,
                  canceledAt: true,
                  plan: { select: { id: true, name: true, type: true, priceCents: true, currency: true, billingInterval: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    const now = Date.now();
    return paginate(items.map((user) => {
      const subscription = user.candidateProfile?.subscriptions[0] ?? null;
      return {
        id: user.id, name: user.name, email: user.email, plan: subscription?.plan ?? null,
        subscriptionStatus: subscription?.status ?? null,
        renewalAt: subscription?.currentPeriodEnd ?? null,
        expiresAt: subscription?.currentPeriodEnd ?? null,
        daysRemaining: subscription?.currentPeriodEnd ? Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - now) / 86400000)) : null,
        accountStatus: user.status, createdAt: user.createdAt, lastActivityAt: user.lastLoginAt,
        subscription,
      };
    }), total, page, limit);
  }

  async getCandidate(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, candidateProfile: { isNot: null } },
      select: {
        id: true, name: true, email: true, phone: true, status: true, createdAt: true, lastLoginAt: true,
        candidateProfile: { select: {
          headline: true, bio: true, location: true, yearsExperience: true,
          _count: { select: { applications: true, resumes: true } },
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, provider: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, canceledAt: true, createdAt: true, plan: { select: { id: true, name: true, type: true, priceCents: true, currency: true, billingInterval: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, providerPaymentId: true, amountCents: true, currency: true, status: true, createdAt: true, paidAt: true, invoiceUrl: true } } } },
        } },
      },
    });
    if (!user) throw new NotFoundException('Candidate not found');
    const activity = await this.prisma.auditLog.findFirst({ where: { actorId: userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, action: true } });
    const now = Date.now();
    const subscriptions = (user.candidateProfile?.subscriptions ?? []).map((subscription) => ({ ...subscription, remainingDays: subscription.currentPeriodEnd ? Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - now) / 86400000)) : null, autoRenew: !subscription.canceledAt && subscription.status !== SubscriptionStatus.CANCELED && subscription.status !== SubscriptionStatus.EXPIRED }));
    return { ...user, candidateProfile: user.candidateProfile ? { ...user.candidateProfile, applications: user.candidateProfile._count.applications, resumes: user.candidateProfile._count.resumes } : null, subscriptions, lastActivityAt: activity?.createdAt ?? user.lastLoginAt, activity };
  }

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, legalName: true, commercialName: true, slug: true, website: true,
        industry: true, description: true, address: true, city: true, country: true,
        phone: true, professionalEmail: true, status: true, createdAt: true, updatedAt: true,
        members: { orderBy: { createdAt: 'asc' }, select: { id: true, userId: true, role: true, status: true, isOwner: true, position: true, createdAt: true, user: { select: { name: true, email: true, status: true, lastLoginAt: true } } } },
         subscriptions: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, provider: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, canceledAt: true, createdAt: true, plan: { select: { id: true, name: true, priceCents: true, currency: true, billingInterval: true, features: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, provider: true, providerPaymentId: true, amountCents: true, currency: true, status: true, createdAt: true, paidAt: true, invoiceUrl: true, invoice: { select: { number: true, pdfKey: true, docxKey: true } } } } } },
        jobs: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, title: true, status: true, createdAt: true, _count: { select: { applications: true } } } },
        _count: { select: { members: true, jobs: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    const applications = await this.prisma.application.count({ where: { job: { companyId } } });
    const interviews = await this.prisma.interview.count({ where: { job: { companyId } } });
    const lastActivity = await this.prisma.auditLog.findFirst({
      where: { entityType: 'Company', entityId: companyId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, action: true },
    });
    const now = Date.now();
    const subscriptions = await Promise.all(company.subscriptions.map(async (subscription) => ({ ...subscription, remainingDays: subscription.currentPeriodEnd ? Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - now) / 86400000)) : null, autoRenew: !subscription.canceledAt && subscription.status !== SubscriptionStatus.CANCELED && subscription.status !== SubscriptionStatus.EXPIRED, payments: await Promise.all(subscription.payments.map(async (payment) => ({ ...payment, invoiceUrl: payment.invoice?.pdfKey ? await this.storage.presignedGet(payment.invoice.pdfKey) : payment.invoiceUrl, docxUrl: payment.invoice?.docxKey ? await this.storage.presignedGet(payment.invoice.docxKey) : null, invoiceNumber: payment.invoice?.number ?? null }))) })));
    return { ...company, applications, interviews, lastActivity, subscriptions };
  }

  async updateCompanyStatus(adminId: string, companyId: string, status: CompanyStatus, meta?: { ip?: string; userAgent?: string }) {
    if (!Object.values(CompanyStatus).includes(status)) throw new BadRequestException('Invalid company status');
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, status: true, commercialName: true } });
    if (!company) throw new NotFoundException('Company not found');
    const updated = await this.prisma.company.update({ where: { id: companyId }, data: { status }, select: { id: true, commercialName: true, status: true, updatedAt: true } });
    await this.audit.log({ actorId: adminId, action: status === 'SUSPENDED' ? 'admin.company_suspended' : 'admin.company_status_changed', entityType: 'Company', entityId: companyId, metadata: { from: company.status, to: status }, ipAddress: meta?.ip, userAgent: meta?.userAgent });
    return updated;
  }

  async platformDashboard() {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousSince = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const commercialSubscriptionWhere = {
      ownerType: PlanType.COMPANY,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      provider: { notIn: ['seed', 'dev', 'dev-seed', 'test', 'platform_admin'] },
      plan: { priceCents: { gt: 0 }, name: { notIn: ['TEST', 'DEMO'] } },
    };
    const visibleSubscriptionWhere = {
      ownerType: PlanType.COMPANY,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      provider: { notIn: ['seed', 'dev', 'dev-seed', 'test', 'platform_admin'] },
      plan: { name: { notIn: ['TEST', 'DEMO'] } },
    };
    const [
      companies, newCompanies, previousNewCompanies, users, candidates, activeJobs,
      paidSubscriptions, visibleSubscriptions, pendingCompanies, tickets, failedPayments,
      failedJobs, payments, recentCompanies, recentActivity,
    ] = await Promise.all([
      this.prisma.company.count({ where: { status: 'ACTIVE' } }),
      this.prisma.company.count({ where: { createdAt: { gte: since } } }),
      this.prisma.company.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', candidateProfile: { isNot: null } } }),
      this.prisma.job.count({ where: { status: { in: ['PUBLISHED', 'APPROVED'] } } }),
      this.prisma.subscription.findMany({ where: commercialSubscriptionWhere, select: { plan: { select: { priceCents: true, currency: true, billingInterval: true, name: true } } } }),
      this.prisma.subscription.findMany({ where: visibleSubscriptionWhere, select: { plan: { select: { name: true } } } }),
      this.prisma.company.count({ where: { status: 'PENDING_VERIFICATION' } }),
      this.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'WAITING_USER'] } } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.FAILED, subscription: commercialSubscriptionWhere } }),
      this.prisma.jobSourceSyncRun.count({ where: { status: 'FAILED', startedAt: { gte: since } } }),
      this.prisma.payment.findMany({ where: { status: PaymentStatus.SUCCEEDED, subscription: commercialSubscriptionWhere }, select: { amountCents: true, currency: true, createdAt: true } }),
      this.prisma.company.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, commercialName: true, status: true, createdAt: true, _count: { select: { members: true, jobs: true } }, subscriptions: { where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } }, take: 1, select: { plan: { select: { name: true } } } } } }),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, actor: { select: { name: true } } } }),
    ]);
    const mrrByCurrency = new Map<string, number>();
    for (const sub of paidSubscriptions) {
      const monthly = sub.plan.billingInterval === 'YEARLY' ? Math.round(sub.plan.priceCents / 12) : sub.plan.priceCents;
      mrrByCurrency.set(sub.plan.currency, (mrrByCurrency.get(sub.plan.currency) ?? 0) + monthly);
    }
    const revenueByCurrency = new Map<string, number>();
    for (const payment of payments) revenueByCurrency.set(payment.currency, (revenueByCurrency.get(payment.currency) ?? 0) + payment.amountCents);
    const planCounts = new Map<string, number>();
    for (const sub of visibleSubscriptions) planCounts.set(sub.plan.name, (planCounts.get(sub.plan.name) ?? 0) + 1);
    const totalVisibleSubscriptions = visibleSubscriptions.length || 1;
    const candidateSubscriptions = await this.prisma.subscription.findMany({ where: { ownerType: PlanType.CANDIDATE, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] }, provider: { notIn: ['seed', 'dev', 'dev-seed', 'test', 'platform_admin'] }, plan: { name: { notIn: ['TEST', 'DEMO'] } } }, select: { plan: { select: { name: true } } } });
    const candidatePlanCounts = new Map<string, number>();
    for (const sub of candidateSubscriptions) candidatePlanCounts.set(sub.plan.name, (candidatePlanCounts.get(sub.plan.name) ?? 0) + 1);
    const growth = [
      { period: '30 jours', companies: await this.prisma.company.count({ where: { createdAt: { gte: since } } }), candidates: await this.prisma.candidateProfile.count({ where: { createdAt: { gte: since } } }), jobs: await this.prisma.job.count({ where: { createdAt: { gte: since } } }) },
      { period: '90 jours', companies: await this.prisma.company.count({ where: { createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } } }), candidates: await this.prisma.candidateProfile.count({ where: { createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } } }), jobs: await this.prisma.job.count({ where: { createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } } }) },
    ];
    const urgentTickets = await this.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'WAITING_USER'] }, priority: 'URGENT' } });
    const expiryWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringUnder7Days = await this.prisma.subscription.count({ where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] }, currentPeriodEnd: { gt: now, lte: expiryWindow }, provider: { notIn: ['seed', 'dev', 'dev-seed', 'test', 'platform_admin'] }, plan: { name: { notIn: ['TEST', 'DEMO'] } } } });
    const expiringUnder30Days = await this.prisma.subscription.count({ where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] }, currentPeriodEnd: { gt: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }, provider: { notIn: ['seed', 'dev', 'dev-seed', 'test', 'platform_admin'] }, plan: { name: { notIn: ['TEST', 'DEMO'] } } } });
    return {
      metrics: { activeCompanies: companies, newCompanies, previousNewCompanies, activeUsers: users, activeCandidates: candidates, activeJobs, paidSubscriptions: paidSubscriptions.length, openTickets: tickets, pendingCompanies, failedPayments, failedJobs, expiringUnder7Days, expiringUnder30Days },
      financial: payments.length || paidSubscriptions.length ? { available: true, mrrByCurrencyCents: Object.fromEntries(mrrByCurrency), periodRevenueByCurrencyCents: Object.fromEntries(revenueByCurrency), mode: 'live' } : { available: false, message: 'Paiement non configuré' },
      actionCenter: { failedPayments, pendingCompanies, urgentTickets, failedJobs, expiringUnder7Days },
      growth,
      planDistribution: Array.from(planCounts.entries()).map(([name, count]) => ({ name, count, percentage: Math.round((count / totalVisibleSubscriptions) * 100) })),
      candidatePlanDistribution: Array.from(candidatePlanCounts.entries()).map(([name, count]) => ({ name, count, percentage: Math.round((count / (candidateSubscriptions.length || 1)) * 100) })),
      recentCompanies: recentCompanies.map((company) => ({ id: company.id, commercialName: company.commercialName, status: company.status, createdAt: company.createdAt, members: company._count.members, jobs: company._count.jobs, plan: company.subscriptions[0]?.plan?.name ?? null })),
      recentActivity: recentActivity.map((entry) => ({ id: entry.id, action: entry.action, entityType: entry.entityType, entityId: entry.entityId, createdAt: entry.createdAt, actorName: entry.actor?.name ?? null })),
    };
  }

  async listInvoices(query: { page?: number; limit?: number }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, select: { id: true, provider: true, providerPaymentId: true, amountCents: true, currency: true, status: true, invoiceUrl: true, createdAt: true, paidAt: true, invoice: { select: { number: true, status: true, pdfKey: true, docxKey: true } }, subscription: { select: { ownerType: true, company: { select: { id: true, commercialName: true } }, candidate: { select: { user: { select: { name: true, email: true } } } }, plan: { select: { name: true } } } } } }),
      this.prisma.payment.count({ where }),
    ]);
    const withLinks = await Promise.all(items.map(async (item) => ({ ...item, invoice: item.invoice ? { number: item.invoice.number, status: item.invoice.status, pdfUrl: item.invoice.pdfKey ? await this.storage.presignedGet(item.invoice.pdfKey) : null, docxUrl: item.invoice.docxKey ? await this.storage.presignedGet(item.invoice.docxKey) : null } : null })));
    return paginate(withLinks, total, page, limit);
  }

  async listPlans(type?: PlanType) {
    return this.prisma.plan.findMany({ where: type ? { type } : {}, orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }], select: { id: true, name: true, type: true, priceCents: true, priceTndCents: true, currency: true, billingInterval: true, active: true, features: true, sortOrder: true, createdAt: true, updatedAt: true, _count: { select: { subscriptions: true } } } });
  }

  async updatePlan(adminId: string, planId: string, active: boolean, meta?: { ip?: string; userAgent?: string }) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId }, select: { id: true, active: true, name: true } });
    if (!plan) throw new NotFoundException('Plan not found');
    const updated = await this.prisma.plan.update({ where: { id: planId }, data: { active }, select: { id: true, name: true, active: true, updatedAt: true } });
    await this.audit.log({ actorId: adminId, action: active ? 'admin.plan_activated' : 'admin.plan_deactivated', entityType: 'Plan', entityId: planId, metadata: { from: plan.active, to: active, existingSubscriptionsUnaffected: true }, ipAddress: meta?.ip, userAgent: meta?.userAgent });
    return updated;
  }

  async createPlan(adminId: string, input: { type: PlanType; name: string; priceCents: number; currency?: string; billingInterval: BillingInterval; features?: Record<string, unknown> }, meta?: { ip?: string; userAgent?: string }) {
    if (!input.name.trim() || input.priceCents < 0) throw new BadRequestException('Invalid plan');
    const plan = await this.prisma.plan.create({ data: { type: input.type, name: input.name.trim(), priceCents: input.priceCents, priceTndCents: input.currency?.toUpperCase() === 'TND' ? input.priceCents : null, currency: (input.currency ?? 'TND').toUpperCase(), billingInterval: input.billingInterval, features: (input.features ?? {}) as Prisma.InputJsonValue } });
    await this.audit.log({ actorId: adminId, action: 'admin.plan_created', entityType: 'Plan', entityId: plan.id, metadata: { type: plan.type, name: plan.name }, ipAddress: meta?.ip, userAgent: meta?.userAgent });
    return plan;
  }

  async listNotifications(query: { page?: number; limit?: number; type?: string; unreadOnly?: boolean }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = { ...(query.type ? { type: query.type } : {}), ...(query.unreadOnly ? { readAt: null } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: { user: { select: { id: true, name: true, email: true } } } }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async extendSubscription(adminId: string, subscriptionId: string, days: number, reason: string, meta?: { ip?: string; userAgent?: string }) {
    if (!Number.isInteger(days) || days < 1 || days > 3650 || !reason.trim()) throw new BadRequestException('A valid duration and reason are required');
    const subscription = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, select: { id: true, status: true, currentPeriodEnd: true } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const base = subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date() ? subscription.currentPeriodEnd : new Date();
    const currentPeriodEnd = new Date(base.getTime() + days * 86400000);
    const updated = await this.prisma.subscription.update({ where: { id: subscriptionId }, data: { currentPeriodEnd, status: subscription.status === SubscriptionStatus.EXPIRED ? SubscriptionStatus.ACTIVE : subscription.status }, select: { id: true, status: true, currentPeriodEnd: true } });
    await this.audit.log({ actorId: adminId, action: 'admin.subscription_extended', entityType: 'Subscription', entityId: subscriptionId, metadata: { days, reason, from: subscription.currentPeriodEnd, to: currentPeriodEnd }, ipAddress: meta?.ip, userAgent: meta?.userAgent });
    return updated;
  }

  async updateSubscription(adminId: string, subscriptionId: string, input: { planId?: string; action?: 'cancel' | 'reactivate' }, meta?: { ip?: string; userAgent?: string }) {
    if (!input.planId && !input.action) throw new BadRequestException('A plan or subscription action is required');
    const subscription = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: { select: { id: true, type: true, name: true } } } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const data: Prisma.SubscriptionUpdateInput = {};
    if (input.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: input.planId }, select: { id: true, type: true, name: true, active: true } });
      if (!plan || !plan.active || plan.type !== subscription.ownerType) throw new BadRequestException('The selected plan is not valid for this subscription');
      data.plan = { connect: { id: plan.id } };
    }
    if (input.action === 'cancel') data.canceledAt = new Date();
    if (input.action === 'reactivate') {
      data.canceledAt = null;
      if (subscription.status === SubscriptionStatus.CANCELED || subscription.status === SubscriptionStatus.EXPIRED) data.status = SubscriptionStatus.ACTIVE;
    }
    const updated = await this.prisma.subscription.update({ where: { id: subscriptionId }, data, include: { plan: { select: { id: true, name: true, type: true, priceCents: true, currency: true, billingInterval: true } } } });
    await this.audit.log({ actorId: adminId, action: 'admin.subscription_updated', entityType: 'Subscription', entityId: subscriptionId, metadata: { planId: input.planId, action: input.action, previousPlanId: subscription.planId }, ipAddress: meta?.ip, userAgent: meta?.userAgent });
    return updated;
  }

  async systemHealth() {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down');
    const connection = this.redis.getConnection();
    const redis = connection ? await connection.ping().then(() => 'up').catch(() => 'down') : 'down';
    const enabled = this.config.externalResearch?.enabled === true && this.config.externalResearch.agentReachEnabled === true;
    if (!enabled) return { status: database === 'up' && redis === 'up' ? 'healthy' : 'degraded', services: { database, redis, external_research: { status: 'disabled', worker: 'disabled', agent_reach: 'disabled' } } };
    const [doctor, heartbeat] = await Promise.all([
      this.externalResearch.doctor().catch(() => ({ ok: false, detail: 'doctor failed' })),
      this.redis.getJson<{ status?: string; updatedAt?: string }>(EXTERNAL_RESEARCH_WORKER_HEALTH_KEY),
    ]);
    const workerUp = Boolean(heartbeat?.status === 'up' && heartbeat.updatedAt && Date.now() - Date.parse(heartbeat.updatedAt) < 30_000);
    const external = { status: workerUp && doctor.ok ? 'healthy' : 'degraded', worker: workerUp ? 'up' : 'down', agent_reach: doctor.ok ? 'up' : 'down' };
    return { status: database === 'up' && redis === 'up' && external.status === 'healthy' ? 'healthy' : 'degraded', services: { database, redis, external_research: external } };
  }

  async listJobs(query: { page?: number; limit?: number; status?: JobStatus; search?: string }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { company: { commercialName: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: {
          company: { select: { id: true, commercialName: true, slug: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async listSubscriptions(query: { page?: number; limit?: number; ownerType?: PlanType; status?: SubscriptionStatus; expiring?: string }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const now = new Date();
    const days = query.expiring === '7' ? 7 : query.expiring === '30' ? 30 : null;
    const where = { ...(query.ownerType ? { ownerType: query.ownerType } : {}), ...(query.status ? { status: query.status } : {}), ...(days ? { currentPeriodEnd: { gt: now, lte: new Date(now.getTime() + days * 86400000) } } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        include: {
          plan: { select: { id: true, name: true, type: true, priceCents: true, currency: true } },
          candidate: { select: { id: true, user: { select: { name: true, email: true } } } },
          company: { select: { id: true, commercialName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.subscription.count({ where }),
    ]);
    const nowMs = Date.now();
    return paginate(items.map((subscription) => ({ ...subscription, remainingDays: subscription.currentPeriodEnd ? Math.ceil((subscription.currentPeriodEnd.getTime() - nowMs) / 86400000) : null, autoRenew: !subscription.canceledAt && subscription.status !== SubscriptionStatus.EXPIRED && subscription.status !== SubscriptionStatus.CANCELED })), total, page, limit);
  }

  async listAuditLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    actorId?: string;
  }) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }
}
