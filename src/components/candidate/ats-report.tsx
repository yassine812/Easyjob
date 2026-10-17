'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { ArrowUpRight, Check, ChevronDown, Download, FileSearch, FileText, Info, ListChecks, Target } from 'lucide-react';
import Link from 'next/link';
import { ProfessionalAuditPanel } from './recruitment-evidence';
import { Button } from '@/components/ui/button';
import type { AtsCriterion, AtsReport, ProfileDetails } from '@/lib/api/career';
import { useAtsText } from '@/lib/i18n/ats';
import { useCareerText } from '@/lib/i18n/career';

const box = 'rounded-2xl border border-border bg-card';
const priorityOrder = { high: 0, medium: 1, low: 2 };
type Text = ReturnType<typeof useAtsText>;
function scopeOnly(item: AtsCriterion) { return item.key === 'quantified_evidence' && item.metrics?.kind === 'scope'; }
function observation(item: AtsCriterion, t: Text) {
  if (scopeOnly(item)) return t('quantified_evidence_scope', { count: item.metrics?.count ?? '' });
  // Older cached reports may contain only booleans. Do not invent a measurement.
  if (!item.metrics) return t(item.passed ? 'fallback_pass' : 'fallback_fail');
  return t(`${item.key}_${item.passed ? 'pass' : 'fail'}`, { count: item.metrics.count ?? '' }) || t(item.passed ? 'fallback_pass' : 'fallback_fail');
}
function Evidence({ values, t }: { values: string[]; t: Text }) {
  if (!values.length) return null;
  return <div className="space-y-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('evidence')}</p><div className="space-y-2 border-s-2 border-primary/20 ps-3">{values.map((value, index) => <blockquote key={index} className="break-words text-sm leading-6 text-foreground/85">{value}</blockquote>)}</div></div>;
}
function Improvement({ item, profile }: { item: AtsCriterion; profile?: ProfileDetails }) {
  const t = useAtsText(), career = useCareerText();
  const tone = item.priority === 'high'
    ? { card: 'border-red-300/80 bg-red-50/45 dark:border-red-900/70 dark:bg-red-950/20', icon: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' }
    : item.priority === 'low'
      ? { card: 'border-yellow-300/80 bg-yellow-50/45 dark:border-yellow-900/70 dark:bg-yellow-950/20', icon: 'text-yellow-600 dark:text-yellow-400', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200' }
      : { card: 'border-orange-300/80 bg-orange-50/45 dark:border-orange-900/70 dark:bg-orange-950/20', icon: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200' };
  let example = t(`${item.key}_example`);
  let evidence = item.evidence ?? [];
  if (item.key === 'summary' && profile?.experiences?.[0]?.title && profile.skills?.length) {
    const role = profile.experiences[0].title, skills = profile.skills.slice(0, 4).join(', ');
    example = t('summaryFromCv', { role, skills });
    evidence = [role, skills];
  }
  if (scopeOnly(item) && evidence[0]) example = t('scopeFromCv', { excerpt: evidence[0] });
  return <article className={`rounded-xl border p-4 sm:p-5 ${tone.card}`}>
    <div className="mb-2 flex flex-wrap items-start gap-2"><Info className={`mt-0.5 size-4 shrink-0 ${tone.icon}`} aria-hidden="true" /><h4 className="min-w-0 flex-1 break-words font-semibold">{career(item.key)}</h4><span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>{t(item.priority ?? 'medium')}</span></div>
    <p className="text-sm leading-6 text-muted-foreground">{observation(item, t)}</p>
    <div className="mt-4 rounded-lg border bg-card px-4 py-3"><p className="mb-1 text-xs font-semibold text-primary">{t('action')}</p><p className="text-sm leading-6">{t(`${item.key}_action`) || t('fallback_action')}</p></div>
    {(evidence.length > 0 || example) && <details open={item.key === 'summary' || scopeOnly(item)} className="group mt-4"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-md text-xs font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />{t('details')}</summary><div className="mt-4 space-y-4"><Evidence values={evidence} t={t} />{example && <div className="rounded-lg bg-muted/65 p-4"><h5 className="mb-2 text-xs font-semibold">{t('example')}</h5><p className="whitespace-pre-line break-words text-sm leading-6">{example}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{t('exampleHelp')}</p></div>}</div></details>}
  </article>;
}

export function atsScoreTone(score: number) {
  if (score < 60) return { accent: '#ef4444', track: 'text-red-500/20', ring: 'text-red-500', value: 'text-red-300', border: 'border-red-400/35' };
  if (score <= 80) return { accent: '#facc15', track: 'text-yellow-400/20', ring: 'text-yellow-400', value: 'text-yellow-300', border: 'border-yellow-400/35' };
  return { accent: '#22c55e', track: 'text-green-500/20', ring: 'text-green-500', value: 'text-green-300', border: 'border-green-400/35' };
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const tone = atsScoreTone(score);
  return <div role="progressbar" aria-label={label} aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} className="relative size-32 shrink-0" title={`${score}/100`}>
    <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className={tone.track} />
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className={`${tone.ring} transition-all`} strokeDasharray={circumference} strokeDashoffset={offset} />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`text-3xl font-semibold tabular-nums ${tone.value}`}>{score}</span><span className={`text-xs ${tone.value} opacity-75`}>/100</span></div>
  </div>;
}

export function AtsPanel({ report, profile, onSelectJob, onImprove }: { report: AtsReport; profile?: ProfileDetails; onSelectJob?: () => void; onImprove?: () => void }) {
  const t = useAtsText(), career = useCareerText();
  const criteria = report.criteria ?? [];
  const priorities = criteria.filter(item => !item.passed || scopeOnly(item)).sort((a, b) => priorityOrder[a.priority ?? 'medium'] - priorityOrder[b.priority ?? 'medium']);
  const strengths = criteria.filter(item => item.passed && !scopeOnly(item));
  const passed = criteria.filter(item => item.passed).length;
  const metric = (key: string) => criteria.find(c => c.key === key)?.metrics?.count;
  const target = report.target ?? { selected: false, keywords: [], matched: [], missing: [] };
  // Display the score produced by the backend ATS engine without a frontend cap.
  const score = report.score;
  const stats = [['words', report.wordCount], ['experience', metric('experience')], ['skills', metric('skills')]].filter(([, value]) => typeof value === 'number');
  return <section id="cv-diagnostic" aria-label={t('title')} className="scroll-mt-24 space-y-5">
    <ProfessionalAuditPanel report={report} />
    <header className={`${box} overflow-hidden`}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6"><div className="flex-1"><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><FileSearch className="size-4" aria-hidden="true" />{career('ats')}</p><h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p><p className="mt-3 text-xs text-muted-foreground">{t('verified')} · <span className="font-semibold text-foreground">{passed}/{criteria.length}</span></p></div>
        <div className="flex w-full items-center justify-center rounded-xl border bg-muted/35 p-4 sm:w-44">{score === null ? <div><p className="text-xs font-medium text-muted-foreground">{t('score')}</p><p className="mt-2 text-sm font-semibold">{t('noScore')}</p></div> : <ScoreRing score={score} label={t('score')} />}</div>
      </div>
      {!!stats.length && <dl className="grid grid-cols-3 divide-x border-t bg-muted/20 rtl:divide-x-reverse">{stats.map(([key, value]) => <div key={key} className="min-w-0 px-3 py-4 text-center"><dt className="text-[11px] text-muted-foreground sm:text-xs">{t(String(key))}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>)}</dl>}
    </header>
    <div id="cv-extracted-review" className="rounded-xl border bg-muted/20 px-4 py-3"><p className="text-xs leading-5 text-muted-foreground">{t('fileHelp')}</p><a href="#cv-extracted-review" className="mt-1 inline-block text-xs font-semibold text-primary underline-offset-4 hover:underline">{t('review')}</a></div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className={`${box} min-w-0 p-5 sm:p-6`} aria-label={t('priorities')}><div className="mb-2 flex items-center gap-2"><ListChecks className="size-4 text-red-600" aria-hidden="true" /><h3 className="font-semibold">{t('priorities')}</h3><span className="ms-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/50 dark:text-red-200">{priorities.length}</span></div><p className="mb-5 text-xs leading-5 text-muted-foreground">{t('priorityHelp')}</p><div className="space-y-3">{priorities.length ? priorities.map(item => <Improvement key={item.key} item={item} profile={profile} />) : <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{t(criteria.length && score !== null ? 'allPassed' : 'noScore')}</p>}</div></section>
      <div className="min-w-0 space-y-5">
        {!!strengths.length && <section className={`${box} p-5 sm:p-6`} aria-label={t('passed')}><h3 className="mb-4 flex items-center gap-2 font-semibold"><Check className="size-4 text-emerald-600" aria-hidden="true" />{t('passed')}<span className="ms-auto text-xs text-muted-foreground">{strengths.length}</span></h3><div className="divide-y">{strengths.map(item => <details key={item.key} className="group py-3 first:pt-0 last:pb-0"><summary className="flex cursor-pointer list-none items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"><Check className="mt-1 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" /><div className="min-w-0 flex-1"><h4 className="text-sm font-medium">{career(item.key)}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{observation(item, t)}</p></div><ChevronDown aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary><div className="ms-6 mt-3 space-y-3"><Evidence values={item.evidence ?? []} t={t} /><p className="text-xs leading-5 text-muted-foreground">{t(`${item.key}_action`) || t('fallback_action')}</p></div></details>)}</div></section>}
        <section className={`${box} p-5 sm:p-6`} aria-label={t('target')}><h3 className="mb-3 flex items-center gap-2 font-semibold"><Target className="size-4 text-primary" aria-hidden="true" />{t('target')}</h3>
          {!target.selected ? <p className="text-sm leading-6 text-muted-foreground">{t('targetHelp')}</p> : <div className="space-y-4">{target.title && <p className="text-sm font-semibold">{target.title}{target.company && <span className="mt-1 block text-xs font-normal text-muted-foreground">{target.company}</span>}</p>}{!target.keywords.length ? <p className="text-sm leading-6 text-muted-foreground">{t('noKeywords')}</p> : <><p className="text-sm font-medium">{t('keywordSummary', { matched: target.matched.length, total: target.keywords.length })}</p>{target.matched.length > 0 && <KeywordList title={t('found')} terms={target.matched} found />}{target.missing.length > 0 ? <><KeywordList title={t('missing')} terms={target.missing} /><p className="text-xs leading-5 text-muted-foreground">{t('keywordAdvice')}</p></> : <p className="text-xs leading-5 text-muted-foreground">{t('allKeywords')}</p>}</>}</div>}
          {onSelectJob && <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onSelectJob}>{t(target.selected ? 'change' : 'choose')}<ArrowUpRight aria-hidden="true" className="ms-2 size-3.5" /></Button>}
        </section>
      </div>
    </div>
    <section className={`${box} ats-improve-card p-5 sm:p-6`} aria-label={t('improveCv')}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-bold">{t('improveCv')}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{t('improveCvHelp')}</p></div>{onImprove ? <button type="button" className="ats-improve-action" onClick={onImprove}><span className="ats-improve-action-label">{t('improveCvAction')}</span><span className="ats-improve-action-icons" aria-hidden="true"><EasyJobFeatureMark /><FileText /><Download /></span></button> : <Link href="/candidate/cvs" className="ats-improve-action"><span className="ats-improve-action-label">{t('improveCvAction')}</span><span className="ats-improve-action-icons" aria-hidden="true"><EasyJobFeatureMark /><FileText /><Download /></span></Link>}</div></section>
    {!!report.formattingProblems.length && <aside className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/15"><h3 className="mb-2 text-sm font-semibold">{t('textIssue')}</h3>{report.formattingProblems.map(issue => <p key={issue} className="mt-1 text-sm leading-6 text-muted-foreground">{issue === 'unreadable_characters' ? t('characters') : issue === 'insufficient_text' ? t('shortText') : career(issue)}</p>)}</aside>}
  </section>;
}
function KeywordList({ title, terms, found = false }: { title: string; terms: string[]; found?: boolean }) {
  return <div><h4 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h4><ul className="flex flex-wrap gap-1.5">{terms.map(term => <li key={term} className={`max-w-full break-words rounded-md border px-2 py-1 text-xs ${found ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`}>{term}</li>)}</ul></div>;
}
