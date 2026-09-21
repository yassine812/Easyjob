'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCompanyStore } from '@/store/company-store';
import { useAuthStore } from '@/store/auth-store';
import { companiesApi, type CompanyWithRole } from '@/lib/api/companies';

/**
 * Active-company selection. Persisted id is public data; the canonical list
 * of memberships always comes from /auth/me (backend truth).
 */
export function useActiveCompany() {
  const routeCompanyId = useParams<{ companyId?: string }>()?.companyId;
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const setActiveCompanyId = useCompanyStore((s) => s.setActiveCompanyId);
  const memberships = useAuthStore((s) => s.user?.memberships ?? []);
  useEffect(() => {
    if (routeCompanyId && memberships.some(m => m.companyId === routeCompanyId)) setActiveCompanyId(routeCompanyId);
  }, [routeCompanyId, memberships, setActiveCompanyId]);

  const activeMembership =
    memberships.find((m) => m.companyId === (routeCompanyId ?? activeCompanyId)) ?? memberships[0] ?? null;

  return {
    activeCompanyId: activeMembership?.companyId ?? null,
    activeCompany: activeMembership,
    setActiveCompanyId,
    memberships,
  };
}

export function useMyCompanies() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['my-companies', user?.id],
    queryFn: () => companiesApi.listMine(),
    enabled: !!user && user.memberships.length > 0,
    staleTime: 60_000,
  });
}

/** Company detail for a given id (public endpoint). */
export function useCompany(companyId: string) {
  return useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companiesApi.get(companyId),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useRequireCompany(companyId: string) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const membership = user?.memberships.find((m) => m.companyId === companyId);
  if (user && !membership) {
    // Not a member of this company — bounce to their first membership.
    const first = user.memberships[0];
    if (first) router.replace(`/company/${first.companyId}/dashboard`);
  }
  return membership;
}

export function useCompanyRole(companyId: string) {
  const user = useAuthStore((s) => s.user);
  return user?.memberships.find((m) => m.companyId === companyId)?.role ?? null;
}

/** Company list refresh helper used after creating a company. */
export async function fetchMyCompanies(): Promise<CompanyWithRole[]> {
  return companiesApi.listMine();
}
