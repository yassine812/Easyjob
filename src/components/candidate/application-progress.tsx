'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';


import { CalendarDays, Check, CircleAlert, Clock3, FileCheck2, Gift, Loader2, Send, UserRoundSearch } from 'lucide-react';
import type { Application } from '@/types/api';
import { applicationProgress } from '@/lib/application-progress';
import { useI18n } from '@/lib/i18n';
import { useCareerText } from '@/lib/i18n/career';

const icons = [Send, EasyJobFeatureMark, UserRoundSearch, CalendarDays, Gift, FileCheck2];

export function ApplicationProgress({ data }: { data: Application }) {
  const t = useCareerText(), { locale } = useI18n();
  const { steps, message, ended } = applicationProgress(data);
  return <section aria-label={t('applicationProgress')} className="w-full space-y-6 rounded-2xl border bg-gradient-to-br from-primary/10 to-cyan-500/5 p-5 sm:p-6 lg:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{t('applicationProgress')}</h3><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />{t('trackingAutoRefresh')}</span></div>
    <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {steps.map((step, index) => {
        const Icon = step.state === 'done' ? Check : step.state === 'failed' ? CircleAlert : step.state === 'active' && step.key === 'SCREENING' ? Loader2 : icons[index];
        const color = step.state === 'done' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : step.state === 'failed' ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300' : step.state === 'active' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background/50 text-muted-foreground';
        return <li key={step.key} aria-current={step.state === 'active' ? 'step' : undefined} className={`relative min-h-24 rounded-xl border p-4 transition-colors duration-500 motion-reduce:transition-none ${color}`}>
          <div className="mb-3 flex items-center justify-between"><span className="grid size-9 place-items-center rounded-full bg-background/70"><Icon className={`size-4 ${step.state === 'active' && step.key === 'SCREENING' ? 'animate-spin motion-reduce:animate-none' : ''}`} /></span><span className="text-xs font-semibold opacity-60">0{index + 1}</span></div>
          <p className="text-sm font-semibold">{t(step.key)}</p><p className="mt-1 text-xs">{t(step.state === 'done' ? 'COMPLETED' : step.state === 'active' ? 'PROCESSING' : step.state === 'failed' ? 'FAILED' : 'progressNotReached')}</p>
          {step.date && <time className="mt-2 block text-xs opacity-80" dateTime={step.date}>{new Date(step.date).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>}
        </li>;
      })}
    </ol>
    <div role="status" className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${ended ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-background/70 text-muted-foreground'}`}><Clock3 className="mt-0.5 size-4 shrink-0" /><span>{t(message)}</span></div>
  </section>;
}
