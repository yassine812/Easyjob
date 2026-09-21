import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type Entitlements = Record<string, string | number | boolean>;

export interface OwnerRef {
  ownerType: PlanType;
  ownerId: string;
}

/**
 * Central entitlement engine. Features are driven by plan entitlements
 * (JSON `features` on Plan); business logic must never branch on plan names.
 * Typical keys:
 *   company: team.members, activeJobs, ai.enabled, automation.enabled,
 *            assessments.enabled, analytics.enabled
 *   candidate: cv.uploads, ai.cv_analyze, ai.cv_generate, ai.match,
 *              ai.cover_letter, ai.interview
 */
@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the active plan (TRIALING/ACTIVE) or the default free plan. */
  async getActivePlan(owner: OwnerRef): Promise<{ planId: string; name: string; features: Entitlements }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        ownerType: owner.ownerType,
        ...(owner.ownerType === 'CANDIDATE' ? { candidateId: owner.ownerId } : { companyId: owner.ownerId }),
        status: { in: ['TRIALING', 'ACTIVE'] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (subscription) {
      return {
        planId: subscription.planId,
        name: subscription.plan.name,
        features: (subscription.plan.features as Entitlements) ?? {},
      };
    }

    const freePlan = await this.prisma.plan.findFirst({
      where: { type: owner.ownerType, active: true, priceCents: 0 },
      orderBy: { sortOrder: 'asc' },
    });
    if (!freePlan) {
      throw new NotFoundException(`No default plan for owner type ${owner.ownerType}`);
    }
    return {
      planId: freePlan.id,
      name: freePlan.name,
      features: (freePlan.features as Entitlements) ?? {},
    };
  }

  async can(owner: OwnerRef, feature: string): Promise<boolean> {
    const { features } = await this.getActivePlan(owner);
    return features[feature] === true;
  }

  async assertCan(owner: OwnerRef, feature: string): Promise<void> {
    const allowed = await this.can(owner, feature);
    if (!allowed) {
      throw new ForbiddenException(`Your current plan does not include "${feature}"`);
    }
  }

  async limit(owner: OwnerRef, key: string): Promise<number> {
    const { features } = await this.getActivePlan(owner);
    const value = features[key];
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Enforces a numeric limit on a company-scoped collection (e.g. team.members,
   * activeJobs). `countFn` returns the current usage.
   */
  async assertCompanyLimit(companyId: string, key: string, countFn?: () => Promise<number>): Promise<void> {
    const limit = await this.limit({ ownerType: 'COMPANY', ownerId: companyId }, key);
    const usage = countFn ? await countFn() : await this.defaultUsage(companyId, key);
    if (usage >= limit) {
      const message = key === 'activeJobs'
        ? `You've reached your ${limit} active job limit. Upgrade your plan to publish more jobs.`
        : key === 'team.members'
          ? `You've reached your ${limit} team member limit. Upgrade your plan to add more members.`
          : `Company plan limit reached for "${key}" (${usage}/${limit}). Upgrade your plan to increase this limit.`;
      throw new ForbiddenException(
        message,
      );
    }
  }

  /** Enforce the monthly AI recruitment quota configured on the company plan. */
  async assertCompanyAiQuota(companyId: string): Promise<void> {
    const limit = await this.limit({ ownerType: 'COMPANY', ownerId: companyId }, 'ai.analyses.monthly');
    if (limit <= 0) {
      throw new ForbiddenException('AI recruitment assistance is not included in your current plan. Upgrade to enable it.');
    }
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const usage = await this.prisma.aiAnalysis.count({
      where: { createdAt: { gte: start }, inputReference: { path: ['companyId'], equals: companyId } },
    });
    if (usage >= limit) {
      throw new ForbiddenException(`You have reached your monthly AI analysis limit (${usage}/${limit}). Upgrade your plan for more analyses.`);
    }
  }

  async assertCandidateLimit(candidateId: string, key: string, countFn?: () => Promise<number>): Promise<void> {
    const limit = await this.limit({ ownerType: 'CANDIDATE', ownerId: candidateId }, key);
    const usage = countFn
      ? await countFn()
      : await this.prisma.resume.count({ where: { candidateId } });
    if (usage >= limit) {
      throw new ForbiddenException(
        `Candidate plan limit reached for "${key}" (${usage}/${limit}). Upgrade to Candidate Pro.`,
      );
    }
  }

  private async defaultUsage(companyId: string, key: string): Promise<number> {
    if (key === 'team.members') {
      // Team size = active members + pending invitations (invitations reserve a seat).
      const [members, pendingInvites] = await this.prisma.$transaction([
        this.prisma.companyMember.count({ where: { companyId, status: 'ACTIVE' } }),
        this.prisma.companyInvitation.count({ where: { companyId, status: 'PENDING' } }),
      ]);
      return members + pendingInvites;
    }
    if (key === 'activeJobs') {
      return this.prisma.job.count({
        where: { companyId, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED'] } },
      });
    }
    return 0;
  }
}

export type { Prisma };
