'use client';

import {
  BarChart3,
  Briefcase,
  CalendarClock,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useRole } from '@/hooks/use-auth';
import { RequireCompanyMember } from '@/components/shared/guards';
import { AppShell, type NavItem } from '@/components/layout/app-shell';

import { useI18n } from '@/lib/i18n';
import { Building2 } from 'lucide-react';
import { CompanySearch } from '@/components/company/company-search';
import { useCompanyText } from '@/lib/i18n/company';

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const user = useAuthStore((s) => s.user);
  const { can } = useRole();
  const { t } = useI18n();
  const copy = useCompanyText();

  const membership = user?.memberships.find((m) => m.companyId === companyId);
  const companyStatus = membership?.companyStatus;
  const companyName = membership?.companyName || t.company.recruiterPortal;

  const nav: NavItem[] = [
    { href: `/company/${companyId}/dashboard`, label: t.nav.dashboard, icon: LayoutDashboard, show: can(companyId, 'application.view') },
    { group: 'recruitment', href: `/company/${companyId}/jobs`, label: t.nav.jobs, icon: Briefcase, show: can(companyId, 'application.view') },
    { group: 'recruitment', href: `/company/${companyId}/applications`, label: t.nav.applications, activePaths: [`/company/${companyId}/pipeline`], icon: ClipboardList, show: can(companyId, 'application.view') },
    { group: 'recruitment', href: `/company/${companyId}/candidates`, label: copy('candidates'), icon: Users, show: can(companyId, 'candidate.view') },
    { group: 'recruitment', href: `/company/${companyId}/interviews`, label: t.nav.interviews, icon: CalendarClock, show: can(companyId, 'application.view') },
    { group: 'recruitment', href: `/company/${companyId}/analytics`, label: t.nav.analytics, icon: BarChart3, show: can(companyId, 'analytics.view') },
    { group: 'organization', href: `/company/${companyId}/team`, label: t.nav.team, icon: Users, show: can(companyId, 'team.view') },
    { group: 'organization', href: `/company/${companyId}/assessments`, label: t.nav.assessments, icon: ClipboardList, show: can(companyId, 'assessment.manage') },
    { placement: 'bottom', href: `/company/${companyId}/billing`, label: t.nav.billing, icon: CreditCard, show: can(companyId, 'billing.manage') },
    { placement: 'bottom', href: `/company/${companyId}/settings`, label: t.nav.settings, icon: Settings, show: can(companyId, 'team.manage') },
  ];

  const sidebarHeader = (
    <div className="flex items-center gap-3 px-2 py-1">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white font-bold shadow-md shadow-indigo-500/25">
        <Building2 className="size-5" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
          {companyName}
        </h2>
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
          {copy('workspace')}
        </p>
      </div>
    </div>
  );

  return (
    <RequireCompanyMember companyId={companyId}>
      <AppShell key={companyId} nav={nav} sidebarHeader={sidebarHeader} topbarLeft={<CompanySearch companyId={companyId} />}>
        {companyStatus === 'SUSPENDED' ? (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {copy('suspended')}
          </div>
        ) : null}
        {children}
      </AppShell>
    </RequireCompanyMember>
  );
}

