'use client';

import { Bell, Building2, FileClock, LayoutDashboard, LifeBuoy, Settings, UserRound, ReceiptText, PackageCheck, Activity } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAdmin } from '@/components/shared/guards';

const nav = [
  { href: '/platform-admin', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { group: 'Gestion des comptes', href: '/platform-admin/candidates', label: 'Candidats', icon: UserRound },
  { group: 'Gestion des comptes', href: '/platform-admin/companies', label: 'Entreprises', icon: Building2 },
  { group: 'Facturation', href: '/platform-admin/plans', label: 'Plans', icon: PackageCheck },
  { group: 'Facturation', href: '/platform-admin/invoices', label: 'Factures', icon: ReceiptText },
  { group: 'Opérations', href: '/platform-admin/notifications', label: 'Notifications', icon: Bell },
  { group: 'Opérations', href: '/platform-admin/support', label: 'Support', icon: LifeBuoy },
  { group: 'Opérations', href: '/platform-admin/audit-logs', label: 'Audit', icon: FileClock },
  { group: 'Opérations', href: '/platform-admin/system', label: 'Santé système', icon: Activity },
  { group: 'Configuration', href: '/platform-admin/settings', label: 'Paramètres', icon: Settings },
];

export function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  return <RequireAdmin><AppShell compactSidebar nav={nav} supportHref="/platform-admin/support" sidebarHeader={<div className="px-3"><p className="text-sm font-semibold tracking-tight">EasyJob</p><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Administration plateforme</p></div>}>{children}</AppShell></RequireAdmin>;
}
