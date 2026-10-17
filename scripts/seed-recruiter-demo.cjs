require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
require('ts-node/register/transpile-only');
const { matchCandidate } = require('../src/career/career-engine');
const { analyzeGrowthPotential } = require('../src/career/growth-potential');
const { recruitmentClassification, DEFAULT_THRESHOLDS } = require('../src/companies/recruitment-metrics');

const prisma = new PrismaClient();
const JOB_PREFIX = 'demo-recruiter-';
const CANDIDATE_EMAIL_PREFIX = 'recruiter-demo-';
const DAY = 24 * 60 * 60 * 1000;
const DEMO_PASSWORD = 'EasyJobRecruiterDemo2026!';

const candidates = [
  ['Amel Ben Salem', 'amel', 'Backend Engineer', ['Python', 'Django', 'Django REST Framework', 'PostgreSQL', 'REST API', 'Git'], 3],
  ['Youssef Trabelsi', 'youssef', 'Full-Stack Developer', ['React', 'Django', 'TypeScript', 'Docker'], 4],
  ['Sarra Jaziri', 'sarra', 'Frontend Developer', ['React', 'TypeScript', 'JavaScript', 'REST API', 'Expo'], 3],
  ['Ahmed Mansour', 'ahmed', 'DevOps Engineer', ['Docker', 'Kubernetes', 'AWS', 'CI/CD'], 6],
  ['Meriem Gharbi', 'meriem', 'QA Automation Engineer', ['Playwright', 'Cypress', 'TypeScript', 'CI/CD'], 4],
  ['Omar Kallel', 'omar', 'Data Analyst', ['Python', 'SQL', 'Pandas', 'Power BI'], 3],
  ['Nour Haddad', 'nour', 'Software Engineer', ['Python', 'Django', 'React', 'Git'], 4],
  ['Hatem Saidi', 'hatem', 'Frontend Engineer', ['React', 'TypeScript', 'CSS', 'Testing'], 3],
  ['Ines Cherif', 'ines', 'Product Engineer', ['React', 'Node.js', 'PostgreSQL', 'Docker'], 5],
  ['Walid Mejri', 'walid', 'Cloud Engineer', ['AWS', 'Terraform', 'Kubernetes', 'Linux'], 7],
  ['Rim Ayari', 'rim', 'QA Engineer', ['Playwright', 'API testing', 'SQL', 'Git'], 2],
  ['Karim Ben Amor', 'karim', 'Data Engineer', ['Python', 'SQL', 'Airflow', 'Docker'], 5],
];

const jobs = [
  {
    key: 'backend', slug: `${JOB_PREFIX}backend-python-django`, title: 'Backend Developer — Python / Django', status: 'PUBLISHED', age: 2,
    level: 'MID', location: 'Tunis, Tunisia', mode: 'HYBRID', salary: [3200, 5200], skills: [['Python', true], ['Django', true], ['Django REST Framework', true], ['PostgreSQL', true], ['REST API', true], ['Git', true], ['Docker', false], ['Redis', false], ['CI/CD', false]],
    responsibilities: ['Concevoir des APIs robustes avec Django et Django REST Framework', 'Améliorer la fiabilité et les performances des services backend', 'Collaborer avec les équipes produit, mobile et frontend'],
  },
  {
    key: 'fullstack', slug: `${JOB_PREFIX}full-stack-react-django`, title: 'Full-Stack Developer — React / Django', status: 'PUBLISHED', age: 8,
    level: 'MID', location: 'Tunis, Tunisia', mode: 'HYBRID', salary: [3500, 5800], skills: [['React', true], ['TypeScript', true], ['Django', true], ['PostgreSQL', true], ['REST API', true], ['Testing', false], ['Docker', false]],
    responsibilities: ['Livrer des fonctionnalités de bout en bout sur le web', 'Construire des interfaces accessibles et maintenables', 'Participer aux revues de code et à la qualité logicielle'],
  },
  {
    key: 'mobile', slug: `${JOB_PREFIX}mobile-react-native`, title: 'Mobile Developer — React Native', status: 'PUBLISHED', age: 20,
    level: 'MID', location: 'Tunis, Tunisia', mode: 'REMOTE', salary: [3000, 5200], skills: [['React Native', true], ['Expo', true], ['TypeScript', true], ['REST API', true], ['Git', true], ['Jest', false]],
    responsibilities: ['Développer et maintenir les applications iOS et Android', 'Intégrer les APIs et suivre la qualité des versions mobiles', 'Collaborer avec le design et le backend'],
  },
  {
    key: 'devops', slug: `${JOB_PREFIX}devops-engineer`, title: 'DevOps Engineer', status: 'PUBLISHED', age: 14,
    level: 'SENIOR', location: 'Tunis, Tunisia', mode: 'HYBRID', salary: [4500, 7200], skills: [['Docker', true], ['Kubernetes', true], ['AWS', true], ['CI/CD', true], ['Terraform', true], ['Observability', false]],
    responsibilities: ['Automatiser les déploiements et les environnements cloud', 'Renforcer la disponibilité, la sécurité et l’observabilité', 'Accompagner les équipes de développement sur les pratiques DevOps'],
  },
  {
    key: 'qa', slug: `${JOB_PREFIX}qa-automation`, title: 'QA Automation Engineer', status: 'DRAFT', age: null,
    level: 'MID', location: 'Tunis, Tunisia', mode: 'HYBRID', salary: [2800, 4600], skills: [['Playwright', true], ['Cypress', true], ['TypeScript', true], ['API testing', true], ['CI/CD', false]],
    responsibilities: ['Définir une stratégie de tests automatisés', 'Maintenir les suites end-to-end et API', 'Collaborer avec les développeurs pour prévenir les régressions'],
  },
  {
    key: 'data', slug: `${JOB_PREFIX}data-analyst`, title: 'Data Analyst', status: 'CLOSED', age: 35,
    level: 'MID', location: 'Tunis, Tunisia', mode: 'ON_SITE', salary: [2800, 4800], skills: [['SQL', true], ['Python', true], ['Pandas', true], ['Power BI', true], ['Statistics', false]],
    responsibilities: ['Transformer les données en indicateurs utiles aux équipes', 'Construire des rapports fiables et lisibles', 'Collaborer avec les équipes métier pour clarifier les besoins'],
  },
];

const statusCycle = [
  'INTERVIEW', 'APPLIED', 'APPLIED', 'APPLIED', 'APPLIED', 'APPLIED',
  'SCREENING', 'SCREENING', 'SCREENING', 'SCREENING',
  'UNDER_REVIEW', 'UNDER_REVIEW', 'UNDER_REVIEW', 'UNDER_REVIEW', 'UNDER_REVIEW',
  'SHORTLISTED', 'SHORTLISTED', 'SHORTLISTED', 'SHORTLISTED',
  'INTERVIEW', 'INTERVIEW', 'INTERVIEW', 'OFFER', 'OFFER', 'HIRED', 'REJECTED', 'REJECTED', 'REJECTED',
];
function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function assertDevOnly() {
  const environment = (process.env.NODE_ENV ?? '').toLowerCase();
  if (!['development', 'test'].includes(environment)) {
    throw new Error('Refusing recruiter demo seed outside NODE_ENV=development or test.');
  }
}

async function findCompany() {
  const requestedId = argValue('--company-id');
  const requestedSlug = argValue('--company-slug');
  const ownerEmail = argValue('--owner-email') ?? 'enterprise-test-20261004@startupstarter.test';
  if (requestedId) return prisma.company.findUnique({ where: { id: requestedId }, include: { members: { include: { user: true } } } });
  if (requestedSlug) return prisma.company.findUnique({ where: { slug: requestedSlug }, include: { members: { include: { user: true } } } });
  const owned = await prisma.company.findFirst({ where: { commercialName: 'EasyJob Test Company', members: { some: { user: { email: ownerEmail }, status: 'ACTIVE' } } }, include: { members: { include: { user: true } } } });
  if (owned) return owned;
  return prisma.company.findFirst({ where: { members: { some: { user: { email: ownerEmail }, status: 'ACTIVE' } } }, include: { members: { include: { user: true } } } });
}

async function ensureMaxPlan(company) {
  if (!process.argv.includes('--max-plan')) return false;
  const enterprisePlan = await prisma.plan.findFirst({ where: { type: 'COMPANY', name: 'ENTERPRISE', active: true } });
  if (!enterprisePlan) throw new Error('Cannot enable --max-plan: active ENTERPRISE plan not found.');
  const features = enterprisePlan.features && typeof enterprisePlan.features === 'object' && !Array.isArray(enterprisePlan.features) ? enterprisePlan.features : {};
  await prisma.plan.update({ where: { id: enterprisePlan.id }, data: { features: { ...features, smart_job_creation: true, recruitment_intelligence: true, top_candidates: true, growth_potential: true, advanced_candidate_analysis: true, 'ai.screening': true, 'ai.match': true, 'ai.rank': true, 'analytics.enabled': true } } });
  await prisma.subscription.deleteMany({ where: { ownerType: 'COMPANY', companyId: company.id } });
  const now = new Date();
  const periodEnd = new Date(now); periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  await prisma.subscription.create({ data: { ownerType: 'COMPANY', companyId: company.id, planId: enterprisePlan.id, provider: 'dev-seed', providerSubscriptionId: `dev_seed_enterprise_${company.id}`, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: periodEnd } });
  const active = await prisma.subscription.findFirst({ where: { companyId: company.id, ownerType: 'COMPANY', status: 'ACTIVE' }, include: { plan: true } });
  const activeFeatures = active?.plan.features && typeof active.plan.features === 'object' && !Array.isArray(active.plan.features) ? active.plan.features : {};
  for (const key of ['smart_job_creation', 'recruitment_intelligence', 'top_candidates', 'growth_potential', 'advanced_candidate_analysis']) {
    if (activeFeatures[key] !== true) throw new Error(`Demo entitlement verification failed for ${key}`);
  }
  console.log(`Enabled ENTERPRISE entitlements for demo company ${company.commercialName} (${company.id}).`);
  return true;
}

function ownerFor(company) {
  return company.members.find(member => member.role === 'COMPANY_ADMIN' && member.status === 'ACTIVE')?.user
    ?? company.members.find(member => member.status === 'ACTIVE')?.user;
}

async function resetDemo(companyId) {
  const demoJobs = await prisma.job.findMany({ where: { companyId, slug: { startsWith: JOB_PREFIX } }, select: { id: true } });
  const demoApplications = demoJobs.length ? await prisma.application.findMany({ where: { jobId: { in: demoJobs.map(job => job.id) } }, select: { candidateId: true } }) : [];
  if (demoJobs.length) await prisma.job.deleteMany({ where: { id: { in: demoJobs.map(job => job.id) } } });
  const demoProfiles = demoApplications.length ? await prisma.candidateProfile.findMany({ where: { id: { in: demoApplications.map(application => application.candidateId) } }, select: { userId: true } }) : [];
  const demoUsers = demoProfiles.length ? await prisma.user.findMany({ where: { id: { in: demoProfiles.map(profile => profile.userId) }, email: { startsWith: CANDIDATE_EMAIL_PREFIX } }, select: { id: true } }) : [];
  if (demoUsers.length) await prisma.user.deleteMany({ where: { id: { in: demoUsers.map(user => user.id) } } });
  console.log(`Reset recruiter demo data for ${companyId}: ${demoJobs.length} jobs and ${demoUsers.length} candidate accounts removed.`);
}

async function upsertCandidate(definition, now) {
  const email = `${CANDIDATE_EMAIL_PREFIX}${definition[1]}@easyjob.test`;
  const passwordHash = await require('bcryptjs').hash(DEMO_PASSWORD, 10);
  // Seeding demo content must not reset credentials or reactivate existing users.
  const user = await prisma.user.upsert({ where: { email }, create: { name: definition[0], email, passwordHash, emailVerifiedAt: now, status: 'ACTIVE' }, update: {} });
  const profile = await prisma.candidateProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, headline: definition[2], bio: `${definition[2]} avec ${definition[4]} ans d’expérience.`, location: 'Tunis, Tunisia', yearsExperience: definition[4], visibility: 'RECRUITERS_ONLY', remotePreference: true }, update: { headline: definition[2], bio: `${definition[2]} avec ${definition[4]} ans d’expérience.`, location: 'Tunis, Tunisia', yearsExperience: definition[4], visibility: 'RECRUITERS_ONLY', remotePreference: true } });
  for (const skillName of definition[3]) {
    const skill = await prisma.skill.upsert({ where: { normalizedName: skillName.toLowerCase() }, create: { name: skillName, normalizedName: skillName.toLowerCase() }, update: { name: skillName } });
    await prisma.candidateSkill.upsert({ where: { candidateId_skillId: { candidateId: profile.id, skillId: skill.id } }, create: { candidateId: profile.id, skillId: skill.id, level: 'ADVANCED' }, update: { level: 'ADVANCED' } });
  }
  // Keep the demo profile complete enough for the real matching and growth engines.
  await prisma.experience.deleteMany({ where: { candidateId: profile.id } });
  await prisma.education.deleteMany({ where: { candidateId: profile.id } });
  await prisma.resume.deleteMany({ where: { candidateId: profile.id } });
  const experienceStart = new Date(now.getTime() - Math.max(1, definition[4]) * 365 * DAY);
  await prisma.experience.create({ data: { candidateId: profile.id, companyName: definition[1] === 'amel' ? 'AB Serve Tunisia' : 'EasyJob Demo Studio', location: 'Tunis, Tunisia', countryCode: 'TN', title: definition[2], description: `Livré des fonctionnalités ${definition[3].slice(0, 4).join(', ')}. Documenté les choix techniques, participé aux revues de code et amélioré la qualité des livraisons.`, startDate: experienceStart, endDate: null, current: true } });
  await prisma.education.create({ data: { candidateId: profile.id, institution: 'Université de Tunis', degree: 'Licence', field: 'Informatique', startDate: new Date(now.getTime() - 7 * 365 * DAY), endDate: new Date(now.getTime() - 4 * 365 * DAY) } });
  const project = definition[1] === 'amel' ? 'Audit Management Platform: conçu des APIs REST avec Django, authentification et reporting; Docker utilisé dans un projet personnel.' : definition[1] === 'sarra' ? 'Expo Mobile Portfolio: construit une interface React et un prototype Expo connecté à des APIs REST.' : 'Projet professionnel: livré des fonctionnalités et documenté les résultats.';
  const parsedText = `${definition[0]}\n${definition[2]}\nCompétences: ${definition[3].join(', ')}\nExpérience: ${definition[4]} ans\n\nProjects\n${project}\n\nExperience\nLivré des fonctionnalités mesurables, participé aux revues de code et amélioré la qualité des livraisons.`;
  await prisma.resume.create({ data: { candidateId: profile.id, filename: `${definition[1]}-cv.txt`, storageKey: `demo-recruiter/${definition[1]}/cv.txt`, mimeType: 'text/plain', fileSize: Buffer.byteLength(parsedText), version: 1, isPrimary: true, parsedText, processingStatus: 'COMPLETED' } });
  return { user, profile };
}

async function upsertJob(company, owner, definition, now) {
  const publishedAt = definition.age === null ? null : new Date(now.getTime() - definition.age * DAY);
  const expiresAt = definition.status === 'CLOSED' ? new Date(now.getTime() - 2 * DAY) : new Date(now.getTime() + 45 * DAY);
  const job = await prisma.job.upsert({
    where: { companyId_slug: { companyId: company.id, slug: definition.slug } },
    create: {
      companyId: company.id, createdById: owner.id, title: definition.title, slug: definition.slug,
      description: `${definition.title} au sein d’une équipe produit qui construit des outils utiles aux recruteurs et aux candidats.`,
      responsibilities: definition.responsibilities, requirements: definition.skills.filter(([, required]) => required).map(([skill]) => `Maîtrise de ${skill}`),
      location: definition.location, remote: definition.mode !== 'ON_SITE', workMode: definition.mode, domain: 'Software & product', contractType: 'CDI',
      employmentType: 'FULL_TIME', experienceLevel: definition.level, minimumYearsExperience: definition.level === 'JUNIOR' ? 0 : definition.level === 'MID' ? 2 : 5,
      salaryMin: definition.salary[0], salaryMax: definition.salary[1], currency: 'TND', status: definition.status, publishedAt, expiresAt,
      ...(publishedAt ? { approvedAt: publishedAt, approvedById: owner.id } : {}),
    },
    update: {
      title: definition.title, description: `${definition.title} au sein d’une équipe produit qui construit des outils utiles aux recruteurs et aux candidats.`, responsibilities: definition.responsibilities,
      requirements: definition.skills.filter(([, required]) => required).map(([skill]) => `Maîtrise de ${skill}`), location: definition.location, remote: definition.mode !== 'ON_SITE', workMode: definition.mode,
      status: definition.status, publishedAt, expiresAt, salaryMin: definition.salary[0], salaryMax: definition.salary[1], currency: 'TND',
      ...(publishedAt ? { approvedAt: publishedAt, approvedById: owner.id } : { approvedAt: null, approvedById: null }),
    },
  });
  for (const [skillName, required] of definition.skills) {
    const skill = await prisma.skill.upsert({ where: { normalizedName: skillName.toLowerCase() }, create: { name: skillName, normalizedName: skillName.toLowerCase() }, update: { name: skillName } });
    await prisma.jobSkill.upsert({ where: { jobId_skillId: { jobId: job.id, skillId: skill.id } }, create: { jobId: job.id, skillId: skill.id, required, level: 'ADVANCED' }, update: { required, level: 'ADVANCED' } });
  }
  return job;
}

function recommendationForAnalysis(match, growth) {
  if (match.score == null) return 'Analysis pending. Review the candidate evidence before making a decision.';
  const coverage = match.evidenceAnalysis?.score ?? match.score;
  const transferable = (match.evidenceAnalysis?.requirements || []).filter(requirement => ['TRANSFERABLE', 'PARTIALLY_SUPPORTED'].includes(requirement.status)).length;
  if (match.score >= 85) return `Strong Match. The candidate covers ${coverage}% of the assessed requirements with direct evidence.`;
  if (match.score >= 60 || growth.category === 'HIGH' || transferable > 0) return `Promising. The candidate covers ${coverage}% of the assessed requirements; transferable evidence supports a recruiter review.`;
  return `Low alignment. Only ${coverage}% of the assessed requirements is evidenced; verify the documented gaps before progressing.`;
}

function definitionForApplication(job, candidate) {
  return candidate.user.email.split('@')[0].replace(CANDIDATE_EMAIL_PREFIX, '');
}

async function upsertApplication(job, candidate, owner, index, now) {
  const appliedAt = new Date(now.getTime() - (index % 21 + 1) * DAY + (index % 8) * 60 * 60 * 1000);
  const [analysisJob, analysisProfile] = await Promise.all([
    prisma.job.findUnique({ where: { id: job.id }, include: { skills: { include: { skill: true } } } }),
    prisma.candidateProfile.findUnique({ where: { id: candidate.profile.id }, include: { skills: { include: { skill: true } }, experiences: true, educations: true, resumes: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] } } }),
  ]);
  if (!analysisJob || !analysisProfile) throw new Error(`Unable to load demo analysis data for ${job.id}/${candidate.profile.id}`);
  const match = matchCandidate(analysisProfile, analysisJob);
  const growth = analyzeGrowthPotential(analysisProfile, analysisJob, match);
  if (match.score == null) throw new Error(`Demo analysis did not produce a match score for ${job.id}/${candidate.profile.id}`);
  const score = match.score;
  const criticalGaps = (match.evidenceAnalysis?.requirements || []).filter(requirement => requirement.priority === 'REQUIRED' && ['NOT_FOUND', 'CONFLICTING'].includes(requirement.status)).length;
  const classification = recruitmentClassification(score, growth.category, DEFAULT_THRESHOLDS, criticalGaps);
  // Demo data must obey the same routing invariant as production: a low
  // alignment candidate starts in the inbox, never in interview/offer/hired.
  const requestedStatus = statusCycle[index % statusCycle.length];
  const status = classification === 'LOW_ALIGNMENT' && ['INTERVIEW', 'OFFER', 'HIRED'].includes(requestedStatus) ? 'APPLIED' : requestedStatus;
  const data = {
    status, resumeId: analysisProfile.resumes[0]?.id ?? null, motivation: definitionForApplication(job, candidate) === 'amel' ? 'Je souhaite contribuer à une plateforme backend fiable et mettre à profit mon expérience API et authentification.' : 'Je souhaite mettre mes compétences au service de cette équipe.', coverLetter: definitionForApplication(job, candidate) === 'amel' ? 'Mon projet Audit Management Platform m’a permis de travailler sur des APIs Django, l’authentification et le reporting. J’ai aussi exploré Docker sur un projet personnel.' : null, aiMatchScore: score, atsScore: Math.max(40, score - 4), aiQualification: match.classification, aiRecommendation: recommendationForAnalysis(match, growth),
    aiSummary: match.summary, aiScreeningStatus: 'COMPLETED', aiScreenedAt: new Date(appliedAt.getTime() + 2 * 60 * 60 * 1000),
    matchExplanation: { ...match, growthAnalysis: growth, jobSnapshot: { title: analysisJob.title, requirements: analysisJob.requirements, skills: analysisJob.skills.map(item => item.skill.name), description: analysisJob.description } },
    potentialScore: growth.category, potentialReason: growth.summary,
    strengths: match.matchedSkills.join(', '), missingRequirements: [...match.missingSkills, ...match.unverifiedRequirements].join('; '),
    appliedAt, stageChangedAt: status === 'APPLIED' ? null : new Date(appliedAt.getTime() + 4 * 60 * 60 * 1000), stageChangedById: status === 'APPLIED' ? null : owner.id, stageChangeSource: status === 'APPLIED' ? 'SYSTEM' : 'RECRUITER',
    candidateSnapshot: { name: candidate.user.name, headline: candidate.profile.headline, location: candidate.profile.location }, cvTextSnapshot: analysisProfile.resumes[0]?.parsedText || `${candidate.user.name}\n${candidate.profile.headline}\n${candidate.profile.yearsExperience} years experience`,
  };
  const application = await prisma.application.upsert({ where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.profile.id } }, create: { jobId: job.id, candidateId: candidate.profile.id, ...data }, update: data });
  await prisma.applicationEvent.deleteMany({ where: { applicationId: application.id } });
  await prisma.applicationEvent.createMany({ data: [
    { applicationId: application.id, actorId: null, newStatus: 'APPLIED', createdAt: appliedAt },
    ...(status === 'APPLIED' ? [] : [{ applicationId: application.id, actorId: owner.id, previousStatus: 'APPLIED', newStatus: status, createdAt: data.stageChangedAt ?? appliedAt }]),
  ] });
  return application;
}

async function createInterviews(applications, owner, now) {
  const selected = applications.filter(application => ['INTERVIEW', 'OFFER', 'HIRED'].includes(application.status)).slice(0, 3);
  await prisma.interview.deleteMany({ where: { notes: { startsWith: 'Recruiter demo schedule:' } } });
  const times = [new Date(now.getTime() + 4 * 60 * 60 * 1000), new Date(now.getTime() + DAY + 2 * 60 * 60 * 1000), new Date(now.getTime() + 7 * DAY + 3 * 60 * 60 * 1000)];
  for (let index = 0; index < selected.length; index += 1) {
    const application = selected[index];
    await prisma.interview.create({ data: { applicationId: application.id, jobId: application.jobId, scheduledById: owner.id, startAt: times[index], endAt: new Date(times[index].getTime() + 45 * 60 * 1000), type: index === 0 ? 'TECHNICAL' : 'VIDEO', status: 'SCHEDULED', location: index === 1 ? 'Google Meet' : 'Tunis office', notes: `Recruiter demo schedule: round ${index + 1}` } });
  }
  return selected.length;
}

async function createDemoCommunications(applications, owner) {
  if (!applications.length) return 0;
  await prisma.candidateCommunication.deleteMany({ where: { applicationId: { in: applications.map(application => application.id) } } });
  const selected = applications.slice(0, 4);
  await prisma.candidateCommunication.createMany({ data: selected.map((application, index) => ({ applicationId: application.id, senderId: owner.id, subject: index % 2 ? 'Next steps' : 'Application received', body: index % 2 ? 'Merci pour votre candidature. Nous revenons vers vous après examen du dossier.' : 'Votre candidature a bien été reçue par notre équipe.', channel: 'EMAIL', status: 'SENT', requestId: `recruiter-demo-message-${application.id}` })) });
  return selected.length;
}

async function main() {
  assertDevOnly();
  const company = await findCompany();
  if (!company) throw new Error('No existing EasyJob Test Company membership found. Pass --company-id or --company-slug; this command never creates a company.');
  const owner = ownerFor(company);
  if (!owner) throw new Error(`Company ${company.id} has no active member who can own demo jobs.`);
  const maxPlan = await ensureMaxPlan(company);
  // A plan change never changes the owner's password or account status.
  if (process.argv.includes('--reset')) await resetDemo(company.id);
  const now = new Date();
  const candidateRecords = new Map();
  for (const definition of candidates) candidateRecords.set(definition[1], await upsertCandidate(definition, now));
  const jobRecords = new Map();
  for (const definition of jobs) jobRecords.set(definition.key, await upsertJob(company, owner, definition, now));
  const applications = [];
  const counts = [12, 8, 5, 3];
  const expectedApplicationCount = counts.reduce((total, count) => total + count, 0);
  for (let jobIndex = 0; jobIndex < counts.length; jobIndex += 1) {
    const job = jobRecords.get(jobs[jobIndex].key);
    for (let candidateIndex = 0; candidateIndex < counts[jobIndex]; candidateIndex += 1) {
      const definition = candidates[(candidateIndex + jobIndex * 2) % candidates.length];
      const candidate = candidateRecords.get(definition[1]);
      applications.push(await upsertApplication(job, candidate, owner, applications.length, now));
    }
  }
  const interviews = await createInterviews(applications, owner, now);
  const messages = await createDemoCommunications(applications, owner);
  const expectedInterviews = Math.min(3, applications.filter(application => ['INTERVIEW', 'OFFER', 'HIRED'].includes(application.status)).length);
  const published = jobs.filter(job => job.status === 'PUBLISHED').length;
  const drafts = jobs.filter(job => job.status === 'DRAFT').length;
  const closed = jobs.filter(job => job.status === 'CLOSED').length;
  const persistedJobs = await prisma.job.count({ where: { companyId: company.id, slug: { startsWith: JOB_PREFIX } } });
  const persistedApplications = await prisma.application.count({ where: { job: { companyId: company.id, slug: { startsWith: JOB_PREFIX } } } });
  if (persistedJobs !== jobs.length || persistedApplications !== expectedApplicationCount || interviews !== expectedInterviews) throw new Error(`Seed verification failed: jobs=${persistedJobs}, applications=${persistedApplications}, interviews=${interviews}`);
  console.log(JSON.stringify({ company: company.commercialName, companyId: company.id, jobs: { total: persistedJobs, published, draft: drafts, closed }, candidates: candidates.length, applications: persistedApplications, interviews, reset: process.argv.includes('--reset'), maxPlan, messages }, null, 2));
}

if (require.main === module) {
  main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
