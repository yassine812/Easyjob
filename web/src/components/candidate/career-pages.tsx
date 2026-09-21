'use client';
import { useEffect, useRef, useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { CvPreview } from './cv-preview';
import { LanguageLevelSelect } from './language-level-select';
import { ExperienceDraftEditor, experienceDrafts, serializeExperiences } from './extracted-profile';
import { JobExclusions } from './job-exclusions';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { careerApi, type CareerSettings, type CvProject, type Draft, type ProfileDetails } from '@/lib/api/career';
import { resumesApi } from '@/lib/api/resumes';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { billingApi } from '@/lib/api/billing';
import { useEntitlement } from '@/hooks/use-entitlement';
import { useCareerText } from '@/lib/i18n/career';
import { useUxText } from '@/lib/i18n/ux';
import { useReleaseText } from '@/lib/i18n/release';
import { useAtsText } from '@/lib/i18n/ats';
import { AtsPanel, Busy, CareerFrame, CvUpload, Failure, FeatureGate, Field, JobCard, panelClass, selectClass } from './career-shared';
import { atsScoreTone } from './ats-report';
import { CvPdfViewer } from './cv-pdf-viewer';

const TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'];
const MODES = ['REMOTE', 'HYBRID', 'ONSITE'];
const split = (value: string) => [...new Set(value.split(/[,،]/).map(v => v.trim()).filter(Boolean))];
const cleanLineBreaks = (value: string) => value.replace(/\\n/g, '\n');
export function CareerDashboard() {
  const t = useCareerText(); const q = useQuery({ queryKey: ['career-overview'], queryFn: careerApi.overview });
  const atsScore = q.data?.resume?.ats?.score;
  const atsTone = typeof atsScore === 'number' ? atsScoreTone(atsScore) : undefined;
  return <CareerFrame title={t('dashboard')} description={q.data?.name ? `${t('greeting')}, ${q.data.name}. ${t('welcome')}` : t('welcome')}>{q.isPending ? <Busy /> : q.isError ? <Failure retry={() => q.refetch()} /> : <>
    {!q.data.resume && <section className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}><div><h2 className="font-semibold">{t('cvStatus')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('noCv')}</p></div><Button asChild variant="outline"><Link href="/candidate/cvs">{t('upload')}</Link></Button></section>}
    <div data-guide="dashboard" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{[['ats', q.data.resume?.ats?.score ?? '—', '/candidate/ats'], ['completion', `${q.data.profileCompletion}%`, '/candidate/profile'], ['applications', q.data.applications, '/candidate/applications'], ['saved', q.data.savedJobs ?? 0, '/candidate/saved'], ['invitations', q.data.interviews, '/candidate/applications']].map(([k, value, href]) => k === 'ats' ? <div key={k} className={`relative rounded-xl border ${atsTone?.border ?? 'border-border'} bg-card p-4`}><Link href={String(href)} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-ring"><p className="text-xs text-muted-foreground">{t(String(k))}</p><div className="mt-2 flex items-center gap-3"><span aria-label={`${value}/100`} className="relative grid size-16 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${atsTone?.accent ?? '#64748b'} ${Number(value) || 0}%, #334155 0)` }}><span className={`absolute inset-1 grid place-items-center rounded-full bg-card text-xl font-semibold tabular-nums ${atsTone?.value ?? 'text-muted-foreground'}`}>{value}</span></span><span className={`text-xs font-medium ${atsTone?.value ?? 'text-muted-foreground'}`}>{t('atsImproveHint')}</span></div></Link><Link href="/candidate/subscription" className="mt-3 inline-flex rounded-full border border-yellow-300/45 px-2.5 py-1 text-[11px] font-semibold text-yellow-300 transition-colors hover:bg-yellow-300/15 focus-visible:outline-2 focus-visible:outline-yellow-300">{t('upgrade')}</Link></div> : <Link key={k} href={String(href)} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{t(String(k))}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></Link>)}</div>
    <div className="grid gap-4 md:grid-cols-2"><section className={panelClass}><h2 className="font-semibold">{t('auto')}</h2><p className="my-3 text-sm text-muted-foreground">{t(q.data.autoApply ? 'ACTIVE' : 'DISABLED')}</p><Button asChild variant="outline"><Link href="/candidate/auto-apply">{t('settings')}</Link></Button></section><section className={panelClass}><h2 className="font-semibold">{t('upcomingInterview')}</h2><p className="my-3 text-sm text-muted-foreground">{q.data.upcomingInterview ? `${q.data.upcomingInterview.application.job.title} · ${new Date(q.data.upcomingInterview.startAt).toLocaleString()}` : t('noData')}</p><Button asChild variant="outline"><Link href="/candidate/interview-coach">{t('coach')}</Link></Button></section></div><section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{t('recommended')}</h2><Link className="text-sm text-indigo-600 dark:text-indigo-300" href="/candidate/recommended">{t('details')}</Link></div><FeatureGate feature="career.match">{q.data.recommendations?.items.length ? <div className="grid gap-4 lg:grid-cols-2">{q.data.recommendations.items.map(j => <JobCard key={j.id} job={j} />)}</div> : <p className={panelClass}>{t('emptyRecommendations')}</p>}</FeatureGate></section>
  </>}</CareerFrame>;
}
export function FindJobs({ recommended = false }: { recommended?: boolean }) {
  const t = useCareerText(), ux = useUxText(), ent = useEntitlement('CANDIDATE');
  const [form, setForm] = useState<Record<string, string>>({ sort: recommended ? 'match' : 'newest' });
  const [query, setQuery] = useState<Record<string, string | number>>({ sort: recommended ? 'match' : 'newest', page: 1 });
  const facets = useQuery({ queryKey: ['career-facets'], queryFn: careerApi.facets });
  const results = useQuery({ queryKey: ['career-jobs', recommended, query], queryFn: () => careerApi.jobs(query, recommended), enabled: !recommended || ent.feature('career.match') === true });
  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  const select = (key: string, values: string[], label = key) => <Field label={t(label)}><select className={selectClass} value={form[key] || ''} onChange={e => update(key, e.target.value)}><option value="">{t('all')}</option>{values.map(v => <option key={v} value={v}>{t(v)}</option>)}</select></Field>;
  const body = <>
    <form className={`${panelClass} space-y-4`} onSubmit={e => { e.preventDefault(); setQuery({ ...form, page: 1 }); }}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label={t('keyword')}><Input value={form.keyword || ''} onChange={e => update('keyword', e.target.value)} /></Field><Field label={t('location')}><Input value={form.location || ''} onChange={e => update('location', e.target.value)} /></Field></div>
      <details><summary className="cursor-pointer text-sm font-medium text-primary">{ux('filters')}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={t('company')}><select className={selectClass} value={form.companyId || ''} onChange={e => update('companyId', e.target.value)}><option value="">{t('all')}</option>{facets.data?.companies.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></Field><Field label={t('publishedWithin')}><select className={selectClass} value={form.publishedWithin || ''} onChange={e => update('publishedWithin', e.target.value)}><option value="">{t('all')}</option>{[1, 7, 14, 30].map(days => <option value={days} key={days}>{t(`days${days}`)}</option>)}</select></Field>{select('domain', facets.data?.domains || [])}
      {select('contractType', ['CDI', 'CDD'])}{select('workMode', MODES)}{select('employmentType', TYPES, 'jobType')}{select('experienceLevel', ['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'], 'experience')}
      <Field label={t('salaryMin')}><Input min={0} type="number" value={form.salaryMin || ''} onChange={e => update('salaryMin', e.target.value)} /></Field><Field label={t('salaryMax')}><Input min={0} type="number" value={form.salaryMax || ''} onChange={e => update('salaryMax', e.target.value)} /></Field>
      <Field label={t('skills')}><Input placeholder={t('comma')} value={form.skills || ''} onChange={e => update('skills', e.target.value)} /></Field>{select('sort', ['relevance', 'newest', 'match'])}
      </div></details>
      <div className="flex items-end gap-2"><Button type="submit">{t('search')}</Button><Button variant="outline" type="button" onClick={() => { setForm({ sort: 'newest' }); setQuery({ page: 1, sort: 'newest' }); }}>{t('reset')}</Button></div><p className="self-end text-xs text-muted-foreground">{t('salaryNote')}</p>
    </form>
    {results.isPending ? <Busy /> : results.isError ? <Failure retry={() => results.refetch()} /> : results.data.items.length ? <><p className="text-sm text-muted-foreground">{results.data.total} · {t('estimated')}</p><div className="grid gap-4 lg:grid-cols-2">{results.data.items.map(j => <JobCard key={j.id} job={j} />)}</div><div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={results.data.page <= 1} onClick={() => setQuery(q => ({ ...q, page: Number(q.page || 1) - 1 }))}>{t('previous')}</Button><span>{results.data.page}</span><Button variant="outline" disabled={results.data.page * results.data.limit >= results.data.total} onClick={() => setQuery(q => ({ ...q, page: Number(q.page || 1) + 1 }))}>{t('next')}</Button></div></> : <p className={panelClass}>{t(recommended ? 'emptyRecommendations' : 'emptyJobs')}</p>}
  </>;
  return <CareerFrame showFindJob={false} title={t(recommended ? 'recommended' : 'find')} description={t(recommended ? 'why' : 'freeFeatures')} actions={recommended && <Button asChild variant="outline"><Link href="/candidate/alerts">{t('alerts')}</Link></Button>}>{recommended ? <FeatureGate feature="career.match">{body}</FeatureGate> : body}</CareerFrame>;
}

function CvAtsSummary({ report }: { report: import('@/lib/api/career').AtsReport }) {
  const t = useCareerText(), tr = useReleaseText();
  const score = report.score, tone = score === null ? undefined : atsScoreTone(score);
  return <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-3" aria-label={tr('Score ATS du CV', 'CV ATS score', 'نتيجة ATS للسيرة')}>
    <div className="flex items-center gap-4"><span className={`text-3xl font-semibold tabular-nums ${tone?.value ?? ''}`}>{score ?? '—'}<small className="text-sm text-muted-foreground">/100</small></span><div><h2 className="text-sm font-semibold">{tr('Score ATS du CV', 'CV ATS score', 'نتيجة ATS للسيرة')}</h2><p className="text-xs text-muted-foreground">{tr('Explore les passages surlignés avec ton coach.', 'Explore highlighted passages with your coach.', 'شوف النصوص الملوّنة مع المدرّب.')}</p></div></div>
    <Link href="/candidate/ats" className="text-sm text-primary underline underline-offset-4">{t('ats')}</Link>
  </section>;
}

function ExtractionStatus({ profile }: { profile: import('@/lib/api/career').ProfileDetails | null }) {
  const t = useCareerText();
  if (!profile) return null;
  const experiences = profile.experiences?.length ?? profile.sections.experience?.length ?? 0;
  const educations = profile.educations?.length ?? profile.sections.education?.length ?? 0;
  const languages = profile.languages?.length ?? profile.sections.languages?.length ?? 0;
  const skills = profile.skills?.length ?? profile.sections.skills?.length ?? 0;
  return <section className={`${panelClass} space-y-4`}><div className="flex items-center gap-2"><FileCheck2 className="size-5 text-emerald-500" /><h2 className="font-semibold">{t('extractionStatus')}</h2></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><p className="text-sm text-muted-foreground">✓ {skills} {t('skillsDetected')}</p><p className="text-sm text-muted-foreground">✓ {experiences} {t('experienceDetected')}</p><p className="text-sm text-muted-foreground">✓ {educations} {t('educationDetected')}</p><p className="text-sm text-muted-foreground">✓ {languages} {t('languagesDetected')}</p></div><Button asChild variant="outline"><Link href="/candidate/profile">{t('viewProfile')}</Link></Button></section>;
}
export function MyCv({ analysisOnly = false }: { analysisOnly?: boolean }) {
  const targetSelect = useRef<HTMLSelectElement>(null);
  const ats = useAtsText(), tr = useReleaseText();
  const t = useCareerText(), qc = useQueryClient(); const [selected, setSelected] = useState(''), [jobId, setJobId] = useState('');
  const cvs = useQuery({ queryKey: ['resumes'], queryFn: resumesApi.list, refetchInterval: q => q.state.data?.some(r => ['PENDING', 'PROCESSING'].includes(r.processingStatus)) ? 2500 : false });
  const id = selected || cvs.data?.[0]?.id || '';
  const jobs = useQuery({ queryKey: ['career-jobs-picker'], queryFn: () => careerApi.jobs({ limit: 50 }), enabled: analysisOnly });
  const report = useQuery({ queryKey: ['career-report', id, jobId], queryFn: () => careerApi.report(id, jobId || undefined), enabled: !!id,
    refetchInterval: q => q.state.data && ['PENDING', 'PROCESSING'].includes(q.state.data.status) ? 2000 : false });
  const resume = cvs.data?.find(item => item.id === id);
  const action = useMutation({ mutationFn: async (kind: string) => {
    if (kind === 'download') { const r = await resumesApi.downloadUrl(id); window.open(r.url, '_blank', 'noopener,noreferrer'); }
    if (kind === 'primary') await resumesApi.setPrimary(id);
    if (kind === 'delete') { await resumesApi.remove(id); setSelected(''); }
    if (kind === 'import') await careerApi.importResume(id);
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['resumes'] }); qc.invalidateQueries({ queryKey: ['career-profile-details'] }); qc.invalidateQueries({ queryKey: ['candidate-profile'] }); toast.success(t('success')); }, onError: () => toast.error(t('error')) });
  const viewerActions = { onDownload: () => action.mutate('download'), onPrimary: () => action.mutate('primary'), onDelete: () => { if (window.confirm(t('confirmDelete'))) action.mutate('delete'); }, pending: action.isPending };
  return <CareerFrame wide={!analysisOnly} title={t(analysisOnly ? 'ats' : 'cvs')} description={analysisOnly ? t('scoreNote') : undefined} actions={cvs.data?.length ? <div className="relative"><details><summary className="flex cursor-pointer list-none items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">{tr('Importer une nouvelle version', 'Upload a new version', 'حمّل نسخة جديدة')}</summary><div className="absolute end-0 top-full z-30 mt-2 w-[min(90vw,34rem)] rounded-xl border bg-card p-4 text-start shadow-xl"><CvUpload onUploaded={setSelected} /></div></details></div> : undefined}>
    {!cvs.data?.length && <CvUpload onUploaded={setSelected} />}
    {cvs.isError ? <Failure retry={() => cvs.refetch()} /> : cvs.isPending ? <Busy /> : cvs.data.length ? <>
      {analysisOnly && <div className="max-w-xl"><Field label={t('targetJob')}><select ref={targetSelect} className={selectClass} value={jobId} disabled={jobs.isPending || jobs.isError || !jobs.data?.items.length} onChange={e => setJobId(e.target.value)}><option value="">{ats(jobs.isPending ? 'jobsLoading' : jobs.isError ? 'jobsError' : !jobs.data?.items.length ? 'jobsEmpty' : 'noTarget')}</option>{jobs.data?.items.map(j => <option key={j.id} value={j.id}>{j.title} · {j.company.commercialName}</option>)}</select></Field></div>}
      {analysisOnly && jobs.isError && <span role="alert" className="text-xs text-destructive">{ats('jobsError')} <button type="button" className="ms-1 underline" onClick={() => { void jobs.refetch(); }}>{ats('jobsRetry')}</button></span>}
      {analysisOnly ? (report.isError ? <Failure retry={() => report.refetch()} /> : report.data?.status === 'FAILED' ? <p role="alert" className={panelClass}>{t('FAILED')} · {t('uploadHelp')}</p> : report.data?.report ? <AtsPanel report={report.data.report} profile={report.data.extracted ?? undefined} onSelectJob={() => { targetSelect.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); targetSelect.current?.focus({ preventScroll: true }); }} /> : <Busy />) : resume ? <>
        {report.isError ? <Failure retry={() => report.refetch()} /> : report.data?.status === 'FAILED' ? <p role="alert" className={panelClass}>{t('FAILED')} · {t('uploadHelp')}</p> : report.data?.report ? <CvAtsSummary report={report.data.report} /> : <Busy />}
        <CvPdfViewer key={resume.id} resume={resume} report={report.data?.report ?? undefined} actions={viewerActions} />
        <ExtractionStatus profile={report.data?.extracted ?? null} />
      </> : <p className="text-sm text-muted-foreground">{t('noCv')}</p>}
    </> : <p className="text-sm text-muted-foreground">{t('noCv')}</p>}
  </CareerFrame>;
}
export function ProfessionalDetails({ onRegisterSave, fallback }: { onRegisterSave?: (save: () => Promise<unknown>) => void; fallback?: ProfileDetails } = {}) {
  const q = useQuery({ queryKey: ['career-profile-details'], queryFn: careerApi.profile });
  if (q.isPending) return <Busy />;
  if (q.isError) return <Failure retry={() => q.refetch()} />;
  const data = q.data, source = fallback;
  const merged: ProfileDetails = {
    ...source,
    ...data,
    sections: Object.keys(data.sections ?? {}).length ? data.sections : source?.sections ?? {},
    experiences: data.experiences?.length ? data.experiences : source?.experiences,
    educations: data.educations?.length ? data.educations : source?.educations,
    languages: data.languages?.length ? data.languages : source?.languages,
    certifications: data.certifications?.length ? data.certifications : source?.certifications,
    projects: data.projects?.length ? data.projects : source?.projects,
    skills: data.skills?.length ? data.skills : source?.skills,
    summary: data.summary || source?.summary,
    headline: data.headline || source?.headline,
    location: data.location || source?.location,
    phone: data.phone || source?.phone,
  };
  return <DetailsForm initial={merged} onRegisterSave={onRegisterSave} />;
}
function projectDrafts(initial: ProfileDetails): CvProject[] {
  if (initial.projects?.length) return initial.projects;
  const lines = initial.sections?.projects ?? [];
  if (!lines.length) return [];
  const projects: CvProject[] = [];
  let current: CvProject | null = null;
  for (const raw of lines) {
    const line = cleanLineBreaks(raw).trim();
    if (!line) continue;
    const name = line.match(/^(?:nom|name|projet|project)\s*[:：]\s*(.+)$/i)?.[1];
    const description = line.match(/^(?:description|desc)\s*[:：]\s*(.+)$/i)?.[1];
    const githubUrl = line.match(/^(?:github|github\s*link|lien\s*github)\s*[:：]\s*(.+)$/i)?.[1];
    if (name || (!current && !description && !githubUrl)) { current = { name: name ?? line, description: '', githubUrl: '' }; projects.push(current); continue; }
    if (!current) { current = { name: '', description: '', githubUrl: '' }; projects.push(current); }
    if (description) current.description = description;
    else if (githubUrl) current.githubUrl = githubUrl;
    else current.description = current.description ? `${current.description}\n${line}` : line;
  }
  return projects;
}
function DetailsForm({ initial, onRegisterSave }: { initial: ProfileDetails; onRegisterSave?: (save: () => Promise<unknown>) => void }) {
  const t = useCareerText(), qc = useQueryClient();
  const [fields, setFields] = useState<Record<string, string>>({
    summary: cleanLineBreaks(initial.summary || initial.sections?.summary?.join('\n') || ''),
    projects: initial.sections?.projects?.join('\n') || '',
  });
  const [certifications, setCertifications] = useState(() => initial.certifications?.length ? initial.certifications.map(c => c.name).filter(Boolean) : initial.sections?.certifications ?? []);
  const [experiences, setExperiences] = useState(() => experienceDrafts(initial));
  const [educations, setEducations] = useState(() => initial.educations ?? []);
  const [languages, setLanguages] = useState(() => initial.languages ?? []);
  const [projects, setProjects] = useState<CvProject[]>(() => projectDrafts(initial));
  const [skills, setSkills] = useState(() => initial.skills ?? initial.sections?.skills ?? []);
  const [skillInput, setSkillInput] = useState('');
  const save = useMutation({ mutationFn: () => careerApi.saveProfile({ ...fields,
    experience: serializeExperiences(experiences),
    education: educations.map(e => [`Diplôme: ${e.degree}`, `Domaine: ${e.field}`, `Établissement: ${e.institution}`, `Période: ${e.period}`].join('\n')).join('\n\n'),
    skills: skills.join('\n'), languages: languages.map(l => `${l.name} - ${l.level}`).join('\n'), certifications: certifications.join('\n'), projects: projects.map(p => [`Nom: ${p.name}`, `Description: ${p.description}`, p.githubUrl ? `GitHub: ${p.githubUrl}` : ''].filter(Boolean).join('\n')).join('\n\n'),
  }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['career-overview'] }); qc.invalidateQueries({ queryKey: ['career-profile-details'] }); toast.success(t('success')); }, onError: () => toast.error(t('error')) });
  const addSkill = () => { const value = skillInput.trim(); if (value && !skills.some(s => s.toLocaleLowerCase() === value.toLocaleLowerCase())) setSkills([...skills, value]); setSkillInput(''); };
  useEffect(() => { onRegisterSave?.(() => save.mutateAsync()); }, [onRegisterSave, save]);
  return <form className={`${panelClass} min-w-0 space-y-8`} onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    <div><h2 className="text-xl font-semibold">{t('reviewExtracted')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('extractedHelp')}</p></div>
    <section className="space-y-3"><h3 className="font-semibold">{t('summary')}</h3><Textarea className="min-h-36" value={fields.summary} onChange={e => setFields(f => ({ ...f, summary: e.target.value }))} placeholder={t('summary')} /></section>
    <ExperienceDraftEditor entries={experiences} onChange={setExperiences} />
    <section className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{t('education')}</h3><Button type="button" variant="outline" onClick={() => setEducations([...educations, { degree: '', field: '', institution: '', period: '' }])}>{t('addEducation')}</Button></div>
      {!educations.length && <p className="text-sm text-muted-foreground">{t('noData')}</p>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">{educations.map((entry, index) => <fieldset key={index} className="min-w-0 space-y-3 rounded-xl border p-4"><legend className="px-2 text-sm font-semibold">{t('education')} {index + 1}</legend><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Field label={t('educationDegree')}><Input className="min-w-0" value={entry.degree} onChange={e => setEducations(es => es.map((x, i) => i === index ? { ...x, degree: e.target.value } : x))} /></Field><Field label={t('educationField')}><Input className="min-w-0" value={entry.field} onChange={e => setEducations(es => es.map((x, i) => i === index ? { ...x, field: e.target.value } : x))} /></Field><Field label={t('educationInstitution')}><Input className="min-w-0" value={entry.institution} onChange={e => setEducations(es => es.map((x, i) => i === index ? { ...x, institution: e.target.value } : x))} /></Field><Field label={t('educationPeriod')}><Input className="min-w-0" value={entry.period} onChange={e => setEducations(es => es.map((x, i) => i === index ? { ...x, period: e.target.value } : x))} /></Field></div><Button type="button" variant="ghost" className="w-full justify-start px-0 text-left text-destructive" onClick={() => setEducations(es => es.filter((_, i) => i !== index))}>{t('removeEducation')}</Button></fieldset>)}</div>
    </section>
    <section className="space-y-3"><h3 className="font-semibold">{t('skills')}</h3><div className="flex flex-wrap gap-2">{skills.map((skill, index) => <button type="button" key={`${skill}-${index}`} className="rounded-full border bg-muted px-3 py-1.5 text-sm hover:border-destructive" onClick={() => setSkills(skills.filter((_, i) => i !== index))} aria-label={`${skill} — ${t('delete')}`}>{skill} ×</button>)}</div><div className="flex gap-2"><Input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} placeholder={t('comma')} /><Button type="button" variant="outline" onClick={addSkill}>+</Button></div></section>
    <section className="min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{t('languages')}</h3><Button type="button" variant="outline" onClick={() => setLanguages([...languages, { name: '', level: '' }])}>{t('addLanguage')}</Button></div><div className="grid min-w-0 gap-3 sm:grid-cols-2">{languages.map((entry, index) => <fieldset key={index} className="min-w-0 space-y-3 rounded-lg border p-3"><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Field label={t('languageName')}><Input className="min-w-0" value={entry.name} onChange={e => setLanguages(ls => ls.map((x, i) => i === index ? { ...x, name: e.target.value } : x))} /></Field><Field label={t('languageLevel')}><LanguageLevelSelect value={entry.level} onChange={level => setLanguages(ls => ls.map((x, i) => i === index ? { ...x, level } : x))} /></Field></div><Button type="button" variant="ghost" className="w-full justify-start whitespace-normal px-0 text-left text-destructive" onClick={() => setLanguages(ls => ls.filter((_, i) => i !== index))}>{t('removeLanguage')}</Button></fieldset>)}</div></section>
    <section className="min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{t('certifications')}</h3><Button type="button" variant="outline" onClick={() => setCertifications([...certifications, ''])}>{t('addCertification')}</Button></div>{certifications.length ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">{certifications.map((value, index) => <fieldset key={index} className="min-w-0 space-y-3 rounded-lg border p-3"><Field label={`${t('certification')} ${index + 1}`}><Textarea className="min-h-16 min-w-0 resize-y" value={value} onChange={e => setCertifications(cs => cs.map((x, i) => i === index ? e.target.value : x))} placeholder={t('certificationPlaceholder')} /></Field><Button type="button" variant="ghost" className="w-full justify-start whitespace-normal px-0 text-left text-destructive" onClick={() => setCertifications(cs => cs.filter((_, i) => i !== index))}>{t('removeCertification')}</Button></fieldset>)}</div> : <p className="text-sm text-muted-foreground">{t('noData')}</p>}</section>
    <section className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{t('projects')}</h3><Button type="button" variant="outline" onClick={() => setProjects(ps => [...ps, { name: '', description: '', githubUrl: '' }])}>{t('addProject')}</Button></div>{projects.length ? <div className="space-y-3">{projects.map((project, index) => <fieldset key={index} className="space-y-3 rounded-xl border p-4"><legend className="px-2 text-sm font-semibold">{t('projects')} {index + 1}</legend><Field label={t('projectName')}><Input value={project.name} onChange={e => setProjects(ps => ps.map((p, i) => i === index ? { ...p, name: e.target.value } : p))} /></Field><Field label={t('projectDescription')}><Textarea className="min-h-24" value={project.description} onChange={e => setProjects(ps => ps.map((p, i) => i === index ? { ...p, description: e.target.value } : p))} /></Field><Field label={t('githubLink')}><Input type="url" placeholder="https://github.com/" value={project.githubUrl} onChange={e => setProjects(ps => ps.map((p, i) => i === index ? { ...p, githubUrl: e.target.value } : p))} /></Field><Button type="button" variant="ghost" className="text-destructive" onClick={() => setProjects(ps => ps.filter((_, i) => i !== index))}>{t('removeProject')}</Button></fieldset>)}</div> : <p className="text-sm text-muted-foreground">{t('noData')}</p>}</section>
    <Button disabled={save.isPending}>{t('save')}</Button>
  </form>;
}export function CvBuilder() {
  const t = useCareerText(); return <CareerFrame title={t('builder')} description={t('builderHelp')}><FeatureGate feature="career.builder"><BuilderContent /></FeatureGate></CareerFrame>;
}
function BuilderContent() {
  const t = useCareerText(), qc = useQueryClient();
  const [mode, setMode] = useState('profile'), [title, setTitle] = useState(''), [jobId, setJobId] = useState(''), [resumeId, setResumeId] = useState(''), [active, setActive] = useState<Draft | null>(null);
  const drafts = useQuery({ queryKey: ['career-drafts'], queryFn: careerApi.drafts });
  const jobs = useQuery({ queryKey: ['career-jobs-picker'], queryFn: () => careerApi.jobs({ limit: 50 }) });
  const cvs = useQuery({ queryKey: ['resumes'], queryFn: resumesApi.list });
  const generate = useMutation({ mutationFn: () => careerApi.build({ title, mode, jobId: jobId || undefined, resumeId: resumeId || undefined }), onSuccess: d => { setActive(d); qc.invalidateQueries({ queryKey: ['career-drafts'] }); }, onError: () => toast.error(t('error')) });
  return <><form className={`${panelClass} grid gap-4 sm:grid-cols-2`} onSubmit={e => { e.preventDefault(); generate.mutate(); }}><Field label={t('title')}><Input required minLength={2} maxLength={150} value={title} onChange={e => setTitle(e.target.value)} /></Field><Field label={t('generate')}><select value={mode} onChange={e => setMode(e.target.value)} className={selectClass}><option value="profile">{t('fromProfile')}</option><option value="optimize">{t('optimize')}</option><option value="tailor">{t('tailor')}</option></select></Field><Field label={t('cvs')}><select className={selectClass} value={resumeId} onChange={e => setResumeId(e.target.value)}><option value="">{t('primary')}</option>{cvs.data?.map(r => <option key={r.id} value={r.id}>{r.filename}</option>)}</select></Field><Field label={t('targetJob')}><select className={selectClass} required={mode === 'tailor'} value={jobId} onChange={e => setJobId(e.target.value)}><option value="">—</option>{jobs.data?.items.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></Field><Button disabled={generate.isPending} type="submit">{generate.isPending ? t('PROCESSING') : t('generate')}</Button></form>
    {drafts.isError && <Failure retry={() => drafts.refetch()} />}
    {!!drafts.data?.length && <Field label={t('history')}><select className={selectClass} value={active?.id || ''} onChange={e => setActive(drafts.data?.find(d => d.id === e.target.value) || null)}><option value="">—</option>{drafts.data.map(d => <option key={d.id} value={d.id}>{d.title} · {t(d.approvedAt ? 'approved' : 'draft')}</option>)}</select></Field>}
    {active && <DraftEditor key={`${active.id}-${active.approvedAt || ''}`} draft={active} onSaved={setActive} />}
  </>;
}
function DraftEditor({ draft, onSaved }: { draft: Draft; onSaved: (draft: Draft) => void }) {
  const t = useCareerText(), qc = useQueryClient(); const [sectionIndex, setSectionIndex] = useState(0), [template, setTemplate] = useState('classic'), [content, setContent] = useState(draft.content), [approve, setApprove] = useState(false), [preview, setPreview] = useState(false);
  const save = useMutation({ mutationFn: () => careerApi.saveDraft(draft.id, { content, approve }), onSuccess: d => { onSaved(d); qc.invalidateQueries({ queryKey: ['career-drafts'] }); toast.success(t('success')); }, onError: () => toast.error(t('error')) });
  const regenerate = useMutation({ mutationFn: () => careerApi.regenerateSection(draft.id, { content, sectionIndex }), onSuccess: r => { setContent(r.content); setApprove(false); toast.success(t('sectionReview')); }, onError: () => toast.error(t('error')) });
  const publish = useMutation({ mutationFn: () => careerApi.publish(draft.id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['resumes'] }); toast.success(t('success')); }, onError: () => toast.error(t('error')) });
  return <section className={`${panelClass} space-y-4`}><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">{draft.title}</h2><p className="text-sm">{t('before')}: {draft.beforeScore ?? '—'} → {t('after')}: {draft.afterScore ?? '—'}</p></div><p className="text-xs text-muted-foreground">{t('scoreNote')}</p><div className="flex gap-2"><Button variant="outline" onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'preview')}</Button><Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' })); const a = document.createElement('a'); a.href = url; a.download = `${draft.title.replace(/[^\p{L}\p{N}_-]/gu, '_')}.md`; a.click(); URL.revokeObjectURL(url); }}>{t('download')}</Button></div>{preview ? <div className="space-y-4"><Button variant="outline" onClick={() => window.print()}>{t('print')}</Button><Field label={t('template')}><select className={selectClass} value={template} onChange={e => setTemplate(e.target.value)}>{['classic', 'modern', 'compact'].map(k => <option key={k} value={k}>{t(`${k}Template`)}</option>)}</select></Field><CvPreview content={content} template={template} /></div> : <Textarea className="min-h-96 font-mono text-sm" value={content} maxLength={50000} onChange={e => { setContent(e.target.value); setApprove(false); }} />}<div className="flex flex-wrap items-end gap-3"><Field label={t('selectSection')}><select className={selectClass} value={sectionIndex} onChange={e => setSectionIndex(Number(e.target.value))}>{content.split(/(?=^## )/m).map((section, i) => <option key={i} value={i}>{section.split('\n')[0].replace(/^#+ /, '').slice(0, 80) || String(i + 1)}</option>)}</select></Field><Button variant="outline" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>{regenerate.isPending ? t('PROCESSING') : t('regenerateSection')}</Button></div><p className="text-xs text-muted-foreground">{t('sectionReview')}</p><p className="text-sm text-muted-foreground">{t('missingKeywords')}: {draft.keywords.join(', ') || '—'}</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={approve} onChange={e => setApprove(e.target.checked)} />{t('approve')}</label><div className="flex flex-wrap gap-2"><Button disabled={save.isPending} onClick={() => save.mutate()}>{t('save')}</Button><Button variant="outline" disabled={!draft.approvedAt || content !== draft.content || publish.isPending} onClick={() => publish.mutate()}>{t('publish')}</Button></div></section>;
}
export function CareerPreferences({ auto = false }: { auto?: boolean }) {
  const t = useCareerText(); const settings = useQuery({ queryKey: ['career-settings'], queryFn: careerApi.settings });
  // Settings remain accessible after downgrade so opt-in can always be disabled.
  return <CareerFrame title={t(auto ? 'auto' : 'alerts')} description={t(auto ? 'autoHelp' : 'requiresPro')}>{settings.isPending ? <Busy /> : settings.isError ? <Failure retry={() => settings.refetch()} /> : <PreferencesForm initial={settings.data} auto={auto} />}{auto && <AutoApplyStats />}<CareerHistory /></CareerFrame>;
}
function PreferencesForm({ initial, auto }: { initial: CareerSettings; auto: boolean }) {
  const t = useCareerText(), ent = useEntitlement('CANDIDATE'), qc = useQueryClient(); const [value, setValue] = useState(initial), [consent, setConsent] = useState(false);
  const [domains, setDomains] = useState(initial.domains.join(', ')), [locations, setLocations] = useState(initial.locations.join(', '));
  const drafts = useQuery({ queryKey: ['career-drafts'], queryFn: careerApi.drafts });
  const facets = useQuery({ queryKey: ['career-facets'], queryFn: careerApi.facets });
  const allowed = ent.feature(auto ? 'career.auto_apply' : 'career.alerts') === true;
  const save = useMutation({ mutationFn: () => careerApi.saveSettings({ domains: split(domains), locations: split(locations), workModes: value.workModes, employmentTypes: value.employmentTypes ?? [], contractTypes: value.contractTypes ?? [], minimumSalary: value.minimumSalary ?? null, salaryCurrency: value.salaryCurrency || 'USD', excludedJobs: value.excludedJobs ?? [],
    ...(auto ? { autoApply: value.autoApply, autoMinimumScore: value.autoMinimumScore, maxPerDay: value.maxPerDay, excludedCompanies: value.excludedCompanies, excludedJobTypes: value.excludedJobTypes, approvedDraftId: value.approvedDraftId || undefined, consent } : { emailAlerts: value.emailAlerts, frequency: value.frequency, minimumScore: value.minimumScore }) }),
    onSuccess: r => { setValue(r); setConsent(false); qc.invalidateQueries({ queryKey: ['career-settings'] }); toast.success(t('success')); }, onError: () => toast.error(t('error')) });
  const toggle = (key: 'contractTypes' | 'workModes' | 'excludedCompanies' | 'excludedJobTypes' | 'employmentTypes' | 'excludedJobs', option: string) => setValue(v => ({ ...v, [key]: (v[key] ?? []).includes(option) ? (v[key] ?? []).filter(k => k !== option) : [...(v[key] ?? []), option] }));
  return <form className={`${panelClass} space-y-6`} onSubmit={e => { e.preventDefault(); save.mutate(); }}>{!allowed && <p className="text-sm text-indigo-600 dark:text-indigo-300">{t(auto ? 'requiresCareer' : 'requiresPro')} · <Link href="/candidate/subscription" className="underline">{t('upgrade')}</Link></p>}<label className="flex items-center gap-3 font-medium"><input type="checkbox" checked={auto ? value.autoApply : value.emailAlerts} disabled={!allowed && !(auto ? value.autoApply : value.emailAlerts)} onChange={e => setValue(v => ({ ...v, [auto ? 'autoApply' : 'emailAlerts']: e.target.checked }))} />{t(auto ? 'enableAuto' : 'emailAlerts')}</label><div className="grid gap-4 md:grid-cols-2"><Field label={t('domain')}><Input value={domains} onChange={e => setDomains(e.target.value)} placeholder={t('comma')} /></Field><Field label={t('location')}><Input value={locations} onChange={e => setLocations(e.target.value)} placeholder={t('comma')} /></Field><Field label={t('minimumScore')}>{auto ? <Input type="number" min={0} max={100} required value={value.autoMinimumScore} onChange={e => setValue(v => ({ ...v, autoMinimumScore: Number(e.target.value) }))} /> : <Input type="number" min={0} max={100} value={value.minimumScore} onChange={e => setValue(v => ({ ...v, minimumScore: Number(e.target.value) }))} />}</Field>{auto ? <Field label={t('maxPerDay')}><Input type="number" min={1} max={20} value={value.maxPerDay} onChange={e => setValue(v => ({ ...v, maxPerDay: Number(e.target.value) }))} /></Field> : <Field label={t('frequency')}><select className={selectClass} value={value.frequency} onChange={e => setValue(v => ({ ...v, frequency: e.target.value }))}>{['INSTANT', 'DAILY', 'WEEKLY'].map(v => <option key={v} value={v}>{t(v)}</option>)}</select></Field>}</div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label={t('minimumSalary')}><Input type="number" min={0} value={value.minimumSalary ?? ''} onChange={e => setValue(v => ({ ...v, minimumSalary: e.target.value === '' ? null : Number(e.target.value) }))} /></Field><Field label={t('salaryCurrency')}><select className={selectClass} value={value.salaryCurrency || 'USD'} onChange={e => setValue(v => ({ ...v, salaryCurrency: e.target.value }))}>{['USD', 'EUR', 'TND', 'GBP', 'CAD'].map(c => <option key={c}>{c}</option>)}</select></Field></div><p className="text-xs text-muted-foreground">{t('salaryPreferenceHelp')}</p><fieldset><legend className="mb-3 text-sm font-medium">{t('contractType')}</legend><div className="flex gap-4">{['CDI','CDD'].map(k => <label key={k} className="flex gap-2 text-sm"><input type="checkbox" checked={(value.contractTypes ?? []).includes(k)} onChange={() => toggle('contractTypes', k)} />{t(k)}</label>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-medium">{t('allowedTypes')}</legend><div className="flex flex-wrap gap-4">{TYPES.map(k => <label key={k} className="flex gap-2 text-sm"><input type="checkbox" checked={(value.employmentTypes ?? []).includes(k)} onChange={() => toggle('employmentTypes', k)} />{t(k)}</label>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-medium">{t('workMode')}</legend><div className="flex flex-wrap gap-5">{MODES.map(m => <label key={m} className="flex gap-2 text-sm"><input type="checkbox" checked={value.workModes.includes(m)} onChange={() => toggle('workModes', m)} />{t(m)}</label>)}</div></fieldset>
    {auto && <><JobExclusions selected={value.excludedJobs ?? []} onToggle={id => toggle('excludedJobs', id)} /><Field label={t('reviewedCv')}><select className={selectClass} value={value.approvedDraftId || ''} onChange={e => setValue(v => ({ ...v, approvedDraftId: e.target.value }))}><option value="">—</option>{drafts.data?.filter(d => d.approvedAt).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field><Link className="text-sm text-indigo-600 underline" href="/candidate/cv-builder">{t('builder')}</Link><fieldset><legend className="mb-3 text-sm font-medium">{t('excludedCompanies')}</legend><div className="flex flex-wrap gap-4">{facets.data?.companies.map(c => <label key={c.id} className="flex gap-2 text-sm"><input type="checkbox" checked={value.excludedCompanies.includes(c.id)} onChange={() => toggle('excludedCompanies', c.id)} />{c.name}</label>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-medium">{t('excludedTypes')}</legend><div className="flex flex-wrap gap-4">{TYPES.map(k => <label key={k} className="flex gap-2 text-sm"><input type="checkbox" checked={value.excludedJobTypes.includes(k)} onChange={() => toggle('excludedJobTypes', k)} />{t(k)}</label>)}</div></fieldset>{value.autoApply && <label className="flex gap-3 rounded-xl bg-muted p-4 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t('autoConsent')}</label>}</>}
    <Button disabled={save.isPending || auto && value.autoApply && !initial.autoApply && !consent}>{t('save')}</Button>
  </form>;
}
function AutoApplyStats() {
  const t = useCareerText();
  const query = useQuery({ queryKey: ['career-auto-stats'], queryFn: careerApi.autoStats, refetchInterval: 30000 });
  return query.isPending ? <Busy /> : query.isError ? <Failure retry={() => query.refetch()} /> : <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(query.data).map(([key, value]) => <div key={key} className={panelClass}><p className="text-xs text-muted-foreground">{t(key)}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value == null ? '—' : key === 'averageMatch' ? Math.round(value) + '%' : value}</p></div>)}</section>;
}
function CareerHistory() {
  const t = useCareerText(); const q = useQuery({ queryKey: ['career-history'], queryFn: careerApi.history });
  return <section className={panelClass}><h2 className="mb-4 text-xl font-semibold">{t('history')}</h2>{q.isPending ? <Busy /> : q.isError ? <Failure retry={() => q.refetch()} /> : q.data.length ? <div className="divide-y">{q.data.map(d => <div key={d.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="font-medium">{d.job?.title || '—'}</p><p className="text-sm text-muted-foreground">{d.job?.company.commercialName} · {t(d.kind)} · {new Date(d.createdAt).toLocaleString()}</p>{d.reason && <p className="text-xs text-muted-foreground">{t(d.reason)}</p>}</div><p className="text-sm">{d.matchScore ?? '—'}% · {t(d.status)}</p></div>)}</div> : <p className="text-sm text-muted-foreground">{t('noData')}</p>}</section>;
}
export function CandidatePlans() {
  const t = useCareerText(), qc = useQueryClient(), ent = useEntitlement('CANDIDATE'); const [country, setCountry] = useState('TN');
  const plans = useQuery({ queryKey: ['candidate-plans'], queryFn: () => billingApi.plans('CANDIDATE') });
  const current = useQuery({ queryKey: ['subscription-me', 'CANDIDATE', undefined], queryFn: () => billingApi.currentSubscription('CANDIDATE') });
  const checkout = useMutation({ mutationFn: (planId: string) => billingApi.checkout({ planId, ownerType: 'CANDIDATE', billingCountry: country }), onSuccess: r => { window.location.assign(r.checkoutUrl); }, onError: () => toast.error(t('error')) });
  const cancel = useMutation({ mutationFn: (id: string) => billingApi.cancel({ subscriptionId: id }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscription-me'] }); toast.success(t('success')); }, onError: () => toast.error(t('error')) });
  return <CareerFrame title={t('subscription')} description={`${t('currentPlan')}: ${t(ent.planName)}`}><div className="max-w-sm"><Field label={t('billingCountry')}><Input maxLength={2} value={country} onChange={e => setCountry(e.target.value.toUpperCase())} /></Field></div>{plans.isPending ? <Busy /> : plans.isError ? <Failure retry={() => plans.refetch()} /> : <div className="grid gap-4 lg:grid-cols-3">{plans.data.map(p => <PlanCard key={p.id} plan={p} country={country} current={ent.planName} busy={checkout.isPending} checkout={() => checkout.mutate(p.id)} />)}</div>}{current.data?.subscription?.id && <Button variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(current.data!.subscription!.id)}>{t('cancelPlan')}</Button>}</CareerFrame>;
}


function PlanCard({ plan: p, country, current, busy, checkout }: { plan: import('@/types/api').Plan; country: string; current: string; busy: boolean; checkout: () => void }) {
  const t = useCareerText(), { locale } = useI18n();
  const quote = useQuery({ queryKey: ['career-price', p.id, country], queryFn: () => billingApi.quote(p.id, country), enabled: p.priceCents > 0 && country.length === 2, retry: false });
  return <section className={`${panelClass} flex flex-col gap-4 ${p.name === 'PRO' ? 'border-indigo-500' : ''}`}>
    <h2 className="text-xl font-semibold">{t(p.name)}</h2>
    <p className="text-3xl font-semibold">{formatMoney(quote.data?.amountCents ?? p.priceCents, quote.data?.currency ?? p.currency, locale)} <span className="text-sm text-muted-foreground">/ {t(p.billingInterval)}</span></p>
    {quote.isError && <p className="text-sm text-muted-foreground">{t('pricingUnavailable')}</p>}
    <p className="text-sm text-muted-foreground">{t(p.name === 'FREE' ? 'freeFeatures' : p.name === 'PRO' ? 'proFeatures' : 'careerFeatures')}</p>
    <p className="text-sm">{t('cvs')}: {String(p.features['cv.uploads'] ?? '—')}</p>
    {p.priceCents > 0 && p.name !== current && <Button className="mt-auto" disabled={busy || !quote.data} onClick={checkout}>{t('upgrade')}</Button>}
    {p.name === current && <span className="mt-auto text-sm text-indigo-600">{t('currentPlan')}</span>}
  </section>;
}



