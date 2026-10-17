'use client';
import Link from 'next/link';

import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/use-workspace';
import { Logo } from '@/components/layout/logo';

import { useProductText } from '@/lib/i18n/product';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageToggle, useI18n } from '@/lib/i18n';

export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  const workspace = useWorkspace();
  const dashboardHref = workspace.home;
  const { t } = useI18n(), copy = useProductText();

  const links = [
    { href: workspace.jobs, label: t.nav.jobs },
    { href: '/#companies', label: t.nav.companies },
    { href: '/pricing', label: t.nav.pricing },
    { href: '/about', label: t.nav.about },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo href={workspace.home} size="lg" />
        <nav className="hidden items-center gap-8 md:flex" aria-label={copy('menu')}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-gray-900 dark:hover:text-white',
                pathname.startsWith(l.href) ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-600 dark:text-gray-400',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-4.5 md:flex">
          <LanguageToggle />
          <ThemeToggle />
          {isAuthed ? (
            <Button asChild className="bg-[#3F5FDE] hover:bg-[#3252c8] text-white text-sm font-medium px-4.5 py-2 rounded-lg">
              <Link href={dashboardHref}>{t.common.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">{t.auth.login}</Link>
              <Button asChild className="bg-[#3F5FDE] hover:bg-[#3252c8] text-white text-sm font-medium px-4.5 py-2 rounded-lg shadow-none transition-colors"><Link href="/register">{t.auth.register}</Link></Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 md:hidden">
          <LanguageToggle />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((o) => !o)}
            aria-label={copy('menu')}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-gray-100 bg-white dark:bg-gray-950 px-4 py-3 md:hidden" aria-label={copy('menu')}>
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-gray-900"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
              {isAuthed ? <Button variant="outline" asChild className="w-full"><Link href={dashboardHref} onClick={() => setOpen(false)}>{t.common.dashboard}</Link></Button> : <Button asChild variant="outline" className="w-full"><Link href="/login" onClick={() => setOpen(false)}>{t.auth.login}</Link></Button>}
              {!isAuthed && <Button asChild className="w-full bg-[#3F5FDE] hover:bg-[#3252c8] text-white"><Link href="/register" onClick={() => setOpen(false)}>{t.auth.register}</Link></Button>}
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
