import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ROLE_PERMISSIONS } from '../src/common/constants/roles';
import { PERMISSIONS } from '../src/common/constants/permissions';
import { CANDIDATE_PLAN_CATALOG, COMPANY_PLAN_CATALOG } from '../src/subscriptions/plan-catalog';

const prisma = new PrismaClient();

const PASSWORD = 'Password123!';
const TEST_CANDIDATE_PASSWORDS = {
  'candidate.free@easyjob.test': 'EJ-Test-Free-2026!xQ7#Lm9',
  'candidate.pro@easyjob.test': 'EJ-Test-Pro-2026@vR8$Np4',
  'candidate.premium@easyjob.test': 'EJ-Test-Premium-2026#kT6!Wx9',
} as const;

/**
 * Safety guard: never create fake companies/candidates/applications on a real
 * production database. The seed may only run when the environment is NOT
 * production, or when SEED_FORCE=true is explicitly set (used only in isolated
 * demo environments — never on a production database with real users).
 */
function assertSeedAllowed(): void {
  if (process.env.SEED_SYSTEM_ONLY === 'true') return;
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
  const forced = process.env.SEED_FORCE === 'true';
  if (nodeEnv === 'production' && !forced) {
    console.error(
      'Refusing to seed: NODE_ENV=production. If you really need demo data in an isolated environment, re-run with SEED_FORCE=true.',
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assertSeedAllowed();
  console.log('Seeding roles and permissions...');
  const permissionIds = new Map<string, string>();
  for (const name of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { name },
      create: { name, description: `Allows ${name}` },
      update: {},
    });
    permissionIds.set(name, permission.id);
  }

  const roleIds = new Map<string, string>();
  for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, description: `${name} role` },
      update: {},
    });
    roleIds.set(name, role.id);
    for (const permission of permissions) {
      const pid = permissionIds.get(permission);
      if (!pid) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: pid } },
        create: { roleId: role.id, permissionId: pid },
        update: {},
      });
    }
  }

  console.log('Seeding plans...');
  const plans = [
    {
      name: 'FREE',
      type: 'CANDIDATE' as const,
      priceCents: CANDIDATE_PLAN_CATALOG.FREE.priceCents,
      currency: 'TND',
      billingInterval: 'MONTHLY' as const,
      sortOrder: 1,
      features: CANDIDATE_PLAN_CATALOG.FREE.features,
    },
    {
      name: 'PRO',
      type: 'CANDIDATE' as const,
      priceCents: CANDIDATE_PLAN_CATALOG.PRO.priceCents,
      currency: 'TND',
      billingInterval: 'MONTHLY' as const,
      sortOrder: 2,
      features: CANDIDATE_PLAN_CATALOG.PRO.features,
    },
    {
      name: 'PREMIUM', type: 'CANDIDATE' as const, priceCents: CANDIDATE_PLAN_CATALOG.PREMIUM.priceCents,
      currency: 'TND', billingInterval: 'MONTHLY' as const, sortOrder: 3,
      features: CANDIDATE_PLAN_CATALOG.PREMIUM.features,
    },
    ...Object.values(COMPANY_PLAN_CATALOG).map((plan, index) => ({
      name: plan.name, type: 'COMPANY' as const, priceCents: plan.priceCents,
      currency: 'TND', billingInterval: 'MONTHLY' as const, sortOrder: index + 1,
      features: plan.features,
    })),
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name_type: { name: plan.name, type: plan.type } },
      create: { ...plan, priceTndCents: plan.priceCents, pricesJson: { TND: plan.priceCents } },
      // Refresh commercial policy without modifying existing payment records.
      update: { features: plan.features as object, priceCents: plan.priceCents,
        priceTndCents: plan.priceCents, pricesJson: { TND: plan.priceCents },
        currency: plan.currency, active: true },
    });
  }
  // CAREER_AI was the previous public name for Premium. Keep existing
  // subscriptions readable, but prevent the legacy plan from appearing in
  // the candidate catalogue after the rename.
  await prisma.plan.updateMany({
    where: { name: 'CAREER_AI', type: 'CANDIDATE' },
    data: { active: false, sortOrder: 99 },
  });

  if (process.env.SEED_SYSTEM_ONLY === 'true') {
    console.log('System roles, permissions and plans are ready. No demo users or jobs created.');
    return;
  }
  console.log('Seeding users and companies...');
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  const mkUser = async (name: string, email: string, platformRoles: string[] = ['CANDIDATE']) => {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        name,
        email,
        passwordHash: hash,
        emailVerifiedAt: now,
        status: 'ACTIVE',
      },
      update: {},
    });
    for (const role of platformRoles) {
      const roleId = roleIds.get(role);
      if (!roleId) continue;
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        create: { userId: user.id, roleId },
        update: {},
      });
    }
    return user;
  };

  // Platform admin
  const admin = await mkUser('Platform Admin', 'admin@startupstarter.test', ['PLATFORM_ADMIN', 'CANDIDATE']);

  // Companies
  const companyDefs = [
    {
      key: 'A',
      legalName: 'Acme Corporation S.A.',
      commercialName: 'Acme',
      slug: 'acme',
      industry: 'SaaS',
      country: 'US',
      city: 'San Francisco',
      status: 'ACTIVE' as const,
      verification: 'VERIFIED' as const,
    },
    {
      key: 'B',
      legalName: 'Globex Holdings Ltd',
      commercialName: 'Globex',
      slug: 'globex',
      industry: 'E-commerce',
      country: 'GB',
      city: 'London',
      status: 'PENDING_VERIFICATION' as const,
      verification: 'UNDER_REVIEW' as const,
    },
    {
      key: 'C',
      legalName: 'Initech SARL',
      commercialName: 'Initech',
      slug: 'initech',
      industry: 'Fintech',
      country: 'TN',
      city: 'Tunis',
      status: 'ACTIVE' as const,
      verification: 'VERIFIED' as const,
    },
    {
      key: 'D',
      legalName: 'EasyJob Matching Lab SARL',
      commercialName: 'EasyJob Matching Lab',
      slug: 'easyjob-matching-lab',
      website: 'https://matching-lab.test',
      industry: 'Software',
      country: 'TN',
      city: 'Tunis',
      status: 'ACTIVE' as const,
      verification: 'VERIFIED' as const,
    },
  ];

  const companies: Record<string, { id: string; adminUserId: string; commercialName: string }> = {};
  const users: Record<string, string> = {};

  for (const def of companyDefs) {
    const adminUser = await mkUser(`${def.commercialName} Admin`, `${def.key.toLowerCase()}admin@startupstarter.test`, [
      'COMPANY_ADMIN',
    ]);
    const company = await prisma.company.upsert({
      where: { slug: def.slug },
      create: {
        legalName: def.legalName,
        commercialName: def.commercialName,
        slug: def.slug,
        website: def.website ?? `https://${def.slug}.example.com`,
        industry: def.industry,
        description: `${def.commercialName} — a fictional company used for development/testing.`,
        city: def.city,
        country: def.country,
        professionalEmail: `contact@${def.slug}.example.com`,
        registrationIdentifier: `REG-${def.key}-12345`,
        status: def.status,
      },
      update: { status: def.status, website: def.website ?? `https://${def.slug}.example.com` },
    });
    await prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: company.id, userId: adminUser.id } },
      create: { companyId: company.id, userId: adminUser.id, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
      update: { role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    });
    await prisma.companyVerification.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        status: def.verification,
        submittedAt: now,
        ...(def.verification === 'VERIFIED' ? { reviewedAt: now, reviewedById: admin.id } : {}),
      },
      update: { status: def.verification },
    });
    companies[def.key] = { id: company.id, adminUserId: adminUser.id, commercialName: company.commercialName };
    users[`${def.key}Admin`] = adminUser.id;
  }

  // Team members for company A
  const teamDefs = [
    { key: 'A', email: 'hr@acme.example.com', name: 'Alice HR', role: 'HR' as const, platformRole: 'HR' },
    { key: 'A', email: 'recruiter@acme.example.com', name: 'Rex Recruiter', role: 'RECRUITER' as const, platformRole: 'RECRUITER' },
    { key: 'A', email: 'hm@acme.example.com', name: 'Hannah Manager', role: 'HIRING_MANAGER' as const, platformRole: 'HIRING_MANAGER' },
    { key: 'A', email: 'interviewer@acme.example.com', name: 'Ivan Interviewer', role: 'INTERVIEWER' as const, platformRole: 'INTERVIEWER' },
    { key: 'C', email: 'hr@initech.example.com', name: 'Claire HR', role: 'HR' as const, platformRole: 'HR' },
  ];
  for (const def of teamDefs) {
    const user = await mkUser(def.name, def.email, [def.platformRole]);
    await prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: companies[def.key].id, userId: user.id } },
      create: { companyId: companies[def.key].id, userId: user.id, role: def.role, status: 'ACTIVE' },
      update: { role: def.role, status: 'ACTIVE' },
    });
  }

  // Candidates
  const candidateDefs = [
    { name: 'Cara Candidate', email: 'cara@example.test', headline: 'Senior Backend Engineer', skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'], years: 6 },
    { name: 'Bob Builder', email: 'bob@example.test', headline: 'Full-Stack Developer', skills: ['JavaScript', 'React', 'Node.js'], years: 4 },
    { name: 'Dana Designer', email: 'dana@example.test', headline: 'Product Designer', skills: ['Figma', 'UI/UX', 'Design Systems'], years: 5 },
    { name: 'Eve Analyst', email: 'eve@example.test', headline: 'Data Analyst', skills: ['SQL', 'Python', 'Pandas'], years: 3 },
  ];
  const candidateIds: Record<string, string> = {};
  for (const def of candidateDefs) {
    const user = await mkUser(def.name, def.email);
    const profile = await prisma.candidateProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        headline: def.headline,
        bio: `Profil de démonstration : ${def.headline}, ${def.years} ans d’expérience. Exemple fictif pour découvrir le parcours candidat.`,
        location: 'Remote',
        yearsExperience: def.years,
        visibility: 'RECRUITERS_ONLY',
        remotePreference: true,
      },
      update: { headline: def.headline },
    });
    candidateIds[def.name] = profile.id;
    for (const skillName of def.skills) {
      const skill = await prisma.skill.upsert({
        where: { normalizedName: skillName.toLowerCase() },
        create: { name: skillName, normalizedName: skillName.toLowerCase() },
        update: {},
      });
      await prisma.candidateSkill.upsert({
        where: { candidateId_skillId: { candidateId: profile.id, skillId: skill.id } },
        create: { candidateId: profile.id, skillId: skill.id, level: 'ADVANCED' },
        update: {},
      });
    }
    if (!await prisma.experience.findFirst({ where: { candidateId: profile.id, companyName: 'Atelier Numérique — Démonstration', title: def.headline } })) await prisma.experience.create({
      data: {
        candidateId: profile.id,
        companyName: 'Atelier Numérique — Démonstration',
        title: def.headline,
        description: `Exemple fictif pour le rôle ${def.headline}.\n• Concevoir et livrer les fonctionnalités de son périmètre.\n• Documenter le travail et vérifier sa qualité avec l’équipe.`,
        startDate: new Date('2020-01-01'),
        endDate: null,
        current: true,
      },
    });
    if (!await prisma.education.findFirst({ where: { candidateId: profile.id, institution: 'Institut du Numérique — Démonstration' } })) await prisma.education.create({
      data: {
        candidateId: profile.id,
        institution: 'Institut du Numérique — Démonstration',
        degree: 'Licence (exemple)',
        field: 'Informatique',
        startDate: new Date('2014-09-01'),
        endDate: new Date('2018-06-01'),
      },
    });
  }

  // Dedicated, reproducible candidate accounts for plan-gate testing. These
  // are development-only identities and never use real payment providers.
  const testCandidateDefs = [
    { name: 'Amine Ben Salem', email: 'candidate.free@easyjob.test', plan: 'FREE', headline: 'Développeur web junior', skills: ['JavaScript', 'React', 'SQL'], years: 2, autoApply: false },
    { name: 'Sami Trabelsi', email: 'candidate.pro@easyjob.test', plan: 'PRO', headline: 'Ingénieur logiciel', skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'], years: 5, autoApply: false },
    { name: 'Youssef Mansour', email: 'candidate.premium@easyjob.test', plan: 'PREMIUM', headline: 'Ingénieur Full-Stack senior', skills: ['TypeScript', 'React', 'NestJS', 'PostgreSQL', 'AWS'], years: 8, autoApply: true },
  ] as const;
  for (const def of testCandidateDefs) {
    const passwordHash = await bcrypt.hash(TEST_CANDIDATE_PASSWORDS[def.email], 10);
    const user = await prisma.user.upsert({
      where: { email: def.email },
      create: { name: def.name, email: def.email, passwordHash, emailVerifiedAt: now, status: 'ACTIVE' },
      // Preserve credentials and account status when refreshing demo content.
      update: {},
    });
    const roleId = roleIds.get('CANDIDATE');
    if (roleId) await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId } }, create: { userId: user.id, roleId }, update: {} });
    const profile = await prisma.candidateProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, headline: def.headline, bio: `Profil synthétique Software de test pour vérifier le plan ${def.plan}.`, location: 'Tunis, Tunisie', yearsExperience: def.years, visibility: 'RECRUITERS_ONLY', remotePreference: true },
      update: { headline: def.headline, bio: `Profil synthétique Software de test pour vérifier le plan ${def.plan}.`, location: 'Tunis, Tunisie', yearsExperience: def.years, remotePreference: true },
    });
    for (const skillName of def.skills) {
      const skill = await prisma.skill.upsert({ where: { normalizedName: skillName.toLowerCase() }, create: { name: skillName, normalizedName: skillName.toLowerCase() }, update: {} });
      await prisma.candidateSkill.upsert({ where: { candidateId_skillId: { candidateId: profile.id, skillId: skill.id } }, create: { candidateId: profile.id, skillId: skill.id, level: 'ADVANCED' }, update: { level: 'ADVANCED' } });
    }
    await prisma.jobPreference.upsert({ where: { candidateId: profile.id }, create: { candidateId: profile.id, jobTitle: def.headline, location: 'Tunis', remote: true, salaryMin: 2500, salaryMax: 9000, currency: 'TND', keywords: [...def.skills] }, update: { jobTitle: def.headline, location: 'Tunis', remote: true, salaryMin: 2500, salaryMax: 9000, currency: 'TND', keywords: [...def.skills] } });
    await prisma.careerSettings.upsert({ where: { candidateId: profile.id }, create: { candidateId: profile.id, domains: ['Software'], locations: ['Tunis'], workModes: ['REMOTE', 'HYBRID'], minimumScore: 70, autoApply: def.autoApply, autoMinimumScore: 85, maxPerDay: 3, salaryCurrency: 'TND' }, update: { domains: ['Software'], locations: ['Tunis'], workModes: ['REMOTE', 'HYBRID'], minimumScore: 70, autoApply: def.autoApply, autoMinimumScore: 85, maxPerDay: 3, salaryCurrency: 'TND' } });
    const resume = await prisma.resume.findFirst({ where: { candidateId: profile.id, filename: 'easyjob-test-cv.txt' } });
    const resumeData = { filename: 'easyjob-test-cv.txt', storageKey: `seed/test-candidates/${def.plan.toLowerCase()}/cv.txt`, mimeType: 'text/plain', fileSize: 420, version: 1, isPrimary: true, parsedText: `${def.name}\n${def.headline}\nCompétences: ${def.skills.join(', ')}\nExpérience: ${def.years} ans de développement logiciel à Tunis.`, processingStatus: 'COMPLETED' as const, extractedProfile: { skills: def.skills, summary: def.headline } };
    if (resume) await prisma.resume.update({ where: { id: resume.id }, data: resumeData });
    else await prisma.resume.create({ data: { candidateId: profile.id, ...resumeData } });
    const plan = await prisma.plan.findUnique({ where: { name_type: { name: def.plan, type: 'CANDIDATE' } } });
    if (!plan) throw new Error(`Missing candidate plan ${def.plan}`);
    await prisma.subscription.updateMany({ where: { candidateId: profile.id, ownerType: 'CANDIDATE', status: { in: ['ACTIVE', 'TRIALING'] } }, data: { status: 'CANCELED', canceledAt: now } });
    await prisma.subscription.upsert({
      where: { provider_providerSubscriptionId: { provider: 'seed', providerSubscriptionId: `easyjob-test-${def.plan.toLowerCase()}` } },
      create: { ownerType: 'CANDIDATE', candidateId: profile.id, planId: plan.id, provider: 'seed', providerSubscriptionId: `easyjob-test-${def.plan.toLowerCase()}`, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 3600 * 1000) },
      update: { ownerType: 'CANDIDATE', candidateId: profile.id, planId: plan.id, status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 3600 * 1000), canceledAt: null },
    });
  }

  // Jobs
  type SeedJobDef = {
    company: string; title: string; status: 'PUBLISHED' | 'PENDING_APPROVAL' | 'DRAFT'; skills: string[];
    location?: string; remote?: boolean; workMode?: string; employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
    experienceLevel?: 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE'; minimumYearsExperience?: number;
    requirements?: string[]; domain?: string; salaryMin?: number; salaryMax?: number; currency?: string;
  };
  const jobDefs: SeedJobDef[] = [
    { company: 'A', title: 'Senior Backend Engineer', status: 'PUBLISHED' as const, skills: ['TypeScript', 'Node.js', 'PostgreSQL'] },
    { company: 'A', title: 'Frontend Engineer', status: 'PUBLISHED' as const, skills: ['JavaScript', 'React'] },
    { company: 'A', title: 'Product Designer', status: 'PUBLISHED' as const, skills: ['Figma'] },
    { company: 'A', title: 'Platform Engineer', status: 'PENDING_APPROVAL' as const, skills: ['Docker', 'PostgreSQL'] },
    { company: 'A', title: 'Security Engineer', status: 'DRAFT' as const, skills: ['Docker'] },
    { company: 'C', title: 'Data Analyst', status: 'PUBLISHED' as const, skills: ['SQL', 'Python'] },
    // These deterministic offers give the FREE test account a real, explainable
    // high-match preview that is blurred until the candidate upgrades.
    { company: 'D', title: 'Développeur Web Junior — JavaScript React SQL', status: 'PUBLISHED', skills: ['JavaScript', 'React', 'SQL'], location: 'Tunis, Tunisie', remote: true, workMode: 'HYBRID', experienceLevel: 'JUNIOR', minimumYearsExperience: 2, requirements: ['JavaScript', 'React', 'SQL'], salaryMin: 3500, salaryMax: 5500, currency: 'TND' },
    { company: 'D', title: 'Assistant Développeur React — JavaScript SQL', status: 'PUBLISHED', skills: ['JavaScript', 'React', 'SQL'], location: 'Tunis, Tunisie', remote: true, workMode: 'HYBRID', experienceLevel: 'JUNIOR', minimumYearsExperience: 2, requirements: ['JavaScript', 'React', 'SQL'], salaryMin: 3200, salaryMax: 5000, currency: 'TND' },
    { company: 'B', title: 'QA Engineer', status: 'PENDING_APPROVAL' as const, skills: [] },
  ];

  const jobs: Array<{ id: string; companyId: string; title: string }> = [];
  for (const def of jobDefs) {
    const company = companies[def.company];
    const slug = `${def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-demo`;
    const job = await prisma.job.upsert({
      where: { companyId_slug: { companyId: company.id, slug } },
      create: {
        companyId: company.id,
        createdById: users[`${def.company}Admin`] ?? company.adminUserId,
        title: def.title,
        slug,
        description: `OFFRE DE DÉMONSTRATION — aucune embauche réelle.\nDécouvrez le parcours de candidature au poste de ${def.title} chez ${company.commercialName}. ${def.skills.length ? `Compétences utilisées dans cet exemple : ${def.skills.join(", ")}.` : "Le poste consiste à vérifier la qualité des fonctionnalités avant livraison."}\nLe scénario permet de tester la candidature, la présélection et l’entretien.`,
        responsibilities: ['Réaliser les tâches du poste et documenter les résultats', 'Collaborer avec l’équipe lors des revues de travail'],
        requirements: def.requirements ?? [...def.skills.map(skill => `Connaissance de ${skill}`), 'Présenter clairement son travail en entretien'],
        location: def.location ?? 'Remote',
        remote: def.remote ?? true,
        workMode: def.workMode,
        domain: def.domain,
        employmentType: def.employmentType ?? 'FULL_TIME',
        experienceLevel: def.experienceLevel ?? 'SENIOR',
        minimumYearsExperience: def.minimumYearsExperience,
        salaryMin: def.salaryMin ?? 80000,
        salaryMax: def.salaryMax ?? 140000,
        currency: def.currency ?? 'USD',
        status: def.status,
        expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
        ...(def.status === 'PUBLISHED' ? { publishedAt: new Date(), approvedAt: new Date(), approvedById: admin.id } : {}),
      },
      update: { title: def.title, status: def.status, requirements: def.requirements ?? [...def.skills.map(skill => `Connaissance de ${skill}`), 'Présenter clairement son travail en entretien'], location: def.location ?? 'Remote', remote: def.remote ?? true, workMode: def.workMode, domain: def.domain, employmentType: def.employmentType ?? 'FULL_TIME', experienceLevel: def.experienceLevel ?? 'SENIOR', minimumYearsExperience: def.minimumYearsExperience, salaryMin: def.salaryMin ?? 80000, salaryMax: def.salaryMax ?? 140000, currency: def.currency ?? 'USD', expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000), ...(def.status === 'PUBLISHED' ? { publishedAt: now, approvedAt: now, approvedById: admin.id } : {}) },
    });
    jobs.push({ id: job.id, companyId: company.id, title: def.title });
    for (const skillName of def.skills) {
      const skill = await prisma.skill.upsert({
        where: { normalizedName: skillName.toLowerCase() },
        create: { name: skillName, normalizedName: skillName.toLowerCase() },
        update: {},
      });
      await prisma.jobSkill.upsert({ where: { jobId_skillId: { jobId: job.id, skillId: skill.id } }, create: { jobId: job.id, skillId: skill.id, required: true, level: 'ADVANCED' }, update: { required: true, level: 'ADVANCED' } });
    }
  }

  // Deterministic lifecycle fixtures for candidate search tests. Only the
  // ACTIVE fixture is visible through the candidate marketplace.
  const lifecycleJobs = [
    { slug: 'easyjob-test-active', title: 'Test Active Software Engineer', status: 'PUBLISHED' as const, expiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000) },
    { slug: 'easyjob-test-expired', title: 'Test Expired Software Engineer', status: 'EXPIRED' as const, expiresAt: new Date(now.getTime() - 24 * 3600 * 1000) },
    { slug: 'easyjob-test-closed', title: 'Test Closed Software Engineer', status: 'CLOSED' as const, expiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000) },
    { slug: 'easyjob-test-paused', title: 'Test Paused Software Engineer', status: 'PAUSED' as const, expiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000) },
  ];
  for (const fixture of lifecycleJobs) {
    const company = companies.C;
    const job = await prisma.job.upsert({
      where: { companyId_slug: { companyId: company.id, slug: fixture.slug } },
      create: { companyId: company.id, createdById: company.adminUserId, title: fixture.title, slug: fixture.slug, description: `Offre synthétique EasyJob pour tester le statut ${fixture.status}.`, responsibilities: ['Tester la recherche candidat'], requirements: ['TypeScript'], location: 'Tunis', remote: true, employmentType: 'FULL_TIME', experienceLevel: 'MID', salaryMin: 3500, salaryMax: 6000, currency: 'TND', status: fixture.status, expiresAt: fixture.expiresAt, ...(fixture.status === 'PUBLISHED' ? { publishedAt: now, approvedAt: now, approvedById: admin.id } : {}) },
      update: { title: fixture.title, status: fixture.status, expiresAt: fixture.expiresAt, ...(fixture.status === 'PUBLISHED' ? { publishedAt: now, approvedAt: now, approvedById: admin.id } : {}) },
    });
    const skill = await prisma.skill.upsert({ where: { normalizedName: 'typescript' }, create: { name: 'TypeScript', normalizedName: 'typescript' }, update: {} });
    await prisma.jobSkill.upsert({ where: { jobId_skillId: { jobId: job.id, skillId: skill.id } }, create: { jobId: job.id, skillId: skill.id, required: true, level: 'INTERMEDIATE' }, update: { required: true } });
  }

  // Applications with pipeline events
  const applicationDefs = [
    { candidate: 'Cara Candidate', jobTitle: 'Senior Backend Engineer', status: 'INTERVIEW' as const },
    { candidate: 'Bob Builder', jobTitle: 'Frontend Engineer', status: 'SHORTLISTED' as const },
    { candidate: 'Dana Designer', jobTitle: 'Product Designer', status: 'APPLIED' as const },
    { candidate: 'Eve Analyst', jobTitle: 'Data Analyst', status: 'SCREENING' as const },
  ];
  const applicationIds: string[] = [];
  for (const def of applicationDefs) {
    const job = jobs.find((j) => j.title === def.jobTitle);
    if (!job) continue;
    const candidateId = candidateIds[def.candidate];
    if (!candidateId) continue;
    const existingApplication = await prisma.application.findFirst({ where: { jobId: job.id, candidateId } });
    if (existingApplication) { applicationIds.push(existingApplication.id); continue; }
    const application = await prisma.application.create({
      data: {
        jobId: job.id,
        candidateId,
        motivation: 'Candidature de démonstration : je souhaite présenter mon parcours et échanger sur les missions de cette offre fictive.',
        status: def.status,
        appliedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      },
    });
    applicationIds.push(application.id);
    const flow: Array<'APPLIED' | 'SCREENING' | 'SHORTLISTED' | 'ASSESSMENT' | 'INTERVIEW'> = [
      'APPLIED',
      'SCREENING',
      'SHORTLISTED',
      'ASSESSMENT',
      'INTERVIEW',
    ];
    const idx = flow.indexOf(def.status);
    for (let i = 0; i <= idx; i++) {
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          actorId: companies[def.jobTitle === 'Data Analyst' ? 'C' : 'A'].adminUserId,
          previousStatus: i === 0 ? null : flow[i - 1],
          newStatus: flow[i],
          metadata: { source: 'seed' },
        },
      });
    }
    if (def.status === 'INTERVIEW') {
      const candidateUser = await prisma.candidateProfile.findUnique({
        where: { id: candidateId },
        include: { user: true },
      });
      if (candidateUser) {
        await prisma.interview.create({
          data: {
            applicationId: application.id,
            jobId: job.id,
            scheduledById: companies[def.jobTitle === 'Data Analyst' ? 'C' : 'A'].adminUserId,
            startAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
            endAt: new Date(Date.now() + 3 * 24 * 3600 * 1000 + 3600 * 1000),
            type: 'VIDEO',
            location: 'https://meet.example.com/seed-interview',
            status: 'SCHEDULED',
            notes: 'Fictional seed interview',
          },
        });
        await prisma.notification.create({
          data: {
            userId: candidateUser.user.id,
            type: 'interview.scheduled',
            title: 'Interview scheduled',
            message: `Interview scheduled for ${def.jobTitle}.`,
          },
        });
      }
    }
  }

  // Sample automation rule for company A
  await prisma.automationRule.create({
    data: {
      companyId: companies['A'].id,
      createdById: users['AAdmin'],
      name: 'Notify recruiter on shortlist',
      triggerType: 'APPLICATION_STATUS_CHANGED',
      triggerConfig: {},
      conditions: [{ field: 'newStatus', op: 'eq', value: 'SHORTLISTED' }],
      actions: [
        { type: 'send_notification', config: { role: 'RECRUITER', title: 'Candidate shortlisted', message: 'A candidate was shortlisted.' } },
      ],
      active: true,
    },
  });

  // Sample assessment for company A
  const assessment = await prisma.assessment.create({
    data: {
      companyId: companies['A'].id,
      createdById: users['AAdmin'],
      title: 'Backend technical screening',
      description: 'Fictional screening assessment.',
      type: 'TECHNICAL',
      durationMinutes: 30,
      status: 'ACTIVE',
      questions: {
        create: [
          { prompt: 'What is the time complexity of binary search?', type: 'MULTIPLE_CHOICE', options: [{ label: 'O(log n)', value: 'O(log n)' }, { label: 'O(n)', value: 'O(n)' }], correctAnswer: 'O(log n)', points: 2, order: 0 },
          { prompt: 'Describe how you would design a rate limiter.', type: 'TEXT', points: 5, order: 1 },
        ],
      },
    },
  });

  console.log(
    `Seeded: ${permissionIds.size} permissions, ${roleIds.size} roles, ${plans.length} plans, 1 admin, ${companyDefs.length} companies, ${candidateDefs.length} candidates, ${jobs.length} jobs, ${applicationIds.length} applications, 1 automation rule, 1 assessment (${assessment.id})`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
