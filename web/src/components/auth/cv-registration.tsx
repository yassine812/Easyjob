'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { careerApi } from '@/lib/api/career';
import { candidatesApi } from '@/lib/api/candidates';
import { resumesApi } from '@/lib/api/resumes';
import { useCareerText } from '@/lib/i18n/career';
import { useReleaseText } from '@/lib/i18n/release';
import { AtsPanel, Busy, Failure, Field, JobCard, FeatureGate } from '@/components/candidate/career-shared';
import { ProfessionalDetails } from '@/components/candidate/career-pages';
import { ProfilePhoto } from '@/components/candidate/profile-photo';
import { useEntitlement } from '@/hooks/use-entitlement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUp } from 'lucide-react';
import { EasyJobCoach } from './easyjob-coach';
import { ProfilePreparation } from './profile-preparation';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
interface Props { candidateEmail: string; candidatePhone?: string; initialResumeId?: string; onFinishFace: () => void; onFinishDashboard: () => void }
const LOCATION_OPTIONS = [
  'Tunis — Tunisia', 'Ariana — Tunisia', 'Ben Arous — Tunisia', 'Manouba — Tunisia', 'Sfax — Tunisia', 'Sousse — Tunisia', 'Bizerte — Tunisia', 'Nabeul — Tunisia', 'Monastir — Tunisia', 'Gabès — Tunisia', 'Kairouan — Tunisia', 'Tozeur — Tunisia',
  'Paris — France', 'Lyon — France', 'Marseille — France', 'Nice — France', 'London — United Kingdom', 'Berlin — Germany', 'Madrid — Spain', 'Rome — Italy', 'Brussels — Belgium', 'Montreal — Canada', 'Toronto — Canada', 'New York — United States', 'Dubai — United Arab Emirates', 'Doha — Qatar', 'Riyadh — Saudi Arabia', 'Cairo — Egypt', 'Casablanca — Morocco', 'Algiers — Algeria',
];
function LocationAutocomplete({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (value: string) => void }) {
  const [focused, setFocused] = useState(false);
  const query = value.split(/[,،]/).pop()?.trim().toLocaleLowerCase() ?? '';
  const suggestions = query.length < 1 ? LOCATION_OPTIONS.slice(0, 8) : LOCATION_OPTIONS.filter(option => option.toLocaleLowerCase().includes(query)).slice(0, 8);
  return <div className="relative"><Input value={value} autoComplete="off" role="combobox" aria-expanded={focused && suggestions.length > 0} aria-controls="location-suggestions" onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 120)} onChange={event => onChange(event.target.value)} />{focused && suggestions.length > 0 && <div id="location-suggestions" role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl">{suggestions.map(option => <button key={option} type="button" role="option" className="block w-full rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-primary/10" onMouseDown={event => event.preventDefault()} onClick={() => { onSelect(option); setFocused(false); }}>{option}</button>)}</div>}</div>;
}
export function CandidateCvOnboarding({ candidateEmail, candidatePhone, initialResumeId, onFinishDashboard }: Props) {
  const t = useCareerText(), tr = useReleaseText(), qc = useQueryClient(), ent = useEntitlement('CANDIDATE');
  const progressKey = `easyjob:onboarding:${candidateEmail.trim().toLowerCase()}`;
  const [restored, setRestored] = useState(false);
  const detailsSave = useRef<(() => Promise<unknown>) | null>(null);
  const [step, setStep] = useState(0), [id, setId] = useState(initialResumeId ?? ''), [upgradeOpen, setUpgradeOpen] = useState(false), [photoReady, setPhotoReady] = useState(false);
  const [resumeStep, setResumeStep] = useState(!initialResumeId), [resumeMode, setResumeMode] = useState<'upload' | 'manual' | null>(null), [resumeFile, setResumeFile] = useState<File | null>(null), [resumeError, setResumeError] = useState<string | null>(null), [resumeUploading, setResumeUploading] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({}), [domains, setDomains] = useState(''), [locations, setLocations] = useState(''), [workModes, setWorkModes] = useState<string[]>([]);
  const [manualReview, setManualReview] = useState(false), [stalled, setStalled] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(progressKey);
      if (raw) {
        const saved = JSON.parse(raw) as { step?: number; id?: string; resumeStep?: boolean; fields?: Record<string, string>; domains?: string; locations?: string; workModes?: string[] };
        if (typeof saved.step === 'number') setStep(Math.max(0, Math.min(5, saved.step)));
        if (saved.id) setId(saved.id);
        if (typeof saved.resumeStep === 'boolean') setResumeStep(saved.resumeStep);
        if (saved.fields) setFields(saved.fields);
        if (typeof saved.domains === 'string') setDomains(saved.domains);
        if (typeof saved.locations === 'string') setLocations(saved.locations);
        if (Array.isArray(saved.workModes)) setWorkModes(saved.workModes);
      }
    } catch { /* Ignore malformed browser state and start cleanly. */ }
    setRestored(true);
  }, [progressKey]);
  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(progressKey, JSON.stringify({ step, id, resumeStep, fields, domains, locations, workModes, pending: step < 5 }));
  }, [domains, fields, id, locations, progressKey, restored, resumeStep, step, workModes]);
  const report = useQuery({ queryKey: ['career-onboarding', id], queryFn: () => careerApi.report(id), enabled: !!id && !manualReview,
    // Keep checking after a transient failure too: the worker can recover or a
    // retry can be queued while this page remains open.
    refetchInterval: q => !manualReview && q.state.data?.status !== 'COMPLETED' ? 2000 : false });
  const profile = useQuery({ queryKey: ['candidate-profile'], queryFn: () => candidatesApi.me(), enabled: step === 0 && !resumeStep });
  useEffect(() => {
    document.body.dataset.authOnboarding = 'true';
    window.dispatchEvent(new Event('easyjob:onboarding-toggle'));
    return () => {
      delete document.body.dataset.authOnboarding;
      window.dispatchEvent(new Event('easyjob:onboarding-toggle'));
    };
  }, []);
  useEffect(() => {
    if (step !== 0) return;
    const extracted = report.data?.extracted;
    const firstValue = (...values: (string | null | undefined)[]) => values.find(value => typeof value === 'string' && value.trim()) ?? '';
    setFields(current => ({
      headline: current.headline?.trim() ? current.headline : firstValue(profile.data?.headline, extracted?.headline),
      phone: current.phone?.trim() ? current.phone : firstValue(profile.data?.phone, extracted?.phone, candidatePhone),
      location: current.location?.trim() ? current.location : firstValue(profile.data?.location, extracted?.location),
    }));
  }, [candidatePhone, profile.data, report.data?.extracted, step]);
  useEffect(() => {
    if (report.data?.status === 'COMPLETED') {
      for (const key of ['candidate-profile', 'career-profile-details', 'career-overview']) void qc.invalidateQueries({ queryKey: [key] });
    }
  }, [report.data?.status, qc]);
  useEffect(() => { if (step === 5) setUpgradeOpen(true); }, [step]);
  const domainSuggestions = useMemo(() => {
    const extracted = report.data?.extracted;
    return [...new Set([
      extracted?.headline,
      ...(extracted?.experiences ?? []).map(entry => entry.title),
      ...(extracted?.sections?.skills ?? []).slice(0, 3),
    ].map(value => value?.trim()).filter((value): value is string => !!value))].slice(0, 4);
  }, [report.data?.extracted]);
  const addDomainSuggestion = (value: string) => setDomains(current => [...new Set([...current.split(/[,،]/).map(item => item.trim()).filter(Boolean), value])].join(', '));
  const openUpgradeAssistant = () => setUpgradeOpen(true);
  const chooseUpgrade = () => { setUpgradeOpen(false); toast.success(t('assistantGreat')); window.location.assign('/candidate/subscription'); };
  const chooseLater = () => { setUpgradeOpen(false); if (step === 5) { window.localStorage.removeItem(progressKey); toast.success(t('assistantThanks')); onFinishDashboard(); } };
  const recommendations = useQuery({ queryKey: ['onboarding-recommendations'], queryFn: () => careerApi.jobs({ limit: 3 }, true), enabled: step === 4 && ent.feature('career.match') === true });
  const finishResumeStep = async () => {
    setResumeError(null);
    if (!resumeMode) { setResumeError(tr('Choisis une option pour continuer.', 'Choose one option to continue.', 'اختر أحد الخيارين للمتابعة.')); return; }
    if (resumeMode === 'upload') {
      if (!resumeFile) { setResumeMode(null); setResumeError(tr('Choisis une option pour continuer.', 'Choose one option to continue.', 'اختر أحد الخيارين للمتابعة.')); return; }
      setResumeUploading(true);
      try { const resume = await resumesApi.upload(resumeFile); setId(resume.id); setResumeStep(false); }
      catch { setResumeError(tr('Le CV n’a pas pu être importé. Réessaie ou continue manuellement.', 'The CV could not be uploaded. Try again or continue manually.', 'تعذر رفع السيرة. حاول مجدداً أو تابع يدوياً.')); }
      finally { setResumeUploading(false); }
      return;
    }
    setResumeStep(false);
  };
  const next = useMutation({ mutationFn: async () => {
    if (step === 0) { if (Object.keys(fields).length) await candidatesApi.updateMe(fields); await detailsSave.current?.(); }
    if (step === 3) await careerApi.saveSettings({ domains: domains.split(/[,،]/).map(s => s.trim()).filter(Boolean), locations: locations.split(/[,،]/).map(s => s.trim()).filter(Boolean), workModes });
  }, onSuccess: () => { if (step === 0) void qc.invalidateQueries({ queryKey: ['candidate-profile'] }); setStep(s => Math.min(5, s + 1)); } });
  const titles = [t('reviewExtracted'), t('ats'), tr('Votre photo', 'Your photo', 'صورتك'), t('jobPreferences'), t('recommended'), t('subscription')];
  // A failed report is terminal for this attempt. Treating it as "waiting" kept
  // the preparation coach on screen forever, even though the API had already
  // finished processing and reported the failure.
  const reportFailed = !!id && !manualReview && (report.isError || report.data?.status === 'FAILED');
  const waitingForResume = !!id && !manualReview && !reportFailed && report.data?.status !== 'COMPLETED';
  const preparationFailed = profile.isError || reportFailed;
  const preparing = step === 0 && (!profile.data || waitingForResume || preparationFailed);
  useEffect(() => {
    if (!preparing) return;
    const timeout = setTimeout(() => setStalled(true), 90_000);
    return () => clearTimeout(timeout);
  }, [preparing]);
  if (!restored) return <Busy />;
  if (resumeStep) return <section className="space-y-5"><div><p className="mb-3 text-xs font-medium text-primary">{tr('Ton parcours professionnel · étape 1', 'Your career journey · step 1', 'مسارك المهني · المرحلة 1')}</p><div className="h-1.5 rounded-full bg-muted"><div className="h-full w-1/7 rounded-full bg-indigo-500" /></div></div><div><h2 className="text-2xl font-semibold tracking-tight">{tr('Comment veux-tu compléter ton profil ?', 'How do you want to complete your profile?', 'كيف تريد إكمال ملفك؟')}</h2><p className="mt-2 text-sm text-muted-foreground">{tr('Choisis maintenant. Tu pourras modifier tes informations ensuite.', 'Choose now. You can edit your information afterwards.', 'اختر الآن ويمكنك تعديل معلوماتك لاحقاً.')}</p></div><div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={tr('Choix du profil', 'Profile setup choice', 'اختيار إعداد الملف')}><div className={`relative rounded-2xl border p-4 transition-colors ${resumeMode === 'upload' ? 'border-indigo-400 bg-indigo-950/30' : 'border-border bg-card'}`}><button type="button" role="radio" aria-checked={resumeMode === 'upload'} onClick={() => { setResumeMode('upload'); setResumeError(null); }} className="w-full text-start"><span className="flex items-center gap-2 font-semibold"><FileUp className="size-4 text-indigo-400" />{tr('Préremplir avec mon CV', 'Prefill from my CV', 'ملء من سيرتي')}</span><span className="mt-1 block text-sm text-muted-foreground">{tr('Importe ton CV et remplis automatiquement ton profil.', 'Upload your CV and fill your profile automatically.', 'ارفع سيرتك واملأ ملفك آلياً.')}</span></button><label onClick={() => { setResumeMode('upload'); setResumeError(null); }} className="mt-3 inline-flex cursor-pointer items-center rounded-lg bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-200">{tr('Parcourir', 'Browse', 'تصفح')}<Input type="file" accept=".pdf,.docx,.txt,.md" className="sr-only" onChange={event => { setResumeMode('upload'); const file = event.target.files?.[0] ?? null; if (file && file.size > 10 * 1024 * 1024) { setResumeError(tr('Le CV ne doit pas dépasser 10 Mo.', 'The CV must not exceed 10 MB.', 'يجب ألا تتجاوز السيرة 10 ميغابايت.')); setResumeFile(null); event.currentTarget.value = ''; return; } setResumeError(null); setResumeFile(file); }} /></label></div><button type="button" role="radio" aria-checked={resumeMode === 'manual'} onClick={() => { setResumeMode('manual'); setResumeError(null); }} className={`rounded-2xl border p-4 text-start transition-colors ${resumeMode === 'manual' ? 'border-indigo-400 bg-indigo-950/30' : 'border-border bg-card'}`}><span className="font-semibold">{tr('Remplir manuellement', 'Fill manually', 'إدخال يدوي')}</span><span className="mt-1 block text-sm text-muted-foreground">{tr('Saisis tes informations toi-même. Tu peux importer un CV plus tard.', 'Enter your information yourself. You can upload a CV later.', 'أدخل معلوماتك بنفسك ويمكنك رفع سيرة لاحقاً.')}</span></button></div>{resumeFile && <p className="text-xs text-muted-foreground">{resumeFile.name}</p>}{resumeError && <p role="alert" className="text-sm text-destructive">{resumeError}</p>}<div className="flex justify-end border-t pt-5"><Button disabled={resumeUploading} onClick={() => void finishResumeStep()}>{resumeUploading ? tr('Importation…', 'Uploading…', 'جارٍ الرفع…') : tr('Continuer', 'Continue', 'متابعة')}</Button></div></section>;
  if (preparing) return <ProfilePreparation stalled={stalled} failed={preparationFailed} hasResume={!!id}
    onCheck={() => { void profile.refetch(); if (id) void report.refetch(); }}
    onManual={profile.data ? () => setManualReview(true) : undefined} />;
  const waiting = step === 1 && !manualReview && !!id && ['PENDING', 'PROCESSING'].includes(report.data?.status ?? '');
  return <section className="space-y-6">
    <div><p className="mb-3 text-xs font-medium text-primary">{t('yourJourney')} · {step + 1} / {titles.length}</p><div className="flex gap-1" role="progressbar" aria-label={t('yourJourney')} aria-valuemin={1} aria-valuemax={titles.length} aria-valuenow={step + 1}>{titles.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-indigo-500' : 'bg-muted'}`} />)}</div></div>
    <h2 className="text-2xl font-semibold tracking-tight">{titles[step]}</h2>
    {step === 0 && <div className="space-y-5"><p className="text-sm text-muted-foreground">{candidateEmail}</p>{(['headline', 'phone', 'location'] as const).map(key => <Field key={key} label={t(key)}><Input type={key === 'phone' ? 'tel' : 'text'} maxLength={key === 'phone' ? 30 : 120} value={fields[key] ?? ''} onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))} /></Field>)}<ProfessionalDetails fallback={report.data?.extracted ?? undefined} onRegisterSave={save => { detailsSave.current = save; }} /></div>}
    {step === 1 && (report.data?.report ? <AtsPanel report={report.data.report} profile={report.data.extracted ?? undefined} onImprove={openUpgradeAssistant} /> : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{t('noCv')}</p>)}
    {step === 2 && <ProfilePhoto onValidityChange={setPhotoReady} />}
    {step === 3 && <div className="space-y-4"><Field label={t('domain')}><Input placeholder={t('comma')} value={domains} onChange={e => setDomains(e.target.value)} /></Field>{domainSuggestions.length > 0 && <div className="space-y-2"><p className="text-xs text-muted-foreground">{t('domainSuggestions')}</p><div className="flex flex-wrap gap-2">{domainSuggestions.map(value => <button type="button" key={value} onClick={() => addDomainSuggestion(value)} className="rounded-full border border-indigo-300/60 bg-indigo-50/60 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:border-indigo-500 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">+ {value}</button>)}</div></div>}<Field label={t('location')}><LocationAutocomplete value={locations} onChange={setLocations} onSelect={option => { const rawParts = locations.split(','); const existing = rawParts.slice(0, -1).map(item => item.trim()).filter(Boolean); setLocations([...existing, option].join(', ')); }} /></Field><div className="space-y-2"><p className="text-sm font-medium">{t('workMode')}</p><div className="grid grid-cols-3 gap-2">{(['ONSITE', 'HYBRID', 'REMOTE'] as const).map(mode => <button type="button" key={mode} aria-pressed={workModes.includes(mode)} onClick={() => setWorkModes(current => current.includes(mode) ? current.filter(item => item !== mode) : [...current, mode])} className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${workModes.includes(mode) ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/60'}`}>{t(mode)}</button>)}</div></div></div>}
    {step === 4 && <FeatureGate feature="career.match">{recommendations.isPending ? <Busy /> : recommendations.isError ? <Failure retry={() => recommendations.refetch()} /> : recommendations.data?.items.length ? <div className="space-y-3">{recommendations.data.items.map(j => <JobCard key={j.id} job={j} />)}</div> : <p>{t('emptyRecommendations')}</p>}</FeatureGate>}
    <Dialog open={upgradeOpen} onOpenChange={open => { if (!open) chooseLater(); else setUpgradeOpen(true); }}><DialogContent className="!top-1/2 !bottom-auto !w-[min(94vw,960px)] !max-w-none !-translate-y-1/2 !max-h-[92dvh] !rounded-3xl overflow-y-auto gap-0 border-indigo-300/40 bg-slate-950 !p-0 text-slate-100"><DialogTitle className="sr-only">{t('assistantTitle')}</DialogTitle><DialogDescription className="sr-only">{t('assistantBody')}</DialogDescription><EasyJobCoach onUpgrade={chooseUpgrade} onLater={chooseLater} finalStep={step === 5} /></DialogContent></Dialog>
    {next.isError && <p role="alert" className="text-destructive">{t('error')}</p>}
    <div className="flex flex-wrap gap-2 border-t pt-5"><Button variant="outline" disabled={step === 0 || next.isPending} onClick={() => setStep(s => s - 1)}>{t('previous')}</Button>{step < 5 ? <Button disabled={!!waiting || next.isPending || (step === 2 && !photoReady)} onClick={() => next.mutate()}>{next.isPending ? t('PROCESSING') : t('next')}</Button> : <Button onClick={onFinishDashboard}>{t('dashboard')}</Button>}</div>
  </section>;
}


