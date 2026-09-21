import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ROLE_PERMISSIONS } from '../src/common/constants/roles';
import { PERMISSIONS } from '../src/common/constants/permissions';

const prisma = new PrismaClient();

const PASSWORD = 'Password123!';

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
      priceCents: 0,
      currency: 'TND',
      billingInterval: 'MONTHLY' as const,
      sortOrder: 1,
      features: {
        'cv.uploads': 3,
        'ai.cv_analyze': true,
        'career.builder': false,
        'career.match': false,
        'career.alerts': false,
        'career.auto_apply': false,
        'career.coach': false, 'career.vision': false, 'ats.basic': true,
        'ai.cv_generate': false,
        'ai.match': false,
        'ai.cover_letter': false,
        'ai.interview': false,
        'applications': 10000,
      },
    },
    {
      name: 'PRO',
      type: 'CANDIDATE' as const,
      priceCents: 2499,
      currency: 'TND',
      billingInterval: 'MONTHLY' as const,
      sortOrder: 2,
      features: {
        'cv.uploads': 20,
        'ai.cv_analyze': true,
        'ai.cv_generate': true,
        'ai.match': true,
        'ai.cover_letter': true,
        'ai.interview': false,
        'career.builder': true,
        'career.match': true,
        'career.alerts': true,
        'career.auto_apply': false,
        'career.coach': false, 'career.vision': false, 'ats.basic': true, 'ai.cv_tailor': true,
        'applications': 100000,
      },
    },
    {
      name: 'PREMIUM', type: 'CANDIDATE' as const, priceCents: 4999,
      currency: 'TND', billingInterval: 'MONTHLY' as const, sortOrder: 3,
      features: {
        'cv.uploads': 50, 'ai.cv_analyze': true, 'ai.cv_generate': true, 'ai.cv_tailor': true, 'ats.basic': true,
        'ai.match': true, 'ai.cover_letter': true, 'ai.interview': true,
        'career.builder': true, 'career.match': true, 'career.alerts': true,
        'career.auto_apply': true, 'career.coach': true, 'career.vision': true, 'applications': 100000,
      },
    },
    {
      name: 'TRIAL',
      type: 'COMPANY' as const,
      priceCents: 0,
      currency: 'TND',
      billingInterval: 'MONTHLY' as const,
      sortOrder: 1,
      features: {
        'team.members': 5,
        'activeJobs': 3,
        'ai.enabled': false,
        'ai.analyses.monthly': 0,
        'automation.enabled': false,
        'assessments.enabled': false,
        'analytics.enabled': false,
        'interviews.enabled': false,
        'advanced.search': false,
        'advanced.permissions': false,
        'audit.logs': false,
        'billing.manage': true,
      },
    },
    {
      name: 'BUSINESS',
      type: 'COMPANY' as const,
      priceCents: 14900,
      currency: 'TND',
      billingInterval: 'MONTHLY' as const,
      sortOrder: 2,
      features: {
        'team.members': 20,
        'activeJobs': 20,
        'ai.enabled': true,
        'ai.analyses.monthly': 100,
        'automation.enabled': true,
        'assessments.enabled': true,
        'analytics.enabled': true,
        'interviews.enabled': true,
        'advanced.search': true,
        'advanced.permissions': false,
        'audit.logs': false,
        'billing.manage': true,
      },
    },
    {
      name: 'PRO',
      type: 'COMPANY' as const,
      priceCents: 29900,
      currency: 'TND',
      billingInterval: 'MONTHLY' as const,
      sortOrder: 3,
      features: {
        'team.members': 50,
        'activeJobs': 50,
        'ai.enabled': true,
        'ai.analyses.monthly': 1000,
        'automation.enabled': true,
        'assessments.enabled': true,
        'analytics.enabled': true,
        'interviews.enabled': true,
        'advanced.search': true,
        'advanced.permissions': true,
        'audit.logs': false,
        'billing.manage': true,
      },
    },
    {
      name: 'ENTERPRISE',
      type: 'COMPANY' as const,
      priceCents: 89900,
      currency: 'TND',
      billingInterval: 'MONTHLY' as const,
      sortOrder: 4,
      features: {
        'team.members': 1000,
        'activeJobs': 200,
        'ai.enabled': true,
        'ai.analyses.monthly': 10000,
        'automation.enabled': true,
        'assessments.enabled': true,
        'analytics.enabled': true,
        'interviews.enabled': true,
        'advanced.search': true,
        'advanced.permissions': true,
        'audit.logs': true,
        'billing.manage': true,
      },
    },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name_type: { name: plan.name, type: plan.type } },
      create: { ...plan, priceTndCents: plan.priceCents, pricesJson: { TND: plan.priceCents } },
      update: { features: plan.features as object, ...(process.env.SEED_SYSTEM_ONLY === 'true' ? {} : { priceCents: plan.priceCents, priceTndCents: plan.priceCents, currency: plan.currency, active: true }) },
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
        website: `https://${def.slug}.example.com`,
        industry: def.industry,
        description: `${def.commercialName} — a fictional company used for development/testing.`,
        city: def.city,
        country: def.country,
        professionalEmail: `contact@${def.slug}.example.com`,
        registrationIdentifier: `REG-${def.key}-12345`,
        status: def.status,
      },
      update: { status: def.status },
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

  // Jobs
  const jobDefs = [
    { company: 'A', title: 'Senior Backend Engineer', status: 'PUBLISHED' as const, skills: ['TypeScript', 'Node.js', 'PostgreSQL'] },
    { company: 'A', title: 'Frontend Engineer', status: 'PUBLISHED' as const, skills: ['JavaScript', 'React'] },
    { company: 'A', title: 'Product Designer', status: 'PUBLISHED' as const, skills: ['Figma'] },
    { company: 'A', title: 'Platform Engineer', status: 'PENDING_APPROVAL' as const, skills: ['Docker', 'PostgreSQL'] },
    { company: 'A', title: 'Security Engineer', status: 'DRAFT' as const, skills: ['Docker'] },
    { company: 'C', title: 'Data Analyst', status: 'PUBLISHED' as const, skills: ['SQL', 'Python'] },
    { company: 'B', title: 'QA Engineer', status: 'PENDING_APPROVAL' as const, skills: [] },
  ];

  const jobs: Array<{ id: string; companyId: string; title: string }> = [];
  for (const def of jobDefs) {
    const company = companies[def.company];
    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        createdById: users[`${def.company}Admin`] ?? company.adminUserId,
        title: def.title,
        slug: `${def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
        description: `OFFRE DE DÉMONSTRATION — aucune embauche réelle.\nDécouvrez le parcours de candidature au poste de ${def.title} chez ${company.commercialName}. ${def.skills.length ? `Compétences utilisées dans cet exemple : ${def.skills.join(", ")}.` : "Le poste consiste à vérifier la qualité des fonctionnalités avant livraison."}\nLe scénario permet de tester la candidature, la présélection et l’entretien.`,
        responsibilities: ['Réaliser les tâches du poste et documenter les résultats', 'Collaborer avec l’équipe lors des revues de travail'],
        requirements: [...def.skills.map(skill => `Connaissance de ${skill}`), 'Présenter clairement son travail en entretien'],
        location: 'Remote',
        remote: true,
        employmentType: 'FULL_TIME',
        experienceLevel: 'SENIOR',
        salaryMin: 80000,
        salaryMax: 140000,
        currency: 'USD',
        status: def.status,
        expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
        ...(def.status === 'PUBLISHED' ? { publishedAt: new Date(), approvedAt: new Date(), approvedById: admin.id } : {}),
      },
    });
    jobs.push({ id: job.id, companyId: company.id, title: def.title });
    for (const skillName of def.skills) {
      const skill = await prisma.skill.upsert({
        where: { normalizedName: skillName.toLowerCase() },
        create: { name: skillName, normalizedName: skillName.toLowerCase() },
        update: {},
      });
      await prisma.jobSkill.create({
        data: { jobId: job.id, skillId: skill.id, required: true, level: 'ADVANCED' },
      });
    }
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
