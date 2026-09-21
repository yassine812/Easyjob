'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUxText } from '@/lib/i18n/ux';
import type { NavItem } from './app-shell';
export function useCommandShortcut(open: () => void) { useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [open]); }
export function NavigationSearch({ items }: { items: NavItem[] }) {
  const t = useUxText(); const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); useCommandShortcut(() => setOpen(true));
  const matches = items.filter(item => item.show !== false && item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <><Button variant="ghost" onClick={() => setOpen(true)} aria-label={t('search')} className="text-muted-foreground"><Search className="size-4" /><span className="hidden sm:inline">{t('search')}</span><kbd className="ms-6 hidden rounded border px-1.5 py-0.5 text-[10px] lg:inline">Ctrl K</kbd></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{t('search')}</DialogTitle><DialogDescription>{t('searchHelp')}</DialogDescription></DialogHeader><Input autoFocus aria-label={t('search')} value={query} onChange={e => setQuery(e.target.value)} /><div className="max-h-[50vh] space-y-1 overflow-y-auto">{matches.length ? matches.map(item => <Link href={item.href} key={item.href} onClick={() => setOpen(false)} className="workspace-nav-item"><item.icon className="size-4" />{item.label}</Link>) : <p role="status" className="py-6 text-center text-sm text-muted-foreground">{t('noResults')}</p>}</div></DialogContent></Dialog></>;
}
