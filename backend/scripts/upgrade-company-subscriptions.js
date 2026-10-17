const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Get Enterprise Plan
  const enterprisePlan = await prisma.plan.findFirst({
    where: { type: 'COMPANY', name: 'ENTERPRISE' },
  });

  if (!enterprisePlan) {
    console.error('ENTERPRISE plan not found!');
    return;
  }

  // Ensure Enterprise plan has all features enabled
  const fullEnterpriseFeatures = {
    activeJobs: 99999,
    'ai.enabled': true,
    'team.members': 1000,
    'billing.manage': true,
    'analytics.enabled': true,
    'automation.enabled': true,
    'assessments.enabled': true,
    'ai.screening': true,
    'ai.match': true,
    'ai.rank': true,
  };

  await prisma.plan.update({
    where: { id: enterprisePlan.id },
    data: { features: fullEnterpriseFeatures },
  });
  console.log('Updated Enterprise Plan features in DB.');

  // Also update Business and Pro plans so automation is enabled on all company plans if needed
  await prisma.plan.updateMany({
    where: { type: 'COMPANY' },
    data: {
      features: fullEnterpriseFeatures,
    },
  });

  // 2. Set all companies to ACTIVE Enterprise subscription
  const companies = await prisma.company.findMany({ select: { id: true, commercialName: true } });

  for (const c of companies) {
    // Delete existing pending/canceled subs
    await prisma.subscription.deleteMany({
      where: { companyId: c.id },
    });

    // Create ACTIVE Enterprise subscription
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 5);

    await prisma.subscription.create({
      data: {
        ownerType: 'COMPANY',
        companyId: c.id,
        planId: enterprisePlan.id,
        provider: 'dev',
        providerSubscriptionId: `dev_enterprise_${c.id}`,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: oneYearFromNow,
      },
    });

    console.log(`Activated ENTERPRISE subscription for company ${c.commercialName} (${c.id})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
