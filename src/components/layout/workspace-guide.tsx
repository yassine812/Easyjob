'use client';
import { HumanCoach } from '@/components/ui/human-coach';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useReleaseText } from '@/lib/i18n/release';
import { useI18n } from '@/lib/i18n';
import type { NavItem } from './app-shell';

/** Contextual navigation help; only destinations already allowed by the shell are shown. */
export function WorkspaceGuide({ items, placement = 'topbar' }: { items: NavItem[]; placement?: 'topbar' | 'sidebar' }) {
  const [open, setOpen] = useState(false), tr = useReleaseText(), { locale } = useI18n();
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild>{placement === 'sidebar' ? <button type="button" className="workspace-coach-card" aria-label={tr('Ouvrir le guide', 'Open the guide', 'افتح الدليل')}>
      <HumanCoach className="workspace-coach-card__portrait" pose={1} />
      <span><strong>{tr('Un repère pour avancer.', 'A clearer next step.', 'خطوة تالية أوضح.')}</strong><span>{tr('Ouvrir le guide', 'Open the guide', 'افتح الدليل')}<ArrowUpRight aria-hidden="true" /></span></span>
    </button> : <button type="button" className="workspace-guide-trigger relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/10 transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-ring" aria-label={tr('Guide EasyJob', 'EasyJob guide', 'دليل EasyJob')} title={tr('Guide EasyJob', 'EasyJob guide', 'دليل EasyJob')}><HumanCoach className="h-10 w-10" /></button>}</SheetTrigger>
    <SheetContent side={locale === 'ar' ? 'left' : 'right'} className="overflow-y-auto px-6 py-8">
      <div className="workspace-guide-art"><HumanCoach className="h-48 w-48" pose={1} /></div>
      <SheetTitle>{tr('Où veux-tu aller ?', 'Where would you like to go?', 'إلى أين تريد الانتقال؟')}</SheetTitle>
      <SheetDescription className="mt-2">{tr('Retrouve les outils de ton espace. Les fonctions premium sont signalées dans le menu.', 'Find the tools in your workspace. Premium features are marked in the menu.', 'اعثر على أدوات مساحتك. الميزات المدفوعة مميزة في القائمة.')}</SheetDescription>
      <nav className="mt-6 space-y-2" aria-label={tr('Raccourcis du guide', 'Guide shortcuts', 'اختصارات الدليل')}>
        {items.filter(item => item.show !== false && !item.locked).map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="workspace-guide-link flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-accent"><item.icon className="size-4 shrink-0 text-primary" /><span className="flex-1">{item.label}</span><ArrowUpRight className="size-4 text-muted-foreground" /></Link>)}
      </nav>
    </SheetContent>
  </Sheet>;
}
