import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { QUEUES } from '../common/constants/queues';
import { redisKeys } from '../common/constants/redis-keys';

const COMPANY_CACHE_TTL = 5 * 60; // 5 minutes
const PLATFORM_CACHE_TTL = 60;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUES.ANALYTICS) private readonly queue: Queue,
  ) {}

  async companyMetrics(companyId: string) {
    return this.redis.cache(redisKeys.analyticsCompany(companyId), COMPANY_CACHE_TTL, () =>
      this.computeCompanyMetrics(companyId),
    );
  }

  async scopedCompanyMetrics(companyId: string, scope: Prisma.JobWhereInput) {
    return this.computeCompanyMetrics(companyId, scope);
  }

  async platformMetrics() {
    return this.redis.cache(redisKeys.analyticsPlatform(), PLATFORM_CACHE_TTL, () =>
      this.computePlatformMetrics(),
    );
  }

  @OnEvent('analytics.invalidate.company')
  async onInvalidateCompany(payload: { companyId: string }): Promise<void> {
    await this.redis.del(redisKeys.analyticsCompany(payload.companyId));
    await this.queue.add('invalidate', { companyId: payload.companyId }, { attempts: 3 });
  }

  async invalidateCompany(companyId: string): Promise<void> {
    await this.redis.del(redisKeys.analyticsCompany(companyId));
  }

  private async computeCompanyMetrics(companyId: string, scope: Prisma.JobWhereInput = { companyId }) {
    const [activeJobs, totalJobs, totalApplications, hiredCount, interviews] = await Promise.all([
      this.prisma.job.count({ where: { AND: [scope, { status: 'PUBLISHED' }] } }),
      this.prisma.job.count({ where: scope }),
      this.prisma.application.count({ where: { job: scope } }),
      this.prisma.application.count({ where: { job: scope, status: 'HIRED' } }),
      this.prisma.interview.count({
        where: { job: scope, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      }),
    ]);

    const byStatus = await this.prisma.application.groupBy({
      by: ['status'],
      where: { job: scope },
      _count: { _all: true },
    });
    const statusCounts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));

    const appliedCount = statusCounts[ApplicationStatus.APPLIED] ?? 0;
    const screening = statusCounts[ApplicationStatus.SCREENING] ?? 0;
    const shortlisted = statusCounts[ApplicationStatus.SHORTLISTED] ?? 0;
    const interviewsCount = statusCounts[ApplicationStatus.INTERVIEW] ?? 0;
    const offers = statusCounts[ApplicationStatus.OFFER] ?? 0;
    const rejected = statusCounts[ApplicationStatus.REJECTED] ?? 0;
    const withdrawn = statusCounts[ApplicationStatus.WITHDRAWN] ?? 0;

    // Cumulative progression rates
    const reachingScreening = screening + shortlisted + interviewsCount + offers + hiredCount;
    const reachingInterview = interviewsCount + offers + hiredCount;
    const reachingOffer = offers + hiredCount;

    const denominator = totalApplications || 1;
    const screeningRate = totalApplications > 0 ? round(reachingScreening / denominator) : 0;
    const interviewRate = totalApplications > 0 ? round(reachingInterview / denominator) : 0;
    const offerRate = totalApplications > 0 ? round(reachingOffer / denominator) : 0;
    const hireRate = totalApplications > 0 ? round(hiredCount / denominator) : 0;

    // Average time to hire: days between appliedAt and the HIRED event or status change
    const hiredEvents = await this.prisma.applicationEvent.findMany({
      where: {
        newStatus: 'HIRED',
        application: { job: scope },
      },
      select: { application: { select: { appliedAt: true } }, createdAt: true },
    });
    const timesToHire = hiredEvents.map((e) =>
      Math.max(0, (e.createdAt.getTime() - e.application.appliedAt.getTime()) / 86_400_000),
    );
    const avgTimeToHire =
      timesToHire.length > 0
        ? Math.round((timesToHire.reduce((a, b) => a + b, 0) / timesToHire.length) * 10) / 10
        : null;

    const last7Days = await this.prisma.application.count({
      where: { job: scope, appliedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    });

    // Pipeline Volume time-series
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const volumeApps = await this.prisma.application.findMany({
      where: {
        job: scope,
        appliedAt: { gte: thirtyDaysAgo },
      },
      select: { appliedAt: true, status: true },
      orderBy: { appliedAt: 'asc' },
    });

    const volumeMap = new Map<string, number>();
    for (const app of volumeApps) {
      const dateStr = app.appliedAt.toISOString().slice(0, 10);
      volumeMap.set(dateStr, (volumeMap.get(dateStr) ?? 0) + 1);
    }

    const pipelineVolume = Array.from(volumeMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      companyId,
      activeJobs,
      totalJobs,
      totalApplications,
      applicationsLast7Days: last7Days,
      applicationsByStatus: {
        APPLIED: appliedCount,
        SCREENING: screening,
        SHORTLISTED: shortlisted,
        INTERVIEW: interviewsCount,
        OFFER: offers,
        HIRED: hiredCount,
        REJECTED: rejected,
        WITHDRAWN: withdrawn,
        ...statusCounts,
      },
      screeningRate,
      interviewRate,
      offerRate,
      hireRate,
      hires: hiredCount,
      avgTimeToHireDays: avgTimeToHire,
      interviewsScheduled: interviews,
      pipelineVolume,
    };
  }

  private async computePlatformMetrics() {
    const [users, candidates, companies, verifiedCompanies, jobs, applications, hires, subscriptions, payments, aiAnalyses] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.candidateProfile.count(),
        this.prisma.company.count(),
        this.prisma.company.count({ where: { status: 'ACTIVE' } }),
        this.prisma.job.count(),
        this.prisma.application.count(),
        this.prisma.application.count({ where: { status: 'HIRED' } }),
        this.prisma.subscription.count({ where: { status: { in: ['TRIALING', 'ACTIVE'] } } }),
        this.prisma.payment.findMany({ where: { status: 'SUCCEEDED' }, select: { amountCents: true, currency: true } }),
        this.prisma.aiAnalysis.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);

    const revenueByCurrency = new Map<string, number>();
    for (const p of payments) {
      revenueByCurrency.set(p.currency, (revenueByCurrency.get(p.currency) ?? 0) + p.amountCents);
    }

    return {
      users,
      candidates,
      companies,
      verifiedCompanies,
      jobs,
      applications,
      hires,
      activeSubscriptions: subscriptions,
      revenueByCurrencyCents: Object.fromEntries(revenueByCurrency),
      aiUsage: Object.fromEntries(aiAnalyses.map((row) => [row.status, row._count._all])),
    };
  }
}

function round(ratio: number): number {
  return Math.round(ratio * 1000) / 10;
}
