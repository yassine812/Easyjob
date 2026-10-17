import { PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../src/common/constants/permissions';
import { ROLE_PERMISSIONS } from '../src/common/constants/roles';

const PLANS = [
  {
    name: 'CAREER_AI', type: 'CANDIDATE' as const, priceCents: 7900, currency: 'TND', billingInterval: 'MONTHLY' as const, sortOrder: 3,
    features: { 'cv.uploads': 50, 'ats.basic': true, 'ai.cv_analyze': true, 'ai.cv_generate': true, 'ai.cv_tailor': true,
      'ai.match': true, 'ai.cover_letter': true, 'ai.interview': true, 'career.builder': true,
      'career.match': true, 'career.alerts': true, 'career.auto_apply': true, 'career.coach': true, 'career.vision': true },
  },
  {
    name: 'FREE',
    type: 'CANDIDATE' as const,
    priceCents: 0,
    currency: 'TND',
    billingInterval: 'MONTHLY' as const,
    sortOrder: 1,
    features: { 'cv.uploads': 3, 'ai.cv_analyze': true, 'ats.basic': true, 'ai.cv_generate': false, 'ai.match': false, 'ai.cover_letter': false, 'ai.interview': false },
  },
  {
    name: 'PRO',
    type: 'CANDIDATE' as const,
    priceCents: 4900,
    currency: 'TND',
    billingInterval: 'MONTHLY' as const,
    sortOrder: 2,
    features: { 'cv.uploads': 20, 'career.builder': true, 'career.match': true, 'career.alerts': true, 'ai.cv_analyze': true, 'ai.cv_generate': true, 'ai.match': true, 'ai.cover_letter': true, 'ai.interview': true },
  },
  {
    name: 'TRIAL',
    type: 'COMPANY' as const,
    priceCents: 0,
    currency: 'TND',
    billingInterval: 'MONTHLY' as const,
    sortOrder: 1,
    features: { 'team.members': 5, 'activeJobs': 3, 'ai.enabled': false, 'ai.analyses.monthly': 0, 'automation.enabled': false, 'assessments.enabled': false, 'analytics.enabled': false, 'interviews.enabled': false, 'advanced.search': false, 'advanced.permissions': false, 'audit.logs': false, recruitment_intelligence: false },
  },
  {
    name: 'BUSINESS',
    type: 'COMPANY' as const,
    priceCents: 14900,
    currency: 'TND',
    billingInterval: 'MONTHLY' as const,
    sortOrder: 2,
    features: { 'team.members': 20, 'activeJobs': 20, 'ai.enabled': true, 'ai.analyses.monthly': 100, 'automation.enabled': true, 'assessments.enabled': true, 'analytics.enabled': true, 'interviews.enabled': true, 'advanced.search': true, 'advanced.permissions': false, 'audit.logs': false, recruitment_intelligence: false },
  },
  {
    name: 'PRO',
    type: 'COMPANY' as const,
    priceCents: 29900,
    currency: 'TND',
    billingInterval: 'MONTHLY' as const,
    sortOrder: 3,
    features: { 'team.members': 50, 'activeJobs': 50, 'ai.enabled': true, 'ai.analyses.monthly': 1000, 'automation.enabled': true, 'assessments.enabled': true, 'analytics.enabled': true, 'interviews.enabled': true, 'advanced.search': true, 'advanced.permissions': true, 'audit.logs': false, recruitment_intelligence: false },
  },
  {
    name: 'ENTERPRISE',
    type: 'COMPANY' as const,
    priceCents: 89900,
    currency: 'TND',
    billingInterval: 'MONTHLY' as const,
    sortOrder: 4,
    features: { 'team.members': 1000, 'activeJobs': 200, 'ai.enabled': true, 'ai.analyses.monthly': 10000, 'automation.enabled': true, 'assessments.enabled': true, 'analytics.enabled': true, 'interviews.enabled': true, 'advanced.search': true, 'advanced.permissions': true, 'audit.logs': true, recruitment_intelligence: true },
  },
];

/** Seeds roles, permissions and plans (system data) — called after each truncation. */
export async function seedEssential(prisma: PrismaClient): Promise<void> {
  const permissionIds = new Map<string, string>();
  for (const name of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    permissionIds.set(name, permission.id);
  }
  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({ where: { name: roleName }, create: { name: roleName }, update: {} });
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
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { name_type: { name: plan.name, type: plan.type } },
      create: plan,
      update: { features: plan.features as object, priceCents: plan.priceCents, active: true },
    });
  }
}

