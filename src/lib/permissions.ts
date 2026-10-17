import type { MeUser, MemberRole, Role } from '@/types/api';
import type { Permission } from '@/types/auth';

/**
 * Frontend RBAC mirror of the backend permission matrix
 * (src/common/constants/roles.ts in the NestJS backend).
 *
 * IMPORTANT: this is for UX (navigation, button visibility) only.
 * The backend is the final authority and returns 403 — always handle it.
 */
export const COMPANY_PERMISSION_MATRIX: Record<MemberRole, Permission[]> = {
  COMPANY_ADMIN: [
    'candidate.view',
    'candidate.cv.view',
    'job.create',
    'job.update',
    'job.delete',
    'job.publish',
    'application.view',
    'application.update',
    'application.move',
    'team.view',
    'team.invite',
    'team.manage',
    'interview.create',
    'interview.update',
    'analytics.view',
    'billing.view',
    'billing.manage',
    'automation.manage',
    'assessment.manage',
  ],
  HR: [
    'candidate.view',
    'candidate.cv.view',
    'job.create',
    'job.update',
    'job.publish',
    'application.view',
    'application.update',
    'application.move',
    'team.view',
    'team.invite',
    'interview.create',
    'interview.update',
    'analytics.view',
  ],
  RECRUITER: [
    'candidate.view',
    'candidate.cv.view',
    'job.create',
    'job.update',
    'job.publish',
    'application.view',
    'application.update',
    'application.move',
    'team.view',
    'interview.create',
    'interview.update',
    'analytics.view',
  ],
  HIRING_MANAGER: [
    'candidate.view',
    'candidate.cv.view',
    'application.view',
    'application.update',
    'application.move',
    'team.view',
    'interview.create',
    'interview.update',
    'analytics.view',
  ],
  INTERVIEWER: [
    'candidate.view',
    'candidate.cv.view',
    'application.view',
    'team.view',
    'interview.create',
    'interview.update',
  ],
};

/** Tenant-level permission granted only to platform admins (not to company roles). */
export const PLATFORM_PERMISSIONS: Permission[] = [
  'admin.users',
  'admin.companies',
  'admin.verifications',
  'admin.jobs',
  'admin.analytics',
  'admin.subscriptions',
  'admin.audit',
  'admin.billing',
  'admin.plans',
  'admin.support',
  'admin.system',
  'admin.platform_admins',
  'admin.company_manage',
  'admin.user_manage',
  'admin.job_moderate',
  'admin.support_manage',
  'admin.billing_manage',
  'admin.plan_manage',
];

export const PLATFORM_ADMIN_ROLES: Role[] = [
  'PLATFORM_ADMIN', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN', 'READ_ONLY_ADMIN',
];

export type AccountType = 'candidate' | 'company' | 'admin';

export const COMPANY_ROLES: Role[] = [
  'COMPANY_ADMIN',
  'HR',
  'RECRUITER',
  'HIRING_MANAGER',
  'INTERVIEWER',
];

export function resolveAccountType(user: MeUser | null | undefined): AccountType {
  if (!user) return 'candidate';
  if (user.roles.some((role) => PLATFORM_ADMIN_ROLES.includes(role))) {
    return 'admin';
  }
  if (
    user.roles.some((r) => COMPANY_ROLES.includes(r as Role)) ||
    (user.memberships && user.memberships.length > 0)
  ) {
    return 'company';
  }
  return 'candidate';
}

export function isCandidate(user: MeUser | null | undefined): boolean {
  return resolveAccountType(user) === 'candidate';
}

export function isCompanyUser(user: MeUser | null | undefined): boolean {
  return resolveAccountType(user) === 'company';
}

export function isPlatformAdmin(user: MeUser | null | undefined): boolean {
  return !!user && user.roles.some((role) => PLATFORM_ADMIN_ROLES.includes(role));
}

export function getDashboardRoute(user: MeUser | null | undefined): string {
  if (user?.mustChangePassword) return '/change-password';
  const accountType = resolveAccountType(user);
  if (accountType === 'admin') {
    // Keep the canonical entry point used by the auth flow and legacy links.
    // `/platform-admin` remains available as an alias for direct navigation.
    return '/admin/dashboard';
  }
  if (accountType === 'company') {
    const companyId = user?.memberships[0]?.companyId;
    return companyId ? `/company/${companyId}/dashboard` : '/company/dashboard';
  }
  return '/candidate/dashboard';
}

export function memberRoleOf(user: MeUser | null | undefined, companyId: string | null): MemberRole | null {
  if (!user || !companyId) return null;
  return user.memberships.find((m) => m.companyId === companyId)?.role ?? null;
}

export function hasCompanyPermission(
  user: MeUser | null | undefined,
  companyId: string | null,
  permission: Permission,
): boolean {
  if (isPlatformAdmin(user)) return true;
  const role = memberRoleOf(user, companyId);
  if (!role) return false;
  return COMPANY_PERMISSION_MATRIX[role].includes(permission);
}

export function hasPlatformPermission(user: MeUser | null | undefined, permission: Permission): boolean {
  return isPlatformAdmin(user) && PLATFORM_PERMISSIONS.includes(permission);
}

/** Does the user hold the given platform role? */
export function hasRole(user: MeUser | null | undefined, role: string): boolean {
  return !!user && user.roles.includes(role as MeUser['roles'][number]);
}
