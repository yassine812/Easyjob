'use client';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';
import { resolveAccountType } from '@/lib/permissions';
import { recruiterJobsRoute } from '@/lib/job-display';
import type { MeUser } from '@/types/api';

export function resolveWorkspace(user: MeUser | null, activeCompanyId: string | null) {
  const type = user ? resolveAccountType(user) : null;
  const companyId = user?.memberships.find(m => m.companyId === activeCompanyId)?.companyId ?? user?.memberships[0]?.companyId;
  const currentWorkspace = type === 'company' ? 'recruiter' : type === 'candidate' ? 'career' : type === 'admin' ? 'admin' : 'public';
  const home = currentWorkspace === 'recruiter' ? companyId ? `/company/${encodeURIComponent(companyId)}/dashboard` : '/companies/new' : currentWorkspace === 'career' ? '/candidate/dashboard' : currentWorkspace === 'admin' ? '/platform-admin' : '/';
  const jobs = currentWorkspace === 'recruiter' ? companyId ? recruiterJobsRoute(companyId) : '/companies/new' : currentWorkspace === 'career' ? '/candidate/jobs' : '/jobs';
  return { currentWorkspace, companyId, home, jobs };
}

export function useWorkspace() {
  const user = useAuthStore(s => s.user);
  const companyId = useCompanyStore(s => s.activeCompanyId);
  return resolveWorkspace(user, companyId);
}
