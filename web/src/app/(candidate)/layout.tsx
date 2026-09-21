'use client';
import { FileText, LayoutDashboard, Search, Video, CreditCard, User, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireCandidate } from '@/components/shared/guards';
import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { useCareerText } from '@/lib/i18n/career';
import { useUxText } from '@/lib/i18n/ux';
import { CandidateGuide } from '@/components/candidate/candidate-guide';
export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  const t = useCareerText(), ux = useUxText(), pathname = usePathname();
  const jobTabs = [['jobs', 'find'], ['recommended', 'recommended'], ['saved', 'saved'], ['alerts', 'alerts']];
  const cvTabs = [['cvs', 'cvs'], ['cv-builder', 'builder'], ['ats', 'ats']];
  const applicationTabs = [['applications', 'applications'], ['auto-apply', 'auto']];
  const tabs = [jobTabs, cvTabs, applicationTabs].find(group => group.some(([path]) => pathname === `/candidate/${path}` || pathname.startsWith(`/candidate/${path}/`)));
  const nav: NavItem[] = [
    { href: '/candidate/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/candidate/jobs', label: t('find'), icon: Search, group: 'discover', activePaths: jobTabs.map(([path]) => `/candidate/${path}`) },
    { href: '/candidate/applications', label: t('applications'), icon: FileText, group: 'discover', activePaths: ['/candidate/auto-apply'] },
    { href: '/candidate/cvs', label: t('cvs'), icon: FileText, group: 'preparation', activePaths: ['/candidate/cv-builder', '/candidate/ats'] },
    { href: '/candidate/interview-coach', label: t('coach'), icon: Video, group: 'preparation' },
    { href: '/candidate/profile', label: t('profile'), icon: User, group: 'preparation' },
    { href: '/candidate/subscription', label: t('subscription'), icon: CreditCard, placement: 'bottom' },
    { href: '/settings', label: ux('account'), icon: Settings, placement: 'bottom' },
  ];
  const searchItems = [...nav, ...[...jobTabs.slice(1), ...cvTabs.slice(1), ...applicationTabs.slice(1)].map(([path, key]) => ({ href: `/candidate/${path}`, label: t(key), icon: FileText }))];
  return <RequireCandidate><AppShell nav={nav} searchItems={searchItems}>{tabs && <nav className="module-tabs" aria-label={ux('navigation')}>{tabs.map(([path, key]) => <Link key={path} href={`/candidate/${path}`} aria-current={pathname === `/candidate/${path}` || pathname.startsWith(`/candidate/${path}/`) ? 'page' : undefined}>{t(key)}</Link>)}</nav>}{children}</AppShell><CandidateGuide /></RequireCandidate>;
}
