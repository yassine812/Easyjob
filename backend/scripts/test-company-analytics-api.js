const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function computeCompanyMetrics(companyId) {
  const [activeJobs, totalJobs, totalApplications, hiredCount, interviews] = await Promise.all([
    prisma.job.count({ where: { companyId, status: 'PUBLISHED' } }),
    prisma.job.count({ where: { companyId } }),
    prisma.application.count({ where: { job: { companyId } } }),
    prisma.application.count({ where: { job: { companyId }, status: 'HIRED' } }),
    prisma.interview.count({
      where: { job: { companyId }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
    }),
  ]);

  const byStatus = await prisma.application.groupBy({
    by: ['status'],
    where: { job: { companyId } },
    _count: { _all: true },
  });
  const statusCounts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));

  const appliedCount = statusCounts['APPLIED'] ?? 0;
  const screening = statusCounts['SCREENING'] ?? 0;
  const shortlisted = statusCounts['SHORTLISTED'] ?? 0;
  const interviewsCount = statusCounts['INTERVIEW'] ?? 0;
  const offers = statusCounts['OFFER'] ?? 0;

  const denominator = totalApplications || 1;
  const screeningRate = Math.round(((screening + shortlisted + interviewsCount + offers + hiredCount) / denominator) * 100);
  const interviewRate = Math.round(((interviewsCount + offers + hiredCount) / denominator) * 100);
  const offerRate = Math.round(((offers + hiredCount) / denominator) * 100);
  const hireRate = Math.round((hiredCount / denominator) * 100);

  console.log(`=== ANALYTICS FOR COMPANY ${companyId} ===`);
  console.log({
    activeJobs,
    totalJobs,
    totalApplications,
    hires: hiredCount,
    screeningRate: `${screeningRate}%`,
    interviewRate: `${interviewRate}%`,
    offerRate: `${offerRate}%`,
    hireRate: `${hireRate}%`,
    interviewsScheduled: interviews,
    statusCounts,
  });
}

async function main() {
  await computeCompanyMetrics('cmt1l7cpg000c24r6vmmetgle');
}

main().catch(console.error).finally(() => prisma.$disconnect());
