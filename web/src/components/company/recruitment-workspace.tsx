'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, ArrowUpRight, Users, Sparkles, Plus, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { applicationsApi } from '@/lib/api/applications';
import { jobsApi } from '@/lib/api/jobs';
import { useRole } from '@/hooks/use-auth';
import { useSocketEvent } from '@/hooks/use-socket';
import { useUxText } from '@/lib/i18n/ux';
import { ScheduleInterviewAction } from './workspace-interviews';
import { AnalysisProcessing } from '@/components/shared/analysis-processing';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { useI18n } from '@/lib/i18n';
import { RequireCompanyPermission } from '@/components/shared/guards';
import { EmptyState, SkeletonRows } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Failure, panelClass, selectClass } from '@/components/candidate/career-shared';
import { PIPELINE_ORDER, TERMINAL_STATUSES } from '@/lib/constants';
import type { Application, ApplicationStatus } from '@/types/api';

export function RecruitmentHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  const t = useRecruitmentText();
  return <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300"><Sparkles className="size-4" />{t('workspace')}</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{children}</header>;
}
export function PageControls({ page, total, limit, change }: { page: number; total: number; limit: number; change: (page: number) => void }) {
  const t = useRecruitmentText();
  return <nav aria-label={t('page')} className="flex items-center justify-between gap-3 py-4"><Button variant="outline" disabled={page <= 1} onClick={() => change(page - 1)}>{t('previous')}</Button><span className="text-sm tabular-nums">{t('page')} {page} / {Math.max(1, Math.ceil(total / limit))}</span><Button variant="outline" disabled={page * limit >= total} onClick={() => change(page + 1)}>{t('next')}</Button></nav>;
}
function Empty({ text }: { text: string }) { return <div className={`${panelClass} col-span-full py-16 text-center`}><Briefcase className="mx-auto mb-4 size-10 text-muted-foreground" /><p className="text-sm text-muted-foreground">{text}</p></div>; }
const percent = (score: number | null | undefined) => score == null ? '—' : `${Math.round(score)}%`;

export function ApplicationJobsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const params = useSearchParams();
  return <RequireCompanyPermission companyId={companyId} permission="application.view">{params.get('view') === 'jobs' ? <ApplicationJobs companyId={companyId} /> : <ApplicationBoard companyId={companyId} pipeline={false} />}</RequireCompanyPermission>;
}
function ApplicationJobs({ companyId }: { companyId: string }) {
  const t = useRecruitmentText(), { locale } = useI18n();
  const [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['application-jobs', companyId, search, page], queryFn: () => applicationsApi.jobSummaries(companyId, { search, page, limit: 12 }) });
  const qc = useQueryClient();
  useSocketEvent('application.updated', () => { void qc.invalidateQueries({ queryKey: ['application-jobs', companyId] }); });
  return <div className="space-y-6"><RecruitmentHeader title={t('applicationsByJob')} description={t('applicationsHelp')}><Button asChild variant="outline"><Link href={`/company/${companyId}/pipeline`}>{t('pipeline')}</Link></Button></RecruitmentHeader><Input aria-label={t('searchJobs')} placeholder={t('searchJobs')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-xl" />
    {query.isPending ? <SkeletonRows rows={4} cols={3} /> : query.isError ? <Failure retry={() => query.refetch()} /> : <><div className="grid gap-5 lg:grid-cols-2">{query.data.items.length ? query.data.items.map(job => <article key={job.id} className={`${panelClass} space-y-5 transition-shadow hover:shadow-md`}>
      <div className="flex justify-between gap-3"><div><p className="mb-1 text-xs text-muted-foreground">{job.domain || t(job.employmentType)}</p><h2 className="text-xl font-semibold">{job.title}</h2></div><span className="h-fit rounded-full bg-muted px-3 py-1 text-xs">{t(job.status)}</span></div>
      <p className="text-sm text-muted-foreground">{job.location || '—'} · {new Date(job.publishedAt || job.createdAt).toLocaleDateString(locale)}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['totalApplications', job.applications], ['newApplications', job.newApplications], ['strongMatches', job.strongMatches], ['shortlisted', job.shortlisted]].map(([label, count]) => <div key={label} className="rounded-xl bg-muted/60 p-3"><p className="text-2xl font-semibold tabular-nums">{count}</p><p className="mt-1 text-xs text-muted-foreground">{t(String(label))}</p></div>)}</div>
      <div className="flex flex-wrap gap-5 text-xs text-muted-foreground"><span>{t('averageMatch')}: {percent(job.averageMatch)}</span><span>{t('averageAts')}: {percent(job.averageAts)}</span></div>
      <Button asChild className="w-full"><Link href={`/company/${companyId}/jobs/${job.id}/applications`}>{t('openApplications')}<ArrowUpRight className="ms-2 size-4" /></Link></Button>
    </article>) : <Empty text={t('emptyCompanyJobs')} />}</div><PageControls page={page} total={query.data.total} limit={12} change={setPage} /></>}
  </div>;
}

export function JobApplicationsPage({ pipeline = false }: { pipeline?: boolean }) {
  const { companyId, jobId } = useParams<{ companyId: string; jobId?: string }>();
  return <RequireCompanyPermission companyId={companyId} permission="application.view"><ApplicationBoard companyId={companyId} routeJobId={jobId} pipeline={pipeline} /></RequireCompanyPermission>;
}
function ApplicationBoard({ companyId, routeJobId, pipeline }: { companyId: string; routeJobId?: string; pipeline: boolean }) {
  const params = useSearchParams(); const ux = useUxText(); const [isPipeline, setPipeline] = useState(pipeline); const [dragging, setDragging] = useState<string | null>(null); const [target, setTarget] = useState<string | null>(null);
  const t = useRecruitmentText(), qc = useQueryClient(), { can } = useRole();
  const selectedStatus = params.get('status') || '';
  const validStatus = [...PIPELINE_ORDER, 'REJECTED', 'WITHDRAWN'].includes(selectedStatus as ApplicationStatus) ? selectedStatus : '';
  const [previousStatus, setPreviousStatus] = useState(selectedStatus);
  const [chosen, setChosen] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState(validStatus), [sort, setSort] = useState('newest'), [page, setPage] = useState(1), [minimum, setMinimum] = useState('');
  if (previousStatus !== selectedStatus) { setPreviousStatus(selectedStatus); setStatus(validStatus); setPage(1); }
  const [jobPage, setJobPage] = useState(1);
  const jobs = useQuery({ queryKey: ['application-jobs', companyId, jobPage], queryFn: () => applicationsApi.jobSummaries(companyId, { page: jobPage, limit: 50 }), enabled: !routeJobId });
  const jobId = routeJobId || chosen || undefined;
  const job = useQuery({ queryKey: ['managed-job', companyId, jobId], queryFn: () => jobsApi.managed(jobId!), enabled: !!jobId });
  const query = useQuery({ queryKey: ['company-applications', companyId, jobId, search, status, sort, minimum, page], queryFn: () => applicationsApi.companyList(companyId, { jobId, search, status: status || undefined, sort, minimumMatch: minimum ? Number(minimum) : undefined, page, limit: 30 }), enabled: can(companyId, 'application.view') });
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['company-workspace', companyId] }); void qc.invalidateQueries({ queryKey: ['company-applications', companyId] }); void qc.invalidateQueries({ queryKey: ['application-jobs', companyId] }); void qc.invalidateQueries({ queryKey: ['analytics', companyId] }); };
  useSocketEvent('application.updated', invalidate);
  const move = useMutation({ mutationFn: ({ id, next }: { id: string; next: ApplicationStatus }) => applicationsApi.updateStatus(id, { newStatus: next, source: 'HR' }), onSuccess: () => { invalidate(); toast.success(t('updated')); }, onError: () => toast.error(t('error')) });
  const stages: ApplicationStatus[] = [...PIPELINE_ORDER, 'REJECTED', 'WITHDRAWN'];
  const allowed = (app: Application, next: ApplicationStatus) => !TERMINAL_STATUSES.includes(app.status) && app.status !== next && (next === 'REJECTED' || PIPELINE_ORDER.indexOf(next) > PIPELINE_ORDER.indexOf(app.status));
  const items = query.data?.items ?? [];
  const card = (app: Application) => <article key={app.id} draggable={isPipeline && can(companyId, 'application.move') && !move.isPending} onDragStart={e => { e.dataTransfer.setData('text/plain', app.id); e.dataTransfer.effectAllowed = 'move'; setDragging(app.id); }} onDragEnd={() => { setDragging(null); setTarget(null); }} aria-busy={move.isPending && move.variables?.id === app.id} data-dragging={dragging === app.id} className={`${panelClass} pipeline-card space-y-4`}>
    <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{app.candidate?.user.name.slice(0, 1) || <Users className="size-5" />}</div><div className="min-w-0 flex-1"><h2 className="font-semibold">{app.candidate?.user.name || '—'}</h2><p className="truncate text-xs text-muted-foreground">{app.candidate?.headline || app.job?.title || job.data?.title}</p></div>{isPipeline && <GripVertical className="size-4 text-muted-foreground" />}</div>
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{t('match')}: {percent(app.aiMatchScore)}</span><span>{t('ats')}: {percent(app.atsScore)}</span><span className="rounded-full bg-muted px-2 py-1">{t(app.status)}</span></div>
    {['PENDING', 'PROCESSING'].includes(app.aiScreeningStatus ?? '') && <AnalysisProcessing />}
    <details className="text-sm"><summary className="cursor-pointer font-medium text-indigo-600 dark:text-indigo-300">{t('report')}</summary><div className="mt-3 space-y-3 text-muted-foreground">{app.matchExplanation ? <><p>{t(app.matchExplanation.classification)}</p><p>{t('matched')}: {app.matchExplanation.matchedSkills?.join(', ') || '—'}</p><p>{t('missing')}: {app.matchExplanation.missingSkills?.join(', ') || '—'}</p>{app.matchExplanation.dimensions?.map(d => <p key={d.key}>{t(d.key)}: {percent(d.score)}</p>)}<p>{t('unverified')}: {app.matchExplanation.unverifiedRequirements?.join(' · ') || '—'}</p></> : <p>{app.aiSummary || t('NOT_ANALYZED')}</p>}</div></details>
    {can(companyId, 'application.move') && <select className={selectClass} aria-label={`${t('changeStage')} · ${app.candidate?.user.name || app.id}`} value={app.status} disabled={move.isPending || TERMINAL_STATUSES.includes(app.status)} onChange={e => move.mutate({ id: app.id, next: e.target.value as ApplicationStatus })}><option value={app.status}>{t(app.status)}</option>{stages.filter(next => allowed(app, next)).map(next => <option key={next} value={next}>{t(next)}</option>)}</select>}
    {can(companyId, 'application.move') && allowed(app, 'SHORTLISTED') && <Button size="sm" variant="secondary" disabled={move.isPending} onClick={() => move.mutate({ id: app.id, next: 'SHORTLISTED' })}>{t('SHORTLISTED')}</Button>}
    <ScheduleInterviewAction companyId={companyId} applicationId={app.id} label={`${app.candidate?.user.name ?? ''} · ${app.job?.title ?? job.data?.title ?? ''}`} />
    <Button asChild variant="outline" className="w-full"><Link href={`/company/${companyId}/applications/${app.id}`}>{t('details')}<ArrowUpRight className="ms-2 size-4" /></Link></Button>
  </article>;
  return <div className="space-y-6"><RecruitmentHeader title={isPipeline ? t('pipeline') : job.data?.title || t('applications')} description={t(isPipeline ? 'pipelineHelp' : 'applicationsHelp')}><Button variant="outline" asChild><Link href={`/company/${companyId}/applications?view=jobs`}>{t('applicationsByJob')}</Link></Button></RecruitmentHeader><div className="flex items-center gap-1" aria-label={ux('board')}><Button variant={!isPipeline ? 'secondary' : 'ghost'} aria-pressed={!isPipeline} onClick={() => setPipeline(false)}>{ux('list')}</Button><Button variant={isPipeline ? 'secondary' : 'ghost'} aria-pressed={isPipeline} onClick={() => setPipeline(true)}>{ux('board')}</Button></div>
    {!routeJobId && <div className={panelClass}>{jobs.isError ? <Failure retry={() => jobs.refetch()} /> : <><label className="text-sm font-medium">{t('chooseJob')}<select className={`${selectClass} mt-2`} value={jobId || ''} onChange={e => { setChosen(e.target.value); setPage(1); }}><option value="">{t('all')}</option>{jobs.data?.items.map(j => <option value={j.id} key={j.id}>{j.title} ({j.applications})</option>)}</select></label>{(jobs.data?.total ?? 0) > 50 && <PageControls page={jobPage} total={jobs.data!.total} limit={50} change={p => { setJobPage(p); setChosen(''); setPage(1); }} />}</>}</div>}
    <p className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">{t('humanReview')}</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Input aria-label={t('searchCandidates')} placeholder={t('searchCandidates')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><select aria-label={t('status')} className={selectClass} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">{t('all')}</option>{stages.map(s => <option key={s} value={s}>{t(s)}</option>)}</select><Input aria-label={t('minimumScore')} placeholder={t('minimumScore')} type="number" min={0} max={100} value={minimum} onChange={e => { setMinimum(e.target.value); setPage(1); }} /><Button variant={sort === 'match' ? 'default' : 'outline'} onClick={() => { setSort(sort === 'match' ? 'newest' : 'match'); setPage(1); }}><Sparkles className="me-2 size-4" />{t(sort === 'match' ? 'newest' : 'bestCandidates')}</Button></div>
    {!routeJobId && jobs.data?.total === 0 ? <Empty text={t('emptyCompanyJobs')} /> : query.isPending ? <SkeletonRows rows={4} cols={3} /> : query.isError ? <Failure retry={() => query.refetch()} /> : <>{isPipeline ? <><p className="text-xs text-muted-foreground">{t('pageScope')}</p><div className="flex snap-x snap-proximity gap-4 overflow-x-auto pb-4">{stages.map(stage => <section key={stage} aria-label={t(stage)} onDragOver={e => { const app = items.find(item => item.id === dragging); if (app && allowed(app, stage) && can(companyId, 'application.move') && !move.isPending) { e.preventDefault(); setTarget(stage); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setTarget(null); }} data-target={target === stage} onDrop={e => { e.preventDefault(); setDragging(null); setTarget(null); const app = items.find(a => a.id === e.dataTransfer.getData('text/plain')); if (app && can(companyId, 'application.move') && !move.isPending && allowed(app, stage)) move.mutate({ id: app.id, next: stage }); }} className="pipeline-column w-[min(320px,85vw)] shrink-0 space-y-3 rounded-xl bg-muted/50 p-3"><h2 className="flex items-center justify-between p-2 text-sm font-semibold">{t(stage)}<span className="rounded-full bg-background px-2 py-1 tabular-nums">{items.filter(a => a.status === stage).length}</span></h2>{items.filter(a => a.status === stage).map(card)}</section>)}</div></> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.length ? items.map(card) : <Empty text={t('emptyApplications')} />}</div>}<PageControls page={page} total={query.data?.total ?? 0} limit={30} change={setPage} /></>}
  </div>;
}

export function CompanyJobsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  return <RequireCompanyPermission companyId={companyId} permission="application.view"><CompanyJobs companyId={companyId} /></RequireCompanyPermission>;
}
function CompanyJobs({ companyId }: { companyId: string }) {
  const params = useSearchParams(); const ux = useUxText();
  const t = useRecruitmentText(), qc = useQueryClient(), { can } = useRole();
  const selectedStatus = params.get('status') || '';
  const validStatus = ['DRAFT','PENDING_APPROVAL','APPROVED','PAUSED','PUBLISHED','CLOSED','EXPIRED','REJECTED'].includes(selectedStatus) ? selectedStatus : '';
  const [previousStatus, setPreviousStatus] = useState(selectedStatus);
  const [status, setStatus] = useState(validStatus), [page, setPage] = useState(1);
  if (previousStatus !== selectedStatus) { setPreviousStatus(selectedStatus); setStatus(validStatus); setPage(1); }
  const jobs = useQuery({ queryKey: ['company-jobs', companyId, status, page], queryFn: () => jobsApi.companyJobs(companyId, { status: status || undefined, page, limit: 12 }) });
  type JobAction = 'duplicate' | 'pause' | 'publish' | 'submit' | 'close';
  const action = useMutation({ mutationFn: ({ id, type }: { id: string; type: JobAction }) => jobsApi[type](id, companyId), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['company-jobs', companyId] }); void qc.invalidateQueries({ queryKey: ['application-jobs', companyId] }); toast.success(t('updated')); }, onError: () => toast.error(t('error')) });
  return <div className="space-y-6"><RecruitmentHeader title={t('companyJobs')} description={t('companyJobsHelp')}>{can(companyId, 'job.create') && <Button asChild><Link href={`/company/${companyId}/jobs/new`}><Plus className="me-2 size-4" />{t('postJob')}</Link></Button>}</RecruitmentHeader><select className={`${selectClass} max-w-sm`} aria-label={t('status')} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">{t('all')}</option>{['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAUSED', 'PUBLISHED', 'CLOSED', 'EXPIRED', 'REJECTED'].map(s => <option key={s} value={s}>{t(s)}</option>)}</select>
    {jobs.isPending ? <SkeletonRows rows={4} cols={3} /> : jobs.isError ? <Failure retry={() => jobs.refetch()} /> : <><div className="grid gap-4 lg:grid-cols-2">{jobs.data.items.length ? jobs.data.items.map(job => <article key={job.id} className={`${panelClass} space-y-4`}><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{job.title}</h2><span className="rounded-full bg-muted px-3 py-1 text-xs">{t(job.status)}</span></div><p className="text-sm text-muted-foreground">{[job.location, t(job.employmentType), t(job.workMode || (job.remote ? 'REMOTE' : 'ONSITE'))].filter(Boolean).join(' · ')}</p>{(job.salaryMin != null || job.salaryMax != null) && <p className="text-sm">{job.salaryMin?.toLocaleString() || '—'} – {job.salaryMax?.toLocaleString() || '—'} {job.currency}</p>}<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/company/${companyId}/jobs/${job.id}`}>{t('editJob')}</Link></Button>{([['duplicate', 'job.create', true], ['pause', 'job.publish', job.status === 'PUBLISHED'], ['publish', 'job.publish', ['APPROVED', 'PAUSED'].includes(job.status)], ['submit', 'job.update', ['DRAFT', 'REJECTED'].includes(job.status)], ['close', 'job.update', !['CLOSED', 'EXPIRED'].includes(job.status)]] as const).filter(([, permission, show]) => show && can(companyId, permission)).map(([type]) => <Button key={type} variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: job.id, type })}>{t(type === 'publish' ? 'publishJob' : type)}</Button>)}</div></article>) : <div className="col-span-full"><EmptyState icon={Briefcase} title={ux('noJobs')} description={status ? t('emptyCompanyJobs') : ux('noJobsHelp')} action={status ? <Button variant="outline" onClick={() => { setStatus(''); setPage(1); }}>{ux('clearFilters')}</Button> : can(companyId, 'job.create') ? <Button asChild><Link href={`/company/${companyId}/jobs/new`}>{t('postJob')}</Link></Button> : undefined} /></div>}</div><PageControls page={page} total={jobs.data.total} limit={12} change={setPage} /></>}
  </div>;
}
