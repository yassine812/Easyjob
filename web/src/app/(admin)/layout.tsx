'use client';

import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  CreditCard,
  FileClock,
  LayoutDashboard,
  ShieldCheck,
  Users,
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
          { placement: 'bottom', href: '/admin/subscriptions', label: ux('subscriptions'), icon: CreditCard },
          { placement: 'bottom', href: '/admin/audit-logs', label: ux('audit'), icon: FileClock },
          { href: '/admin/analytics', label: t('analytics'), icon: BarChart3 },
        ]}
      >
        {children}
      </AppShell>
    </RequireAdmin>
  );
}

export { ClipboardList };
