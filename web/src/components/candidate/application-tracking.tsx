'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Target, ScanText } from 'lucide-react';
import { ApplicationProgress } from './application-progress';
import { useApplicationTracking } from '@/hooks/use-application-tracking';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { applicationsApi } from '@/lib/api/applications';
import { careerApi } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';
import { Button } from '@/components/ui/button';
import { PaginationControls } from '@/components/shared';
import type { Application } from '@/types/api';
import { Busy, CareerFrame, Failure, panelClass, selectClass } from './career-shared';
import { applicationProgress } from '@/lib/application-progress';

function ScoreCard({ label, value, icon: Icon, unit = '/100' }: { label: string; value?: number | null; icon: typeof Target; unit?: string }) {
  const score = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
  const color = score === null ? 'text-muted-foreground' : score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  return <div className="rounded-xl border bg-background/60 p-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{label}</p><p className={`my-3 text-3xl font-bold tabular-nums ${color}`}>{score === null ? '—' : score}<span className="ms-1 text-sm font-normal text-muted-foreground">{score === null ? '' : unit}</span></p><div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? undefined} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none ${color}`} style={{ width: `${score ?? 0}%`, backgroundColor: 'currentColor' }} /></div></div>;
}

export function ApplicationInsights({ data, showInterviewAction = true }: { data: Application; showInterviewAction?: boolean }) {
  const t = useCareerText();
  const [followUp, setFollowUp] = useState<Awaited<ReturnType<typeof careerApi.applicationFollowUp>> | null>(null);
  useEffect(() => { let active = true; const load = careerApi.applicationFollowUp; if (typeof load !== 'function') return () => { active = false; }; void load(data.id).then(value => { if (active) setFollowUp(value); }).catch(() => undefined); return () => { active = false; }; }, [data.id]);
  const groups = [
    { key: 'matched', items: data.matchExplanation?.matchedSkills, Icon: CheckCircle2, color: 'border-emerald-500/25 bg-emerald-500/5', chip: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200' },
  ];
  return <div className="mt-5 space-y-4">
    <ApplicationProgress data={data} />
    {followUp && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-semibold">Prochaine action</p><p className="mt-1 text-sm text-muted-foreground">{followUp.nextAction}</p>{followUp.followUpSuggested && <p className="mt-2 text-xs text-muted-foreground">Temps d’attente : {followUp.daysWaiting} jours · Relance recommandée.</p>}</div>}
    {showInterviewAction && data.jobId && <Button asChild className="min-h-11 px-5"><Link href={`/candidate/interview-coach?jobId=${data.jobId}&resumeId=${data.resumeId ?? ''}`}>{t('prepareInterview')}</Link></Button>}
    <div className="grid gap-3 sm:grid-cols-3">
      <ScoreCard label={t('match')} value={data.aiMatchScore} icon={Target} unit="%" />
      <ScoreCard label={t('ats')} value={data.atsScore} icon={ScanText} />
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><EasyJobFeatureMark size="sm" className=" text-violet-500" />{t('SCREENING')}</p><p className="my-3 font-semibold">{t(data.aiScreeningStatus || 'NOT_ANALYZED')}</p><p className="text-xs text-muted-foreground">{t('estimated')}</p></div>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">{groups.map(({ key, items, Icon, color, chip }) => {
      const skills = [...new Map((items || []).filter(Boolean).map(skill => [skill.trim().toLowerCase(), skill.trim()])).values()];
      return skills.length > 0 && <section key={key} className={`rounded-xl border p-4 ${color}`}><h4 className="mb-3 flex items-start gap-2 text-sm font-semibold"><Icon className="mt-0.5 size-4 shrink-0" /><span className="flex-1">{t(key)}</span><span className={`rounded-full px-2 py-0.5 text-xs ${chip}`}>{skills.length}</span></h4><div className="flex flex-wrap gap-2">{skills.map(skill => <span key={skill} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${chip}`}>{skill}</span>)}</div></section>;
    })}</div>
    <div className="flex items-center gap-3 rounded-xl border bg-muted/25 px-4 py-3"><FileText className="size-5 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">{t('cvUsed')}</p><p className="truncate text-sm font-medium">{data.resume?.filename || '—'}</p></div>{data.autoApplied && <span className="ms-auto rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{t('auto')}</span>}</div>
    {data.interviews?.map(interview => <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 text-sm" key={interview.id}>{t('INTERVIEW')} · {new Date(interview.startAt).toLocaleString()} · {t(interview.status)}</div>)}
  </div>;
}

function ApplicationSummary({ data, expanded, onToggle }: { data: Application; expanded: boolean; onToggle: () => void }) {
  const t = useCareerText();
  const progress = applicationProgress(data);
  const progressed = progress.steps.filter(step => step.state === 'done' || step.state === 'active');
  const current = progressed[progressed.length - 1] ?? progress.steps[0];
  const stateLabel = current.state === 'done' ? 'COMPLETED' : current.state === 'active' ? 'PROCESSING' : current.state === 'failed' ? 'FAILED' : 'progressNotReached';
  return <button
    type="button"
    className="min-w-0 flex-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    aria-expanded={expanded}
    aria-controls={`application-progress-${data.id}`}
    onClick={onToggle}
  >
    <span className="block break-words text-base font-semibold sm:text-lg">{data.job?.title || t('jobTitle')}</span>
    <p className="mt-1 text-sm text-muted-foreground">{data.job?.company?.commercialName || t('companyNotListed')} · {t('appliedDate')}: {new Date(data.appliedAt).toLocaleDateString()}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">{t(current.key)}</span>
      <span className="text-muted-foreground">{t(stateLabel)}</span>
    </div>
  </button>;
}

export function CandidateApplications() {
  useApplicationTracking();
  const t = useCareerText(); const [page, setPage] = useState(1), [status, setStatus] = useState('');
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['my-applications', { page, status }], queryFn: () => applicationsApi.mine({ page, limit: 12, status: status || undefined }), refetchInterval: 15000, refetchIntervalInBackground: false });
  const external = useQuery({ queryKey: ['external-applications'], queryFn: careerApi.externalApplications });
  return <CareerFrame title={t('applications')}>
    {external.data?.length ? <section className="mb-5 space-y-3"><h2 className="text-lg font-semibold">{t('externalPreparations')}</h2>{external.data.map(item => <article className={panelClass} key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{item.job.title}</h3><p className="text-sm text-muted-foreground">{item.job.company?.commercialName || t('companyNotListed')} · {t('selectCv')}: {item.resume?.filename || '—'}</p><p className="mt-1 text-xs text-muted-foreground">{item.externalSiteOpenedAt ? `${t('externalSiteOpenedAt')}: ${new Date(item.externalSiteOpenedAt).toLocaleString()}` : `${t('preparedAt')}: ${new Date(item.preparedAt).toLocaleString()}`}</p></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">{t(item.status)}</span></div><p className="mt-3 text-xs text-muted-foreground">{t('externalNotConfirmed')}</p></article>)}</section> : null}
    {external.isError && <Failure retry={() => external.refetch()} />}
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-card/60 p-4">
      <div>
        <p className="text-sm font-semibold">{t('applications')}</p>
        <p className="text-xs text-muted-foreground">{t('filterApplicationsHelp')}</p>
      </div>
      <label className="grid min-w-44 gap-1.5 text-sm font-medium">{t('applicationStatus')}
        <select aria-label={t('applicationStatus')} className={selectClass} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">{t('all')}</option>{['APPLIED', 'SCREENING', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'].map(s => <option value={s} key={s}>{t(s)}</option>)}</select>
      </label>
    </div>
    {q.isPending ? <Busy /> : q.isError ? <Failure retry={() => q.refetch()} /> : q.data.items.length ? <><div className="space-y-3">{q.data.items.map(a => {
      const expanded = expandedApplicationId === a.id;
      const toggle = () => setExpandedApplicationId(current => current === a.id ? null : a.id);
      return <article className={`${panelClass} overflow-hidden !p-0`} key={a.id}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
          <ApplicationSummary data={a} expanded={expanded} onToggle={toggle} />
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {a.jobId && <Button asChild className="h-10 min-h-10 w-full px-4 sm:w-auto" onClick={event => event.stopPropagation()}><Link href={`/candidate/interview-coach?jobId=${a.jobId}&resumeId=${a.resumeId ?? ''}`}>{t('prepareInterview')}</Link></Button>}
            <Button variant="outline" asChild className="h-10 min-h-10 flex-1 sm:flex-none" onClick={event => event.stopPropagation()}><Link href={`/candidate/applications/${a.id}`}>{t('details')}</Link></Button>
            <Button variant="outline" size="icon" className="size-10 shrink-0" aria-label={expanded ? t('collapseApplication') : t('expandApplication')} aria-expanded={expanded} aria-controls={`application-progress-${a.id}`} onClick={toggle}>{expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</Button>
          </div>
        </div>
        {expanded && <div id={`application-progress-${a.id}`} className="border-t px-4 pb-4 sm:px-5 sm:pb-5"><ApplicationInsights data={a} showInterviewAction={false} /></div>}
      </article>;
    })}</div><PaginationControls page={page} totalPages={Math.ceil(q.data.total / 12)} total={q.data.total} onPageChange={setPage} /></> : <p className={panelClass}>{t('noData')}</p>}</CareerFrame>;
}
