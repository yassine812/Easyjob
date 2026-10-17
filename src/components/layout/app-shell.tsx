'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Crown, Menu, HelpCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { Logo } from './logo';
import { CompanySwitcher } from './company-switcher';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageToggle, useI18n } from '@/lib/i18n';
import { useUxText } from '@/lib/i18n/ux';
import { cn } from '@/lib/utils';
import { NavigationSearch } from './navigation-search';
import { DemoNotice } from './demo-notice';

export interface NavItem { href: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; show?: boolean; group?: string; placement?: 'main' | 'bottom'; activePaths?: string[]; premium?: boolean; locked?: boolean; onLockedClick?: () => void; }
export function isNavActive(pathname: string, item: Pick<NavItem, 'href' | 'activePaths'>) { return [item.href, ...(item.activePaths ?? [])].some(path => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`))); }
const SIDEBAR_PREFERENCE_KEY = 'easyjob_sidebar_collapsed';

export function AppShell({ nav, searchItems, topbarLeft, sidebarHeader, sidebarBottom, supportUnreadCount = 0, supportHref, compactSidebar = false, children }: { nav: NavItem[]; searchItems?: NavItem[]; topbarLeft?: ReactNode; sidebarHeader?: ReactNode; sidebarBottom?: ReactNode; supportUnreadCount?: number; supportHref?: string; compactSidebar?: boolean; children: ReactNode; }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);
  useEffect(() => { setCollapsed(window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === 'true'); setSidebarHydrated(true); }, []);
  const toggleSidebar = () => setCollapsed(value => { const next = !value; window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(next)); return next; });
  const visibleNav = nav.filter(item => item.show !== false);
  const primary = visibleNav.filter(item => item.placement !== 'bottom');
  const lower = visibleNav.filter(item => item.placement === 'bottom');
  const { t, locale } = useI18n();
  const ux = useUxText();
  const workspace = useWorkspace();
  const resolvedSupportHref = supportHref ?? (workspace.currentWorkspace === 'admin' ? '/platform-admin/support' : '/support');
  const searchDestinations = Array.from(new Map([...(searchItems ?? visibleNav), { href: resolvedSupportHref, label: t.common.support, icon: HelpCircle }].map(item => [item.href, item])).values());
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => { setOpen(false); if (item.locked) { event.preventDefault(); item.onLockedClick?.(); } };
  const itemLink = (item: NavItem) => <Link key={item.href} href={item.href} title={item.label} aria-current={isNavActive(pathname, item) ? 'page' : undefined} onClick={event => navigate(event, item)} className={cn('workspace-nav-item md:justify-center md:px-2 lg:justify-start lg:px-3', (!collapsed || !sidebarHydrated) && 'lg:justify-start lg:px-3', collapsed && 'lg:justify-center lg:px-2', isNavActive(pathname, item) && 'is-active')}><item.icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} /><span className={cn('truncate md:hidden lg:inline', collapsed && 'lg:hidden')}>{item.label}</span>{item.premium && <Crown aria-label="Fonctionnalité premium" className={cn('ms-auto size-3.5 shrink-0 text-amber-500 md:hidden lg:block', collapsed && 'lg:hidden')} strokeWidth={1.75} />}</Link>;
  const showSupportFooter = !primary.some(item => item.href === resolvedSupportHref);
  const sidebar = <div className={cn('flex h-full min-w-0 flex-col overflow-hidden px-2 lg:px-4', compactSidebar ? 'py-3 lg:px-3' : 'py-4')}>
    <div className={cn('flex min-w-0 items-center justify-between gap-2', compactSidebar ? 'mb-2' : 'mb-4')}><div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}><span className="md:hidden lg:block">{sidebarHeader ?? <Logo href={workspace.home} className="px-3" />}</span><span className="hidden md:block lg:hidden">{sidebarHeader ?? <Logo href={workspace.home} className="justify-center px-0" size="sm" />}</span></div>{collapsed && <span className="hidden size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary lg:inline-flex">E</span>}<button type="button" onClick={toggleSidebar} aria-expanded={!collapsed} aria-label={collapsed ? ux('expandNavigation') : ux('collapseNavigation')} title={collapsed ? ux('expandNavigation') : ux('collapseNavigation')} className="hidden size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground md:inline-flex lg:ms-auto"><span className="lg:hidden">{collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}</span><span className="hidden lg:inline">{collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}</span></button></div>
    <nav aria-label={ux('navigation')} className="workspace-sidebar-nav min-h-0 flex-1 space-y-1 overflow-y-auto">{primary.map((item, index) => <div key={item.href}>{item.group && item.group !== primary[index - 1]?.group && <p className={cn('px-3 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground md:hidden lg:block', compactSidebar ? 'pb-1.5 pt-3' : 'pb-2 pt-3', collapsed && 'lg:hidden')}>{ux(item.group)}</p>}{itemLink(item)}</div>)}</nav>
    {!compactSidebar && <div className="shrink-0 space-y-1 border-t pt-3">{sidebarBottom && <div className="pb-4">{sidebarBottom}</div>}{lower.map(itemLink)}{showSupportFooter && <Link href={resolvedSupportHref} title={t.common.support} onClick={() => setOpen(false)} className={cn('workspace-nav-item md:justify-center md:px-2 lg:justify-start lg:px-3', collapsed && 'lg:justify-center lg:px-2')}><HelpCircle className="size-[18px] shrink-0" /><span className={cn('truncate md:hidden lg:inline', collapsed && 'lg:hidden')}>{t.common.support}</span>{supportUnreadCount > 0 && <span className={cn('ms-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold text-primary-foreground md:hidden lg:block', collapsed && 'lg:hidden')}>{supportUnreadCount > 99 ? '99+' : supportUnreadCount}</span>}</Link>}<div className="mt-4 border-t pt-4 md:hidden"><p className="mb-3 text-xs text-muted-foreground">{ux('preferences')}</p><div className="flex items-center justify-between"><LanguageToggle /><ThemeToggle /></div></div></div>}
  </div>;
  return <div className="workspace-shell flex min-h-dvh min-w-0 overflow-x-clip" data-sidebar-collapsed={collapsed} data-sidebar-compact={compactSidebar}><a href="#workspace-content" className="skip-link">{ux('skip')}</a><aside className={cn('workspace-sidebar sticky top-0 hidden h-dvh shrink-0 border-e bg-sidebar md:block', collapsed ? 'w-[72px]' : 'w-[72px] lg:w-[240px]')}>{sidebar}</aside><div className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-30 flex h-16 min-w-0 items-center gap-2 border-b bg-background/95 px-4 sm:px-6"><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="md:hidden" aria-label={ux('menu')}><Menu className="size-5" /></Button></SheetTrigger><SheetContent side={locale === 'ar' ? 'right' : 'left'} className="w-[min(320px,90vw)] p-0 md:hidden"><SheetTitle className="sr-only">{ux('navigation')}</SheetTitle>{sidebar}</SheetContent></Sheet><Logo href={workspace.home} size="sm" className="shrink-0 md:hidden [&_img]:h-9" /><div className="flex min-w-0 flex-1 items-center gap-2">{pathname.startsWith('/company/') && <CompanySwitcher />}{topbarLeft ?? <NavigationSearch items={searchDestinations} />}</div><div className="flex shrink-0 items-center gap-1 sm:gap-2"><div className="hidden items-center gap-2 lg:flex"><LanguageToggle /><ThemeToggle /><span className="mx-2 h-5 border-e" /></div><NotificationBell /><UserMenu /></div></header><main id="workspace-content" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-28 pt-7 outline-none sm:px-7 lg:px-9 lg:pb-10"><div key={pathname} className="workspace-page-container view-enter"><DemoNotice />{children}</div></main>{primary.length > 0 && <nav aria-label={ux('navigation')} className="mobile-dock fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 px-2 pt-2 md:hidden">{primary.slice(0, 3).map(item => <Link key={item.href} href={item.href} aria-current={isNavActive(pathname, item) ? 'page' : undefined} onClick={event => navigate(event, item)} className={cn('flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px]', isNavActive(pathname, item) ? 'bg-primary/8 font-semibold text-primary' : 'text-muted-foreground')}><item.icon className="size-5" /><span className="max-w-full truncate">{item.label}</span></Link>)}<button type="button" className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-muted-foreground" onClick={() => setOpen(true)}><Menu className="size-5" />{ux('menu')}</button></nav>}</div></div>;
}
