/* Synchronize the public company catalogue without touching candidate plans. */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const plans = [
  {
    name: 'TRIAL', priceCents: 0, sortOrder: 1,
    features: {
      'team.members': 5, activeJobs: 3, 'ai.enabled': false, 'ai.analyses.monthly': 0,
      'automation.enabled': false, 'assessments.enabled': false, 'analytics.enabled': false,
      'interviews.enabled': false, 'advanced.search': false, 'advanced.permissions': false,
      'audit.logs': false, 'billing.manage': true,
    },
  },
  {
    name: 'BUSINESS', priceCents: 14900, sortOrder: 2,
    features: {
      'team.members': 20, activeJobs: 20, 'ai.enabled': true, 'ai.analyses.monthly': 100,
      'automation.enabled': true, 'assessments.enabled': true, 'analytics.enabled': true,
      'interviews.enabled': true, 'advanced.search': true, 'advanced.permissions': false,
      'audit.logs': false, 'billing.manage': true,
    },
  },
  {
    name: 'PRO', priceCents: 29900, sortOrder: 3,
    features: {
      'team.members': 50, activeJobs: 50, 'ai.enabled': true, 'ai.analyses.monthly': 1000,
      'automation.enabled': true, 'assessments.enabled': true, 'analytics.enabled': true,
      'interviews.enabled': true, 'advanced.search': true, 'advanced.permissions': true,
      'audit.logs': false, 'billing.manage': true,
    },
  },
  {
    name: 'ENTERPRISE', priceCents: 89900, sortOrder: 4,
    features: {
      'team.members': 1000, activeJobs: 200, 'ai.enabled': true, 'ai.analyses.monthly': 10000,
      'automation.enabled': true, 'assessments.enabled': true, 'analytics.enabled': true,
      'interviews.enabled': true, 'advanced.search': true, 'advanced.permissions': true,
      'audit.logs': true, 'billing.manage': true,
    },
  },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      await tx.plan.upsert({
        where: { name_type: { name: plan.name, type: 'COMPANY' } },
        create: {
          name: plan.name, type: 'COMPANY', priceCents: plan.priceCents, priceTndCents: plan.priceCents,
          pricesJson: { TND: plan.priceCents }, currency: 'TND', billingInterval: 'MONTHLY',
          active: true, sortOrder: plan.sortOrder, features: plan.features,
        },
        update: {
          priceCents: plan.priceCents, priceTndCents: plan.priceCents, pricesJson: { TND: plan.priceCents },
          currency: 'TND', billingInterval: 'MONTHLY', active: true, sortOrder: plan.sortOrder,
          features: plan.features,
        },
      });
    }
  });
  const result = await prisma.plan.findMany({
    where: { type: 'COMPANY', active: true }, orderBy: { sortOrder: 'asc' },
    select: { name: true, priceCents: true, currency: true, features: true },
  });
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
