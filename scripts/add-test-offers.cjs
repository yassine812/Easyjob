require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const offers = [
  { slug: 'test-full-stack-developer', title: 'Développeur Full Stack — TEST', skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'], level: 'MID' },
  { slug: 'test-frontend-engineer', title: 'Ingénieur Frontend — TEST', skills: ['React', 'TypeScript', 'CSS'], level: 'JUNIOR' },
  { slug: 'test-backend-engineer', title: 'Ingénieur Backend — TEST', skills: ['Node.js', 'NestJS', 'PostgreSQL'], level: 'MID' },
  { slug: 'test-product-designer', title: 'Product Designer — TEST', skills: ['Figma', 'UX Research', 'Design Systems'], level: 'MID' },
  { slug: 'test-data-analyst', title: 'Data Analyst — TEST', skills: ['SQL', 'Python', 'Power BI'], level: 'JUNIOR' },
];

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@startupstarter.test' } });
  if (!admin) throw new Error('Platform demo admin not found');
  const company = await prisma.company.upsert({
    where: { slug: 'easyjob-test-lab' },
    create: {
      legalName: 'EasyJob Test Lab SARL', commercialName: 'EasyJob Test Lab', slug: 'easyjob-test-lab',
      website: 'https://testlab.easyjob.dev', industry: 'Recruitment technology', country: 'TN', city: 'Tunis',
      description: 'Espace de test EasyJob. Ces offres sont fictives et ne correspondent pas à un recrutement réel.',
      status: 'ACTIVE', professionalEmail: 'testlab@easyjob.dev', registrationIdentifier: 'EASYJOB-TEST-LAB',
    },
    update: { status: 'ACTIVE', website: 'https://testlab.easyjob.dev', description: 'Espace de test EasyJob. Ces offres sont fictives et ne correspondent pas à un recrutement réel.' },
  });
  await prisma.companyVerification.upsert({ where: { companyId: company.id }, create: { companyId: company.id, status: 'VERIFIED', submittedAt: new Date(), reviewedAt: new Date(), reviewedById: admin.id }, update: { status: 'VERIFIED', reviewedAt: new Date(), reviewedById: admin.id } });
  await prisma.companyMember.upsert({ where: { companyId_userId: { companyId: company.id, userId: admin.id } }, create: { companyId: company.id, userId: admin.id, role: 'COMPANY_ADMIN', status: 'ACTIVE', isOwner: false }, update: { role: 'COMPANY_ADMIN', status: 'ACTIVE' } });
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  for (const offer of offers) {
    const job = await prisma.job.upsert({
      where: { companyId_slug: { companyId: company.id, slug: offer.slug } },
      create: {
        companyId: company.id, createdById: admin.id, title: offer.title, slug: offer.slug,
        description: `OFFRE DE TEST — aucune embauche réelle. Utilise cette offre pour tester la recherche, la candidature et le coach d’entretien EasyJob.`,
        responsibilities: ['Analyser le besoin fourni dans le scénario de test', 'Collaborer avec l’équipe et documenter les résultats', 'Présenter une solution claire pendant l’entretien'],
        requirements: offer.skills.map(skill => `Connaissance de ${skill}`), location: 'Tunis / Remote', remote: true, domain: 'Test produit',
        employmentType: 'FULL_TIME', experienceLevel: offer.level, minimumYearsExperience: offer.level === 'JUNIOR' ? 0 : 2,
        salaryMin: 180000, salaryMax: 280000, currency: 'TND', status: 'PUBLISHED', publishedAt: new Date(), approvedAt: new Date(), approvedById: admin.id, expiresAt,
      },
      update: { status: 'PUBLISHED', publishedAt: new Date(), approvedAt: new Date(), approvedById: admin.id, expiresAt, salaryMin: 180000, salaryMax: 280000, currency: 'TND' },
    });
    for (const skillName of offer.skills) {
      const skill = await prisma.skill.upsert({ where: { normalizedName: skillName.toLowerCase() }, create: { name: skillName, normalizedName: skillName.toLowerCase() }, update: {} });
      await prisma.jobSkill.upsert({ where: { jobId_skillId: { jobId: job.id, skillId: skill.id } }, create: { jobId: job.id, skillId: skill.id, required: true, level: 'INTERMEDIATE' }, update: { required: true } });
    }
  }
  console.log(`Created/updated ${offers.length} visible test offers for ${company.commercialName}.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
