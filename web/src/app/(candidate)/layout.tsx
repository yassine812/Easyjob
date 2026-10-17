'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { Crown, FileText, LayoutDashboard, Search, Video, CreditCard, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { RequireCandidate } from '@/components/shared/guards';
import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { useCareerText } from '@/lib/i18n/career';
import { useUxText } from '@/lib/i18n/ux';
import { CandidateGuide } from '@/components/candidate/candidate-guide';
import { useEntitlement } from '@/hooks/use-entitlement';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supportApi } from '@/lib/api/support';
export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  const t = useCareerText(), ux = useUxText(), pathname = usePathname(), ent = useEntitlement('CANDIDATE');
  const supportUnread = useQuery({ queryKey: ['support-unread'], queryFn: supportApi.unreadCount, staleTime: 15_000, retry: false });
  const [coachUpgradeOpen, setCoachUpgradeOpen] = useState(false);
  const [autoUpgradeOpen, setAutoUpgradeOpen] = useState(false);
  const jobTabs = [['jobs', 'find'], ['recommended', 'recommended'], ['saved', 'saved'], ['alerts', 'alerts']];
  const applicationTabs = [['applications', 'applications'], ['auto-apply', 'auto']];
  const tabs = [jobTabs, applicationTabs].find(group => group.some(([path]) => pathname === `/candidate/${path}` || pathname.startsWith(`/candidate/${path}/`)));
  const nav: NavItem[] = [
    { href: '/candidate/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/candidate/jobs', label: t('find'), icon: Search, group: 'discover', activePaths: jobTabs.map(([path]) => `/candidate/${path}`) },
    { href: '/candidate/applications', label: t('applications'), icon: FileText, group: 'discover' },
    { href: '/candidate/auto-apply', label: t('auto'), icon: EasyJobFeatureMark, group: 'discover', premium: true, locked: !ent.loading && ent.feature('career.auto_apply') !== true, onLockedClick: () => setAutoUpgradeOpen(true) },
    { href: '/candidate/cvs', label: t('cvs'), icon: FileText, group: 'preparation' },
    { href: '/candidate/interview-coach', label: t('coach'), icon: Video, group: 'preparation', premium: true, locked: !ent.loading && ent.feature('career.coach') !== true, onLockedClick: () => setCoachUpgradeOpen(true) },
    { href: '/candidate/profile', label: t('profile'), icon: User, group: 'preparation' },
    { href: '/candidate/subscription', label: t('subscription'), icon: CreditCard, placement: 'bottom' },
  ];
  const searchItems = [...nav, ...[...jobTabs.slice(1), ...applicationTabs.slice(1)].map(([path, key]) => ({ href: `/candidate/${path}`, label: t(key), icon: FileText }))];
  return <RequireCandidate><AppShell nav={nav} searchItems={searchItems} supportUnreadCount={supportUnread.data?.count ?? 0}>{tabs && <nav className="module-tabs" aria-label={ux('navigation')}>{tabs.map(([path, key]) => <Link key={path} href={`/candidate/${path}`} aria-current={pathname === `/candidate/${path}` || pathname.startsWith(`/candidate/${path}/`) ? 'page' : undefined}>{t(key)}</Link>)}</nav>}{children}</AppShell><Dialog open={coachUpgradeOpen} onOpenChange={setCoachUpgradeOpen}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="size-5 text-amber-500" />Débloque le Coach d’entretien IA</DialogTitle><DialogDescription>Entraîne-toi avec un recruteur IA adaptatif, reçois des relances personnalisées et un débrief détaillé.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" asChild><Link href="/candidate/subscription">Voir les offres</Link></Button><Button variant="ghost" onClick={() => setCoachUpgradeOpen(false)}>Plus tard</Button></DialogFooter></DialogContent></Dialog><Dialog open={autoUpgradeOpen} onOpenChange={setAutoUpgradeOpen}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="size-5 text-amber-500" />{t('autoApplyUpgradeTitle')}</DialogTitle><DialogDescription>{t('autoApplyUpgradeDescription')}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" asChild><Link href="/candidate/subscription">{t('viewPlans')}</Link></Button></DialogFooter></DialogContent></Dialog><CandidateGuide /></RequireCandidate>;
}
