/**
 * Canonical permission identifiers. These are seeded into the database and
 * referenced by @Permissions(...) decorators.
 */
export const PERMISSIONS = [
  // candidate data
  'candidate.view',
  'candidate.cv.view',
  // jobs
  'job.create',
  'job.update',
  'job.delete',
  'job.publish',
  'job.approve',
  // applications
  'application.view',
  'application.update',
  'application.move',
  // team
  'team.view',
  'team.invite',
  'team.manage',
  // interviews
  'interview.create',
  'interview.update',
  // analytics & billing
  'analytics.view',
  'billing.view',
  'billing.manage',
  // automation & assessments
  'automation.manage',
  'assessment.manage',
  // platform admin
  'admin.users',
  'admin.companies',
  'admin.verifications',
  'admin.jobs',
  'admin.dashboard',
  'admin.subscriptions',
  'admin.audit',
  'admin.billing',
  'admin.plans',
  'admin.notifications',
  'admin.support',
  'admin.system',
  'admin.platform_admins',
  'admin.company_manage',
  'admin.user_manage',
  'admin.job_moderate',
  'admin.support_manage',
  'admin.billing_manage',
  'admin.plan_manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (value: string): value is Permission =>
  (PERMISSIONS as readonly string[]).includes(value);
