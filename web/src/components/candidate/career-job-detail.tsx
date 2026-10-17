'use client';

import Link from 'next/link';
import { useState } from 'react';
import { OpportunityWorkspace } from './recruitment-evidence';
import { ExternalApplyButton } from './external-apply-button';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, BriefcaseBusiness, CalendarDays, MapPin, Sparkles, Target, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { careerApi } from '@/lib/api/career';
import { candidatesApi } from '@/lib/api/candidates';
import { useCareerText } from '@/lib/i18n/career';
import { useEntitlement } from '@/hooks/use-entitlement';
import { ApplyDialog } from '@/components/candidate/apply-dialog';
import { Busy, CareerFrame, Failure, panelClass } from '@/components/candidate/career-shared';

export function CareerJobDetail({ autoOpen = false, initialResumeId }: { autoOpen?: boolean; initialResumeId?: string }) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tailoringDecisions, setTailoringDecisions] = useState<Record<string, 'accepted' | 'ignored'>>({});
  const t = useCareerText(), ent = useEntitlement('CANDIDATE'), queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['career-job', id], queryFn: () => careerApi.job(id), enabled: !!id });
  const job = query.data;
  const save = useMutation({
    mutationFn: () => job?.isExternal ? job.isSaved ? careerApi.removeExternalSavedJob(id) : careerApi.saveExternalJob(id) : job?.isSaved ? candidatesApi.removeSavedJob(id) : candidatesApi.saveJob({ jobId: id }),
    onSuccess: () => { toast.success(t('success')); void queryClient.invalidateQueries({ queryKey: ['career-job', id] }); void queryClient.invalidateQueries({ queryKey: ['saved-jobs'] }); void queryClient.invalidateQueries({ queryKey: ['saved-external-jobs'] }); void queryClient.invalidateQueries({ queryKey: ['career-jobs'] }); },
    onError: () => toast.error(t('error')),
  });
  const fit = useMutation({ mutationFn: () => careerApi.fit(id), onError: () => toast.error(t('error')) });
  const tailoring = useMutation({ mutationFn: () => careerApi.tailoring(id), onError: () => toast.error(t('error')) });
  const interviewPrep = useMutation({ mutationFn: () => careerApi.interviewPrep(id), onError: () => toast.error(t('error')) });
  if (query.isPending) return <CareerFrame title={t('viewJob')}><Busy /></CareerFrame>;
  if (query.error instanceof ApiError && query.error.status === 403) return <CareerFrame title={t('viewJob')}><section className={panelClass}><p>{t('requiresPro')}</p><Button asChild className="mt-3"><Link href="/candidate/subscription">{t('upgrade')}</Link></Button></section></CareerFrame>;
  if (query.error instanceof ApiError && query.error.status === 404) return <CareerFrame title={t('viewJob')}><p className={panelClass}>{t('jobUnavailable')}</p></CareerFrame>;
  if (query.isError || !job) return <CareerFrame title={t('viewJob')}><Failure retry={() => query.refetch()} /></CareerFrame>;
  const canNativeApply = job.applicationMethod === 'NATIVE_EASYJOB';
  const external = job.applicationMethod === 'EXTERNAL_APPLICATION';
  const canPrepareExternal = external && ent.feature('ai.cover_letter') === true;
  const employmentType = job.employmentType ? job.isExternal ? job.employmentType === 'UNKNOWN' ? null : job.employmentType : t(job.employmentType) : null;
  const workMode = job.workMode ? t(job.workMode) : job.isExternal ? null : t(job.remote ? 'REMOTE' : 'ONSITE');

  return <CareerFrame title={job.title} description={job.company?.commercialName || t('companyNotListed')} actions={<Button variant="outline" asChild><Link href="/candidate/jobs"><ArrowLeft className="me-2 size-4" />{t('backToJobs')}</Link></Button>}>
    <section className={`${panelClass} space-y-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{job.title}</h2><p className="mt-1 text-muted-foreground">{job.company?.commercialName || t('companyNotListed')}</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => save.mutate()} variant="outline" disabled={save.isPending}><Bookmark className="me-2 size-4" />{t(job.isSaved ? 'removeSaved' : 'saveJob')}</Button>{external && <ExternalApplyButton jobId={id} />}{external && !canPrepareExternal && <Button variant="outline" asChild><Link href="/candidate/subscription">{t('prepareApplication')} · EasyJob Boost</Link></Button>}{canNativeApply || canPrepareExternal ? <ApplyDialog jobId={id} jobTitle={job.title} job={job} external={canPrepareExternal} autoOpen={autoOpen} initialResumeId={initialResumeId} /> : !external && <Button disabled>{t('applicationMethodUnavailable')}</Button>}</div></div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {job.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{job.location}</span>}
        {employmentType && <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-4" />{employmentType}</span>}
        {workMode && <span>{workMode}</span>}
        {job.experienceLevel && job.experienceLevel !== 'UNKNOWN' && <span>{t(job.experienceLevel)}</span>}
        {job.publishedAt && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{t('posted')}: {new Date(job.publishedAt).toLocaleDateString()}</span>}
        {!job.publishedAt && job.sourceUpdatedAt && <span>{t('sourceUpdated')}: {new Date(job.sourceUpdatedAt).toLocaleDateString()}</span>}
        {job.expiresAt && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{t('deadline')}: {new Date(job.expiresAt).toLocaleDateString()}</span>}
        {(job.salaryMin != null || job.salaryMax != null || job.salaryText) && <span>{job.salaryText || `${job.salaryMin?.toLocaleString() ?? '—'} – ${job.salaryMax?.toLocaleString() ?? '—'} ${job.currency || ''}`}</span>}
      </div>
      <OpportunityWorkspace job={job} />
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Préparation EasyJob gratuite</h3><p className="mt-1 text-sm text-muted-foreground">Analyse locale basée uniquement sur votre CV et cette offre. Aucun changement n’est appliqué automatiquement.</p></div><Sparkles className="size-5 text-primary" /></div>
        <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => fit.mutate()} disabled={fit.isPending}><Target className="me-2 size-4" />{fit.isPending ? 'Analyse…' : 'Pourquoi cette offre peut vous correspondre'}</Button><Button size="sm" variant="outline" onClick={() => tailoring.mutate()} disabled={tailoring.isPending}><Sparkles className="me-2 size-4" />{tailoring.isPending ? 'Analyse…' : 'Adapter mon CV'}</Button><Button size="sm" variant="outline" onClick={() => interviewPrep.mutate()} disabled={interviewPrep.isPending}><ListChecks className="me-2 size-4" />{interviewPrep.isPending ? 'Préparation…' : 'Préparer l’entretien'}</Button></div>
        {fit.data && <div className="mt-4 space-y-2 text-sm"><p className="font-medium">{fit.data.alignment === 'STRONG_ALIGNMENT' ? 'Strong alignment' : fit.data.alignment === 'PARTIAL_ALIGNMENT' ? 'Partial alignment' : 'Needs review'}</p><p className="text-muted-foreground">Compétences correspondantes : {fit.data.matchingSkills.join(', ') || 'À vérifier'}</p>{fit.data.missingEvidence.length > 0 && <p className="text-muted-foreground">Preuves à vérifier : {fit.data.missingEvidence.join(', ')}</p>}</div>}
        {tailoring.data && <div className="mt-4 space-y-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Suggestions à confirmer ({tailoring.data.suggestions.length})</p><Button size="sm" variant="link" asChild><Link href="/candidate/cvs">Ouvrir l’éditeur CV</Link></Button></div><ul className="space-y-2">{tailoring.data.suggestions.slice(0, 8).map(item => { const key = `${item.type}-${item.label}`; const decision = tailoringDecisions[key]; return <li key={key} className="rounded-lg border bg-background p-3"><p>{item.action}</p><p className="mt-1 text-xs text-muted-foreground">Preuve : {item.evidence.join(' · ') || 'à vérifier'}</p><div className="mt-2 flex gap-2"><Button size="sm" variant={decision === 'accepted' ? 'default' : 'outline'} onClick={() => setTailoringDecisions(current => ({ ...current, [key]: 'accepted' }))}>Appliquer</Button><Button size="sm" variant={decision === 'ignored' ? 'secondary' : 'ghost'} onClick={() => setTailoringDecisions(current => ({ ...current, [key]: 'ignored' }))}>Ignorer</Button></div></li>; })}</ul><p className="text-xs text-muted-foreground">Les décisions sont une confirmation de votre part ; EasyJob n’invente et n’enregistre aucune expérience.</p></div>}
        {interviewPrep.data && <div className="mt-4 space-y-2 text-sm"><p className="font-medium">Thèmes à préparer</p><div className="flex flex-wrap gap-2">{interviewPrep.data.likelyThemes.slice(0, 6).map(item => <span key={item.label} className="rounded-full bg-background px-2.5 py-1 text-xs">{item.label}</span>)}</div><p className="text-muted-foreground">{interviewPrep.data.technicalQuestions[0] || interviewPrep.data.behavioralQuestions[0]}</p></div>}
      </section>
      <article className="space-y-5">
        <section><h3 className="mb-2 text-lg font-semibold">{t('jobDescription')}</h3><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{job.description || t('sourceSummaryOnly')}</p></section>
        {!!job.responsibilities?.length && <section><h3 className="mb-2 text-lg font-semibold">{t('responsibilities')}</h3><ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">{job.responsibilities.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
        {!!job.requirements?.length && <section><h3 className="mb-2 text-lg font-semibold">{t('requirements')}</h3><ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">{job.requirements.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
        {job.skills.length > 0 && <section><h3 className="mb-2 text-lg font-semibold">{t('skills')}</h3><div className="flex flex-wrap gap-2">{job.skills.map(({ skill, required }) => <span key={skill.name} className="rounded-full bg-muted px-3 py-1 text-sm">{skill.name}{required ? ` · ${t('required')}` : ''}</span>)}</div></section>}
        {job.minimumYearsExperience != null && <p className="text-sm"><strong>{t('yearsExperience')}:</strong> {job.minimumYearsExperience}</p>}
        {job.educationRequirement && <p className="text-sm"><strong>{t('education')}:</strong> {job.educationRequirement}</p>}
      </article>
      <dl className="grid gap-3 rounded-xl bg-muted/30 p-4 text-sm sm:grid-cols-2">
        {[[t('salary'), job.salaryText || (job.salaryMin != null || job.salaryMax != null ? `${job.salaryMin ?? '—'} – ${job.salaryMax ?? '—'} ${job.currency || ''} ${job.salaryPeriod || ''}` : 'Non communiqué')],
          [t('languages'), job.languages?.join(', ')], [t('education'), job.education?.join(', ')],
          ['Contrat', [job.contractType, job.contractDuration].filter(Boolean).join(' · ')],
          ['Postes ouverts', job.positions],
          ['Adresse', [job.address, job.city, job.region, job.country].filter(Boolean).join(', ')], ['Référence', job.reference]]
          .filter(([, value]) => value != null && value !== '').map(([label, value]) => <div key={String(label)}><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {[['Avantages', job.benefits], ['Compétences appréciées', job.niceToHave]].map(([label, values]) => Array.isArray(values) && values.length > 0 ? <section key={String(label)}><h3 className="font-semibold">{String(label)}</h3><ul className="list-disc ps-5 text-sm text-muted-foreground">{values.map((value, index) => <li key={index}>{value}</li>)}</ul></section> : null)}
      {job.sourceReferences?.map((source, index) => <section key={`${source.type}-${index}`} className="border-t pt-3"><p className="text-sm text-muted-foreground">{t('source')}: {source.name}</p>{source.url && <a className="text-sm text-primary underline" href={source.url} target="_blank" rel="noopener noreferrer">{t('viewOriginalListing')}</a>}</section>)}
      {external && <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-muted-foreground">{t('externalApplicationDisclosure')}</p>}
    </section>
  </CareerFrame>;
}
