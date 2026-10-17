'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, FilePlus2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { Button } from '@/components/ui/button';
import { useUxText } from '@/lib/i18n/ux';
import type { NavItem } from './app-shell';

export function useCommandShortcut(open: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);
}

function isQuickAction(item: NavItem) {
  return ['/candidate/jobs', '/candidate/applications', '/candidate/auto-apply', '/candidate/cvs', '/candidate/cv-builder', '/candidate/interview-coach', '/candidate/subscription', '/support'].includes(item.href);
}

export function NavigationSearch({ items }: { items: NavItem[] }) {
  const t = useUxText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  useCommandShortcut(openPalette);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(window.navigator.platform || window.navigator.userAgent));
  }, []);

  const actionItems = useMemo(() => {
    const base = [...items];
    const cvs = base.find(item => item.href === '/candidate/cvs');
    if (cvs && !base.some(item => item.href === '/candidate/cv-builder')) base.push({ ...cvs, href: '/candidate/cv-builder', label: t('createCv'), icon: FilePlus2 });
    return base;
  }, [items, t]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return actionItems.filter(item => item.show !== false && (!normalized || item.label.toLocaleLowerCase().includes(normalized)));
  }, [actionItems, query]);
  const quickMatches = matches.filter(isQuickAction);
  const navigationMatches = matches.filter(item => !isQuickAction(item));
  const resultItems = [...quickMatches, ...navigationMatches];
  const shortcut = isMac ? '⌘ K' : 'Ctrl K';

  const close = () => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  };
  const activate = (item: NavItem) => {
    if (item.locked) {
      item.onLockedClick?.();
      close();
    }
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!resultItems.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex(index => (index + 1) % resultItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex(index => (index - 1 + resultItems.length) % resultItems.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = resultItems[selectedIndex];
      if (selected?.locked) activate(selected);
      else if (selected) { close(); router.push(selected.href); }
    }
  };

  let resultIndex = 0;
  const renderGroup = (title: string, group: NavItem[]) => group.length ? <section key={title} className="space-y-1"><h3 className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{group.map(item => { const index = resultIndex++; const selected = index === selectedIndex; const content = <><item.icon aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.locked ? <span className="shrink-0 text-[10px] font-semibold text-amber-500">{t('premium')}</span> : <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}</>; return item.locked ? <button type="button" role="option" aria-selected={selected} key={item.href} onClick={() => activate(item)} onMouseEnter={() => setSelectedIndex(index)} className={`group workspace-nav-item w-full text-start ${selected ? 'bg-muted text-foreground' : ''}`}>{content}</button> : <Link href={item.href} role="option" aria-selected={selected} key={item.href} onClick={close} onMouseEnter={() => setSelectedIndex(index)} className={`group workspace-nav-item ${selected ? 'bg-muted text-foreground' : ''}`}>{content}</Link>; })}</section> : null;

  return <>
    <Button type="button" variant="outline" onClick={openPalette} aria-label={t('searchPlaceholder')} aria-haspopup="dialog" className="h-10 min-w-10 shrink-0 justify-start gap-2 rounded-xl border-border/70 bg-background/60 px-2.5 text-muted-foreground hover:border-primary/50 hover:bg-muted/40 sm:w-full sm:max-w-md sm:px-3">
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate text-start sm:inline">{t('searchPlaceholder')}</span>
      <kbd className="hidden shrink-0 rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground lg:inline">{shortcut}</kbd>
    </Button>
    <Dialog open={open} onOpenChange={value => value ? setOpen(true) : close()}>
      <DialogContent className="!top-1/2 !bottom-auto !-translate-y-1/2 flex h-[min(720px,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b px-4 py-4 text-start sm:px-5">
          <DialogTitle>{t('commandPalette')}</DialogTitle>
          <DialogDescription>{t('searchHelp')}</DialogDescription>
        </DialogHeader>
        <div className="border-b px-4 py-3 sm:px-5">
          <div className="relative">
            <InputWithIcon icon={<Search className="size-4" />} autoFocus value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }} onKeyDown={handleKeyDown} aria-label={t('searchPlaceholder')} placeholder={t('searchPlaceholder')} className="h-11 w-full rounded-xl pe-3" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox" aria-label={t('commandPalette')}>
          {resultItems.length ? <div className="space-y-3">{renderGroup(t('quickActions'), quickMatches)}{renderGroup(t('navigationGroup'), navigationMatches)}</div> : <p role="status" className="py-12 text-center text-sm text-muted-foreground">{t('noResults')}</p>}
        </div>
        <div className="hidden items-center justify-end gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground sm:flex"><span>↑↓ {t('navigate')}</span><span>↵ {t('open')}</span><span>Esc {t('close')}</span></div>
      </DialogContent>
    </Dialog>
  </>;
}
