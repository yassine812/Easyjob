const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      roles: { include: { role: true } },
      candidateProfile: true,
      companyMemberships: { include: { company: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(
    JSON.stringify(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        roles: u.roles.map((r) => r.role.name),
        candidateProfileId: u.candidateProfile?.id,
        memberships: u.companyMemberships.map((m) => ({
          companyId: m.companyId,
          companyName: m.company.commercialName,
          role: m.role,
        })),
      })),
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
