const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== ALL COMPANIES ===');
  const companies = await prisma.company.findMany({
    select: { id: true, commercialName: true, legalName: true },
  });
  for (const c of companies) {
    const jobsCount = await prisma.job.count({ where: { companyId: c.id } });
    const appsCount = await prisma.application.count({ where: { job: { companyId: c.id } } });
    console.log(`Company ID: ${c.id} | Commercial Name: ${c.commercialName} | Jobs: ${jobsCount} | Apps: ${appsCount}`);
  }

  console.log('\n=== COMPANY USERS & MEMBERSHIPS ===');
  const members = await prisma.companyMember.findMany({
    select: {
      companyId: true,
      role: true,
      user: { select: { email: true, name: true } },
    },
  });
  console.log(members);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
