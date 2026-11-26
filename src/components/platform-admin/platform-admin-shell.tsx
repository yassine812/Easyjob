'use client';

import { Bell, BriefcaseBusiness, FileClock, LayoutDashboard, LifeBuoy, Settings, Users, ReceiptText, PackageCheck, Activity } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAdmin } from '@/components/shared/guards';

export const platformAdminNav = [
  { href: '/platform-admin', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { group: 'Gestion', href: '/platform-admin/users', label: 'Utilisateurs', icon: Users, activePaths: ['/platform-admin/candidates', '/platform-admin/companies'] },
  { group: 'Gestion', href: '/platform-admin/jobs', label: 'Offres d’emploi', icon: BriefcaseBusiness },
  { group: 'Facturation', href: '/platform-admin/plans', label: 'Plans', icon: PackageCheck },
  { group: 'Facturation', href: '/platform-admin/invoices', label: 'Factures', icon: ReceiptText },
  { group: 'Opérations', href: '/platform-admin/notifications', label: 'Notifications', icon: Bell },
  { group: 'Opérations', href: '/platform-admin/support', label: 'Support', icon: LifeBuoy },
  { group: 'Opérations', href: '/platform-admin/audit-logs', label: 'Audit', icon: FileClock },
  { group: 'Opérations', href: '/platform-admin/system', label: 'Santé système', icon: Activity },
  { group: 'Configuration', href: '/platform-admin/settings', label: 'Paramètres', icon: Settings },
];

export function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  return <RequireAdmin><AppShell compactSidebar nav={platformAdminNav} supportHref="/platform-admin/support" sidebarHeader={<div className="px-3"><Logo href="/platform-admin" size="sm" /><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Administration plateforme</p></div>}>{children}</AppShell></RequireAdmin>;
}
