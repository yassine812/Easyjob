require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Curated from the companies' official career pages on 12 September 2026.
// The source URL is kept in each description so candidates can verify the
// original posting before applying. Re-running this script refreshes the
// visible offers without creating duplicates.
const companies = [
  {
    slug: 'vermeg',
    legalName: 'Vermeg Tunisia',
    commercialName: 'Vermeg',
    website: 'https://www.vermeg.com',
    industry: 'Financial software',
    country: 'TN',
    city: 'Tunis',
    professionalEmail: 'communication@vermeg.com',
    registrationIdentifier: 'VERMEG-OFFICIAL',
    description: 'Éditeur international de solutions logicielles pour les services financiers. Les postes ci-dessous proviennent de la page officielle des offres Vermeg.',
    offers: [
      {
        slug: 'senior-cloud-devops-engineer-aws',
        title: 'Senior Cloud / DevOps Engineer (AWS)',
        sourceUrl: 'https://www.vermeg.com/job/senior-cloud-devops-engineer-aws/',
        domain: 'Cloud & DevOps',
        level: 'SENIOR',
        years: 4,
        skills: ['AWS', 'Terraform', 'Kubernetes', 'CI/CD', 'Observability'],
        location: 'Tunis, Tunisie',
        remote: false,
        description: 'Concevoir, déployer et exploiter des environnements cloud AWS fiables pour la plateforme SaaS de Vermeg. Le poste couvre l’infrastructure as code, Kubernetes/EKS, les pipelines CI/CD, la supervision et la sécurité.\n\nSource officielle et candidature : https://www.vermeg.com/job/senior-cloud-devops-engineer-aws/',
        responsibilities: ['Concevoir et maintenir l’infrastructure AWS', 'Administrer les environnements Kubernetes/EKS', 'Construire les pipelines CI/CD et améliorer l’observabilité', 'Diagnostiquer les incidents de production et optimiser les coûts cloud'],
        requirements: ['Expérience confirmée en cloud AWS', 'Pratique de Terraform et Kubernetes', 'Expérience CI/CD et monitoring', 'Français et anglais professionnels'],
      },
      {
        slug: 'business-analyst',
        title: 'Business Analyst',
        sourceUrl: 'https://www.vermeg.com/job/business-analyst/',
        domain: 'Analyse métier & Finance',
        level: 'MID',
        years: 3,
        skills: ['Business analysis', 'SQL', 'ETL', 'Finance', 'Agile'],
        location: 'Tunis, Tunisie',
        remote: false,
        description: 'Accompagner les clients de Vermeg dans l’analyse de leurs processus réglementaires et financiers, formaliser les besoins et collaborer avec les équipes R&D.\n\nSource officielle et candidature : https://www.vermeg.com/job/business-analyst/',
        responsibilities: ['Analyser et consolider les besoins clients', 'Rédiger les spécifications fonctionnelles', 'Configurer la solution et coordonner avec la R&D', 'Participer aux flux ETL et à la connaissance produit'],
        requirements: ['Formation supérieure en informatique, économie ou finance', 'Connaissances SQL et ETL', 'Expérience en analyse métier ou fintech', 'Français et anglais courants'],
      },
      {
        slug: 'senior-analyst-developer-java-jee',
        title: 'Senior Analyst Developer Java / J2EE',
        sourceUrl: 'https://www.vermeg.com/job/senior-analyst-developer-java-j2ee/',
        domain: 'Développement logiciel',
        level: 'SENIOR',
        years: 4,
        skills: ['Java', 'J2EE', 'Spring', 'REST', 'SQL', 'Angular'],
        location: 'Tunis, Tunisie',
        remote: false,
        description: 'Concevoir et livrer des applications Java/J2EE pour les solutions financières de Vermeg, avec Spring, REST, bases de données et pratiques Agile.\n\nSource officielle et candidature : https://www.vermeg.com/job/senior-analyst-developer-java-j2ee/',
        responsibilities: ['Concevoir et développer des composants Java/J2EE', 'Participer aux revues de code et à la qualité logicielle', 'Construire des services REST et des interfaces web', 'Collaborer dans un cycle Agile et contribuer à l’architecture'],
        requirements: ['4 à 7 ans d’expérience en développement', 'Maîtrise Java/J2EE et Spring', 'Connaissances SQL, microservices et CI/CD', 'Bon niveau de français et d’anglais'],
      },
    ],
  },
  {
    slug: 'sagemcom-tunisia',
    legalName: 'Sagemcom Tunisia',
    commercialName: 'Sagemcom',
    website: 'https://careers-tunisia.sagemcom.com',
    industry: 'Électronique & télécommunications',
    country: 'TN',
    city: 'Ben Arous',
    professionalEmail: null,
    registrationIdentifier: 'SAGEMCOM-TN-OFFICIAL',
    description: 'Groupe industriel et technologique présent en Tunisie. Les postes sont synchronisés depuis le moteur officiel Sagemcom Tunisia.',
    offers: [
      {
        slug: 'chef-de-projet-sagemcom-2026-2260',
        title: 'Chef·fe de Projet — Réf. 2026-2260',
        sourceUrl: 'https://careers-tunisia.sagemcom.com/Pages/Offre/ListeOffre.aspx',
        domain: 'R&D & Gestion de projet',
        level: 'MID',
        years: 3,
        skills: ['Gestion de projet', 'Agile', 'R&D', 'Industrialisation'],
        location: 'Ben Arous, Tunisie',
        remote: false,
        description: 'Piloter des projets R&D chez Sagemcom, coordonner les équipes et sécuriser les jalons de livraison. Référence officielle : 2026-2260.\n\nSource et candidature : https://careers-tunisia.sagemcom.com/Pages/Offre/ListeOffre.aspx',
        responsibilities: ['Planifier les phases et les jalons du projet', 'Coordonner les équipes R&D et les parties prenantes', 'Suivre les risques, la qualité et les délais', 'Communiquer l’avancement aux responsables'],
        requirements: ['Formation ingénieur ou équivalente', 'Expérience en gestion de projet technique', 'Méthode et communication solides', 'Français et anglais professionnels'],
      },
      {
        slug: 'ingenieur-developpement-aspnet-sagemcom-2026-2083',
        title: 'Ingénieur·e Développement ASP.NET — Réf. 2026-2083',
        sourceUrl: 'https://careers-tunisia.sagemcom.com/Pages/Offre/ListeOffre.aspx',
        domain: 'Développement logiciel',
        level: 'MID',
        years: 2,
        skills: ['ASP.NET', 'C#', 'SQL', 'REST', 'Git'],
        location: 'Ben Arous, Tunisie',
        remote: false,
        description: 'Développer et maintenir des composants logiciels ASP.NET au sein des équipes R&D de Sagemcom. Référence officielle : 2026-2083.\n\nSource et candidature : https://careers-tunisia.sagemcom.com/Pages/Offre/ListeOffre.aspx',
        responsibilities: ['Concevoir et développer les fonctionnalités .NET', 'Écrire des tests et corriger les anomalies', 'Collaborer avec les équipes produit et validation', 'Documenter les composants livrés'],
        requirements: ['Formation supérieure en informatique', 'Expérience C#/.NET et ASP.NET', 'Maîtrise des bases SQL et des API REST', 'Esprit d’équipe et capacité d’analyse'],
      },
      {
        slug: 'coordinateur-technique-ia-junior-sagemcom-2026-2221',
        title: 'Coordinateur·rice Technique IA Junior — Réf. 2026-2221',
        sourceUrl: 'https://careers-tunisia.sagemcom.com/Pages/Offre/ListeOffre.aspx',
        domain: 'Intelligence artificielle & R&D',
        level: 'JUNIOR',
        years: 0,
        skills: ['Python', 'Machine Learning', 'Data', 'Git', 'Communication technique'],
        location: 'Ben Arous, Tunisie',
        remote: false,
        description: 'Contribuer à la coordination de sujets IA et au suivi technique des équipes R&D Sagemcom. Référence officielle : 2026-2221.\n\nSource et candidature : https://careers-tunisia.sagemcom.com/Pages/Offre/ListeOffre.aspx',
        responsibilities: ['Suivre les sujets IA et leurs livrables', 'Préparer les synthèses techniques', 'Faciliter les échanges entre équipes', 'Participer à la veille et à la qualification de solutions'],
        requirements: ['Formation en informatique, data ou ingénierie', 'Bases en Python et machine learning', 'Organisation et curiosité technique', 'Bon relationnel en français et en anglais'],
      },
    ],
  },
];

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@startupstarter.test' } });
  if (!admin) throw new Error('Platform demo admin not found');
  let created = 0;

  for (const definition of companies) {
    const company = await prisma.company.upsert({
      where: { slug: definition.slug },
      create: {
        legalName: definition.legalName,
        commercialName: definition.commercialName,
        slug: definition.slug,
        website: definition.website,
        industry: definition.industry,
        country: definition.country,
        city: definition.city,
        description: definition.description,
        status: 'ACTIVE',
        professionalEmail: definition.professionalEmail,
        registrationIdentifier: definition.registrationIdentifier,
      },
      update: {
        legalName: definition.legalName,
        commercialName: definition.commercialName,
        website: definition.website,
        industry: definition.industry,
        country: definition.country,
        city: definition.city,
        description: definition.description,
        status: 'ACTIVE',
        professionalEmail: definition.professionalEmail,
      },
    });

    await prisma.companyVerification.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, status: 'VERIFIED', submittedAt: new Date(), reviewedAt: new Date(), reviewedById: admin.id, notes: 'Company and offers sourced from official career pages.' },
      update: { status: 'VERIFIED', reviewedAt: new Date(), reviewedById: admin.id, notes: 'Company and offers sourced from official career pages.' },
    });
    await prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: company.id, userId: admin.id } },
      create: { companyId: company.id, userId: admin.id, role: 'COMPANY_ADMIN', status: 'ACTIVE', isOwner: false },
      update: { role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    });

    for (const offer of definition.offers) {
      const job = await prisma.job.upsert({
        where: { companyId_slug: { companyId: company.id, slug: offer.slug } },
        create: {
          companyId: company.id,
          createdById: admin.id,
          title: offer.title,
          slug: offer.slug,
          description: offer.description,
          responsibilities: offer.responsibilities,
          requirements: offer.requirements,
          location: offer.location,
          remote: offer.remote,
          domain: offer.domain,
          workMode: 'On-site',
          contractType: 'CDI',
          languages: ['Français', 'Anglais'],
          preferredLanguages: ['Français', 'Anglais'],
          interviewProcess: 'Voir les étapes indiquées sur la page carrière officielle.',
          employmentType: 'FULL_TIME',
          experienceLevel: offer.level,
          minimumYearsExperience: offer.years,
          currency: 'TND',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          approvedAt: new Date(),
          approvedById: admin.id,
          expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        },
        update: {
          title: offer.title,
          description: offer.description,
          responsibilities: offer.responsibilities,
          requirements: offer.requirements,
          location: offer.location,
          remote: offer.remote,
          domain: offer.domain,
          workMode: 'On-site',
          contractType: 'CDI',
          languages: ['Français', 'Anglais'],
          preferredLanguages: ['Français', 'Anglais'],
          interviewProcess: 'Voir les étapes indiquées sur la page carrière officielle.',
          employmentType: 'FULL_TIME',
          experienceLevel: offer.level,
          minimumYearsExperience: offer.years,
          currency: 'TND',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          approvedAt: new Date(),
          approvedById: admin.id,
          expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        },
      });
      created += 1;
      for (const skillName of offer.skills) {
        const skill = await prisma.skill.upsert({
          where: { normalizedName: skillName.toLowerCase() },
          create: { name: skillName, normalizedName: skillName.toLowerCase() },
          update: { name: skillName },
        });
        await prisma.jobSkill.upsert({
          where: { jobId_skillId: { jobId: job.id, skillId: skill.id } },
          create: { jobId: job.id, skillId: skill.id, required: true, level: offer.level === 'JUNIOR' ? 'INTERMEDIATE' : 'ADVANCED' },
          update: { required: true },
        });
      }
    }
  }
  console.log(`Created/updated ${created} real offers for ${companies.length} verified companies.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
