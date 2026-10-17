// Update only unchanged fixture text, never uploaded CVs, edited profiles or passwords.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const candidateEmails = ['cara@example.test', 'bob@example.test', 'dana@example.test', 'eve@example.test'];
(async () => {
  const target = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/startup_starter') throw Error('This command only supports the local EasyJob development database.');
  const result = await db.$transaction(async tx => {
    const counts = { experiences: 0, educations: 0, jobs: 0, profiles: 0, applications: 0 };
    const profiles = await tx.candidateProfile.findMany({ where: { user: { email: { in: candidateEmails } } }, select: { id: true, headline: true, yearsExperience: true } });
    for (const profile of profiles) {
      counts.profiles += (await tx.candidateProfile.updateMany({ where: { id: profile.id, bio: `${profile.headline} with ${profile.yearsExperience} years of experience. Fictional test profile.` }, data: { bio: `Profil de démonstration : ${profile.headline}, ${profile.yearsExperience} ans d’expérience. Exemple fictif pour découvrir le parcours candidat.` } })).count;
      const experiences = await tx.experience.findMany({ where: { candidateId: profile.id, companyName: 'Fictional Startup', description: 'Fictional experience used for development.' }, select: { id: true, title: true } });
      for (const exp of experiences) counts.experiences += (await tx.experience.updateMany({ where: { id: exp.id, description: 'Fictional experience used for development.' }, data: { companyName: 'Atelier Numérique — Démonstration', description: `Exemple fictif pour le rôle ${exp.title}.\n• Concevoir et livrer les fonctionnalités de son périmètre.\n• Documenter le travail et vérifier sa qualité avec l’équipe.` } })).count;
      counts.educations += (await tx.education.updateMany({ where: { candidateId: profile.id, institution: 'University of Fictional', degree: "Bachelor's", field: 'Computer Science' }, data: { institution: 'Institut du Numérique — Démonstration', degree: 'Licence (exemple)', field: 'Informatique' } })).count;
      counts.applications += (await tx.application.updateMany({ where: { candidateId: profile.id, motivation: 'I am very interested in this position. Fictional application.' }, data: { motivation: 'Candidature de démonstration : je souhaite présenter mon parcours et échanger sur les missions de cette offre fictive.' } })).count;
    }
    const jobs = await tx.job.findMany({ where: { createdBy: { email: { in: ['aadmin@startupstarter.test', 'badmin@startupstarter.test', 'cadmin@startupstarter.test'] } }, description: { endsWith: 'This is fictional seed data.' } }, include: { company: { select: { commercialName: true } }, skills: { include: { skill: true } } } });
    for (const job of jobs) {
      const skills = job.skills.map(s => s.skill.name);
      counts.jobs += (await tx.job.updateMany({ where: { id: job.id, description: job.description }, data: {
        description: `OFFRE DE DÉMONSTRATION — aucune embauche réelle.\nDécouvrez le parcours de candidature au poste de ${job.title} chez ${job.company.commercialName}. ${skills.length ? `Compétences utilisées dans cet exemple : ${skills.join(', ')}.` : 'Le poste consiste à vérifier la qualité des fonctionnalités avant livraison.'}\nLe scénario permet de tester la candidature, la présélection et l’entretien.`,
        responsibilities: ['Réaliser les tâches du poste et documenter les résultats', 'Collaborer avec l’équipe lors des revues de travail'],
        requirements: [...skills.map(s => `Connaissance de ${s}`), 'Présenter clairement son travail en entretien'],
      } })).count;
    }
    return counts;
  }, { timeout: 30000 });
  console.log(JSON.stringify(result));
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
