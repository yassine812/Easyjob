import { describe, expect, it } from 'vitest';
import {
  COMPANY_PERMISSION_MATRIX,
  PLATFORM_PERMISSIONS,
  hasCompanyPermission,
  hasPlatformPermission,
  isPlatformAdmin,
  memberRoleOf,
} from './permissions';
import type { MeUser, MemberRole } from '@/types/api';
import type { Permission } from '@/types/auth';
import { makeUser } from '@/test/factories';

const member = (role: MemberRole, companyId = 'c1'): MeUser =>
  makeUser({
    id: 'u1',
    name: 'Test',
    email: 't@test.dev',
    roles: [role],
    memberships: [{ companyId, role }],
  });

const admin: MeUser = makeUser({
  id: 'u9',
  name: 'Admin',
  email: 'admin@test.dev',
  roles: ['PLATFORM_ADMIN'],
});

describe('isPlatformAdmin', () => {
  it('returns true only for PLATFORM_ADMIN', () => {
    expect(isPlatformAdmin(admin)).toBe(true);
    expect(isPlatformAdmin(member('COMPANY_ADMIN'))).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
  });
});

describe('memberRoleOf', () => {
  it('returns the role for the matching company', () => {
    expect(memberRoleOf(member('HR', 'c2'), 'c2')).toBe('HR');
    expect(memberRoleOf(member('HR', 'c2'), 'c1')).toBeNull();
    expect(memberRoleOf(null, 'c1')).toBeNull();
  });
});

describe('hasCompanyPermission', () => {
  it('gives the COMPANY_ADMIN the full company permission set', () => {
    for (const permission of COMPANY_PERMISSION_MATRIX.COMPANY_ADMIN) {
      expect(hasCompanyPermission(member('COMPANY_ADMIN'), 'c1', permission)).toBe(true);
    }
  });

  it('gives an INTERVIEWER only interview + basic view permissions', () => {
    expect(hasCompanyPermission(member('INTERVIEWER'), 'c1', 'interview.create')).toBe(true);
    expect(hasCompanyPermission(member('INTERVIEWER'), 'c1', 'application.view')).toBe(true);
    expect(hasCompanyPermission(member('INTERVIEWER'), 'c1', 'application.move')).toBe(false);
    expect(hasCompanyPermission(member('INTERVIEWER'), 'c1', 'team.manage')).toBe(false);
    expect(hasCompanyPermission(member('INTERVIEWER'), 'c1', 'billing.manage')).toBe(false);
  });

  it('never grants company permissions for a company the user is not a member of', () => {
    expect(hasCompanyPermission(member('COMPANY_ADMIN', 'c1'), 'c2', 'job.create')).toBe(false);
    expect(hasCompanyPermission(null, 'c1', 'job.create')).toBe(false);
  });

  it('gives platform admins every tenant permission regardless of membership', () => {
    expect(hasCompanyPermission(admin, 'any-company', 'job.create')).toBe(true);
    expect(hasCompanyPermission(admin, 'any-company', 'application.move')).toBe(true);
  });

  it('does not grant admin.* permissions to company roles', () => {
    expect(hasCompanyPermission(member('COMPANY_ADMIN'), 'c1', 'admin.users')).toBe(false);
    expect(hasCompanyPermission(member('COMPANY_ADMIN'), 'c1', 'admin.companies')).toBe(false);
  });
});

describe('hasPlatformPermission', () => {
  it('grants admin permissions only to platform admins', () => {
    for (const permission of PLATFORM_PERMISSIONS) {
      expect(hasPlatformPermission(admin, permission)).toBe(true);
    }
    expect(hasPlatformPermission(member('COMPANY_ADMIN'), 'admin.users')).toBe(false);
  });
});

describe('permission catalog integrity', () => {
  it('every role has only real backend permissions', () => {
    const real: Permission[] = [
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
      ...PLATFORM_PERMISSIONS,
    ];
    for (const role of Object.values(COMPANY_PERMISSION_MATRIX)) {
      for (const permission of role) {
        expect(real).toContain(permission);
      }
    }
  });
});
