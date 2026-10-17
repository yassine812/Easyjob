'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';


import { CheckCircle2, CircleHelp } from 'lucide-react';
import type { JobMatch } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';

const unique = (items: string[] = []) => [...new Map(items.filter(Boolean).map(value => [value.trim().toLocaleLowerCase(), value.trim()])).values()];
const percent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const tone = (score: number) => score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

export function JobMatchInsights({ match }: { match: JobMatch }) {
  const t = useCareerText();
  const matched = unique(match.matchedSkills), missing = unique(match.missingSkills);
  const score = typeof match.score === 'number' && Number.isFinite(match.score) ? percent(match.score) : null;
  if (match.method === 'evidence_coverage_v2') return <section aria-label={t('match')} className="rounded-xl border bg-muted/20 p-4"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-semibold">Correspondance documentée du profil</h3><span className="text-lg font-semibold tabular-nums">{score === null ? 'Non évaluée' : `${score}%`}</span></div><p className="mt-2 text-sm text-muted-foreground">{matched.length} compétences de l’offre sont documentées. La comparaison détaillée ci-dessous utilise le CV que tu sélectionnes.</p><div className="mt-3 flex flex-wrap gap-2">{matched.slice(0, 8).map(skill => <span key={skill} className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-800 dark:text-emerald-300">{skill}</span>)}</div></section>;
  return <section aria-label={t('match')} className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-cyan-500/5">
    <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
      <div className={`relative grid size-32 place-items-center rounded-full ${score === null ? 'text-muted-foreground' : tone(score)}`} role="meter" aria-label={t('match')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? undefined} aria-valuetext={score === null ? t('NOT_ANALYZED') : `${score}%`}>
        <div aria-hidden="true" className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(currentColor ${(score ?? 0) * 3.6}deg, color-mix(in srgb, currentColor 12%, transparent) 0deg)` }} />
        <div className="absolute inset-2 rounded-full bg-background" />
        <span className="relative text-3xl font-bold tabular-nums">{score === null ? '—' : `${score}%`}</span>
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><EasyJobFeatureMark size="md" className=" text-primary" />{t('match')}</h3>
        <p className={`font-medium ${score === null ? 'text-muted-foreground' : tone(score)}`}>{t(score === null ? 'NOT_ANALYZED' : match.classification)}</p>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2"><span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{matched.length}</span><span className="ms-2 text-sm">{t(matched.length === 1 ? 'matchedSkillCount' : 'matchedSkillsCount')}</span></div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2"><span className="text-xl font-bold text-amber-700 dark:text-amber-300">{missing.length}</span><span className="ms-2 text-sm">{t(missing.length === 1 ? 'missingSkillCount' : 'missingSkillsCount')}</span></div>
        </div>
        <p className="text-xs text-muted-foreground">{t(score === null ? 'noReliableMatch' : 'estimated')}</p>
      </div>
    </div>
    {!!match.dimensions?.length && <div className="grid gap-x-6 gap-y-4 border-t p-5 sm:grid-cols-2 sm:p-6">
      {match.dimensions.map(dimension => {
        const value = typeof dimension.score === 'number' && Number.isFinite(dimension.score) ? percent(dimension.score) : null;
        return <div key={dimension.key}>
          <div className="mb-2 flex justify-between gap-3 text-sm"><span>{t(dimension.key)}</span><span className={`font-semibold tabular-nums ${value === null ? 'text-muted-foreground' : tone(value)}`}>{value === null ? t('notEvaluated') : `${value}%`}</span></div>
          <div role="progressbar" aria-label={t(dimension.key)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={value === null ? t('notEvaluated') : `${value}%`} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${value === null ? '' : tone(value)}`} style={{ width: `${value ?? 0}%`, backgroundColor: 'currentColor' }} /></div>
        </div>;
      })}
    </div>}
    {(matched.length > 0 || missing.length > 0) && <div className="grid gap-5 border-t p-5 sm:grid-cols-2 sm:p-6">
      {[{ items: matched, label: 'matched', icon: CheckCircle2, classes: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' }, { items: missing, label: 'missing', icon: CircleHelp, classes: 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200' }].map(group => group.items.length > 0 && <div key={group.label}><h4 className="mb-3 flex items-center gap-2 text-sm font-medium"><group.icon className="size-4 shrink-0" />{t(group.label)}</h4><div className="flex flex-wrap gap-2">{group.items.map(skill => <span key={skill} className={`rounded-lg border px-2.5 py-1 text-xs ${group.classes}`}>{skill}</span>)}</div></div>)}
    </div>}
  </section>;
}
