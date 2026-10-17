'use client';
import { recruiterJobApplicationsRoute, recruiterJobRoute } from '@/lib/job-display';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';


import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, ArrowUpRight, ExternalLink, Users, Plus, MoreHorizontal, Clock3, MapPin, Laptop, Wallet, CalendarDays, Info } from 'lucide-react';
import { toast } from 'sonner';
import { applicationsApi } from '@/lib/api/applications';
import { jobsApi } from '@/lib/api/jobs';
import { useRole } from '@/hooks/use-auth';
import { useSocketEvent } from '@/hooks/use-socket';
import { ScheduleInterviewAction } from './workspace-interviews';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { useI18n } from '@/lib/i18n';
import { RequireCompanyPermission } from '@/components/shared/guards';
import { EmptyState, SkeletonRows } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Failure, panelClass } from '@/components/candidate/career-shared';
import { JobStatusBadge } from './job-status-badge';
import { PIPELINE_ORDER, TERMINAL_STATUSES } from '@/lib/constants';
import type { Application, ApplicationStatus } from '@/types/api';
import type { Permission } from '@/types/auth';
import { ApplicationStageControl } from './application-stage-control';
import { EasyJobFeature, AnalysisInfo } from './easyjob-feature';
import { analysisTone, isTerminalApplication } from '@/lib/recruitment-presentation';
import { GrowthPotentialDialog } from './growth-potential-dialog';
import { formatJobSalary } from '@/lib/format';
import NotFound from '@/app/not-found';
import { ApiError } from '@/lib/api/client';
import { recruiterJobEditRoute, recruiterJobPreviewRoute, toJobDisplayStatus, workModeKey, employmentTypeKey, type JobDisplayStatus } from '@/lib/job-display';

export function RecruitmentHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  const t = useRecruitmentText();
  return <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300"><EasyJobFeatureMark size="sm" className="" />{t('workspace')}</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{children}</header>;
}
export function PageControls({ page, total, limit, change }: { page: number; total: number; limit: number; change: (page: number) => void }) {
  const t = useRecruitmentText();
  return <nav aria-label={t('page')} className="flex items-center justify-between gap-3 py-4"><Button variant="outline" disabled={page <= 1} onClick={() => change(page - 1)}>{t('previous')}</Button><span className="text-sm tabular-nums">{t('page')} {page} / {Math.max(1, Math.ceil(total / limit))}</span><Button variant="outline" disabled={page * limit >= total} onClick={() => change(page + 1)}>{t('next')}</Button></nav>;
}
function Empty({ text }: { text: string }) { return <div className={`${panelClass} col-span-full py-16 text-center`}><Briefcase className="mx-auto mb-4 size-10 text-muted-foreground" /><p className="text-sm text-muted-foreground">{text}</p></div>; }
const percent = (score: number | null | undefined) => score == null ? '—' : `${Math.round(score)}%`;
const stageDuration = (seconds: number | undefined) => {
  if (seconds == null) return '—';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} j`;
};
function withApplicationView(companyId: string, view: 'table' | 'jobs', query = '') {
  const next = new URLSearchParams(query);
  next.set('view', view);
  return `/company/${companyId}/applications?${next.toString()}`;
}
function RecruitmentViewSwitch({ companyId, active, query }: { companyId: string; active: 'table' | 'jobs'; query?: string }) {
  const t = useRecruitmentText();
  return <Tabs value={active} className="shrink-0"><TabsList aria-label={t('applicationViews')}><TabsTrigger value="table" asChild><Link href={withApplicationView(companyId, 'table', query)}>{t('board')}</Link></TabsTrigger><TabsTrigger value="jobs" asChild><Link href={withApplicationView(companyId, 'jobs', query)}>{t('applicationsByJob')}</Link></TabsTrigger></TabsList></Tabs>;
}
export function ApplicationJobsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const params = useSearchParams();
  return <RequireCompanyPermission companyId={companyId} permission="application.view">{params.get('view') === 'jobs' ? <ApplicationJobs companyId={companyId} /> : <ApplicationBoard companyId={companyId} pipeline={false} />}</RequireCompanyPermission>;
}
function ApplicationJobs({ companyId }: { companyId: string }) {
  const t = useRecruitmentText(), { locale } = useI18n(), params = useSearchParams(), router = useRouter();
  const [search, setSearch] = useState(params.get('search') || ''), [page, setPage] = useState(Number(params.get('page') || 1));
  const [status, setStatus] = useState(params.get('jobStatus') || ''), [sort, setSort] = useState(params.get('jobSort') || 'newest');
  const updateParam = (key: string, value: string) => { const next = new URLSearchParams(params.toString()); if (value) next.set(key, value); else next.delete(key); next.delete('page'); router.replace(`?${next.toString()}`, { scroll: false }); };
  const query = useQuery({ queryKey: ['application-jobs', companyId, search, status, sort, page, params.get('from'), params.get('to'), params.get('overdue'), params.get('classification'), params.get('activeOnly'), params.get('includeLowAlignment')], queryFn: () => applicationsApi.jobSummaries(companyId, { search, status: status || undefined, sort, page, limit: 12 }) });
  const qc = useQueryClient();
  useSocketEvent('application.updated', () => { void qc.invalidateQueries({ queryKey: ['application-jobs', companyId] }); });
  const visibleJobs = query.data?.items ?? [];
  return <div className="space-y-6"><RecruitmentHeader title={t('applicationsByJob')} description={t('applicationsHelp')}><div className="flex flex-wrap items-center gap-2"><RecruitmentViewSwitch companyId={companyId} active="jobs" query={params.toString()} /><Button asChild variant="outline"><Link href={`/company/${companyId}/pipeline`}>{t('pipeline')}</Link></Button></div></RecruitmentHeader>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">{t('searchJobs')}<Input className="mt-1" aria-label={t('searchJobs')} placeholder={t('searchJobs')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); updateParam('search', e.target.value); }} /></label><label className="w-full text-xs font-medium text-muted-foreground sm:w-44">{t('status')}<Select value={status || 'all'} onValueChange={value => { setStatus(value === 'all' ? '' : value); setPage(1); updateParam('jobStatus', value === 'all' ? '' : value); }}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('all')}</SelectItem>{['PUBLISHED', 'PAUSED', 'CLOSED', 'DRAFT', 'EXPIRED'].map(value => <SelectItem value={value} key={value}>{t(value)}</SelectItem>)}</SelectContent></Select></label><label className="w-full text-xs font-medium text-muted-foreground sm:w-44">{t('sortBy')}<Select value={sort} onValueChange={value => { setSort(value); updateParam('jobSort', value); }}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">{t('newest')}</SelectItem><SelectItem value="oldest">{t('oldest')}</SelectItem><SelectItem value="title">{t('title')}</SelectItem></SelectContent></Select></label></div>
    {query.isPending ? <SkeletonRows rows={4} cols={3} /> : query.isError ? <Failure retry={() => query.refetch()} /> : <><div className="grid gap-4 lg:grid-cols-2">{visibleJobs.length ? visibleJobs.map(job => <ApplicationJobCard key={job.id} companyId={companyId} job={job} locale={locale} t={t} advancedAnalysisAvailable={query.data.advancedAnalysisAvailable} />) : <Empty text={status ? t('emptyApplications') : t('emptyCompanyJobs')} />}</div><PageControls page={page} total={query.data.total} limit={12} change={next => { setPage(next); updateParam('page', String(next)); }} /></>}
  </div>;
}

function ApplicationJobCard({ companyId, job, locale, t, advancedAnalysisAvailable: advancedAvailable }: { companyId: string; job: import('@/lib/api/applications').ApplicationJobSummary; locale: string; t: (key: string) => string; advancedAnalysisAvailable?: boolean }) {
  const advancedAnalysisAvailable = advancedAvailable !== false;
  const top = useQuery({ queryKey: ['application-job-rank', companyId, job.id], queryFn: () => applicationsApi.rankCandidates(companyId, job.id), enabled: advancedAnalysisAvailable && job.applications > 0, staleTime: 60_000 });
  const activity = [
    job.newApplications > 0 ? `${job.newApplications} ${t('newApplications').toLowerCase()}` : null,
    job.shortlisted > 0 ? `${job.shortlisted} ${t('shortlisted').toLowerCase()}` : null,
    advancedAnalysisAvailable && job.strongMatches > 0 ? `${job.strongMatches} ${t('strongMatches').toLowerCase()}` : null,
  ].filter((value): value is string => Boolean(value));
  const analysisBlock = advancedAnalysisAvailable ? <>{(job.averageMatch != null || job.averageAts != null) && <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><span>{t('averageMatch')}: {percent(job.averageMatch)}</span><span>{t('averageAts')}: {percent(job.averageAts)}</span></div>}{top.isSuccess && top.data.length > 0 && <div className="space-y-2"><EasyJobFeature companyId={companyId} feature="ranking" label={t('topCandidates')} /><ol className="space-y-1 text-sm">{top.data.slice(0, 3).map(candidate => <li key={candidate.applicationId} className="flex items-center justify-between gap-3"><span className="truncate">{candidate.rank}. {candidate.candidateName}</span><span className="shrink-0 font-semibold text-primary">{percent(candidate.aiMatchScore)}</span></li>)}</ol></div>}</> : <p className="rounded-lg border border-indigo-200/60 bg-indigo-50/40 px-3 py-3 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">{t('advancedAnalysisPremium')}</p>;
  const hasSalary = (job.salaryMin ?? 0) > 0 || (job.salaryMax ?? 0) > 0;
  const metadata = [
    <span key="location" className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{job.location || '—'}</span>,
    <span key="employment" className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5" aria-hidden="true" />{employmentTypeKey(job.employmentType) ? t(employmentTypeKey(job.employmentType)!) : ''}</span>,
    <span key="workMode" className="inline-flex items-center gap-1.5"><Laptop className="size-3.5" aria-hidden="true" />{t(workModeKey(job.workMode, job.remote))}</span>,
  ];
  return <article className={`${panelClass} space-y-5 transition-shadow hover:shadow-md`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 truncate text-xs uppercase tracking-wide text-muted-foreground">{job.domain || t('offer')}</p><h2 className="truncate text-xl font-semibold">{job.title}</h2></div><JobStatusBadge status={job.status} /></div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">{metadata}</div>
    {hasSalary && <p className="inline-flex items-center gap-1.5 text-base font-semibold"><Wallet className="size-4 text-primary" aria-hidden="true" />{formatJobSalary(job.salaryMin, job.salaryMax, job.currency ?? 'TND')}</p>}
    <div className="space-y-1"><p className="text-sm font-medium">{job.applications} {t('totalApplications').toLowerCase()}</p>{activity.length > 0 && <p className="text-xs text-muted-foreground">{activity.join(' · ')}</p>}{job.applications === 0 && <p className="text-xs text-muted-foreground">{t('noApplicationsForJob')}</p>}</div>
    {analysisBlock}
    {job.expiresAt && <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={new Date(job.expiresAt).toLocaleDateString(locale)}><CalendarDays className="size-3.5" aria-hidden="true" />{t('deadline')} {new Date(job.expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
    <Button asChild size="sm" variant="secondary" className="w-full sm:w-auto"><Link href={`${recruiterJobApplicationsRoute(companyId, job.id)}?sort=match`}>{t('openApplications')}<ArrowUpRight className="ms-2 size-4" /></Link></Button>
  </article>;
}

export function JobApplicationsPage({ pipeline = false }: { pipeline?: boolean }) {
  const { companyId, jobId } = useParams<{ companyId: string; jobId?: string }>();
  return <RequireCompanyPermission companyId={companyId} permission="application.view"><ApplicationBoard companyId={companyId} routeJobId={jobId} pipeline={pipeline} /></RequireCompanyPermission>;
}
function ApplicationBoard({ companyId, routeJobId, pipeline }: { companyId: string; routeJobId?: string; pipeline: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const t = useRecruitmentText(), qc = useQueryClient(), { can } = useRole();
  const selectedStatus = params.get('status') || '';
  const validStatus = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'].includes(selectedStatus) ? selectedStatus : '';
  const [previousStatus, setPreviousStatus] = useState(selectedStatus);
  const [chosen, setChosen] = useState(params.get('job') || ''), [search, setSearch] = useState(params.get('search') || ''), [status, setStatus] = useState(validStatus), [sort, setSort] = useState(params.get('sort') || 'newest'), [page, setPage] = useState(Number(params.get('page') || 1));
  const updateParam = (key: string, value: string) => { const next = new URLSearchParams(params.toString()); if (value) next.set(key, value); else next.delete(key); next.delete('page'); router.replace(`?${next.toString()}`, { scroll: false }); };
  if (previousStatus !== selectedStatus) { setPreviousStatus(selectedStatus); setStatus(validStatus); setPage(1); }
  const jobs = useQuery({ queryKey: ['application-jobs', companyId], queryFn: () => applicationsApi.jobSummaries(companyId, { page: 1, limit: 50 }), enabled: !routeJobId });
  const jobId = routeJobId || chosen || undefined;
  const job = useQuery({ queryKey: ['managed-job', companyId, jobId], queryFn: () => jobsApi.managed(jobId!), enabled: !!jobId });
  const query = useQuery({ queryKey: ['company-applications', companyId, jobId, search, status, sort, page, params.get('from'), params.get('to'), params.get('overdue'), params.get('classification'), params.get('activeOnly'), params.get('includeLowAlignment')], queryFn: () => applicationsApi.companyList(companyId, { jobId, search, status: status || undefined, sort, page, limit: 30, includeLowAlignment: routeJobId || params.get('overdue') || params.get('status') || params.get('includeLowAlignment') === 'true' ? 'true' : undefined, from: params.get('from') || undefined, to: params.get('to') || undefined, overdue: params.get('overdue') || undefined, classification: params.get('classification') || undefined, activeOnly: params.get('activeOnly') || undefined }), enabled: can(companyId, 'application.view') && (!routeJobId || job.data?.companyId === companyId) });
  const advancedAnalysisAvailable = query.data?.advancedAnalysisAvailable !== false;
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['company-workspace', companyId] }); void qc.invalidateQueries({ queryKey: ['company-applications', companyId] }); void qc.invalidateQueries({ queryKey: ['application-jobs', companyId] }); void qc.invalidateQueries({ queryKey: ['analytics', companyId] }); };
  useSocketEvent('application.updated', invalidate);
  const move = useMutation({ mutationFn: ({ id, next, alignmentOverride, overrideReason }: { id: string; next: ApplicationStatus; alignmentOverride?: boolean; overrideReason?: string }) => applicationsApi.updateStatus(id, { newStatus: next, source: 'HR', alignmentOverride, overrideReason }), onSuccess: () => { invalidate(); toast.success(t('updated')); }, onError: () => toast.error(t('error')) });
  // SCREENING is the internal deterministic analysis state. Recruiters act on
  // the human pipeline only, so it is never offered as a manual stage.
  const visibleStages: ApplicationStatus[] = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'];
  const allowed = (app: Application, next: ApplicationStatus) => !TERMINAL_STATUSES.includes(app.status) && app.status !== next && (next === 'REJECTED' || PIPELINE_ORDER.indexOf(next) > PIPELINE_ORDER.indexOf(app.status));
  const items = query.data?.items ?? [];
  const stageCounts = query.data?.stageCounts ?? {};
  const allCount = query.data?.stageCounts ? Object.values(stageCounts).reduce((sum, count) => sum + count, 0) : query.data?.total ?? 0;
  const card = (app: Application) => {
    const workflow = app.workflow;
    const terminal = isTerminalApplication(app.status);
    const overdue = !terminal && (workflow?.recruiterProcessingOverdue ?? workflow?.overdue);
    const dossierHref = `/company/${companyId}/applications/${app.id}`;
    const primaryAction = app.status === 'APPLIED'
      ? <Button asChild size="sm"><Link href={dossierHref}>{t('reviewApplication')}<ArrowUpRight className="ms-1 size-3.5" /></Link></Button>
      : app.status === 'UNDER_REVIEW'
        ? can(companyId, 'application.move') && allowed(app, 'SHORTLISTED')
          ? <Button size="sm" onClick={() => move.mutate({ id: app.id, next: 'SHORTLISTED' })} disabled={move.isPending}>{t('shortlistCandidate')}</Button>
          : <Button asChild size="sm"><Link href={dossierHref}>{t('reviewApplication')}<ArrowUpRight className="ms-1 size-3.5" /></Link></Button>
        : app.status === 'SHORTLISTED'
          ? <ScheduleInterviewAction companyId={companyId} applicationId={app.id} label={`${app.candidate?.user.name ?? ''} · ${app.job?.title ?? job.data?.title ?? ''}`} variant="default" />
          : app.status === 'INTERVIEW'
            ? <Button asChild size="sm"><Link href={`${dossierHref}?tab=interviews`}>{t('addInterviewEvaluation')}<ArrowUpRight className="ms-1 size-3.5" /></Link></Button>
            : app.status === 'OFFER'
              ? <Button asChild size="sm"><Link href={`${dossierHref}?tab=offers`}>{t('manageOffer')}<ArrowUpRight className="ms-1 size-3.5" /></Link></Button>
              : null;
    return <article key={app.id} aria-busy={move.isPending && move.variables?.id === app.id} className={`${panelClass} grid gap-3 p-4 transition-colors hover:border-indigo-300/70 lg:grid-cols-[minmax(0,1.45fr)_minmax(7rem,.55fr)_minmax(8rem,.7fr)_minmax(8rem,.7fr)_auto] lg:items-center`}>
      <div className="flex min-w-0 items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{app.candidate?.user.name.slice(0, 1) || <Users className="size-4" />}</div><Link href={`/company/${companyId}/applications/${app.id}`} className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 className="truncate font-semibold">{app.candidate?.user.name || '—'}</h2><p className="truncate text-xs text-muted-foreground">{app.job?.title || job.data?.title || app.candidate?.headline || '—'}</p></Link></div>
      {advancedAnalysisAvailable && <><div className="text-sm"><p className="text-xs text-muted-foreground"><AnalysisInfo label={t('match')} help={t('matchExplanationHelp')} /></p><p className="font-semibold text-primary">{percent(app.aiMatchScore)}</p></div><div className="text-sm"><p className="text-xs text-muted-foreground"><AnalysisInfo label={t('potential')} help={t('potentialHelp')} /></p><GrowthPotentialDialog application={app} /></div></>}
      <div className="flex flex-wrap items-center gap-2 text-xs">{advancedAnalysisAvailable && <span className={`rounded-full border px-2 py-1 ${analysisTone(app.classification)}`}>{t(app.classification ?? 'REVIEW')}</span>}{can(companyId, 'application.move') ? <ApplicationStageControl application={app} companyId={companyId} /> : <span>{t(app.status)}</span>}{terminal && <span className="text-muted-foreground">{t('closedOn')} {new Date(app.stageChangedAt || app.updatedAt).toLocaleDateString()}</span>}<span className="text-muted-foreground" title={t('received')}>{new Date(app.appliedAt).toLocaleDateString()}</span>{workflow && !terminal && <><span className="text-muted-foreground" title={t('timeInStage')}><Clock3 className="me-1 inline size-3.5" />{t('inStage')} {stageDuration(workflow.elapsedSeconds)}</span>{overdue && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300" title={t('processingOverdueHelp')}>{t('processingOverdue')}</span>}</>}</div>
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">{primaryAction}<Button asChild size="sm" variant="outline" className="shrink-0"><Link href={dossierHref}>{t('viewDossier')}<ArrowUpRight className="ms-1 size-3.5" /></Link></Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="shrink-0" aria-label={t('moreActions')}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`${dossierHref}?tab=notes`}>{t('notes')}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`${dossierHref}?tab=timeline`}>{t('timeline')}</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`${dossierHref}?tab=aiAnalysis`}>{t('viewAnalysis')}</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
    </article>;
  };
  if (routeJobId && job.isPending) return <SkeletonRows rows={4} cols={3} />;
  if (routeJobId && ((job.error instanceof ApiError && [403, 404].includes(job.error.status)) || (job.data && job.data.companyId !== companyId))) return <NotFound />;
  if (routeJobId && job.isError) return <Failure retry={() => job.refetch()} />;
  return <div className="space-y-6"><RecruitmentHeader title={pipeline ? t('pipeline') : job.data?.title || t('applications')} description={t(pipeline ? 'pipelineHelp' : 'applicationsHelp')}><div className="flex flex-wrap gap-2"><RecruitmentViewSwitch companyId={companyId} active="table" query={params.toString()} /></div></RecruitmentHeader>
    {(jobs.isError && !routeJobId) && <Failure retry={() => jobs.refetch()} />}
    <div>{advancedAnalysisAvailable ? <EasyJobFeature companyId={companyId} /> : <p className="text-xs text-muted-foreground">{t('advancedAnalysisPremium')}</p>}</div>
    <div className="flex flex-wrap gap-2" aria-label={t('pipeline')}><Button size="sm" variant={!status ? 'secondary' : 'ghost'} onClick={() => { setStatus(''); setPage(1); updateParam('status', ''); }}>{t('all')} <span className="ms-1 rounded-full bg-muted px-1.5 tabular-nums">{allCount}</span></Button>{visibleStages.map(stage => <Button key={stage} size="sm" variant={status === stage ? 'secondary' : 'ghost'} onClick={() => { const next = status === stage ? '' : stage; setStatus(next); setPage(1); updateParam('status', next); }}>{t(stage)} <span className="ms-1 rounded-full bg-muted px-1.5 tabular-nums">{(stageCounts[stage] ?? 0) + (stage === 'UNDER_REVIEW' ? stageCounts.SCREENING ?? 0 : stage === 'INTERVIEW' ? stageCounts.ASSESSMENT ?? 0 : 0)}</span></Button>)}</div>
    <div className={`grid min-w-0 items-end gap-3 ${routeJobId ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,14rem)]'}`}><Input className="min-w-0 flex-1" aria-label={t('searchCandidates')} placeholder={t('searchCandidates')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); updateParam('search', e.target.value); }} />{!routeJobId && <label className="grid min-w-0 w-full gap-1 text-xs font-medium text-muted-foreground">{t('offer')}<Select value={jobId || 'all'} onValueChange={value => { setChosen(value === 'all' ? '' : value); setPage(1); updateParam('job', value === 'all' ? '' : value); }}><SelectTrigger className="w-full" aria-label={t('offer')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('allOffers')}</SelectItem>{jobs.data?.items.map(j => <SelectItem value={j.id} key={j.id}>{j.title} ({j.applications})</SelectItem>)}</SelectContent></Select></label>}<label className="grid min-w-0 w-full gap-1 text-xs font-medium text-muted-foreground">{t('sortBy')}<Select value={sort} onValueChange={value => { setSort(value); setPage(1); updateParam('sort', value); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="match">{t('relevance')}</SelectItem><SelectItem value="potential">{t('growthPotential')}</SelectItem><SelectItem value="newest">{t('newest')}</SelectItem><SelectItem value="oldest">{t('oldest')}</SelectItem><SelectItem value="stageTime">{t('timeInStage')}</SelectItem></SelectContent></Select></label></div>
    {!routeJobId && jobs.data?.total === 0 ? <Empty text={t('emptyCompanyJobs')} /> : query.isPending ? <SkeletonRows rows={4} cols={3} /> : query.isError ? <Failure retry={() => query.refetch()} /> : <><div className="space-y-3">{items.length ? items.map(card) : <Empty text={t('emptyApplications')} />}</div><PageControls page={page} total={query.data?.total ?? 0} limit={30} change={setPage} /></>}
  </div>;
}

export function CompanyJobsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  return <RequireCompanyPermission companyId={companyId} permission="application.view"><CompanyJobs companyId={companyId} /></RequireCompanyPermission>;
}
type OfferDisplayStatus = JobDisplayStatus;
const OFFER_DISPLAY_STATUSES: OfferDisplayStatus[] = ['active', 'paused', 'draft', 'closed'];
const offerDisplayStatus = toJobDisplayStatus;
const offerStatusLabel = (status: OfferDisplayStatus) => ({ active: 'activeOffers', paused: 'pausedOffers', draft: 'draftOffers', closed: 'closedOffers' }[status]);
const offerEmptyCopy = (status: OfferDisplayStatus) => ({
  active: ['noActiveOffers', 'noActiveOffersHelp'],
  paused: ['noPausedOffers', 'emptyCompanyJobs'],
  draft: ['noDraftOffers', 'emptyCompanyJobs'],
  closed: ['noClosedOffers', 'emptyCompanyJobs'],
}[status]);

type CompanyJobAction = 'duplicate' | 'pause' | 'publish' | 'submit' | 'close' | 'remove';

function ManagedJobCard({
  companyId, job, locale, router, t, can, actionPending, onAction,
}: {
  companyId: string;
  job: import('@/types/api').Job;
  locale: string;
  router: { push: (href: string) => void };
  t: (key: string) => string;
  can: (companyId: string | null, permission: Permission) => boolean;
  actionPending: boolean;
  onAction: (type: CompanyJobAction) => void;
}) {
  const displayStatus = offerDisplayStatus(job.status);
  const applications = job._count?.applications ?? 0;
  const activity = [
    job.applicationMetrics?.new && job.applicationMetrics.new > 0 ? `${job.applicationMetrics.new} ${t('newApplications').toLowerCase()}` : null,
    job.applicationMetrics?.shortlisted && job.applicationMetrics.shortlisted > 0 ? `${job.applicationMetrics.shortlisted} ${t('shortlisted').toLowerCase()}` : null,
    job._count?.interviews && job._count.interviews > 0 ? `${job._count.interviews} ${t('interviews').toLowerCase()}` : null,
  ].filter((value): value is string => Boolean(value));
  const hasSalary = (job.salaryMin ?? 0) > 0 || (job.salaryMax ?? 0) > 0;
  const editable = displayStatus !== 'closed' && can(companyId, 'job.update');
  const detailHref = recruiterJobRoute(companyId, job.id);
  const previewHref = recruiterJobPreviewRoute(companyId, job.id);
  const editHref = recruiterJobEditRoute(companyId, job.id);
  const applicationsHref = recruiterJobApplicationsRoute(companyId, job.id);
  const openCard = () => { router.push(detailHref); };
  const stopCard = (event: MouseEvent) => event.stopPropagation();
  return <article className={`${panelClass} group relative space-y-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-indigo-300/70 hover:shadow-lg`} role="link" tabIndex={0} aria-label={job.title} onClick={openCard} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openCard(); } }}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="truncate text-xl font-semibold tracking-tight">{job.title}</h2><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{job.location || '—'}</span><span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5" aria-hidden="true" />{employmentTypeKey(job.employmentType) ? t(employmentTypeKey(job.employmentType)!) : ''}</span><span className="inline-flex items-center gap-1.5"><Laptop className="size-3.5" aria-hidden="true" />{t(workModeKey(job.workMode, job.remote))}</span></div></div>
      <div className="relative z-10 flex shrink-0 items-center gap-2" onClick={stopCard}><JobStatusBadge status={displayStatus} /><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={t('moreActions')}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44">{editable && <DropdownMenuItem asChild><Link href={editHref}>{t('editJob')}</Link></DropdownMenuItem>}{can(companyId, 'job.create') && <DropdownMenuItem disabled={actionPending} onSelect={() => onAction('duplicate')}>{t('duplicateShort')}</DropdownMenuItem>}{displayStatus !== 'closed' && <DropdownMenuSeparator />}{displayStatus === 'active' && job.status === 'PUBLISHED' && can(companyId, 'job.publish') && <DropdownMenuItem disabled={actionPending} onSelect={() => onAction('pause')}>{t('pauseShort')}</DropdownMenuItem>}{displayStatus === 'paused' && can(companyId, 'job.publish') && <DropdownMenuItem disabled={actionPending} onSelect={() => onAction('publish')}>{t('reactivate')}</DropdownMenuItem>}{displayStatus === 'draft' && job.status === 'DRAFT' && can(companyId, 'job.update') && <DropdownMenuItem disabled={actionPending} onSelect={() => onAction('submit')}>{t('submit')}</DropdownMenuItem>}{displayStatus === 'draft' && job.status === 'DRAFT' && can(companyId, 'job.delete') && <DropdownMenuItem variant="destructive" disabled={actionPending} onSelect={() => { if (window.confirm(t('deleteOfferConfirm'))) onAction('remove'); }}>{t('deleteShort')}</DropdownMenuItem>}{displayStatus !== 'closed' && can(companyId, 'job.update') && <DropdownMenuItem disabled={actionPending} onSelect={() => onAction('close')}>{t('closeShort')}</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div>
    </div>
    <div className="grid gap-3 border-y border-border/70 py-3 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-center sm:gap-4"><div>{hasSalary ? <p className="inline-flex items-center gap-1.5 text-base font-semibold"><Wallet className="size-4 text-primary" aria-hidden="true" />{formatJobSalary(job.salaryMin, job.salaryMax, job.currency ?? 'TND')}</p> : <p className="text-sm text-muted-foreground">{t('salaryNotSpecified')}</p>}</div><div><p className="text-sm font-medium">{applications} {t('applications').toLowerCase()}</p>{activity.length > 0 && <p className="mt-0.5 truncate text-xs text-muted-foreground">{activity.join(' · ')}</p>}</div><div className="text-sm text-muted-foreground">{job.expiresAt ? <span className="inline-flex items-center gap-1.5" title={new Date(job.expiresAt).toLocaleDateString(locale)}><CalendarDays className="size-3.5" aria-hidden="true" />{t('deadline')} {new Date(job.expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</span> : <span>—</span>}</div></div>
    <div className="relative z-10 flex flex-wrap items-center gap-2" onClick={stopCard}><Button asChild size="sm" variant="outline"><Link href={displayStatus === 'active' ? previewHref : detailHref}>{displayStatus === 'active' ? t('viewOffer') : t('previewOffer')}<ExternalLink className="ms-1.5 size-3.5" /></Link></Button><Button asChild size="sm"><Link href={applicationsHref}><Users className="me-1.5 size-3.5" />{t('viewApplications')}<ArrowUpRight className="ms-1.5 size-3.5" /></Link></Button></div>
  </article>;
}
function CompanyJobs({ companyId }: { companyId: string }) {
  const params = useSearchParams(); const router = useRouter();
  const t = useRecruitmentText(), { locale } = useI18n(), qc = useQueryClient(), { can } = useRole();
  const rawStatus = params.get('status')?.toLowerCase() || '';
  const initialStatus: OfferDisplayStatus = OFFER_DISPLAY_STATUSES.includes(rawStatus as OfferDisplayStatus) ? rawStatus as OfferDisplayStatus : 'active';
  const [status, setStatus] = useState<OfferDisplayStatus>(initialStatus), [page, setPage] = useState(1), [search, setSearch] = useState(''), [sort, setSort] = useState(params.get('sort') || 'newest');
  const updateUrl = (nextStatus: OfferDisplayStatus, nextSort = sort) => { const next = new URLSearchParams(params.toString()); next.set('status', nextStatus); if (nextSort && nextSort !== 'newest') next.set('sort', nextSort); else next.delete('sort'); next.delete('page'); router.replace(`?${next.toString()}`, { scroll: false }); };
  useEffect(() => {
    const normalized = initialStatus;
    if (params.get('status') !== normalized) updateUrl(normalized);
    // URL navigation (including browser back/forward) is an external state change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status !== normalized) setStatus(normalized);
  // The URL is the source of truth for back/forward and refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const setStatusAndReset = (next: OfferDisplayStatus) => { setStatus(next); setPage(1); updateUrl(next); };
  const jobs = useQuery({ queryKey: ['company-jobs', companyId, status, page, search, sort], queryFn: () => jobsApi.companyJobs(companyId, { status, search: search || undefined, sort, page, limit: 12 }) });
  const statusCounts = useQueries({ queries: OFFER_DISPLAY_STATUSES.map(value => ({ queryKey: ['company-job-status-count', companyId, value], queryFn: () => jobsApi.companyJobs(companyId, { status: value, page: 1, limit: 1 }), staleTime: 30000 })) });
  const countFor = (value: OfferDisplayStatus) => statusCounts[OFFER_DISPLAY_STATUSES.indexOf(value)]?.data?.total;
  const action = useMutation({ mutationFn: async ({ id, type }: { id: string; type: CompanyJobAction }) => jobsApi[type](id, companyId), onSuccess: (result, variables) => { if (variables.type === 'duplicate' && 'id' in result) router.push(recruiterJobEditRoute(companyId, result.id)); void qc.invalidateQueries({ queryKey: ['company-jobs', companyId] }); void qc.invalidateQueries({ queryKey: ['company-job-status-count', companyId] }); void qc.invalidateQueries({ queryKey: ['application-jobs', companyId] }); toast.success(t('updated')); }, onError: () => toast.error(t('error')) });
  const empty = offerEmptyCopy(status);
  return <div className="space-y-6"><RecruitmentHeader title={t('companyJobs')} description={t('companyJobsHelp')}>{can(companyId, 'job.create') && <Button asChild><Link href={`/company/${companyId}/jobs/new`}><Plus className="me-2 size-4" />{t('postJob')}</Link></Button>}</RecruitmentHeader>
    <div className="space-y-3"><div className="flex flex-col gap-3 md:flex-row md:items-center"><Input className="min-w-0 flex-1" aria-label={t('searchJobs')} placeholder={t('searchJobs')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><label className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground md:w-64">{t('sortCompact')}<Select value={sort} onValueChange={value => { setSort(value); setPage(1); updateUrl(status, value); }}><SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">{t('sortNewest')}</SelectItem><SelectItem value="oldest">{t('sortOldest')}</SelectItem><SelectItem value="closingSoon">{t('sortClosingSoon')}</SelectItem><SelectItem value="title">{t('sortTitle')}</SelectItem></SelectContent></Select></label></div><div className="flex flex-wrap gap-2" aria-label={t('status')}>{OFFER_DISPLAY_STATUSES.map(value => <Button key={value} size="sm" variant={status === value ? 'secondary' : 'ghost'} onClick={() => setStatusAndReset(value)}>{t(offerStatusLabel(value))}{countFor(value) != null && <span className="ms-1 rounded-full bg-muted px-1.5 tabular-nums">{countFor(value)}</span>}</Button>)}</div></div>
    {jobs.isPending ? <SkeletonRows rows={4} cols={3} /> : jobs.isError ? <Failure retry={() => jobs.refetch()} message={jobs.error instanceof ApiError ? jobs.error.message : undefined} /> : <><div className="grid gap-4 lg:grid-cols-2">{jobs.data.items.length ? jobs.data.items.map(job => <ManagedJobCard key={job.id} companyId={companyId} job={job} locale={locale} router={router} t={t} can={can} actionPending={action.isPending} onAction={type => action.mutate({ id: job.id, type })} />) : <div className="col-span-full"><EmptyState icon={Briefcase} title={t(empty[0])} description={t(empty[1])} action={can(companyId, 'job.create') && status === 'active' ? <Button asChild><Link href={`/company/${companyId}/jobs/new`}>{t('postJob')}</Link></Button> : undefined} /></div>}</div><PageControls page={page} total={jobs.data.total} limit={12} change={setPage} /></>}
  </div>;
}
