'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { EasyJobLoading } from '@/components/ui/easyjob-loader';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { careerApi, type ApplicationField, type CandidateApplicationSnapshot, type CareerJob, type ProfileDetails } from '@/lib/api/career';
import { applicationsApi } from '@/lib/api/applications';
import { resumesApi } from '@/lib/api/resumes';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlement } from '@/hooks/use-entitlement';
import { QualityPanel } from './recruitment-evidence';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { useCareerText } from '@/lib/i18n/career';
import { ApiError } from '@/lib/api/client';
import type { Resume } from '@/types/api';

type CandidateDraft = {
  fullName: string; email: string; phone: string; location: string; professionalTitle: string;
  experience: string; education: string; skills: string; languages: string; certifications: string;
  portfolio: string; linkedIn: string; github: string;
};
const NO_RESUMES: Resume[] = [];

const lines = (values?: string[]) => (values || []).join('\n');
const splitValues = (value: string) => [...new Set(value.split(/[\n,،;]/).map(item => item.trim()).filter(Boolean))];
const extractUrl = (source: string, pattern: RegExp) => source.match(pattern)?.[0] || '';

function seedCandidate(user: { name?: string; email?: string; phone?: string | null } | null, profile?: ProfileDetails): CandidateDraft {
  const source = Object.values(profile?.sections || {}).flat().join('\n');
  const experience = profile?.experiences?.map(item => [item.title, item.company, item.period, item.description?.join('; ')].filter(Boolean).join(' · ')).join('\n') || lines(profile?.sections?.experience);
  const education = profile?.educations?.map(item => [item.degree, item.field, item.institution, item.period].filter(Boolean).join(' · ')).join('\n') || lines(profile?.sections?.education);
  const github = profile?.projects?.find(project => project.githubUrl)?.githubUrl || extractUrl(source, /https?:\/\/(?:www\.)?github\.com\/[^\s)]+/i);
  const linkedIn = extractUrl(source, /https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
  const urls = [...source.matchAll(/https?:\/\/[^\s)]+/gi)].map(match => match[0]);
  const portfolio = urls.find(url => url !== github && url !== linkedIn) || '';
  return {
    fullName: user?.name || '', email: user?.email || profile?.email || '', phone: profile?.phone || user?.phone || '',
    location: profile?.location || '', professionalTitle: profile?.headline || '', experience,
    education, skills: (profile?.skills?.length ? profile.skills : profile?.sections?.skills || []).join(', '),
    languages: profile?.languages?.map(item => [item.name, item.level].filter(Boolean).join(' · ')).join('\n') || lines(profile?.sections?.languages),
    certifications: profile?.certifications?.map(item => [item.name, item.issuer, item.period].filter(Boolean).join(' · ')).join('\n') || lines(profile?.sections?.certifications),
    portfolio, linkedIn, github,
  };
}

function asSnapshot(draft: CandidateDraft): CandidateApplicationSnapshot {
  return {
    fullName: draft.fullName.trim(), email: draft.email.trim(), phone: draft.phone.trim() || undefined,
    location: draft.location.trim() || undefined, professionalTitle: draft.professionalTitle.trim() || undefined,
    experience: draft.experience.trim() || undefined, education: draft.education.trim() || undefined,
    skills: splitValues(draft.skills), languages: splitValues(draft.languages), certifications: splitValues(draft.certifications),
    portfolio: draft.portfolio.trim() || undefined, linkedIn: draft.linkedIn.trim() || undefined, github: draft.github.trim() || undefined,
  };
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{label}{children}</label>;
}

const normalizeFieldId = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const standardFieldDefinitions = [
  { key: 'fullName', labelKey: 'fullName', aliases: ['full_name', 'fullname', 'name'], inputType: 'text', always: true },
  { key: 'email', labelKey: 'email', aliases: ['email', 'email_address'], inputType: 'email', always: true },
  { key: 'phone', labelKey: 'phone', aliases: ['phone', 'telephone'], inputType: 'tel', always: false },
  { key: 'location', labelKey: 'location', aliases: ['location', 'city', 'address'], inputType: 'text', always: false },
  { key: 'professionalTitle', labelKey: 'headline', aliases: ['professional_title', 'professional_title', 'headline'], inputType: 'text', always: false },
  { key: 'portfolio', labelKey: 'portfolio', aliases: ['portfolio'], inputType: 'url', always: false },
  { key: 'linkedIn', labelKey: 'linkedIn', aliases: ['linkedin', 'linked_in'], inputType: 'url', always: false },
  { key: 'github', labelKey: 'github', aliases: ['github'], inputType: 'url', always: false },
] as const;
const standardFieldKeys = new Set<string>(standardFieldDefinitions.flatMap(field => field.aliases));
const coverLetterFieldKeys = new Set<string>(['cover_letter', 'coverletter', 'motivation', 'motivation_letter']);
const standardDefinitionFor = (field: ApplicationField) => standardFieldDefinitions.find(definition => definition.aliases.some(alias => alias === normalizeFieldId(field.id)));
const candidateValueFor = (candidate: CandidateDraft, key: string) => String(candidate[key as keyof CandidateDraft] || '');

export function ApplyDialog({
  jobId, jobTitle, alreadyApplied, job, external = job?.isExternal ?? false, autoOpen = false, initialResumeId,
}: {
  jobId: string; jobTitle: string; alreadyApplied?: boolean; job?: CareerJob; external?: boolean; autoOpen?: boolean; initialResumeId?: string;
}) {
  const [open, setOpen] = useState(autoOpen), [step, setStep] = useState(0), [draft, setDraft] = useState<CandidateDraft | null>(null);
  const [resumeId, setResumeId] = useState(initialResumeId || ''), [coverLetter, setCoverLetter] = useState(''), [prepared, setPrepared] = useState(false);
  const [consent, setConsent] = useState(false);
  const [letterLength, setLetterLength] = useState('standard');
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const jobDetails = useQuery({ queryKey: ['career-job', jobId], queryFn: () => careerApi.job(jobId), enabled: open && !job });
  const requirementsQuery = useQuery({ queryKey: ['application-requirements', jobId], queryFn: () => careerApi.applicationRequirements(jobId), enabled: open && !job, retry: false });
  const fields = (job?.applicationFields ?? jobDetails.data?.applicationFields ?? (requirementsQuery.data ? [...requirementsQuery.data.fields, ...requirementsQuery.data.questions] : [])) as ApplicationField[];
  const router = useRouter(), queryClient = useQueryClient(), t = useCareerText(), rt = useRecruitmentText();
  const { user } = useAuth();
  const entitlement = useEntitlement('CANDIDATE');
  const { locale } = useI18n();
  const profileQuery = useQuery({ queryKey: ['career-profile-details'], queryFn: careerApi.profile, enabled: open });
  const resumesQuery = useQuery({ queryKey: ['resumes'], queryFn: resumesApi.list, enabled: open, refetchInterval: query => query.state.data?.some(resume => ['PENDING', 'PROCESSING'].includes(resume.processingStatus)) ? 2500 : false });
  const upload = useMutation({ mutationFn: resumesApi.upload, onSuccess: async resume => { setResumeId(resume.id); setCoverLetter(''); await queryClient.invalidateQueries({ queryKey: ['resumes'] }); }, onError: () => toast.error(rt('uploadFailed')) });
  const profile = profileQuery.data;
  const resumes = resumesQuery.data ?? NO_RESUMES;
  const candidate = draft ?? (!profileQuery.isPending ? seedCandidate(user, profile) : null);
  const selectedResume = resumes.find(resume => resume.id === resumeId) || resumes.find(resume => resume.isPrimary) || resumes[0];
  const selectedResumeId = resumeId || selectedResume?.id || '';
  const informationFields = standardFieldDefinitions.filter(definition => definition.always || fields.some(field => standardDefinitionFor(field)?.key === definition.key)).map(definition => {
    const schema = fields.find(field => standardDefinitionFor(field)?.key === definition.key);
    return { ...definition, label: schema?.label || t(definition.labelKey), schema };
  });
  const questionFields = fields.filter(field => !standardFieldKeys.has(normalizeFieldId(field.id)) && !coverLetterFieldKeys.has(normalizeFieldId(field.id)));
  const coverLetterRequired = requirementsQuery.data?.coverLetterRequired ?? fields.some(field => coverLetterFieldKeys.has(normalizeFieldId(field.id)) && field.required);
  const steps = [
    { id: 'information', label: t('candidateInformation') },
    { id: 'cv', label: t('selectCv') },
    ...(questionFields.length ? [{ id: 'questions', label: t('additionalQuestions') }] : []),
    { id: 'coverLetter', label: `${t('coverLetter')}${coverLetterRequired ? ' *' : ' (facultative)'}` },
    { id: 'review', label: t('review') },
  ];
  const currentStep = steps[Math.min(step, steps.length - 1)];
  const currentStepId = currentStep?.id || 'information';
  const currentStepIndex = Math.min(step, steps.length - 1);
  const applicationData = () => {
    if (!candidate) throw new Error('Candidate profile is still loading');
    const standardAnswers = Object.fromEntries(fields.filter(field => standardDefinitionFor(field)).map(field => [field.id, candidateValueFor(candidate, standardDefinitionFor(field)!.key)]));
    return { resumeId: selectedResumeId || undefined, motivation: coverLetter || undefined, coverLetter: coverLetter || undefined, candidateSnapshot: asSnapshot(candidate), answers: { ...standardAnswers, ...answers }, consent };
  };
  const submit = useMutation({
    mutationFn: () => applicationsApi.apply(jobId, applicationData()),
    onSuccess: () => {
      toast.success(t('applicationSubmitted'));
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      void queryClient.invalidateQueries({ queryKey: ['career-overview'] });
      router.push('/candidate/applications');
    },
    onError: err => {
      if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'fieldErrors' in err.body) { setFieldErrors(err.body.fieldErrors as Record<string, string>); setStep(Math.max(0, steps.findIndex(item => item.id === 'questions'))); }
      toast.error(err instanceof ApiError ? err.message : t('error'));
      if (err instanceof ApiError && err.status === 403) router.push('/verify-email');
    },
  });
  const quality = useQuery({ queryKey: ['application-quality', jobId, selectedResumeId, coverLetter, candidate, answers], queryFn: () => careerApi.qualityCheck(jobId, applicationData()), enabled: open && currentStepId === 'review' && !!candidate && !!selectedResumeId, retry: false });
  const prepare = useMutation({
    mutationFn: () => careerApi.prepareExternalApplication(jobId, applicationData()),
    onSuccess: () => { setPrepared(true); void queryClient.invalidateQueries({ queryKey: ['external-applications'] }); void queryClient.invalidateQueries({ queryKey: ['my-applications'] }); },
    onError: err => toast.error(err instanceof ApiError ? err.message : t('error')),
  });
  const generate = useMutation({
    mutationFn: () => external ? careerApi.generateExternalCoverLetter(jobId, selectedResumeId || undefined, locale, letterLength) : careerApi.generateJobCoverLetter(jobId, selectedResumeId || undefined, locale, letterLength),
    onSuccess: result => setCoverLetter(result.coverLetter),
    onError: err => toast.error(err instanceof ApiError ? err.message : t('coverLetterGenerationError')),
  });

  const update = (key: keyof CandidateDraft, value: string) => setDraft(current => current ? { ...current, [key]: value } : candidate ? { ...candidate, [key]: value } : null);
  const canContinue = !upload.isPending && (currentStepId !== 'information' || (!!candidate?.fullName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email.trim())));
  const next = () => {
    if (!canContinue) { toast.error(t('requiredCandidateInfo')); return; }
    if (currentStepId === 'cv' && !selectedResumeId) { toast.error(t('selectCvRequired')); return; }
    if (currentStepId === 'questions') {
      const errors: Record<string, string> = {};
      for (const field of questionFields) { const value = answers[field.id]; if (field.required && (value == null || value === '' || (Array.isArray(value) && !value.length))) errors[field.id] = t('required'); }
      setFieldErrors(errors);
      if (Object.keys(errors).length) return;
    }
    setStep(value => Math.min(steps.length - 1, value + 1));
  };
  const openEmployer = async () => {
    const blank = window.open('about:blank', '_blank');
    if (blank) blank.opener = null;
    try {
      const result = await careerApi.openExternalApplication(jobId);
      if (blank) blank.location.href = result.applicationUrl;
      else window.location.assign(result.applicationUrl);
      toast.success(t('externalSiteOpened'));
      setOpen(false);
    } catch (err) {
      blank?.close();
      toast.error(err instanceof ApiError ? err.message : t('error'));
    }
  };

  if (alreadyApplied) return <Button disabled>{t('APPLIED')}</Button>;
  const input = (key: keyof CandidateDraft, label: string, type = 'text', required = false) => <Field label={<>{label}{required && <span className="ms-1 text-destructive">*</span>}</>}><Input type={type} required={required} value={candidate?.[key] || ''} onChange={event => update(key, event.target.value)} /></Field>;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="lg" className="inline-flex h-12 min-h-12 flex-1 items-center justify-center gap-2 leading-none sm:flex-none"><EasyJobFeatureMark size="sm" className=" shrink-0 transition-transform duration-200 group-hover/button:rotate-6 motion-reduce:transition-none motion-reduce:transform-none" />{external ? t('prepareApplication') : t('apply')}</Button></DialogTrigger>
    <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl min-w-0 max-h-[90dvh] overflow-x-hidden overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:p-6">
      <DialogHeader>
        <DialogTitle className="min-w-0 break-words pe-6">{external ? t('prepareApplication') : t('apply')} · {jobTitle}</DialogTitle>
        <DialogDescription>{external ? t('externalApplicationDisclosure') : t('applicationPrefillHelp')}</DialogDescription>
      </DialogHeader>
      {profileQuery.isError && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm">{t('profilePrefillUnavailable')}</p>}
      {!prepared ? <>
        <div className="min-w-0" aria-label={`${t('step')} ${currentStepIndex + 1} ${t('of')} ${steps.length}`}>
          <ol className="flex w-full items-start text-xs text-muted-foreground">
            {steps.map((item, index) => <li key={item.id} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span aria-hidden="true" className={`h-px flex-1 ${index === 0 ? 'bg-transparent' : currentStepIndex >= index ? 'bg-primary/60' : 'bg-border'}`} />
                <span aria-current={currentStepIndex === index ? 'step' : undefined} className={`grid size-7 shrink-0 place-items-center rounded-full border font-semibold ${currentStepIndex === index ? 'border-primary bg-primary text-primary-foreground' : currentStepIndex > index ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-muted'}`}>{index + 1}</span>
                <span aria-hidden="true" className={`h-px flex-1 ${index === steps.length - 1 ? 'bg-transparent' : currentStepIndex > index ? 'bg-primary/60' : 'bg-border'}`} />
              </div>
              <span className={`mt-1 hidden max-w-full truncate whitespace-nowrap text-center font-medium sm:block ${currentStepIndex === index ? 'text-foreground' : ''}`}>{item.label}</span>
            </li>)}
          </ol>
          <p className="mt-2 text-center text-xs font-medium text-foreground sm:hidden">{currentStep?.label}</p>
        </div>
        {currentStepId === 'information' && !candidate ? <div role="status" className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{t('loadingProfile')}</div> : currentStepId === 'information' && candidate && <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {informationFields.map(field => <div key={field.key}>{input(field.key, field.label, field.inputType, field.schema?.required || field.key === 'fullName' || field.key === 'email')}</div>)}
        </div>}
        {currentStepId === 'cv' && <section className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('chooseCvForApplication')}</p>
          <label className="grid gap-2 rounded-xl border border-dashed p-4 text-sm font-medium">{upload.isPending ? rt('uploadingCv') : rt('attachCv')}<Input type="file" accept=".pdf" disabled={upload.isPending} aria-label={rt('attachCv')} onChange={event => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ''; }} /><span className="text-xs font-normal text-muted-foreground">PDF. {rt('cvSnapshotHelp')}</span></label>
          {resumesQuery.isPending ? <EasyJobLoading label={t('loading')} /> : resumesQuery.isError ? <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">{t('cvListUnavailable')} <Button type="button" variant="link" onClick={() => void resumesQuery.refetch()}>{t('retry')}</Button></div> : resumes.length ? <>
            <div className="grid gap-2">{resumes.map((resume: Resume) => <label key={resume.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${selectedResumeId === resume.id ? 'border-primary bg-primary/5' : 'border-border'}`}><input type="radio" name={`resume-${jobId}`} checked={selectedResumeId === resume.id} onChange={() => { setResumeId(resume.id); setCoverLetter(''); }} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{resume.filename}{resume.isPrimary ? ` · ${t('primaryCv')}` : ''}</span><span className="text-xs text-muted-foreground">{resume.filename.split('.').pop()?.toUpperCase() || 'CV'} · {t(resume.processingStatus)} · {new Date(resume.createdAt).toLocaleDateString()}</span></span>{selectedResumeId === resume.id && <Check className="size-4 text-primary" />}</label>)}</div>
          </> : <div className="rounded-xl border border-dashed p-5 text-sm">{t('uploadCvFirst')} <Button variant="link" asChild className="px-1"><Link href="/candidate/cvs" target="_blank" rel="noreferrer">{t('cvs')}</Link></Button></div>}
        </section>}
        {currentStepId === 'questions' && <section className="space-y-3">
          <h3 className="font-semibold">{t('additionalQuestions')}</h3>
          {questionFields.map(field => <Field key={field.id} label={`${field.label}${field.required ? ' *' : ''}`}>
            {field.type === 'textarea' ? <Textarea value={String(answers[field.id] || '')} onChange={e => setAnswers(a => ({ ...a, [field.id]: e.target.value }))} />
              : field.type === 'select' || field.type === 'boolean' || field.type === 'file' ? <select className="w-full min-w-0 max-w-full rounded-md border bg-background p-2" value={String(answers[field.id] ?? '')} onChange={e => setAnswers(a => ({ ...a, [field.id]: field.type === 'boolean' && e.target.value ? e.target.value === 'true' : e.target.value }))}>
                <option value="">—</option>{field.type === 'boolean' ? <><option value="true">Oui</option><option value="false">Non</option></> : field.type === 'file' ? resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.filename}</option>) : field.options?.map(option => <option key={option}>{option}</option>)}</select>
              : field.type === 'multiselect' ? <div className="flex flex-wrap gap-3">{field.options?.map(option => <label className="flex items-center gap-2" key={option}><input type="checkbox" checked={Array.isArray(answers[field.id]) && (answers[field.id] as string[]).includes(option)} onChange={e => setAnswers(a => ({ ...a, [field.id]: e.target.checked ? [...(Array.isArray(a[field.id]) ? a[field.id] as string[] : []), option] : (a[field.id] as string[] || []).filter(v => v !== option) }))} />{option}</label>)}</div>
              : <Input type={field.type === 'phone' ? 'tel' : field.type} value={String(answers[field.id] ?? '')} onChange={e => setAnswers(a => ({ ...a, [field.id]: field.type === 'number' && e.target.value ? Number(e.target.value) : e.target.value }))} />}
            {fieldErrors[field.id] && <span role="alert" className="text-xs text-destructive">{fieldErrors[field.id]}</span>}
          </Field>)}
        </section>}
        {currentStepId === 'coverLetter' && <section className="space-y-3">
          <label className="grid max-w-xs gap-2 text-sm">Format de la lettre<select className="rounded-lg border bg-background p-2" value={letterLength} onChange={e => setLetterLength(e.target.value)}><option value="short">Courte</option><option value="standard">Standard</option><option value="detailed">Détaillée</option></select></label>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-medium">{t('coverLetterFromCv')}</p><p className="mt-1 break-words text-sm text-muted-foreground">{selectedResume?.filename} · {jobTitle}</p></div>
          <Textarea rows={12} maxLength={12000} value={coverLetter} onChange={event => setCoverLetter(event.target.value)} placeholder={t('coverLetterPlaceholder')} />
          <div className="flex items-center justify-between gap-3">{entitlement.feature('ai.cover_letter') === true ? <Button type="button" onClick={() => generate.mutate()} disabled={generate.isPending || !selectedResumeId}><EasyJobFeatureMark size="sm" className="me-2 " />{generate.isPending ? t('generating') : t('generateWithAi')}</Button> : <Button variant="outline" asChild><Link href="/candidate/subscription">{t('generateWithAi')} · EasyJob Boost</Link></Button>}<span className="text-xs text-muted-foreground">{coverLetter.length}/12000</span></div>
          <p className="text-xs text-muted-foreground">{t('aiFactsOnlyNotice')}</p>
        </section>}
        {currentStepId === 'review' && candidate && <section className="space-y-4">
          {quality.isPending ? <p role="status">Vérification du dossier…</p> : quality.isError ? <div role="alert"><p>Le contrôle est indisponible. Réessaie avant l’envoi.</p><Button variant="outline" onClick={() => quality.refetch()}>Réessayer</Button></div> : <QualityPanel quality={quality.data} />}
          <p className="text-sm text-muted-foreground">{t('reviewBeforeSubmit')}</p>
          <div className="grid min-w-0 gap-3 rounded-xl border p-4 sm:grid-cols-2"><p className="min-w-0 break-words"><span className="text-muted-foreground">{t('fullName')}:</span> {candidate.fullName}</p><p className="min-w-0 break-words"><span className="text-muted-foreground">{t('email')}:</span> {candidate.email}</p><p className="min-w-0 break-words"><span className="text-muted-foreground">{t('phone')}:</span> {candidate.phone || '—'}</p><p className="min-w-0 break-words"><span className="text-muted-foreground">{t('location')}:</span> {candidate.location || '—'}</p><p className="min-w-0 break-words"><span className="text-muted-foreground">{t('headline')}:</span> {candidate.professionalTitle || '—'}</p><p className="min-w-0 break-words"><span className="text-muted-foreground">{t('selectCv')}:</span> {selectedResume?.filename || '—'}</p></div>
          <div className="rounded-xl border p-4"><p className="mb-2 text-sm font-semibold">{jobTitle}{job?.company?.commercialName ? ` · ${job.company.commercialName}` : ''}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{coverLetter || t('noCoverLetter')}</p></div>
          {!!questionFields.length && <div className="rounded-xl border p-4"><p className="mb-2 text-sm font-semibold">{t('additionalQuestions')}</p>{questionFields.map(field => <p className="text-sm" key={field.id}><strong>{field.label}:</strong> {Array.isArray(answers[field.id]) ? (answers[field.id] as string[]).join(', ') : String(answers[field.id] ?? '—')}</p>)}</div>}
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" /><span>J’ai vérifié mes informations et le CV sélectionné. J’autorise leur utilisation pour cette candidature et leur transmission à cet employeur lors de l’envoi. <Link href="/privacy" className="underline">Confidentialité</Link></span></label>
          {external && <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm">{t('externalApplicationDisclosure')}</p>}
        </section>}
        <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0 || generate.isPending}><ArrowLeft className="me-2 size-4" />{t('back')}</Button>
          {currentStepId !== 'review' ? <Button onClick={next} disabled={generate.isPending || profileQuery.isPending || resumesQuery.isPending || (currentStepId === 'cv' && (!selectedResumeId || resumesQuery.isError))}>{t('continue')}<ArrowRight className="ms-2 size-4" /></Button> : external ? <Button onClick={() => candidate && prepare.mutate()} disabled={!quality.data?.ready || quality.isFetching || !consent || prepare.isPending || !selectedResumeId || !candidate?.fullName.trim() || !candidate.email.trim()}>{prepare.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : null}{t('savePreparation')}</Button> : <Button onClick={() => candidate && submit.mutate()} disabled={!quality.data?.ready || quality.isFetching || (!job && !jobDetails.data) || !consent || submit.isPending || !selectedResumeId || !candidate?.fullName.trim() || !candidate.email.trim()}>{submit.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : null}{t('submitApplication')}</Button>}
        </div>
      </> : <section className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="flex items-start gap-3"><Check className="mt-0.5 size-5 text-emerald-600" /><div><h3 className="font-semibold">{t('readyToApplyExternally')}</h3><p className="mt-1 text-sm text-muted-foreground">{t('externalApplicationDisclosure')}</p></div></div>
        <Button onClick={openEmployer}><ExternalLink className="me-2 size-4" />{t('continueToEmployer')}</Button>
      </section>}
    </DialogContent>
  </Dialog>;
}
