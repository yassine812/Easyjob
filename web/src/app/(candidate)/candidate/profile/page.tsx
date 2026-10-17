'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Check, Circle, FileText, MapPin, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { candidatesApi } from '@/lib/api/candidates';
import { api } from '@/lib/api/client';
import type { CandidateProfile, JobPreference } from '@/types/api';
import { useCareerText } from '@/lib/i18n/career';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState, SkeletonRows } from '@/components/shared';
import { ExperienceSection } from '@/components/candidate/experience-section';
import { EducationSection } from '@/components/candidate/education-section';
import { SkillsSection } from '@/components/candidate/skills-section';
import { CvUpload } from '@/components/candidate/career-shared';
import { PremiumAiAction } from '@/components/candidate/career-shared';
import { ProfilePhoto } from '@/components/candidate/profile-photo';
import { CandidateAvatar, displayCandidateName } from '@/components/candidate/candidate-avatar';
import { profileFormDialogClass } from '@/components/candidate/profile-form-dialog';
import { AdvancedSettings } from '@/components/candidate/advanced-settings';
import { StarStoryBank } from '@/components/candidate/star-story-bank';

export default function CandidateProfilePage() {
  const t = useCareerText();
  const profile = useQuery({ queryKey: ['candidate-profile'], queryFn: candidatesApi.me });
  if (profile.isPending) return <SkeletonRows rows={8} />;
  if (profile.isError || !profile.data) return <ErrorState message={t('error')} retry={() => profile.refetch()} />;
  return <ProfessionalProfile profile={profile.data} />;
}

function ProfessionalProfile({ profile }: { profile: CandidateProfile }) {
  const t = useCareerText();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fallbackCompletion = useMemo(() => calculateCompletion(profile), [profile]);
  const completion = profile.profileCompletion?.score ?? fallbackCompletion;
  const name = displayCandidateName(profile.user?.name || profile.name || t('profile'));
  useEffect(() => { if (searchParams.get('settings') === 'advanced') setAdvancedOpen(true); }, [searchParams]);
  const resume = profile.resumes.find(item => item.isPrimary) || profile.resumes[0];

  return <div className="mx-auto max-w-[1200px] space-y-6">
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="h-24 sm:h-32 bg-[radial-gradient(circle_at_15%_0%,rgba(129,140,248,.42),transparent_46%),linear-gradient(110deg,rgba(49,46,129,.5),rgba(15,23,42,.1))]" />
      <div className="relative px-5 pb-6 sm:px-7">
        <CandidateAvatar name={name} className="-mt-11 size-20 border-4 border-card sm:-mt-14 sm:size-28 lg:size-32" fallbackClassName="bg-indigo-500 text-2xl font-semibold text-white sm:text-3xl" />
        <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="mt-1 text-lg text-muted-foreground">{profile.headline || t('profileTitle')}</p>
            {profile.bio && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{profile.bio}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground"><MapPin className="size-4" />{profile.location || t('noData')}{profile.yearsExperience != null && <><span>·</span><span>{profile.yearsExperience} {t('yearsExperience')}</span></>}</p>
            <div className="mt-3 flex flex-wrap gap-2"><Badge>{t('available')}</Badge>{profile.remotePreference && <Badge>{t('remote')}</Badge>}{profile.employmentTypePreference && <Badge>{t(profile.employmentTypePreference)}</Badge>}</div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <PremiumAiAction feature="career.coach" href="/candidate/interview-coach" title={t('prepareInterview')} description={t('interviewCoachPremiumHelp')} />
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="me-2 size-4" />{t('editProfile')}</Button>
            <Button variant="ghost" onClick={() => setUploadOpen(true)}><Upload className="me-2 size-4" />{t('updateCv')}</Button>
          </div>
        </div>
      </div>
    </section>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
      <main className="min-w-0 space-y-6">
        <ProfileCard title={t('about')} action={<Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} aria-label={t('editProfile')}><Pencil className="size-4" /></Button>}>
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{profile.bio || t('noData')}</p>
          <div className="mt-4"><PremiumAiAction feature="career.builder" href={resume ? "/candidate/cvs/" + resume.id + "/ai" : "/candidate/cvs"} title={t('improveWithAi')} description={t('cvImprovePremiumHelp')} className="h-9 text-xs" /></div>
        </ProfileCard>
        <Card><CardContent className="p-5"><ExperienceSection experiences={profile.experiences} /></CardContent></Card>
        <Card><CardContent className="p-5"><EducationSection educations={profile.educations} /></CardContent></Card>
        <Card><CardContent className="p-5"><SkillsSection skills={profile.skills} /></CardContent></Card>
        <StarStoryBank />
        <LanguagesCard profile={profile} onEdit={() => setEditOpen(true)} />
        <ProfileCard title={t('jobCriteria')} action={<Button size="sm" variant="outline" onClick={() => setPreferencesOpen(true)}><Pencil className="me-1.5 size-3.5" />{t('edit')}</Button>}><PreferenceSummary preference={profile.jobPreference} /><p className="mt-4 text-xs text-muted-foreground">{t('salaryPrivate')}</p></ProfileCard>
        <ProfileCard title={t('cv')}>
          {resume ? <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><FileText className="size-8 shrink-0 text-indigo-500" /><div className="min-w-0"><p className="truncate font-medium">{resume.filename}</p><p className="mt-1 text-xs text-muted-foreground"><Check className="me-1 inline size-3 text-emerald-600" />{resume.processingStatus === 'COMPLETED' ? t('cvAnalyzed') : t('processing')}</p></div></div><div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link href="/candidate/cvs">{t('viewCv')}</Link></Button><Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>{t('replace')}</Button></div></div> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{t('noCvImported')}</p><Button onClick={() => setUploadOpen(true)}><Upload className="me-2 size-4" />{t('importMyCv')}</Button></div>}
        </ProfileCard>
        <JobLibrary profile={profile} />
        <AdvancedSettings open={advancedOpen} onOpenChange={setAdvancedOpen} />
      </main>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <ProfileCompletionCard profile={profile} completion={completion} onComplete={() => setCompletionOpen(true)} />
        <EasyJobAnalysisCard profile={profile} />
        <Card className="border-indigo-300/50 bg-indigo-500/5"><CardHeader className="pb-3"><CardTitle className="text-base">{t('nextInterview')}</CardTitle><CardDescription>{t('nextInterviewHelp')}</CardDescription></CardHeader><CardContent><PremiumAiAction feature="career.coach" href="/candidate/interview-coach" title={t('prepareInterview')} description={t('interviewCoachPremiumHelp')} className="w-full" /></CardContent></Card>
      </aside>
    </div>

    <EditProfileDialog profile={profile} open={editOpen} onOpenChange={setEditOpen} />
    <PreferencesDialog initial={profile.jobPreference} open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    <ProfileCompletionDialog open={completionOpen} onOpenChange={setCompletionOpen} />
    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{t('updateCv')}</DialogTitle><DialogDescription>{t('uploadHelp')}</DialogDescription></DialogHeader><CvUpload onUploaded={() => setUploadOpen(false)} /></DialogContent></Dialog>
  </div>;
}

function ProfileCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <Card><CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0"><CardTitle className="text-lg">{title}</CardTitle>{action}</CardHeader><CardContent>{children}</CardContent></Card>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="inline-flex items-center rounded-full border border-indigo-300/40 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-200">{children}</span>; }
function JobLibrary({ profile }: { profile: CandidateProfile }) {
  const t = useCareerText();
  return <ProfileCard title={t('saved')} action={<Button asChild size="sm" variant="outline"><Link href="/candidate/saved"><Bookmark className="me-1.5 size-3.5" />{t('view')}</Link></Button>}>{profile.savedJobs.length ? <ul className="space-y-3">{profile.savedJobs.slice(0, 4).map(saved => <li key={saved.jobId} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{saved.job?.title || t('noData')}</p><p className="mt-1 text-xs text-muted-foreground">{saved.job?.location || t('noData')}</p></div><Button asChild size="sm" variant="ghost"><Link href={"/candidate/jobs/" + saved.jobId}>{t('view')}</Link></Button></li>)}</ul> : <p className="text-sm text-muted-foreground">{t('noData')}</p>}<p className="mt-4 text-xs text-muted-foreground">{t('savedJobsPrivate')}</p></ProfileCard>;
}
function LanguagesCard({ profile, onEdit }: { profile: CandidateProfile; onEdit: () => void }) {
  const t = useCareerText();
  const entries = profileLanguageEntries(profile);
  return <ProfileCard title={t('languages')} action={<Button size="sm" variant="outline" onClick={onEdit}><Pencil className="me-1.5 size-3.5" />{t('edit')}</Button>}>{entries.length ? <ul className="space-y-2">{entries.map((entry, index) => <li className="flex items-center gap-2 text-sm" key={index}><Check className="size-3.5 text-emerald-600" />{entry}<span className="ms-auto text-xs text-muted-foreground">{t('cv')}</span></li>)}</ul> : <div className="space-y-3"><p className="text-sm text-muted-foreground">{t('noLanguagesAdded')}</p><Button size="sm" variant="outline" onClick={onEdit}>{t('addManually')}</Button></div>}</ProfileCard>;
}
function PreferenceSummary({ preference }: { preference: JobPreference | null }) {
  const t = useCareerText();
  const rows: Array<[string, string | null | undefined]> = [[t('targetRoles'), preference?.jobTitle || preference?.keywords?.join(', ')], [t('location'), preference?.location], [t('workMode'), preference?.remote ? t('remote') : undefined], [t('contracts'), preference?.employmentType ? t(preference.employmentType) : undefined]];
  return <div className="grid gap-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value || t('notSpecified')}</p></div>)}</div>;
}

function CompletionRows({ profile }: { profile: CandidateProfile }) {
  const t = useCareerText();
  const items = profile.profileCompletion?.items;
  const rows: Array<[string, boolean]> = [[t('profileTitle'), items?.headline ?? Boolean(profile.headline)], [t('summary'), items?.summary ?? Boolean(profile.bio)], [t('profileExperience'), items?.experience ?? profile.experiences.length > 0], [t('education'), items?.education ?? profile.educations.length > 0], [t('skills'), items?.skills ?? profile.skills.length > 0], [t('languages'), items?.languages ?? false], [t('completionCv'), items?.resume ?? profile.resumes.length > 0], [t('profilePreferences'), items?.jobPreferences ?? Boolean(profile.jobPreference)]];
  return <div className="space-y-2">{rows.map(([label, done]) => <div className="flex items-center gap-2 text-xs" key={label}>{done ? <Check className="size-3.5 text-emerald-600" /> : <Circle className="size-3.5 text-muted-foreground" />}<span className={done ? "" : "text-muted-foreground"}>{label}</span></div>)}</div>;
}

function ProfileCompletionCard({ profile, completion, onComplete }: { profile: CandidateProfile; completion: number; onComplete: () => void }) {
  const t = useCareerText();
  const missing = profile.profileCompletion?.missingFields ?? [];
  const canSuggest = completion < 100 && missing.some(field => field === 'languages' || field === 'jobPreferences');
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">{t('profileCompletion')}</CardTitle><CardDescription>{t('profileCompletionHelp')}</CardDescription></CardHeader><CardContent><div className="mb-4 flex items-end gap-2"><strong className="text-3xl">{completion}%</strong><span className="pb-1 text-xs text-muted-foreground">{t('profileCompletion')}</span></div><CompletionRows profile={profile} />{canSuggest && <PremiumAiAction feature="career.builder" href="/candidate/profile" title={t('completeProfileWithEasyJob')} description={t('profileCompletionAiHelp')} onAllowed={onComplete} className="mt-5 w-full text-xs" />}</CardContent></Card>;
}

function ProfileCompletionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useCareerText(), qc = useQueryClient();
  const suggestions = useQuery({ queryKey: ['profile-completion-suggestions'], queryFn: candidatesApi.profileCompletionSuggestions, enabled: open, retry: false });
  const [languages, setLanguages] = useState<string[]>([]), [roles, setRoles] = useState<string[]>([]), [useLocation, setUseLocation] = useState(true), [remote, setRemote] = useState<boolean | undefined>(undefined), [employmentType, setEmploymentType] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!suggestions.data || !open) return;
    setLanguages(suggestions.data.suggestions.languages);
    setRoles(suggestions.data.suggestions.targetRoles);
    setUseLocation(Boolean(suggestions.data.suggestions.location));
    setRemote(undefined);
    setEmploymentType(undefined);
  }, [open, suggestions.data]);
  const apply = useMutation({
    mutationFn: () => candidatesApi.applyProfileCompletion({
      languages: languages.length ? languages : undefined,
      jobTitle: roles[0],
      keywords: roles.length > 1 ? roles : undefined,
      location: useLocation ? suggestions.data?.suggestions.location || undefined : undefined,
      remote,
      employmentType,
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['candidate-profile'] }); void qc.invalidateQueries({ queryKey: ['profile-completion-suggestions'] }); toast.success(t('success')); onOpenChange(false); },
    onError: () => toast.error(t('error')),
  });
  const toggle = (value: string, set: (values: string[]) => void, values: string[]) => set(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  const data = suggestions.data;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={profileFormDialogClass}><DialogHeader className="shrink-0 border-b px-6 py-5"><DialogTitle>{t('completeProfileTitle')}</DialogTitle><DialogDescription>{t('completeProfileHelp')}</DialogDescription></DialogHeader><div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">{suggestions.isPending && <p className="text-sm text-muted-foreground">{t('processing')}</p>}{suggestions.isError && <p className="text-sm text-destructive">{t('error')}</p>}{data && <><SuggestionList title={t('languages')} values={data.suggestions.languages} selected={languages} onToggle={value => toggle(value, setLanguages, languages)} helper={t('detectedFromCv')} /><SuggestionList title={t('targetRoles')} values={data.suggestions.targetRoles} selected={roles} onToggle={value => toggle(value, setRoles, roles)} helper={t('detectedFromCv')} />{data.suggestions.location && <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" className="mt-1" checked={useLocation} onChange={event => setUseLocation(event.target.checked)} /><span><strong>{t('location')}</strong><span className="mt-1 block text-muted-foreground">{data.suggestions.location} · {t('detectedFromCv')}</span></span></label>} {(data.needsCandidateInput.workArrangement || data.needsCandidateInput.contractType) && <section className="space-y-3 border-t pt-5"><h3 className="font-medium">{t('informationNeeded')}</h3>{data.needsCandidateInput.workArrangement && <div><p className="mb-2 text-sm font-medium">{t('workArrangement')}</p><div className="flex flex-wrap gap-2"><Button type="button" variant={remote === true ? 'default' : 'outline'} size="sm" onClick={() => setRemote(true)}>{t('remote')}</Button><Button type="button" variant={remote === false ? 'default' : 'outline'} size="sm" onClick={() => setRemote(false)}>{t('onsite')}</Button><Button type="button" variant={remote === undefined ? 'secondary' : 'outline'} size="sm" onClick={() => setRemote(undefined)}>{t('chooseLater')}</Button></div></div>}{data.needsCandidateInput.contractType && <div><p className="mb-2 text-sm font-medium">{t('contractType')}</p><div className="flex flex-wrap gap-2">{(['FULL_TIME', 'CONTRACT', 'FREELANCE'] as const).map(type => <Button type="button" variant={employmentType === type ? 'default' : 'outline'} size="sm" key={type} onClick={() => setEmploymentType(employmentType === type ? undefined : type)}>{t(type)}</Button>)}</div></div>}</section>}</>}</div><DialogFooter className="shrink-0 border-t px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button><Button disabled={suggestions.isPending || suggestions.isError || apply.isPending} onClick={() => apply.mutate()}>{t('applySelected')}</Button></DialogFooter></DialogContent></Dialog>;
}

function SuggestionList({ title, values, selected, onToggle, helper }: { title: string; values: string[]; selected: string[]; onToggle: (value: string) => void; helper: string }) {
  if (!values.length) return null;
  return <section><h3 className="mb-2 font-medium">{title}</h3><div className="space-y-2">{values.map(value => <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm" key={value}><input type="checkbox" className="mt-1" checked={selected.includes(value)} onChange={() => onToggle(value)} /><span><strong>{value}</strong><span className="mt-1 block text-xs text-muted-foreground">{helper}</span></span></label>)}</div></section>;
}

function EditProfileDialog({ profile, open, onOpenChange }: { profile: CandidateProfile; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useCareerText(), qc = useQueryClient();
  const [headline, setHeadline] = useState(profile.headline || ''), [bio, setBio] = useState(profile.bio || ''), [location, setLocation] = useState(profile.location || ''), [languages, setLanguages] = useState(profileLanguageEntries(profile).join('\n'));
  useEffect(() => { if (open) { setHeadline(profile.headline || ''); setBio(profile.bio || ''); setLocation(profile.location || ''); setLanguages(profileLanguageEntries(profile).join('\n')); } }, [open, profile]);
  const save = useMutation({ mutationFn: () => api.patch<CandidateProfile>('/candidates/me', { headline: headline || undefined, bio: bio || undefined, location: location || undefined, languages: languages.split('\n').map(item => item.trim()).filter(Boolean) }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['candidate-profile'] }); toast.success(t('success')); onOpenChange(false); }, onError: () => toast.error(t('error')) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={profileFormDialogClass}><DialogHeader className="shrink-0 border-b px-6 py-5"><DialogTitle>{t('editProfile')}</DialogTitle><DialogDescription>{t('profileSubtitle')}</DialogDescription></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><div className="grid gap-5"><label className="grid gap-2 text-sm font-medium">{t('headline')}<Input value={headline} onChange={event => setHeadline(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">{t('about')}<Textarea className="min-h-40 w-full resize-y" value={bio} onChange={event => setBio(event.target.value)} /></label><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium">{t('location')}<Input value={location} onChange={event => setLocation(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">{t('languages')}<Textarea className="min-h-32 w-full resize-y" value={languages} onChange={event => setLanguages(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{t('languagesEditorHelp')}</span></label></div><div className="rounded-lg border p-3 text-sm text-muted-foreground">{t('profilePhoto')}<div className="mt-3"><ProfilePhoto /></div></div></div></div><DialogFooter className="shrink-0 border-t px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{t('save')}</Button></DialogFooter></DialogContent></Dialog>;
}

function EasyJobAnalysisCard({ profile }: { profile: CandidateProfile }) {
  const t = useCareerText(), analysis = profile.easyjobAnalysis;
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">{t('easyJobAnalysis')}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div>{analysis ? <strong className="text-3xl">{analysis.profileStrength} / 100</strong> : <strong className="text-lg text-muted-foreground">{t('notCalculated')}</strong>}<p className="mt-1 text-xs text-muted-foreground">{t('profileStrength')}</p></div><p><strong>{analysis?.skillsCount ?? profile.skills.length}</strong> {t('skillsDetected')}</p><p><strong>{analysis?.experienceCount ?? profile.experiences.length}</strong> {t('experiencesRecorded')}</p><p><strong>{analysis?.educationCount ?? profile.educations.length}</strong> {t('educationEntries')}</p></CardContent></Card>;
}

function PreferencesDialog({ initial, open, onOpenChange }: { initial: JobPreference | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useCareerText(), qc = useQueryClient();
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle || ''), [location, setLocation] = useState(initial?.location || ''), [remote, setRemote] = useState(initial?.remote || false);
  const save = useMutation({ mutationFn: () => candidatesApi.updateJobPreferences({ jobTitle: jobTitle || undefined, location: location || undefined, remote }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['candidate-profile'] }); toast.success(t('success')); onOpenChange(false); }, onError: () => toast.error(t('error')) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={profileFormDialogClass}><DialogHeader className="shrink-0 border-b px-6 py-5"><DialogTitle>{t('jobCriteria')}</DialogTitle><DialogDescription>{t('salaryPrivate')}</DialogDescription></DialogHeader><div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5"><label className="grid gap-2 text-sm font-medium">{t('targetRoles')}<Input value={jobTitle} onChange={event => setJobTitle(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">{t('location')}<Input value={location} onChange={event => setLocation(event.target.value)} /></label><label className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium"><input type="checkbox" checked={remote} onChange={event => setRemote(event.target.checked)} />{t('remote')}</label></div><DialogFooter className="shrink-0 border-t px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{t('save')}</Button></DialogFooter></DialogContent></Dialog>;
}

function calculateCompletion(profile: CandidateProfile) {
  const fields = [profile.headline, profile.bio, profile.location, profile.experiences.length > 0, profile.educations.length > 0, profile.skills.length > 0, profile.resumes.length > 0, profile.jobPreference];
  return Math.round(fields.filter(Boolean).length / fields.length * 100);
}

function profileLanguageEntries(profile: CandidateProfile): string[] {
  const data = profile.professionalData as { languages?: unknown; sections?: { languages?: unknown } } | null;
  const raw = data?.languages ?? data?.sections?.languages;
  if (!Array.isArray(raw)) return [];
  return raw.map(item => typeof item === 'string'
    ? item
    : item && typeof item === 'object' && 'name' in item
      ? [String(item.name), 'level' in item && item.level ? String(item.level) : ''].filter(Boolean).join(' · ')
      : '').filter(Boolean);
}
