'use client';
import { recruiterJobApplicationsRoute, recruiterJobRoute } from '@/lib/job-display';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jobsApi } from '@/lib/api/jobs';
import { companiesApi } from '@/lib/api/companies';
import { api } from '@/lib/api/client';
import { workspaceApi } from '@/lib/api/company-workspace';
import { useRole } from '@/hooks/use-auth';
import { useCompanyText } from '@/lib/i18n/company';
import { Button } from '@/components/ui/button';
import { JobForm } from './job-form';
import { RequireCompanyPermission } from '@/components/shared/guards';
import { RecruitmentAssistant } from './recruitment-assistant';
import { WorkspaceError, WorkspaceLoading } from './workspace-overview';
import { formatJobSalary } from '@/lib/format';
import { recruiterJobEditRoute, recruiterJobPreviewRoute, recruiterJobsRoute, workModeKey, employmentTypeKey } from '@/lib/job-display';
import { JobStatusBadge } from './job-status-badge';
import type { Job } from '@/types/api';
import { Briefcase, CalendarDays, ExternalLink, Laptop, MapPin, MoreHorizontal, Users, Wallet } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function JobWorkspace() {
  const { companyId, jobId } = useParams<{ companyId: string; jobId: string }>();
  const t = useCompanyText();
  const { can } = useRole();
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<'preview' | 'assignments'>('preview');
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({ queryKey: ['company-job', companyId, jobId], queryFn: async () => { const result = await jobsApi.managed(jobId); if (result.companyId !== companyId) throw new Error('Company mismatch'); return result; } });
  const action = useMutation({ mutationFn: async (name: string) => {
    if (name === 'delete') { await jobsApi.remove(jobId, companyId); router.push(recruiterJobsRoute(companyId)); }
    else if (name === 'duplicate') { const copy = await jobsApi.duplicate(jobId); router.push(recruiterJobEditRoute(companyId, copy.id)); }
    else if (name === 'publish') await jobsApi.publish(jobId, companyId);
    else if (name === 'pause') await jobsApi.pause(jobId);
    else if (name === 'close') await jobsApi.close(jobId, companyId);
    else if (name === 'submit') await jobsApi.submit(jobId, companyId);
  }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['company-job', companyId, jobId] }); void qc.invalidateQueries({ queryKey: ['company-jobs', companyId] }); void qc.invalidateQueries({ queryKey: ['company-workspace', companyId] }); toast.success(t('saved')); }, onError: () => toast.error(t('saveError')) });
  if (query.isPending) return <WorkspaceLoading />;
  if (query.isError) return <WorkspaceError retry={() => void query.refetch()} />;
  const job = query.data;
  const published = job.status === 'PUBLISHED';
  const canEdit = can(companyId, 'job.update') && job.status !== 'CLOSED';
  const previewHref = recruiterJobPreviewRoute(companyId, job.id);
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href={`/company/${companyId}/jobs`} className="inline-flex text-sm text-muted-foreground">← {t('back')}</Link>
    <header className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><h1 className="truncate text-2xl font-semibold tracking-tight">{job.title}</h1><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{job.location || '—'}</span><span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5" aria-hidden="true" />{t(employmentTypeKey(job.employmentType) || 'details')}</span><span className="inline-flex items-center gap-1.5"><Laptop className="size-3.5" aria-hidden="true" />{t(workModeKey(job.workMode, job.remote))}</span></div></div><div className="relative z-10 flex flex-wrap items-center gap-2"><JobStatusBadge status={job.status} /><Button asChild variant="outline" size="sm"><Link href={previewHref}><ExternalLink className="me-2 size-4" />{published ? t('viewOffer') : t('previewOffer')}</Link></Button><Button asChild size="sm"><Link href={recruiterJobApplicationsRoute(companyId, job.id)}><Users className="me-2 size-4" />{t('viewApplications')}</Link></Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={t('moreActions')}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44">{canEdit && <DropdownMenuItem asChild><Link href={recruiterJobEditRoute(companyId, job.id)}>{t('editOffer')}</Link></DropdownMenuItem>}{can(companyId, 'job.create') && <DropdownMenuItem disabled={action.isPending} onSelect={() => action.mutate('duplicate')}>{t('duplicateShort')}</DropdownMenuItem>}<DropdownMenuSeparator />{['APPROVED', 'PAUSED'].includes(job.status) && can(companyId, 'job.publish') && <DropdownMenuItem disabled={action.isPending} onSelect={() => action.mutate('publish')}>{t('reactivate')}</DropdownMenuItem>}{job.status === 'PUBLISHED' && can(companyId, 'job.update') && <DropdownMenuItem disabled={action.isPending} onSelect={() => action.mutate('pause')}>{t('pauseShort')}</DropdownMenuItem>}{['DRAFT', 'REJECTED'].includes(job.status) && can(companyId, 'job.update') && <DropdownMenuItem disabled={action.isPending} onSelect={() => action.mutate('submit')}>{t('submit')}</DropdownMenuItem>}{job.status !== 'CLOSED' && can(companyId, 'job.update') && <DropdownMenuItem disabled={action.isPending} onSelect={() => action.mutate('close')}>{t('closeShort')}</DropdownMenuItem>}{can(companyId, 'job.delete') && <DropdownMenuItem variant="destructive" disabled={action.isPending} onSelect={() => setDeleting(true)}>{t('deleteShort')}</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div></div><div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Wallet className="size-4 text-primary" aria-hidden="true" />{formatJobSalary(job.salaryMin, job.salaryMax, job.currency ?? 'TND')}</span>{job.expiresAt && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden="true" />{t('deadline')}: {new Date(job.expiresAt).toLocaleDateString()}</span>}</div></header>
    {job.rejectionReason && <p className="rounded border border-destructive/30 p-3 text-sm">{job.rejectionReason}</p>}
    {deleting && <section role="alertdialog" aria-label={t('deleteConfirm')} className="rounded border border-destructive/30 p-4"><h2>{t('deleteConfirm')}</h2><p className="my-3 text-sm text-muted-foreground">{t('deleteHelp')}</p><Button variant="destructive" disabled={action.isPending} onClick={() => action.mutate('delete')}>{t('confirm')}</Button><Button variant="ghost" onClick={() => setDeleting(false)}>{t('cancel')}</Button></section>}
    <nav className="flex flex-wrap gap-2" aria-label={t('details')}>{(['preview', 'assignments'] as const).map(key => <Button key={key} variant={tab === key ? 'secondary' : 'ghost'} onClick={() => setTab(key)}>{t(key === 'preview' ? 'overviewTab' : 'assignments')}</Button>)}</nav>
    {tab === 'preview' && <JobPreview job={job} />}
    {tab === 'assignments' && <JobAssignments companyId={companyId} jobId={jobId} />}
    {can(companyId, 'job.create') && <RecruitmentAssistant companyId={companyId} jobId={jobId} />}
  </div>;
}

export function JobEditPage() {
  const { companyId, jobId } = useParams<{ companyId: string; jobId: string }>();
  return <RequireCompanyPermission companyId={companyId} permission="job.update"><RecruiterJobEdit companyId={companyId} jobId={jobId} /></RequireCompanyPermission>;
}

function RecruiterJobEdit({ companyId, jobId }: { companyId: string; jobId: string }) {
  const t = useCompanyText();
  const query = useQuery({ queryKey: ['company-job-edit', companyId, jobId], queryFn: async () => { const result = await jobsApi.managed(jobId); if (result.companyId !== companyId) throw new Error('Company mismatch'); return result; } });
  if (query.isPending) return <WorkspaceLoading />;
  if (query.isError) return <WorkspaceError retry={() => void query.refetch()} />;
  const job = query.data;
  const detailHref = recruiterJobRoute(companyId, jobId);
  if (job.status === 'CLOSED') return <div className="mx-auto max-w-5xl space-y-6"><Link href={detailHref} className="inline-flex text-sm text-muted-foreground">← {t('backToOffer')}</Link><header className="rounded-2xl border border-border/70 bg-card/70 p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('editOffer')}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{job.title}</h1><p className="mt-3 text-sm text-muted-foreground">{t('closedEditHelp')}</p></header></div>;
  return <JobForm companyId={companyId} job={job} />;
}
export function JobPublicPreviewPage() {
  const { companyId, jobId } = useParams<{ companyId: string; jobId: string }>();
  return <RequireCompanyPermission companyId={companyId} permission="application.view"><RecruiterPublicPreview companyId={companyId} jobId={jobId} /></RequireCompanyPermission>;
}

function RecruiterPublicPreview({ companyId, jobId }: { companyId: string; jobId: string }) {
  const t = useCompanyText();
  const query = useQuery({ queryKey: ['company-job-preview', companyId, jobId], queryFn: () => jobsApi.managed(jobId) });
  if (query.isPending) return <WorkspaceLoading />;
  if (query.isError) return <WorkspaceError retry={() => void query.refetch()} />;
  const job = query.data;
  return <div className="mx-auto max-w-5xl space-y-6"><Link href={recruiterJobsRoute(companyId)} className="inline-flex text-sm text-muted-foreground">← {t('backToOffers')}</Link><header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-indigo-300/30 bg-indigo-50/20 p-5 dark:bg-indigo-950/20 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">{t('publicPreview')}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{job.title}</h1><p className="mt-2 text-sm text-muted-foreground">{t('publicPreviewHelp')}</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href={recruiterJobEditRoute(companyId, jobId)}>{t('editOffer')}</Link></Button><Button asChild size="sm"><Link href={recruiterJobApplicationsRoute(companyId, jobId)}><Users className="me-2 size-4" />{t('viewApplications')}</Link></Button></div></header><JobPreview job={job} /></div>;
}
export function JobPreview({ job }: { job: Job }) {
  const t = useCompanyText();
  return <article className="rounded-2xl border border-border/70 bg-background p-5 sm:p-8">
    <h2 className="text-lg font-semibold">{t('aboutRole')}</h2>
    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{job.description}</p>
    {job.responsibilities.length > 0 && <section className="mt-8"><h3 className="mb-3 font-semibold">{t('responsibilities')}</h3><ul className="list-disc space-y-2 ps-5 text-sm text-muted-foreground">{job.responsibilities.map((value, i) => <li key={i}>{value}</li>)}</ul></section>}
    {job.requirements.length > 0 && <section className="mt-8"><h3 className="mb-3 font-semibold">{t('requirements')}</h3><ul className="list-disc space-y-2 ps-5 text-sm text-muted-foreground">{job.requirements.map((value, i) => <li key={i}>{value}</li>)}</ul></section>}
    {job.skills && job.skills.length > 0 && <section className="mt-8"><h3 className="mb-3 font-semibold">{t('skills')}</h3><div className="flex flex-wrap gap-2">{job.skills.map(s => <span key={s.skill.id} className="rounded-full border border-border/70 px-3 py-1 text-xs">{s.skill.name}{s.required ? ' *' : ''}</span>)}</div></section>}
    <section className="mt-8 border-t border-border/70 pt-6"><h3 className="mb-4 font-semibold">{t('conditions')}</h3><div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2"><span className="inline-flex items-center gap-2"><MapPin className="size-4" aria-hidden="true" />{job.location || '—'}</span><span className="inline-flex items-center gap-2"><Laptop className="size-4" aria-hidden="true" />{t(workModeKey(job.workMode, job.remote))}</span><span className="inline-flex items-center gap-2"><Briefcase className="size-4" aria-hidden="true" />{employmentTypeKey(job.employmentType) ? t(employmentTypeKey(job.employmentType)!) : '—'}</span><span className="inline-flex items-center gap-2"><Wallet className="size-4" aria-hidden="true" />{formatJobSalary(job.salaryVisible === false ? null : job.salaryMin, job.salaryVisible === false ? null : job.salaryMax, job.currency ?? 'TND')}</span>{job.expiresAt && <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" />{t('deadline')}: {new Date(job.expiresAt).toLocaleDateString()}</span>}</div></section>
    {job.benefits && job.benefits.length > 0 && <section className="mt-8"><h3 className="mb-3 font-semibold">{t('benefitsTitle')}</h3><ul className="list-disc space-y-2 ps-5 text-sm text-muted-foreground">{job.benefits.map((value, i) => <li key={i}>{value}</li>)}</ul></section>}
    {job.interviewProcess && <section className="mt-8"><h3 className="mb-3 font-semibold">{t('interviewProcess')}</h3><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{job.interviewProcess}</p></section>}
  </article>;
}
function JobAssignments({ companyId, jobId }: { companyId: string; jobId: string }) {
  const t = useCompanyText(); const { can } = useRole(); const qc = useQueryClient();
  const base = `/companies/${companyId}/workspace/jobs/${jobId}/assignments`;
  const current = useQuery({ queryKey: ['company-job-assignments', companyId, jobId], queryFn: () => api.get<{ memberId: string; member: { role: string; user: { name: string } } }[]>(base) });
  const members = useQuery({ queryKey: ['company-members', companyId], queryFn: () => companiesApi.members(companyId), enabled: can(companyId, 'team.view') && can(companyId, 'job.update') });
  const save = useMutation({ mutationFn: (ids: string[]) => workspaceApi.assign(companyId, jobId, ids), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['company-job-assignments', companyId, jobId] }); toast.success(t('saved')); }, onError: () => toast.error(t('saveError')) });
  if (current.isPending) return <WorkspaceLoading />; if (current.isError) return <WorkspaceError retry={() => void current.refetch()} />;
  return <section className="rounded border bg-background p-5"><h2 className="mb-4 font-semibold">{t('assignments')}</h2>{current.data.map(m => <p key={m.memberId} className="mb-2 text-sm">{m.member.user.name} · {t(m.member.role === 'HR' ? 'HR_MANAGER' : m.member.role)}</p>)}{members.isError && <WorkspaceError retry={() => void members.refetch()} />}{members.data && <form key={current.data.map(x => x.memberId).join(',')} className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(new FormData(e.currentTarget).getAll('member').map(String)); }}><div className="grid gap-3 sm:grid-cols-2">{members.data.filter(m => m.status === 'ACTIVE').map(m => <label key={m.id} className="flex gap-2 text-sm"><input type="checkbox" name="member" value={m.id} defaultChecked={current.data.some(x => x.memberId === m.id)} />{m.name} · {t(m.role === 'HR' ? 'HR_MANAGER' : m.role)}</label>)}</div><Button disabled={save.isPending}>{t('save')}</Button></form>}</section>;
}

