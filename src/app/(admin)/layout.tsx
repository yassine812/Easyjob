'use client';

import {
  Briefcase,
  Building2,
  CreditCard,
  Database,
  FileClock,
  LayoutDashboard,
  ShieldCheck,
  Users,
  LifeBuoy,
} from 'lucide-react';
import { RequireAdmin } from '@/components/shared/guards';
import { useCompanyText } from '@/lib/i18n/company';
import { useUxText } from '@/lib/i18n/ux';
import { AppShell } from '@/components/layout/app-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useCompanyText(), ux = useUxText();
  return (
    <RequireAdmin>
      <AppShell
        nav={[
          { href: '/admin/dashboard', label: t('dashboard'), icon: LayoutDashboard },
          { group: 'manage', href: '/admin/users', label: ux('users'), icon: Users },
          { group: 'manage', href: '/admin/companies', label: ux('companies'), icon: Building2 },
          { group: 'manage', href: '/admin/verifications', label: ux('verifications'), icon: ShieldCheck },
          { group: 'manage', href: '/admin/jobs', label: t('jobs'), icon: Briefcase },
          { group: 'manage', href: '/admin/job-sources', label: t('jobSourceDashboard'), icon: Database },
          { group: 'manage', href: '/admin/support', label: 'Support inbox', icon: LifeBuoy },
          { placement: 'bottom', href: '/admin/subscriptions', label: ux('subscriptions'), icon: CreditCard },
          { placement: 'bottom', href: '/admin/audit-logs', label: ux('audit'), icon: FileClock },
        ]}
      >
        {children}
      </AppShell>
    </RequireAdmin>
  );
}
