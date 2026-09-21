'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useAuth } from '@/hooks/use-auth';
import {
  hasCompanyPermission,
  isPlatformAdmin,
  resolveAccountType,
  getDashboardRoute,
} from '@/lib/permissions';
import type { Permission } from '@/types/auth';
import { PageLoader } from './index';
import { ErrorState } from './index';

/** Requires an authenticated session; redirects to /login otherwise. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const mustChangePassword = useAuthStore(s => s.user?.mustChangePassword);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    else if (mustChangePassword) router.replace('/change-password');
  }, [status, router, mustChangePassword]);

  if (status === 'loading') return <PageLoader />;
  if (status !== 'authenticated') return null;
  if (mustChangePassword) return null;
  return <>{children}</>;
}

/** Requires the platform PLATFORM_ADMIN role. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (user && !isPlatformAdmin(user)) {
      router.replace(getDashboardRoute(user));
    }
  }, [status, user, router]);

  if (status === 'loading') return <PageLoader />;
  if (!user || !isPlatformAdmin(user)) return null;
  return <>{children}</>;
}

/** Requires the user to be a company member or platform admin for a company workspace. */
export function RequireCompanyMember({
  companyId,
  children,
}: {
  companyId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { status } = useAuth();
  const user = useAuthStore((s) => s.user);

  const accountType = user ? resolveAccountType(user) : null;
  const isMember = user?.memberships.some((m) => m.companyId === companyId);
  const isAdmin = user ? isPlatformAdmin(user) : false;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (user) {
      if (accountType === 'candidate') {
        router.replace('/candidate/dashboard');
        return;
      }
      if (accountType === 'company' && !isMember && !isAdmin) {
        const first = user.memberships[0];
        if (first) {
          router.replace(`/company/${first.companyId}/dashboard`);
        } else {
          router.replace('/companies/new');
        }
      }
    }
  }, [status, user, accountType, isMember, isAdmin, router]);

  if (status === 'loading') return <PageLoader />;
  if (!user) return null;
  if (accountType === 'candidate') return null;

  if (!isMember && !isAdmin) {
    return (
      <div className="mx-auto max-w-md py-16">
        <ErrorState
          title="Not a member of this company"
          message="You don't have access to this company workspace."
        />
      </div>
    );
  }

  return <>{children}</>;
}

/** Requires a tenant permission within a company (or PLATFORM_ADMIN). */
export function RequireCompanyPermission({
  companyId,
  permission,
  children,
}: {
  companyId: string;
  permission: Permission;
  children: ReactNode;
}) {
  const router = useRouter();
  const { status } = useAuth();
  const user = useAuthStore((s) => s.user);

  const accountType = user ? resolveAccountType(user) : null;
  const allowed = user ? hasCompanyPermission(user, companyId, permission) : false;
  const isMember = user?.memberships.some((m) => m.companyId === companyId);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (user) {
      if (accountType === 'candidate') {
        router.replace('/candidate/dashboard');
        return;
      }
      if (!allowed) {
        if (!isMember) {
          const first = user.memberships[0];
          router.replace(first ? `/company/${first.companyId}/dashboard` : '/companies/new');
        }
      }
    }
  }, [status, user, accountType, allowed, isMember, router]);

  if (status === 'loading') return <PageLoader />;
  if (!user || accountType === 'candidate') return null;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-md py-16">
        <ErrorState
          title="You don't have access"
          message={
            isMember
              ? 'Your role in this company does not allow this action. Contact a company admin if you think this is a mistake.'
              : 'You are not a member of this company.'
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}

/** Requires the platform CANDIDATE account type (candidate workspace). */
export function RequireCandidate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const user = useAuthStore((s) => s.user);
  const accountType = user ? resolveAccountType(user) : null;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (user) {
      if (accountType === 'company') {
        const first = user.memberships[0];
        router.replace(first ? `/company/${first.companyId}/dashboard` : '/companies/new');
      } else if (accountType === 'admin') {
        router.replace('/admin/dashboard');
      }
    }
  }, [status, user, accountType, router]);

  if (status === 'loading') return <PageLoader />;
  if (!user || accountType !== 'candidate') return null;
  return <>{children}</>;
}
