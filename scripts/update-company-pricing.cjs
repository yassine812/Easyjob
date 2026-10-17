/* Synchronize the public company catalogue without touching candidate plans. */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

require('ts-node/register/transpile-only');
const { COMPANY_PLAN_CATALOG } = require('../src/subscriptions/plan-catalog');
const plans = Object.values(COMPANY_PLAN_CATALOG).map((plan, index) => ({ ...plan, sortOrder: index + 1 }));

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
