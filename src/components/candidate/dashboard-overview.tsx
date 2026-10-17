'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BriefcaseBusiness, CalendarDays, CheckCircle2, CircleDollarSign, Send, Target, TrendingUp } from 'lucide-react';
import type { CareerOverview } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';
import { Button } from '@/components/ui/button';
import { panelClass } from './career-shared';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function AnimatedNumber({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value == null) return;
    if (reduced) { setDisplay(value); return; }
    let frame = 0; const started = performance.now(); const duration = 520;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return value == null ? '—' : `${display}${suffix}`;
}

function StatCard({ label, value, suffix, context, icon: Icon }: { label: string; value: number | null; suffix?: string; context?: string; icon: typeof Send }) {
  return <div className="group rounded-xl border bg-card/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
    <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">{label}</p><Icon className="size-4 text-primary/70" aria-hidden="true" /></div>
    <p className="mt-2 text-2xl font-semibold tabular-nums"><AnimatedNumber value={value} suffix={suffix} /></p>
    {context && <p className="mt-1 text-xs text-muted-foreground">{context}</p>}
  </div>;
}

type LegacyCareerOverview = Partial<CareerOverview> & {
  applications?: number;
  interviews?: number;
  data?: { dashboard?: CareerOverview['dashboard'] };
  stats?: CareerOverview['dashboard']['stats'];
  activity?: CareerOverview['dashboard']['activity'];
  pipeline?: CareerOverview['dashboard']['pipeline'];
  recentApplications?: CareerOverview['dashboard']['recentApplications'];
  insights?: CareerOverview['dashboard']['insights'];
  weeklyProgress?: CareerOverview['dashboard']['weeklyProgress'];
};

function dashboardFromResponse(data?: CareerOverview): CareerOverview['dashboard'] | null {
  if (!data) return null;
  const raw = data as LegacyCareerOverview;
  if (raw.dashboard) return raw.dashboard;
  // Keep the page usable while older API workers are being restarted. Some
  // local environments still return the former flat overview contract.
  if (raw.data?.dashboard) return raw.data.dashboard;
  if (raw.stats && raw.activity && raw.pipeline && raw.recentApplications && raw.insights) {
    return { stats: raw.stats, activity: raw.activity, pipeline: raw.pipeline, recentApplications: raw.recentApplications, insights: raw.insights, weeklyProgress: raw.weeklyProgress ?? null };
  }
  const applicationsSent = raw.applications ?? 0;
  return {
    stats: { applicationsSent, applicationsThisWeek: 0, inReview: 0, interviews: raw.interviews ?? 0, offers: 0, averageMatch: null },
    activity: Array.from({ length: 7 }, (_, index) => ({ date: new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10), count: 0 })),
    pipeline: { applied: applicationsSent, review: 0, interview: raw.interviews ?? 0, offer: 0, hired: 0 },
    recentApplications: [],
    insights: { mostAppliedRole: null, mostRequestedSkill: null, averageMatchThisMonth: null },
    weeklyProgress: null,
  };
}

export function DashboardOverview({ data }: { data?: CareerOverview }) {
  const t = useCareerText();
  const reduced = useReducedMotion();
  const dashboard = dashboardFromResponse(data);
  if (!dashboard) return <section className={panelClass}><p className="font-medium">{t('noDataYet')}</p><p className="mt-1 text-sm text-muted-foreground">{t('startExploringJobs')}</p><Button asChild className="mt-4"><Link href="/candidate/jobs">{t('find')}</Link></Button></section>;
  const { stats, activity, pipeline, recentApplications, insights, weeklyProgress } = dashboard;
  const totalPipeline = Object.values(pipeline).reduce((sum, value) => sum + value, 0);
  const pipelineItems = [
    ['APPLIED', pipeline.applied, 'bg-sky-500'], ['UNDER_REVIEW', pipeline.review, 'bg-violet-500'], ['INTERVIEW', pipeline.interview, 'bg-amber-500'], ['OFFER', pipeline.offer, 'bg-emerald-500'], ['HIRED', pipeline.hired, 'bg-teal-500'],
  ] as const;
  return <div className="space-y-5">
    <div data-guide="dashboard" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <StatCard label={t('applicationsSent')} value={stats.applicationsSent} context={stats.applicationsThisWeek > 0 ? `+${stats.applicationsThisWeek} ${t('thisWeek')}` : t('noDataYet')} icon={Send} />
      <StatCard label={t('inReview')} value={stats.inReview} icon={BriefcaseBusiness} />
      <StatCard label={t('interviews')} value={stats.interviews} icon={CalendarDays} />
      <StatCard label={t('offers')} value={stats.offers} icon={CircleDollarSign} />
      <StatCard label={t('averageMatch')} value={stats.averageMatch == null ? null : Math.round(stats.averageMatch)} suffix="%" icon={Target} />
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className={`${panelClass} min-w-0`} aria-labelledby="application-activity-title">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="application-activity-title" className="font-semibold">{t('applicationActivity')}</h2><p className="mt-1 text-xs text-muted-foreground">{t('lastSevenDays')}</p></div><TrendingUp className="size-5 text-primary" aria-hidden="true" /></div>
        {activity.some(item => item.count > 0) ? <div className="h-56 min-h-0 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={activity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs><linearGradient id="dashboardActivityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.32} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={value => new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short' })} tickLine={false} axisLine={false} fontSize={11} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} /><Tooltip labelFormatter={value => new Date(`${value}T00:00:00Z`).toLocaleDateString()} contentStyle={{ borderRadius: 12, borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }} /><Area type="monotone" dataKey="count" name={t('applications')} stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#dashboardActivityFill)" isAnimationActive={!reduced} animationDuration={500} />
        </AreaChart></ResponsiveContainer></div> : <div className="flex h-56 items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground"><p>{t('noApplicationActivity')}</p></div>}
      </section>
      <section className={`${panelClass} space-y-4`} aria-labelledby="application-pipeline-title"><div className="flex items-center justify-between gap-3"><h2 id="application-pipeline-title" className="font-semibold">{t('applicationPipeline')}</h2><span className="text-xs text-muted-foreground">{totalPipeline} {t('applications')}</span></div><div className="flex h-3 overflow-hidden rounded-full bg-muted">{pipelineItems.map(([key, value, color]) => value > 0 && <span key={key} title={`${t(key)}: ${value}`} className={`${color} transition-[width] duration-500 motion-reduce:transition-none`} style={{ width: `${totalPipeline ? value / totalPipeline * 100 : 0}%` }} />)}</div><div className="space-y-2">{pipelineItems.map(([key, value, color]) => <div className="flex items-center justify-between gap-3 text-sm" key={key}><span className="flex items-center gap-2 text-muted-foreground"><span className={`size-2 rounded-full ${color}`} />{t(key)}</span><span className="font-semibold tabular-nums">{value}</span></div>)}</div></section>
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className={`${panelClass} space-y-3`} aria-labelledby="recent-applications-title"><div className="flex items-center justify-between gap-3"><h2 id="recent-applications-title" className="font-semibold">{t('recentApplications')}</h2><Link href="/candidate/applications" className="text-sm text-primary hover:underline">{t('viewAllApplications')}</Link></div>{recentApplications.length ? recentApplications.map(application => <Link href={`/candidate/applications/${application.id}`} key={application.id} className="flex items-center gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-primary/25 hover:bg-muted/45 focus-visible:outline-2 focus-visible:outline-ring"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><CheckCircle2 className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{application.job.title}</span><span className="block truncate text-xs text-muted-foreground">{application.job.company?.commercialName ?? t('companyNotListed')} · {new Date(application.appliedAt).toLocaleDateString()}</span></span><span className="shrink-0 text-end"><span className="block text-sm font-semibold tabular-nums">{application.aiMatchScore == null ? '—' : `${application.aiMatchScore}%`}</span><span className="block text-xs text-muted-foreground">{t(application.status)}</span></span></Link>) : <div className="rounded-xl border border-dashed p-6 text-center"><p className="font-medium">{t('noApplicationsYet')}</p><p className="mt-1 text-sm text-muted-foreground">{t('startExploringJobs')}</p><Button asChild className="mt-4"><Link href="/candidate/jobs">{t('find')}</Link></Button></div>}</section>
      <div className="space-y-4"><section className={`${panelClass} space-y-3`} aria-labelledby="dashboard-insights-title"><h2 id="dashboard-insights-title" className="font-semibold">{t('insights')}</h2><div className="grid gap-3 text-sm"><p><span className="block text-xs text-muted-foreground">{t('mostAppliedRole')}</span><span className="font-medium">{insights.mostAppliedRole ?? '—'}</span></p><p><span className="block text-xs text-muted-foreground">{t('mostRequestedSkill')}</span><span className="font-medium">{insights.mostRequestedSkill ?? '—'}</span></p><p><span className="block text-xs text-muted-foreground">{t('averageMatchThisMonth')}</span><span className="font-medium">{insights.averageMatchThisMonth == null ? '—' : `${Math.round(insights.averageMatchThisMonth)}%`}</span></p></div></section>{weeklyProgress && <section className={`${panelClass} space-y-3`} aria-labelledby="weekly-progress-title"><div className="flex items-center justify-between gap-3"><h2 id="weekly-progress-title" className="font-semibold">{t('weeklyProgress')}</h2><span className="text-sm font-semibold tabular-nums">{weeklyProgress.current} / {weeklyProgress.limit}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.min(100, weeklyProgress.current / Math.max(1, weeklyProgress.limit) * 100)}%` }} /></div></section>}</div>
    </div>
  </div>;
}
