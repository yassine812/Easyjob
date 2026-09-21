'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, FileUp, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { careerApi, type CareerJob } from '@/lib/api/career';
import { resumesApi } from '@/lib/api/resumes';
import { candidatesApi } from '@/lib/api/candidates';
import { useCareerText } from '@/lib/i18n/career';
import { useEntitlement } from '@/hooks/use-entitlement';

export const panelClass = 'rounded-2xl border border-border bg-card p-5 sm:p-6';
export const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm';
export function CareerFrame({ title, description, children, actions, showFindJob = true, wide = false }: { title: string; description?: string; children: ReactNode; actions?: ReactNode; showFindJob?: boolean; wide?: boolean }) {
  const t = useCareerText();
  return <div className={`mx-auto ${wide ? 'w-full min-w-0 space-y-4' : 'max-w-7xl space-y-7'}`}><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300"><Sparkles className="size-4" />EasyJob · Career</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div><div className="flex flex-wrap gap-2">{actions}{showFindJob && <Button asChild><Link href="/candidate/jobs">{t('find')}<ArrowUpRight className="ms-2 size-4" /></Link></Button>}</div></header>{children}</div>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">{label}{children}</label>; }
export function Busy() { const t = useCareerText(); return <div role="status" className="flex min-h-28 items-center justify-center"><Loader2 className="size-6 animate-spin" aria-label={t('PROCESSING')} /></div>; }
export function Failure({ retry }: { retry?: () => void }) { const t = useCareerText(); return <div role="alert" className={panelClass}><p>{t('error')}</p>{retry && <Button onClick={retry} variant="outline" className="mt-3">{t('retry')}</Button>}</div>; }
export function FeatureGate({ feature, children, advanced = false }: { feature: string; children: ReactNode; advanced?: boolean }) {
  const ent = useEntitlement('CANDIDATE'), t = useCareerText();
  if (ent.loading) return <Busy />;
  if (ent.feature(feature) !== true) return <div className={`${panelClass} border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/20`}><Sparkles className="mb-3 size-6 text-indigo-600" /><h2 className="font-semibold">{t(advanced ? 'requiresCareer' : 'requiresPro')}</h2><p className="my-3 text-sm text-muted-foreground">{t(advanced ? 'careerFeatures' : 'proFeatures')}</p><Button asChild><Link href="/candidate/subscription">{t('upgrade')}</Link></Button></div>;
  return <>{children}</>;
}
export function JobCard({ job }: { job: CareerJob }) {
  const t = useCareerText(), qc = useQueryClient();
  const save = useMutation({ mutationFn: () => job.isSaved ? candidatesApi.removeSavedJob(job.id) : candidatesApi.saveJob({ jobId: job.id }), onSuccess: () => { toast.success(t('success')); qc.invalidateQueries({ queryKey: ['saved-jobs'] }); qc.invalidateQueries({ queryKey: ['career-jobs'] }); qc.invalidateQueries({ queryKey: ['career-overview'] }); }, onError: () => toast.error(t('error')) });
  return <article className={`${panelClass} flex flex-col gap-4 transition-shadow hover:shadow-md`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-sm text-muted-foreground">{job.company.commercialName}</p><h2 className="text-lg font-semibold"><Link href={`/jobs/${job.id}`}>{job.title}</Link></h2></div><span className="shrink-0 rounded-xl bg-indigo-50 px-3 py-2 text-center text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{job.match.score === null ? '—' : `${job.match.score}%`}<span className="mt-1 block text-[10px] font-normal">{t(job.match.classification)}</span></span></div>
    {job.publishedAt && <time dateTime={job.publishedAt} className="text-xs text-muted-foreground">{new Date(job.publishedAt).toLocaleDateString()}</time>}<p className="line-clamp-2 text-sm text-muted-foreground">{job.description}</p><p className="text-sm text-muted-foreground">{[job.location, t(job.workMode || (job.remote ? 'REMOTE' : 'ONSITE')), t(job.employmentType), job.contractType ? t(job.contractType) : '', t(job.experienceLevel)].filter(Boolean).join(' · ')}</p>
    {(job.salaryMin !== null || job.salaryMax !== null) && <p className="text-sm font-medium">{job.salaryMin?.toLocaleString() ?? '—'} – {job.salaryMax?.toLocaleString() ?? '—'} {job.currency}</p>}
    <div className="flex flex-wrap gap-2">{job.skills.slice(0, 6).map(s => <span key={s.skill.name} className="rounded-md bg-muted px-2 py-1 text-xs">{s.skill.name}</span>)}</div>
    {job.match.matchedSkills && <details className="text-sm"><summary className="cursor-pointer font-medium text-indigo-600 dark:text-indigo-300">{t('why')}</summary><div className="mt-3 space-y-2 text-muted-foreground"><p>{t('matched')}: {job.match.matchedSkills.join(', ') || '—'}</p><p>{t('missing')}: {job.match.missingSkills?.join(', ') || '—'}</p>{!!job.match.unverifiedRequirements?.length && <p>{t('unverified')}: {job.match.unverifiedRequirements.join(' · ')}</p>}<dl className="space-y-1 border-t pt-2">{job.match.dimensions?.map(d => <div className="flex flex-wrap justify-between gap-2" key={d.key}><dt>{t(d.key)}</dt><dd>{d.score === null ? '—' : `${d.score}%`}{d.evidence.length > 0 && <span className="ms-2 text-xs">{d.evidence.map(v => t(v)).join(', ')}</span>}</dd></div>)}</dl><p className="text-xs">{t('estimated')}</p></div></details>}
    <div className="mt-auto flex flex-wrap gap-2 pt-2"><Button asChild className="flex-1"><Link href={`/jobs/${job.id}`}>{t('view')}</Link></Button><Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>{t(job.isSaved ? 'removeSaved' : 'saveJob')}</Button></div>
  </article>;
}
export { AtsPanel } from './ats-report';

export function CvUpload({ onUploaded }: { onUploaded?: (id: string) => void }) {
  const t = useCareerText(), qc = useQueryClient(); const [file, setFile] = useState<File | null>(null);
  const upload = useMutation({ mutationFn: () => { if (!file) throw new Error('No file'); return resumesApi.upload(file); }, onSuccess: r => { onUploaded?.(r.id); qc.invalidateQueries({ queryKey: ['resumes'] }); qc.invalidateQueries({ queryKey: ['career-overview'] }); toast.success(t('processing')); }, onError: () => toast.error(t('error')) });
  const progress = useQuery({ queryKey: ['cv-prefill-progress', upload.data?.id], enabled: !!upload.data?.id,
    queryFn: () => careerApi.report(upload.data!.id), refetchInterval: q => !q.state.data || ['PENDING', 'PROCESSING'].includes(q.state.data.status) ? 2000 : false });
  useEffect(() => {
    if (progress.data?.status === 'COMPLETED') for (const key of ['candidate-profile', 'career-profile-details', 'career-overview', 'resumes']) void qc.invalidateQueries({ queryKey: [key] });
  }, [progress.data?.status, qc]);
  return <form onSubmit={e => { e.preventDefault(); upload.mutate(); }} className={`${panelClass} space-y-4 border-dashed`}><div className="flex items-center gap-3"><FileUp className="size-6 text-indigo-500" /><div><h2 className="font-semibold">{t('uploadNew')} <span className="text-xs text-indigo-600">{t('FREE')}</span></h2><p className="text-xs text-muted-foreground">{t('uploadHelp')}</p></div></div><Input type="file" aria-label={t('uploadNew')} accept=".pdf,.docx,.txt,.md" onChange={e => setFile(e.target.files?.[0] || null)} /><Button type="submit" disabled={!file || upload.isPending}>{upload.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Check className="me-2 size-4" />}{t('upload')}</Button></form>;
}

