require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const offers = [
  { slug: 'test-full-stack-developer', title: 'Développeur Full Stack — TEST', skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'], level: 'MID' },
  { slug: 'test-frontend-engineer', title: 'Ingénieur Frontend — TEST', skills: ['React', 'TypeScript', 'CSS'], level: 'JUNIOR' },
  { slug: 'test-backend-engineer', title: 'Ingénieur Backend — TEST', skills: ['Node.js', 'NestJS', 'PostgreSQL'], level: 'MID' },
  { slug: 'test-product-designer', title: 'Product Designer — TEST', skills: ['Figma', 'UX Research', 'Design Systems'], level: 'MID' },
  { slug: 'test-data-analyst', title: 'Data Analyst — TEST', skills: ['SQL', 'Python', 'Power BI'], level: 'JUNIOR' },
  { slug: 'test-python-django', title: 'Développeur Python Django — TEST', skills: ['Python', 'Django', 'SQL'], level: 'JUNIOR' },
  { slug: 'test-mobile', title: 'Développeur React Native — TEST', skills: ['React Native', 'TypeScript', 'Expo'], level: 'MID' },
  { slug: 'test-accountant', title: 'Comptable — TEST', skills: ['Comptabilité', 'Sage', 'Fiscalité'], level: 'MID' },
  { slug: 'test-sales', title: 'Commercial B2B — TEST', skills: ['Prospection', 'Négociation', 'CRM'], level: 'JUNIOR' },
  { slug: 'test-logistics', title: 'Coordinateur logistique — TEST', skills: ['Logistique', 'SAP', 'Gestion de stock'], level: 'MID' },
  { slug: 'test-marketing', title: 'Chargé marketing — TEST', skills: ['SEO', 'Google Ads', 'Copywriting'], level: 'JUNIOR' },
  { slug: 'test-quality', title: 'Technicien qualité — TEST', skills: ['ISO 9001', 'Métrologie', 'Contrôle qualité'], level: 'JUNIOR' },
  { slug: 'test-yassine-fullstack', title: 'Développeur Full-Stack Python Django React Native — TEST', skills: ['Python', 'Django', 'Django REST Framework', 'React Native (Expo)', 'JavaScript', 'PHP', 'Laravel', 'SQL', 'MySQL', 'SQLite', 'API REST', 'Authentification', 'HTML', 'CSS', 'Git', 'Agile/Scrum', 'Développement d API', 'Revue de code', 'Modélisation de données'], level: 'MID' },
  { slug: 'test-yassine-backend', title: 'Ingénieur Backend Python Django — TEST', skills: ['Python', 'Django', 'Django REST Framework', 'JavaScript', 'SQL', 'MySQL', 'API REST', 'Authentification', 'Git', 'Développement d API', 'Revue de code'], level: 'MID' },
  { slug: 'test-yassine-mobile', title: 'Développeur Mobile React Native — TEST', skills: ['Python', 'React Native (Expo)', 'JavaScript', 'HTML', 'CSS', 'Git', 'API REST', 'SQL', 'Agile/Scrum'], level: 'MID' },
];

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.EASYJOB_LOCAL_TEST_JOBS !== 'true') throw new Error('Enable EASYJOB_LOCAL_TEST_JOBS=true in a non-production environment first');
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
        description: `OFFRE DE TEST — aucune embauche réelle. Utilise cette offre pour tester la recherche, la candidature et le coach d’entretien EasyJob. Les salaires sont fictifs, exprimés en TND par mois.`,
        responsibilities: ['Analyser le besoin fourni dans le scénario de test', 'Collaborer avec l’équipe et documenter les résultats', 'Présenter une solution claire pendant l’entretien'],
        requirements: offer.slug.startsWith('test-yassine-') ? [] : offer.skills.map(skill => `Connaissance de ${skill}`), location: 'Tunis / Remote', remote: true, workMode: offer.slug.startsWith('test-yassine-') ? 'REMOTE' : 'HYBRID', domain: offer.slug.startsWith('test-yassine-') ? null : 'Test produit',
        employmentType: 'FULL_TIME', experienceLevel: offer.level, minimumYearsExperience: offer.slug.startsWith('test-yassine-') ? null : offer.level === 'JUNIOR' ? 0 : 2,
        salaryMin: 1800, salaryMax: 2800, currency: 'TND', workMode: 'HYBRID', contractType: 'CDI', applicationFields: [{ id: 'availability', label: 'Quand serais-tu disponible ? (test)', type: 'select', required: true, options: ['Immédiatement', 'Dans un mois', 'Dans trois mois'] }, { id: 'scenario', label: 'Que souhaites-tu tester avec cette candidature ?', type: 'textarea', required: false }], status: 'PUBLISHED', publishedAt: new Date(), approvedAt: new Date(), approvedById: admin.id, expiresAt,
      },
      update: { title: offer.title, description: 'OFFRE DE TEST — aucune embauche réelle. Scénario local pour essayer le CV, les questions et le suivi de candidature. Les salaires sont fictifs, exprimés en TND par mois.', requirements: offer.slug.startsWith('test-yassine-') ? [] : offer.skills.map(skill => `Connaissance de ${skill}`), location: 'Tunis / Remote', remote: true, workMode: offer.slug.startsWith('test-yassine-') ? 'REMOTE' : 'HYBRID', domain: offer.slug.startsWith('test-yassine-') ? null : 'Test produit', experienceLevel: offer.level, minimumYearsExperience: offer.slug.startsWith('test-yassine-') ? null : offer.level === 'JUNIOR' ? 0 : 2, status: 'PUBLISHED', publishedAt: new Date(), approvedAt: new Date(), approvedById: admin.id, expiresAt, salaryMin: 1800, salaryMax: 2800, currency: 'TND', contractType: 'CDI', applicationFields: [{ id: 'availability', label: 'Quand serais-tu disponible ? (test)', type: 'select', required: true, options: ['Immédiatement', 'Dans un mois', 'Dans trois mois'] }, { id: 'scenario', label: 'Que souhaites-tu tester avec cette candidature ?', type: 'textarea', required: false }] },
    });
    for (const skillName of offer.skills) {
      const skill = await prisma.skill.upsert({ where: { normalizedName: skillName.toLowerCase() }, create: { name: skillName, normalizedName: skillName.toLowerCase() }, update: {} });
      await prisma.jobSkill.upsert({ where: { jobId_skillId: { jobId: job.id, skillId: skill.id } }, create: { jobId: job.id, skillId: skill.id, required: true, level: 'INTERMEDIATE' }, update: { required: true } });
    }
  }
  console.log(`Created/updated ${offers.length} visible test offers for ${company.commercialName}.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
