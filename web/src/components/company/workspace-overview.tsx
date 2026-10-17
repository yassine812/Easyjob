'use client';
import { recruiterJobApplicationsRoute } from '@/lib/job-display';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { RecruiterHome } from './recruiter-home';
import { useDashboardText } from '@/lib/i18n/recruiter-dashboard';
import { EasyJobLoading } from '@/components/ui/easyjob-loader';
import { useUxText } from '@/lib/i18n/ux';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSocketEvent } from '@/hooks/use-socket';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Briefcase, CalendarDays, Plus } from 'lucide-react';
import { workspaceApi } from '@/lib/api/company-workspace';
import { useCompanyText } from '@/lib/i18n/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRole } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export function WorkspaceError({ retry }: { retry: () => void }) { const t = useCompanyText(); return <div role="alert" className="rounded-lg border p-8 text-center"><p>{t('loadError')}</p><Button className="mt-4" variant="outline" onClick={retry}>{t('retry')}</Button></div>; }
export function WorkspaceLoading() { const ux = useUxText(); return <EasyJobLoading label={ux('loading')} />; }
function PeriodFilter() {
  const dashboardText = useDashboardText();
  const params = useSearchParams();
  const router = useRouter();
  const ux = useUxText();
  const t = useCompanyText();
  const period = params.get('period') || '30d';
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');
  const [open, setOpen] = useState(period === 'custom');
  const update = (nextPeriod: string, nextFrom = '', nextTo = '') => {
    const next = new URLSearchParams(params.toString());
    next.set('period', nextPeriod);
    if (nextPeriod === 'custom' && nextFrom) next.set('from', nextFrom); else next.delete('from');
    if (nextPeriod === 'custom' && nextTo) next.set('to', nextTo); else next.delete('to');
    router.replace(`?${next.toString()}`, { scroll: false });
  };
  const value = ['7d', '30d', '90d', 'year', 'custom'].includes(period) ? period : '30d';
  return <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">{ux('period')}</span>
    <Select value={value} onValueChange={next => { if (next === 'custom') { setOpen(true); update(next, from, to); } else { setOpen(false); setFrom(''); setTo(''); update(next); } }}>
      <SelectTrigger className="h-10 w-[172px]" aria-label={ux('period')}><CalendarDays className="size-4 shrink-0" /><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="7d">{dashboardText('last7')}</SelectItem>
        <SelectItem value="30d">{dashboardText('last30')}</SelectItem>
        <SelectItem value="90d">{dashboardText('last90')}</SelectItem>
        <SelectItem value="year">{t('year')}</SelectItem>
        <SelectItem value="custom">{ux('customDates')}</SelectItem>
      </SelectContent>
    </Select>
    <Popover open={open && value === 'custom'} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button type="button" className="sr-only" aria-label={ux('customDates')} /></PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-medium">{ux('customDates')}</p>
        <label className="grid gap-1 text-xs">{t('from')}<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="grid gap-1 text-xs">{t('to')}<Input type="date" min={from || undefined} value={to} onChange={e => setTo(e.target.value)} /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); update('30d'); }}>{t('cancel')}</Button><Button type="button" size="sm" disabled={!from || !to || to < from} onClick={() => { update('custom', from, to); setOpen(false); }}>{t('apply')}</Button></div>
      </PopoverContent>
    </Popover>
  </div>;
}

export function CompanyOverview({ analytics = false, jobId }: { analytics?: boolean; jobId?: string }) {
  const { companyId } = useParams<{ companyId: string }>(); const ux = useUxText(); const t = useCompanyText(); const { can } = useRole();
  const params = useSearchParams();
  const period = params.get('period') || '30d';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const now = new Date();
  const periodFrom = period === 'year' ? new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10) : period === 'custom' && from ? from : new Date(now.getTime() - (Number.parseInt(period, 10) || 30) * 86400000).toISOString().slice(0, 10);
  const result = useQuery({ queryKey: ['company-workspace', companyId, 'overview', jobId, period, from, to], refetchInterval: 30000, queryFn: () => workspaceApi.overview(companyId, { jobId, from: `${periodFrom}T00:00:00.000Z`, ...(period === 'custom' && to ? { to: `${to}T23:59:59.999Z` } : {}) }), enabled: can(companyId, 'application.view') });
  const qc = useQueryClient();
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['company-workspace', companyId] }); };
  useSocketEvent('application.updated', refresh); useSocketEvent('interview.updated', refresh);
  const data = result.data; const href = (path: string) => `/company/${companyId}/${path}`;
  if (!analytics) return <RecruiterHome companyId={companyId} data={data} loading={<WorkspaceLoading />} error={result.isError ? <WorkspaceError retry={() => void result.refetch()} /> : undefined} controls={<PeriodFilter />} />;
  return <div className="mx-auto max-w-7xl space-y-6"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">EasyJob · {t('workspace')}</p><h1 className="text-2xl font-semibold tracking-tight">{t(analytics ? 'analytics' : 'overview')}</h1><p className="mt-2 text-sm text-muted-foreground">{t(analytics ? 'analyticsHelp' : 'overviewHelp')}</p></div>{can(companyId, 'job.create') && <Button asChild><Link href={href('jobs/new')}><Plus className="size-4" />{t('postJob')}</Link></Button>}</header>
    <div className="flex justify-end rounded-lg border bg-background p-3"><PeriodFilter /></div>
    {result.isError ? <WorkspaceError retry={() => void result.refetch()} /> : !data ? <WorkspaceLoading /> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['activeJobs', data.jobs.PUBLISHED ?? 0], ['draftJobs', data.jobs.DRAFT ?? 0], ['closedJobs', data.jobs.CLOSED ?? 0], ['totalApplications', data.totalApplications],
        ['newApplications', data.stages.APPLIED ?? 0], ['UNDER_REVIEW', data.stages.UNDER_REVIEW ?? 0], ['INTERVIEW', data.stages.INTERVIEW ?? 0], ['REJECTED', data.stages.REJECTED ?? 0], ['analyzed', data.analyzed], ['SHORTLISTED', data.stages.SHORTLISTED ?? 0], ['OFFER', data.stages.OFFER ?? 0], ['HIRED', data.stages.HIRED ?? 0],
      ].map(([key, value]) => <div className="rounded-lg border bg-background p-4" key={key}><p className="text-xs font-medium text-muted-foreground">{t(String(key))}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p></div>)}</div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">{data.advancedAnalysisAvailable !== false && <section className="rounded-lg border bg-background p-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><EasyJobFeatureMark size="sm" className=" text-primary" />{t('distribution')}</h2><p className="my-3 text-xs text-muted-foreground">{data.analyzed} · {t('analyzed')}</p><div className="space-y-3">{['STRONG_MATCH', 'PROMISING', 'REVIEW', 'LOW_ALIGNMENT'].map(key => <div key={key} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3 text-xs"><span>{t(key)}</span><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary/70" style={{ width: `${data.totalApplications ? ((data.classificationDistribution ?? data.distribution)[key] ?? 0) / data.totalApplications * 100 : 0}%` }} /></div><span className="text-end tabular-nums">{(data.classificationDistribution ?? data.distribution)[key] ?? 0}</span></div>)}</div><p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">{t('humanReview')}</p></section>}
      <section className="rounded-lg border bg-background p-5"><h2 className="mb-4 text-sm font-semibold">{t('pipeline')}</h2>{['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'].map(s => <Link key={s} href={href('applications')} className="flex items-center justify-between border-b py-2 text-sm last:border-0"><span>{t(s)}</span><span className="tabular-nums text-muted-foreground">{data.stages[s] ?? 0}</span></Link>)}</section></div>
      {analytics ? <><div className="grid gap-3 sm:grid-cols-3">{[['hiringRate', data.hiringRate === null ? '—' : `${data.hiringRate}%`], ['timeToHire', data.averageTimeToHireDays ?? '—'], ['timeToInterview', data.averageTimeToInterviewDays ?? '—']].map(([k, v]) => <div key={k} className="rounded-lg border bg-background p-5"><p className="text-xs text-muted-foreground">{t(String(k))}</p><p className="mt-3 text-2xl font-semibold">{v}</p></div>)}</div><section className="rounded-lg border bg-background p-5"><h2 className="mb-4 font-semibold">{t('applicationsOverTime')}</h2><div className="flex h-40 items-end gap-1 overflow-x-auto">{data.daily.length ? data.daily.map(d => <div key={d.date} className="group flex min-w-6 flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.count}`}><span className="text-xs">{d.count}</span><div className="w-full max-w-10 rounded-t bg-primary/70" style={{ height: `${d.count / Math.max(...data.daily.map(x => x.count)) * 110}px` }} /><span className="mt-2 text-[9px]">{d.date.slice(5)}</span></div>) : <p className="self-center text-sm text-muted-foreground">{t('empty')}</p>}</div></section><section className="rounded-lg border bg-background p-5"><h2 className="mb-4 font-semibold">{t('byJob')}</h2>{data.applicationsByJob.map(j => <Link key={j.id} href={recruiterJobApplicationsRoute(companyId, j.id)} className="flex justify-between gap-3 border-b py-3 text-sm"><span>{j.title}</span><span>{j.total} · {j.hired} {t('HIRED')}</span></Link>)}<p className="mt-5 text-sm text-muted-foreground">{t('sources')}: {t('manual')} {data.sources.manual} · {t('autoApply')} {data.sources.autoApply}</p></section></> : <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-lg border bg-background p-5"><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Briefcase className="size-4" />{t('recent')}</h2>{data.recent.length ? data.recent.map(a => <Link key={a.id} href={href(`applications/${a.id}`)} className="flex items-center gap-3 border-b py-3 last:border-0"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.candidate.user.name}</p><p className="truncate text-xs text-muted-foreground">{a.job.title}</p></div><span className="text-xs">{a.aiMatchScore === null ? '—' : `${a.aiMatchScore}%`}</span><ArrowUpRight className="size-4" /></Link>) : <p className="py-8 text-sm text-muted-foreground">{t('empty')}</p>}</section><section className="rounded-lg border bg-background p-5"><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4" />{t('upcoming')}</h2>{data.upcoming.length ? data.upcoming.map(i => <Link key={i.id} href={href('interviews')} className="flex justify-between gap-3 border-b py-3 text-sm"><span>{i.application.candidate.user.name}<small className="block text-muted-foreground">{i.application.job.title}</small></span><time className="text-xs text-muted-foreground">{new Date(i.startAt).toLocaleString()}</time></Link>) : <p className="py-8 text-sm text-muted-foreground">{t('empty')}</p>}</section></div>}
    </>}
  </div>;
}
