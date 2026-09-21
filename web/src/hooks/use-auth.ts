'use client';

import { useAuthStore } from '@/store/auth-store';
import {
  hasCompanyPermission,
  hasPlatformPermission,
  hasRole,
  isPlatformAdmin,
  memberRoleOf,
} from '@/lib/permissions';
import type { MeUser, MemberRole } from '@/types/api';
import type { Permission } from '@/types/auth';

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const lastEmail = useAuthStore((s) => s.lastEmail);
  const setLastEmail = useAuthStore((s) => s.setLastEmail);

  return {
    status,
    user,
    accessToken,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    setUser,
    clearSession,
    lastEmail,
    setLastEmail,
  };
}

export function useRole(): {
  isAdmin: boolean;
  isCandidateOnly: boolean;
  roleIn: (companyId: string | null) => MemberRole | null;
  can: (companyId: string | null, permission: Permission) => boolean;
  canPlatform: (permission: Permission) => boolean;
  hasPlatformRole: (role: string) => boolean;
} {
  const user = useAuthStore((s) => s.user) as MeUser | null;
  return {
    isAdmin: isPlatformAdmin(user),
    isCandidateOnly: !!user && user.roles.includes('CANDIDATE') && user.memberships.length === 0,
    roleIn: (companyId) => memberRoleOf(user, companyId),
    can: (companyId, permission) => hasCompanyPermission(user, companyId, permission),
    canPlatform: (permission) => hasPlatformPermission(user, permission),
    hasPlatformRole: (role) => hasRole(user, role),
  };
}
