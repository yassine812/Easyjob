const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== PLANS IN DB ===');
  const plans = await prisma.plan.findMany();
  console.log(plans);

  console.log('\n=== SUBSCRIPTIONS IN DB ===');
  const subs = await prisma.subscription.findMany({ include: { plan: true } });
  console.log(subs);

  console.log('\n=== COMPANIES IN DB ===');
  const companies = await prisma.company.findMany();
  console.log(companies.map(c => ({ id: c.id, commercialName: c.commercialName })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
