'use client';
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
import { CompanyLogo } from './company-logo';
import { RecruitmentAssistant } from './recruitment-assistant';
import { WorkspaceError, WorkspaceLoading, CompanyOverview } from './workspace-overview';
import { formatSalary } from '@/lib/format';
import type { Job } from '@/types/api';

export function JobWorkspace() {
  const { companyId, jobId } = useParams<{ companyId: string; jobId: string }>(); const t = useCompanyText();
  const { can } = useRole(); const qc = useQueryClient(); const router = useRouter(); const [tab, setTab] = useState('preview'); const [deleting, setDeleting] = useState(false);
  const query = useQuery({ queryKey: ['company-job', companyId, jobId], queryFn: async () => { const result = await jobsApi.managed(jobId); if (result.companyId !== companyId) throw new Error('Company mismatch'); return result; } });
  const action = useMutation({ mutationFn: async (name: string) => {
    if (name === 'delete') { await jobsApi.remove(jobId, companyId); router.push(`/company/${companyId}/jobs`); }
    else if (name === 'duplicate') { const copy = await jobsApi.duplicate(jobId); router.push(`/company/${companyId}/jobs/${copy.id}`); }
    else if (name === 'publish') await jobsApi.publish(jobId, companyId);
    else if (name === 'pause') await jobsApi.pause(jobId);
    else if (name === 'close') await jobsApi.close(jobId, companyId);
    else if (name === 'submit') await jobsApi.submit(jobId, companyId);
  }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ['company-job', companyId] }); void qc.invalidateQueries({ queryKey: ['company-jobs', companyId] }); void qc.invalidateQueries({ queryKey: ['company-workspace', companyId] }); toast.success(t('saved')); }, onError: () => toast.error(t('saveError')) });
  if (query.isPending) return <WorkspaceLoading />;
  if (query.isError) return <WorkspaceError retry={() => void query.refetch()} />;
  const job = query.data;
  const controls = [
    ...(['DRAFT', 'REJECTED'].includes(job.status) && can(companyId, 'job.update') ? ['submit'] : []),
    ...(['APPROVED', 'PAUSED'].includes(job.status) && can(companyId, 'job.publish') ? ['publish'] : []),
    ...(job.status === 'PUBLISHED' && can(companyId, 'job.update') ? ['pause'] : []),
    ...(job.status !== 'CLOSED' && can(companyId, 'job.update') ? ['close'] : []),
    ...(can(companyId, 'job.create') ? ['duplicate'] : []),
  ];
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href={`/company/${companyId}/jobs`} className="text-sm text-muted-foreground">← {t('back')}</Link>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs text-primary">{t(job.status)}</p><h1 className="text-2xl font-semibold">{job.title}</h1><p className="mt-2 text-sm text-muted-foreground">{job.department} · {job.location}</p></div><Button asChild><Link href={`/company/${companyId}/jobs/${jobId}/applications`}>{t('viewApplications')}</Link></Button></header>
    {job.rejectionReason && <p className="rounded border border-destructive/30 p-3 text-sm">{job.rejectionReason}</p>}
    <div className="flex flex-wrap gap-2">{controls.map(name => <Button key={name} variant={name === 'publish' ? 'default' : 'outline'} disabled={action.isPending} onClick={() => action.mutate(name)}>{t(name)}</Button>)}{can(companyId, 'job.delete') && <Button variant="ghost" onClick={() => setDeleting(true)}>{t('delete')}</Button>}</div>
    {deleting && <section role="alertdialog" aria-label={t('deleteConfirm')} className="rounded border border-destructive/30 p-4"><h2>{t('deleteConfirm')}</h2><p className="my-3 text-sm text-muted-foreground">{t('deleteHelp')}</p><Button variant="destructive" disabled={action.isPending} onClick={() => action.mutate('delete')}>{t('confirm')}</Button><Button variant="ghost" onClick={() => setDeleting(false)}>{t('cancel')}</Button></section>}
    <nav className="flex flex-wrap gap-2">{['preview', ...(can(companyId, 'job.update') && ['DRAFT', 'REJECTED', 'PAUSED', 'APPROVED'].includes(job.status) ? ['edit'] : []), 'assignments', 'analytics'].map(key => <Button key={key} variant={tab === key ? 'secondary' : 'ghost'} onClick={() => setTab(key)}>{t(key)}</Button>)}</nav>
    {tab === 'preview' && <JobPreview job={job} />}
    {tab === 'edit' && <JobForm companyId={companyId} job={job} />}
    {tab === 'assignments' && <JobAssignments companyId={companyId} jobId={jobId} />}
    {tab === 'analytics' && <CompanyOverview analytics jobId={jobId} />}
    {can(companyId, 'job.create') && <RecruitmentAssistant companyId={companyId} jobId={jobId} />}
  </div>;
}

export function JobPreview({ job }: { job: Job }) {
  const t = useCompanyText();
  return <article className="rounded-xl border bg-background p-5 sm:p-8"><CompanyLogo companyId={job.companyId} /><p className="mt-4 text-sm text-muted-foreground">{job.company?.commercialName}</p><h2 className="my-3 text-3xl font-semibold">{job.title}</h2><div className="mb-6 flex flex-wrap gap-3 text-sm text-muted-foreground"><span>{job.location}</span><span>{t(job.workMode ?? (job.remote ? 'REMOTE' : 'ONSITE'))}</span><span>{t(job.employmentType)}</span><span>{t(job.experienceLevel)}</span><span>{formatSalary(job.salaryMin, job.salaryMax, job.currency ?? 'USD')}</span></div><p className="whitespace-pre-wrap text-sm leading-7">{job.description}</p>{[['responsibilities', job.responsibilities], ['requirements', job.requirements], ['benefitsTitle', job.benefits ?? []]].map(([title, values]) => Array.isArray(values) && values.length > 0 && <section key={String(title)} className="mt-7"><h3 className="mb-3 font-semibold">{t(String(title))}</h3><ul className="list-disc space-y-2 ps-5 text-sm text-muted-foreground">{values.map((value, i) => <li key={i}>{value}</li>)}</ul></section>)}<section className="mt-7"><h3 className="mb-3 font-semibold">{t('skills')}</h3><div className="flex flex-wrap gap-2">{job.skills?.map(s => <span key={s.skill.id} className="rounded border px-3 py-1 text-xs">{s.skill.name}{s.required ? ' *' : ''}</span>)}</div></section>{job.interviewProcess && <p className="mt-6 whitespace-pre-wrap text-sm">{t('interviewProcess')}: {job.interviewProcess}</p>}<div className="mt-8 border-t pt-5"><Button disabled>{t('apply')}</Button><p className="mt-2 text-xs text-muted-foreground">{t('previewHelp')}</p></div></article>;
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

