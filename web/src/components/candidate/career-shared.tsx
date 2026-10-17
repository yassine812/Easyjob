'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { EasyJobLoading } from '@/components/ui/easyjob-loader';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalApplyButton } from './external-apply-button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BadgeCheck, Bookmark, BookmarkCheck, Building2, Check, Clock3, Crown, FileUp, Loader2, Lock, MapPin } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/client';
import { careerApi, type CareerJob } from '@/lib/api/career';
import { resumesApi } from '@/lib/api/resumes';
import { candidatesApi } from '@/lib/api/candidates';
import { useCareerText } from '@/lib/i18n/career';
import { useEntitlement } from '@/hooks/use-entitlement';
import { ApplyDialog } from '@/components/candidate/apply-dialog';

export const panelClass = 'rounded-2xl border border-border bg-card p-5 sm:p-6';
export const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm';
export function CareerFrame({ title, description, children, actions, showFindJob = true, wide = false }: { title: string; description?: string; children: ReactNode; actions?: ReactNode; showFindJob?: boolean; wide?: boolean }) {
  const t = useCareerText();
  return <div className={`mx-auto ${wide ? 'w-full min-w-0 space-y-4' : 'max-w-7xl space-y-7'}`}><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300"><EasyJobFeatureMark size="sm" className="" />EasyJob · Career</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div><div className="flex flex-wrap gap-2">{actions}{showFindJob && <Button asChild><Link href="/candidate/jobs">{t('find')}<ArrowUpRight className="ms-2 size-4" /></Link></Button>}</div></header>{children}</div>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">{label}{children}</label>; }
export function Busy() { const t = useCareerText(); return <EasyJobLoading label={t('PROCESSING')} />; }
export function Failure({ retry, message }: { retry?: () => void; message?: string }) { const t = useCareerText(); return <div role="alert" className={panelClass}><p>{message || t('error')}</p>{retry && <Button onClick={retry} variant="outline" className="mt-3">{t('retry')}</Button>}</div>; }
export function FeatureGate({ feature, children, advanced = false }: { feature: string; children: ReactNode; advanced?: boolean }) {
  const ent = useEntitlement('CANDIDATE'), t = useCareerText();
  if (ent.loading) return <Busy />;
  if (ent.feature(feature) !== true) {
    const maxFeature = ['career.auto_apply', 'auto_apply', 'coding_interview', 'adaptive_interview', 'career.vision'].includes(feature);
    const requiredPlan = maxFeature ? 'EasyJob Max' : 'EasyJob Boost';
    return <div className={`${panelClass} border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/20`}><EasyJobFeatureMark size="md" className="mb-3  text-indigo-600" /><h2 className="font-semibold">{t('featureAvailableWith').replace('{plan}', requiredPlan)}</h2><p className="my-3 text-sm text-muted-foreground">{t(maxFeature ? 'careerFeatures' : 'proFeatures')}</p><Button asChild><Link href="/candidate/subscription">{t('viewPlans')}</Link></Button></div>;
  }
  return <>{children}</>;
}
export function PremiumAiAction({ feature, href, title, description, className = '', onAllowed }: { feature: 'career.coach' | 'career.builder'; href: string; title: string; description: string; className?: string; onAllowed?: () => void }) {
  const ent = useEntitlement('CANDIDATE'), t = useCareerText();
  const content = <><Crown className="me-2 size-4 text-amber-500" aria-hidden="true" />{title}</>;
  if (ent.feature(feature) === true) return onAllowed ? <Button className={className} onClick={onAllowed}>{content}</Button> : <Button asChild className={className}><Link href={href}>{content}</Link></Button>;
  const modalTitle = t(feature === 'career.coach' ? 'featureBoostCoachTitle' : 'featureBoostCvTitle');
  return <Dialog><DialogTrigger asChild><Button className={className} variant="outline" disabled={ent.loading} aria-label={`${title} — fonctionnalité premium`}><Lock className="me-2 size-4" aria-hidden="true" />{content}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="size-5 text-amber-500" />{modalTitle}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" asChild><Link href="/candidate/subscription">{t('viewPlans')}</Link></Button><DialogClose asChild><Button variant="ghost">{t('later')}</Button></DialogClose></DialogFooter></DialogContent></Dialog>;
}
export function JobCard({ job, showMatchScore = true }: { job: CareerJob; showMatchScore?: boolean }) {
  const t = useCareerText(), qc = useQueryClient(), ent = useEntitlement('CANDIDATE');
  const save = useMutation({ mutationFn: () => job.isExternal ? job.isSaved ? careerApi.removeExternalSavedJob(job.id) : careerApi.saveExternalJob(job.id) : job.isSaved ? candidatesApi.removeSavedJob(job.id) : candidatesApi.saveJob({ jobId: job.id }), onSuccess: () => { toast.success(t('success')); qc.invalidateQueries({ queryKey: ['saved-jobs'] }); qc.invalidateQueries({ queryKey: ['saved-external-jobs'] }); qc.invalidateQueries({ queryKey: ['career-jobs'] }); qc.invalidateQueries({ queryKey: ['career-overview'] }); }, onError: () => toast.error(t('error')) });
  const company = job.company?.commercialName || t('companyNotListed');
  const hasCompanyName = Boolean(job.company?.commercialName?.trim());
  const description = job.description || '';
  const isDemoOffer = ent.feature('career.match') !== true && (company.trim().toLocaleLowerCase() === 'easyjob matching lab'
    || description.trim().toLocaleLowerCase().startsWith('offre de démonstration'));
  const logo = useQuery({ queryKey: ['company-logo', job.company?.id], queryFn: () => api.get<{ url: string }>(`/companies/${job.company!.id}/logo`, { auth: false }), enabled: !!job.company?.id && !!job.company?.logoKey && !job.isExternal, retry: false, staleTime: 10 * 60 * 1000, gcTime: 60 * 60 * 1000 });
  const logoUrl = job.company?.logoKey?.startsWith('http') ? job.company.logoKey : logo.data?.url;
  const [logoFailed, setLogoFailed] = useState(false);
  // External feeds often put a raw source taxonomy in `description`. Keep the
  // card copy useful without presenting that taxonomy as a personalized AI
  // explanation when the backend did not provide a match summary.
  const summary = job.match.summary || (job.isExternal ? t('sourceSummaryOnly') : description) || t('sourceSummaryOnly');
  const skills = job.skills ?? [];
  const details = [job.contractType ? t(job.contractType) : '', job.employmentType ? job.isExternal ? job.employmentType : t(job.employmentType) : '', job.experienceLevel ? t(job.experienceLevel) : '']
    .filter(value => Boolean(value) && value !== 'UNKNOWN' && value !== 'N/A');
  const location = job.location || (job.workMode ? t(job.workMode) : job.remote ? t('REMOTE') : '');
  const salaryLabel = job.salaryText || ((job.salaryMin != null || job.salaryMax != null) ? `${job.salaryMin?.toLocaleString('fr-TN') ?? '—'} – ${job.salaryMax?.toLocaleString('fr-TN') ?? '—'} ${job.currency || ''} ${job.salaryPeriod || ''}` : t('salaryUndisclosed'));
  return <article className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300/70 hover:shadow-xl sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className={`flex min-w-0 flex-1 gap-3 ${isDemoOffer ? 'blur-[6px] select-none' : ''}`}>
        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white text-indigo-600 dark:text-indigo-300">{logoUrl && !logoFailed ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoUrl} alt={`${company} ${t('companyLogo')}`} className="size-full object-contain p-1" onError={() => setLogoFailed(true)} /> : <span title={t('logoUnavailable')} aria-label={t('logoUnavailable')}><Building2 className="size-5" /></span>}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><span className="truncate">{company}</span>{!job.isExternal && hasCompanyName && <BadgeCheck className="size-4 shrink-0 text-indigo-500" aria-label={t('verifiedCompany')} />}</div>
          <h2 className="mt-1 text-lg font-semibold leading-tight"><Link className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300" href={`/candidate/jobs/${job.id}`}>{job.title}</Link></h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{location}</span>
            {job.publishedAt && <time dateTime={job.publishedAt} className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{new Date(job.publishedAt).toLocaleDateString()}</time>}
            {job.expiresAt && <time dateTime={job.expiresAt} className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{t('deadline')}: {new Date(job.expiresAt).toLocaleDateString()}</time>}
          </div>
        </div>
      </div>
      {showMatchScore && job.match.score !== null && <div className="shrink-0 rounded-xl bg-indigo-50 px-4 py-2 text-center text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-200">
        <p className="text-lg font-semibold leading-none">{job.match.score === null ? '—' : `${job.match.score}%`}{job.match.score !== null && <span className="ms-1 text-xs font-medium">{t('matchAi')}</span>}</p>
        <p className="mt-1 max-w-44 text-[10px] leading-tight">{job.match.score === null ? t('noReliableMatch') : t(job.match.classification)}</p>
      </div>}
      {!showMatchScore && job.match.score !== null && <div className="shrink-0 rounded-xl border border-border bg-muted/40 px-4 py-2 text-center text-muted-foreground">
        <p className="text-sm font-semibold leading-none">— <span className="text-xs font-medium">{t('matchAi')}</span></p>
        <p className="mt-1 max-w-44 text-[10px] leading-tight">{t('matchBelowThreshold')}</p>
      </div>}
    </div>
    <div className={isDemoOffer ? 'blur-[6px] select-none' : ''}>
      <div className="mt-4 flex gap-2 rounded-lg bg-muted/45 px-3 py-2.5 text-sm text-muted-foreground"><EasyJobFeatureMark size="sm" className="mt-0.5  shrink-0 text-indigo-500" /><p><span className="font-medium text-foreground">{t('easyJobAnalysis')}:</span> {summary.length > 190 ? `${summary.slice(0, 190).trim()}…` : summary}</p></div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {details.map((value, index) => <span key={`${value}-${index}`} className="rounded-md border bg-background px-2 py-1 font-medium">{value}</span>)}
        {salaryLabel && <span className="rounded-md border bg-background px-2 py-1 font-medium">{salaryLabel}</span>}
        {skills.slice(0, 6).map((s, index) => <span key={`${s.skill.name}-${index}`} className="rounded-md bg-muted px-2 py-1">{s.skill.name}</span>)}
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center"><Button asChild size="lg" variant="outline" className="inline-flex h-12 min-h-12 w-full items-center justify-center leading-none sm:w-auto"><Link href={`/candidate/jobs/${job.id}`}>{t('viewJob')}</Link></Button>{job.isExternal ? <><ExternalApplyButton jobId={job.id} className="h-12 min-h-12 w-full sm:w-auto" /><Button asChild size="lg" variant="outline" className="inline-flex h-12 min-h-12 w-full items-center justify-center leading-none sm:w-auto"><Link href={ent.feature('ai.cover_letter') === true ? `/candidate/jobs/${job.id}?apply=1` : '/candidate/subscription'}>{t('prepareApplication')} · EasyJob Boost</Link></Button></> : <ApplyDialog jobId={job.id} jobTitle={job.title} job={job} /> }<Button variant="outline" size="icon" className="h-12 min-h-12 w-full shrink-0 sm:w-12" aria-label={t(job.isSaved ? 'removeSaved' : 'saveJob')} onClick={() => save.mutate()} disabled={save.isPending}>{job.isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}</Button></div>
    </div>
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

