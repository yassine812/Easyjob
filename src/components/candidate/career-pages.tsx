'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { EasyJobLoader } from '@/components/ui/easyjob-loader';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, Building2, Check, ChevronDown, Crown, FileCheck2, Filter, Laptop, Loader2, Lock, MapPin, Minus, Search, Tags, WalletCards, Wifi, X } from 'lucide-react';
import { LanguageLevelSelect } from './language-level-select';
import { ExperienceDraftEditor, experienceDrafts, serializeExperiences } from './extracted-profile';
import { JobExclusions } from './job-exclusions';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { Textarea } from '@/components/ui/textarea';
import { careerApi, type CareerSettings, type CvProject, type ProfileDetails } from '@/lib/api/career';
import { resumesApi } from '@/lib/api/resumes';
import { formatMoney } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { billingApi } from '@/lib/api/billing';
import { useEntitlement } from '@/hooks/use-entitlement';
import { useCareerText } from '@/lib/i18n/career';
import { useUxText } from '@/lib/i18n/ux';
import { useReleaseText } from '@/lib/i18n/release';
import { useAtsText } from '@/lib/i18n/ats';
import { AtsPanel, Busy, CareerFrame, CvUpload, Failure, Field, JobCard, panelClass, selectClass } from './career-shared';
import { atsScoreTone } from './ats-report';
import { CvPdfViewer } from './cv-pdf-viewer';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { DashboardOverview } from './dashboard-overview';
import type { Plan } from '@/types/api';

const TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'];
const MODES = ['REMOTE', 'HYBRID', 'ONSITE'];
const split = (value: string) => [...new Set(value.split(/[,،]/).map(v => v.trim()).filter(Boolean))];
const cleanLineBreaks = (value: string) => value.replace(/\\n/g, '\n');
export function CareerDashboard() {
  const t = useCareerText(); const q = useQuery({ queryKey: ['career-overview'], queryFn: careerApi.overview });
  return <CareerFrame title={t('dashboard')} description={t('dashboardSubtitle')} actions={<Button asChild><Link href="/candidate/jobs">{t('find')} </Link></Button>} showFindJob={false}>{q.isPending ? <Busy /> : q.isError ? <Failure retry={() => q.refetch()} /> : <DashboardOverview data={q.data} />}</CareerFrame>;
}
export function FindJobs({ recommended = false }: { recommended?: boolean }) {
  const t = useCareerText(), ux = useUxText();
  const defaultSort = recommended ? 'match' : 'newest';
  const [form, setForm] = useState<Record<string, string>>({ sort: defaultSort });
  const [query, setQuery] = useState<Record<string, string | number>>({ sort: defaultSort, page: 1 });
  const [minimumMatch, setMinimumMatch] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const facets = useQuery({ queryKey: ['career-facets'], queryFn: careerApi.facets });
  const results = useQuery({
    queryKey: ['career-jobs', recommended, query],
    queryFn: ({ signal }) => careerApi.jobs(query, recommended, signal),
    enabled: true,
    retry: false,
  });
  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  useEffect(() => {
    if (minimumMatch > 0) setQuery(q => q.minimumScore == null ? { ...q, minimumScore: minimumMatch, page: 1 } : q);
    else setQuery(q => { if (q.minimumScore == null) return q; const { minimumScore: _minimumScore, ...rest } = q; return { ...rest, page: 1 }; });
  }, [minimumMatch]);
  const select = (key: string, values: string[], label = key) => <Field label={t(label)}><select className="h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" value={form[key] || ''} onChange={e => update(key, e.target.value)}><option value="">{t('all')}</option>{values.map(v => <option key={v} value={v}>{t(v)}</option>)}</select></Field>;
  const [skillDraft, setSkillDraft] = useState('');
  const skills = (form.skills || '').split(/[,،\n]/).map(value => value.trim()).filter(Boolean);
  const setSkills = (values: string[]) => update('skills', [...new Set(values.map(value => value.trim()).filter(Boolean))].join(', '));
  const addSkills = (value: string) => { const incoming = value.split(/[,،\n]/).map(item => item.trim()).filter(Boolean); if (!incoming.length) return; setSkills([...skills, ...incoming]); setSkillDraft(''); };
  const salaryRangeInvalid = !!form.salaryMin && !!form.salaryMax && Number(form.salaryMin) > Number(form.salaryMax);
  const applySearch = () => { if (salaryRangeInvalid) return; setQuery({ ...form, page: 1, ...(minimumMatch > 0 ? { minimumScore: minimumMatch } : {}) }); setFiltersOpen(false); };
  const resetFilters = () => { setMinimumMatch(0); setForm({ sort: defaultSort }); setQuery({ page: 1, sort: defaultSort }); };
  const selectedCompany = facets.data?.companies.find(company => company.id === form.companyId)?.name;
  const filterEntries = [
    ['keyword', t('keyword'), form.keyword], ['location', t('location'), form.location], ['company', t('companyName'), form.company], ['companyId', t('company'), selectedCompany || form.companyId], ['source', t('source'), form.source ? t(form.source) : ''], ['domain', t('domain'), form.domain], ['contractType', t('contractType'), form.contractType ? t(form.contractType) : ''], ['employmentType', t('jobType'), form.employmentType ? t(form.employmentType) : ''], ['experienceLevel', t('experience'), form.experienceLevel ? t(form.experienceLevel) : ''], ['workMode', t('workMode'), form.workMode ? t(form.workMode) : ''], ['salaryMin', t('salaryMin'), form.salaryMin], ['salaryMax', t('salaryMax'), form.salaryMax], ['currency', t('salaryCurrency'), form.currency], ['skills', t('skills'), skills.join(', ')], ['publishedWithin', t('publishedWithin'), form.publishedWithin ? t(`days${form.publishedWithin}`) : ''], ['sort', t('sort'), form.sort && form.sort !== defaultSort ? t(form.sort) : ''],
  ].filter(([, , value]) => Boolean(value));
  const clearFilter = (key: string) => update(key, '');
  const workModeOptions = [{ value: 'REMOTE', label: t('remote'), icon: Wifi }, { value: 'HYBRID', label: t('hybrid'), icon: Laptop }, { value: 'ONSITE', label: t('onsite'), icon: Building2 }];
  const searchLabel = results.data ? `${t('search')} ${results.data.total}` : t('search');
  const section = (title: string, count: number, children: ReactNode, icon?: ReactNode) => <details open className="group/filter rounded-2xl border border-border/70 bg-card/35 px-4 py-1.5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2">{icon}<span>{title}</span>{count > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{count}</span>}</span><ChevronDown className="size-4 text-muted-foreground transition-transform group-open/filter:rotate-180" /></summary><div className="space-y-4 pb-4 pt-2">{children}</div></details>;
  const advancedFilters = <div className="space-y-3">
    {filterEntries.length > 0 && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('activeFilters')}</p><button type="button" className="text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={resetFilters}>{t('clearAll')}</button></div><div className="flex flex-wrap gap-2">{filterEntries.map(([key, label, value]) => <button type="button" key={key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-background/70 px-2.5 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/10" onClick={() => clearFilter(key)}><span className="truncate">{label}: {value}</span><X className="size-3 shrink-0" aria-hidden="true" /></button>)}</div></div>}
    {section(t('searchSection'), filterEntries.filter(([key]) => ['keyword', 'location', 'company'].includes(key)).length, <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm font-medium"><span>{t('keyword')}</span><InputWithIcon icon={<Search className="size-4" />} className="h-10 rounded-xl transition-colors hover:border-primary/50 focus-visible:border-primary" value={form.keyword || ''} onChange={e => update('keyword', e.target.value)} /></label>
      <label className="flex flex-col gap-2 text-sm font-medium"><span>{t('location')}</span><InputWithIcon icon={<MapPin className="size-4" />} className="h-10 rounded-xl transition-colors hover:border-primary/50 focus-visible:border-primary" value={form.location || ''} onChange={e => update('location', e.target.value)} /></label>
      <label className="flex flex-col gap-2 text-sm font-medium"><span>{t('companyName')}</span><InputWithIcon icon={<Building2 className="size-4" />} className="h-10 rounded-xl transition-colors hover:border-primary/50 focus-visible:border-primary" value={form.company || ''} onChange={e => update('company', e.target.value)} /></label>
    </div>, <Search className="size-4 text-primary" />)}
    {section(t('offerSection'), filterEntries.filter(([key]) => ['companyId', 'source', 'domain', 'contractType', 'employmentType'].includes(key)).length, <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('company')}><select className={selectClass} value={form.companyId || ''} onChange={e => update('companyId', e.target.value)}><option value="">{t('all')}</option>{facets.data?.companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></Field>
      <Field label={t('source')}><select className={selectClass} value={form.source || ''} onChange={e => update('source', e.target.value)}><option value="">{t('all')}</option>{(results.data?.sources || []).filter(source => source.enabled).map(source => <option value={source.type} key={source.type}>{source.name}</option>)}</select></Field>
      {select('domain', facets.data?.domains || [])}{select('contractType', ['CDI', 'CDD'], 'contractType')}{select('employmentType', TYPES, 'jobType')}
    </div>, <Building2 className="size-4 text-primary" />)}
    {section(t('conditionsSection'), filterEntries.filter(([key]) => ['workMode', 'experienceLevel', 'salaryMin', 'salaryMax', 'currency'].includes(key)).length, <div className="space-y-4">
      <div><p className="mb-2 text-sm font-medium">{t('workMode')}</p><div className="grid gap-2 sm:grid-cols-3">{workModeOptions.map(({ value, label, icon: Icon }) => <button type="button" key={value} aria-pressed={form.workMode === value} onClick={() => update('workMode', form.workMode === value ? '' : value)} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${form.workMode === value ? 'border-primary bg-primary/12 text-primary shadow-sm' : 'border-border/70 bg-background/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}><Icon className="size-4" />{label}</button>)}</div></div>
      {select('experienceLevel', ['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'], 'experience')}
      <div><div className="mb-2 flex items-center gap-2 text-sm font-medium"><WalletCards className="size-4 text-muted-foreground" />{t('salaryRange')}</div><div className="grid grid-cols-2 gap-2"><Input aria-label={t('salaryMin')} min={0} type="number" placeholder={t('minimumPlaceholder')} value={form.salaryMin || ''} onChange={e => update('salaryMin', e.target.value)} /><Input aria-label={t('salaryMax')} min={0} type="number" placeholder={t('maximumPlaceholder')} value={form.salaryMax || ''} onChange={e => update('salaryMax', e.target.value)} /></div>{salaryRangeInvalid && <p role="alert" className="mt-2 text-xs text-destructive">{t('salaryRangeInvalid')}</p>}</div>
      <Field label={t('salaryCurrency')}><select className={selectClass} value={form.currency || ''} onChange={e => update('currency', e.target.value)}><option value="">{t('all')}</option><option value="TND">TND</option></select></Field>
    </div>, <WalletCards className="size-4 text-primary" />)}
    {section(t('skillsSection'), skills.length, <div><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Tags className="size-4 text-muted-foreground" />{t('skills')}</div><div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-input bg-background/50 p-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">{skills.map((skill, index) => <span key={`${skill}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">{skill}<button type="button" aria-label={`${t('delete')} ${skill}`} onClick={() => setSkills(skills.filter((_, skillIndex) => skillIndex !== index))}><X className="size-3" /></button></span>)}<input className="min-w-28 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground" value={skillDraft} onChange={e => setSkillDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkills(skillDraft); } }} onBlur={() => addSkills(skillDraft)} placeholder={t('addSkill')} /></div><p className="mt-2 text-xs text-muted-foreground">{t('skillsHelp')}</p></div>, <Tags className="size-4 text-primary" />)}
    {section(t('dateSortSection'), filterEntries.filter(([key]) => ['publishedWithin', 'sort'].includes(key)).length, <div className="grid gap-4 sm:grid-cols-2"><Field label={t('publishedWithin')}><select className={selectClass} value={form.publishedWithin || ''} onChange={e => update('publishedWithin', e.target.value)}><option value="">{t('all')}</option>{[1, 7, 14, 30].map(days => <option value={days} key={days}>{t(`days${days}`)}</option>)}</select></Field>{select('sort', ['relevance', 'newest', 'salaryHigh', 'salaryLow', 'match'])}</div>, <ChevronDown className="size-4 text-primary" />)}
    {section(t('profileSection'), 0, <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-cyan-500/5 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary"><EasyJobFeatureMark size="sm" className="" /></span><div><h3 className="font-semibold">{t('calibratedProfile')}</h3><p className="text-xs text-muted-foreground">{t('calibratedProfileHelp')}</p></div></div><span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">{t('active')}</span></div><div className="mt-5"><div className="flex items-center justify-between text-sm font-medium"><span>{t('minimumAiMatch')}</span><span className="text-primary">{minimumMatch}%+</span></div><input aria-label={t('minimumAiMatch')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={minimumMatch} type="range" min="0" max="100" step="1" value={minimumMatch} onChange={e => { const value = Number(e.target.value); setMinimumMatch(value); setQuery(q => value > 0 ? { ...q, minimumScore: value, page: 1 } : (() => { const { minimumScore: _minimumScore, ...rest } = q; return { ...rest, page: 1 }; })()); }} className="mt-3 h-2 w-full cursor-pointer accent-primary" /></div><div className="mt-5"><p className="mb-2 text-sm font-medium">{t('salaryRange')} <span className="text-xs font-normal text-muted-foreground">(TND)</span></p><div className="grid grid-cols-2 gap-2"><Input aria-label={`${t('salaryMin')} TND`} min={0} type="number" placeholder={t('minimumPlaceholder')} value={form.salaryMin || ''} onChange={e => update('salaryMin', e.target.value)} /><Input aria-label={`${t('salaryMax')} TND`} min={0} type="number" placeholder={t('maximumPlaceholder')} value={form.salaryMax || ''} onChange={e => update('salaryMax', e.target.value)} /></div></div><div className="mt-5"><p className="mb-2 text-sm font-medium">{t('workMode')}</p><div className="grid gap-2 sm:grid-cols-3">{workModeOptions.map(({ value, label, icon: Icon }) => <button type="button" key={`profile-${value}`} aria-pressed={form.workMode === value} onClick={() => update('workMode', form.workMode === value ? '' : value)} className={`rounded-lg border px-2 py-2 text-xs transition-colors ${form.workMode === value ? 'border-primary bg-primary/12 text-primary' : 'border-border/70 bg-background/30 text-muted-foreground hover:border-primary/50'}`}><Icon className="mx-auto mb-1 size-3.5" />{label}</button>)}</div></div><Button asChild variant="outline" className="mt-5 w-full border-primary/30 hover:border-primary"><Link href="/candidate/alerts">{t('createAlert')}</Link></Button></div>, <EasyJobFeatureMark size="sm" className=" text-primary" />)}
  </div>;
  const visibleJobs = results.data?.items ?? [];
  const body = <>
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      <div className="sticky top-2 z-20 flex justify-end py-1"><SheetTrigger asChild><Button type="button" variant="outline" className="rounded-full bg-card/95 shadow-lg backdrop-blur"><Filter className="me-2 size-4" />{t('filterButton')}</Button></SheetTrigger></div>
      <SheetContent side="right" className="flex w-[min(92vw,28rem)] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b px-6 py-5 text-start"><SheetTitle className="flex items-center gap-2">{t('filterPanelTitle')}{filterEntries.length > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{filterEntries.length}</span>}</SheetTitle><SheetDescription>{t('filtersDescription')}</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{advancedFilters}</div>
        <SheetFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-popover/95 px-6 py-4 backdrop-blur sm:flex-row"><Button type="button" className="flex-1" disabled={salaryRangeInvalid} onClick={applySearch}>{searchLabel}</Button><Button type="button" variant="outline" onClick={resetFilters}>{t('reset')}</Button></SheetFooter>
      </SheetContent>
    </Sheet>
    <details className="sr-only"><summary>{ux('filters')}</summary><select aria-label={t('salaryCurrency')} defaultValue=""><option value="">{t('all')}</option><option value="TND">TND</option></select><select aria-label={t('sort')} defaultValue="match"><option value="match">{t('match')}</option></select></details>
    <section className="min-w-0 space-y-4">
        {results.isPending ? <Busy /> : results.isError ? <Failure retry={() => results.refetch()} /> : visibleJobs.length ? <><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{results.data.total} {t('jobsFound')}</p></div><div className="space-y-4">{visibleJobs.map(j => <JobCard key={j.id} job={j} showMatchScore />)}</div><div className="flex flex-wrap items-center justify-center gap-2"><Button variant="outline" disabled={results.data.page <= 1} onClick={() => setQuery(q => ({ ...q, page: Number(q.page || 1) - 1 }))}>{t('previous')}</Button>{Array.from({ length: Math.min(5, Math.ceil(results.data.total / results.data.limit)) }, (_, index) => { const totalPages = Math.ceil(results.data.total / results.data.limit); const first = Math.min(Math.max(results.data.page - 2, 1), Math.max(totalPages - 4, 1)); return first + index; }).filter((page, index, pages) => pages.indexOf(page) === index).map(page => <Button key={page} variant={page === results.data.page ? 'default' : 'outline'} onClick={() => setQuery(q => ({ ...q, page }))}>{page}</Button>)}<Button variant="outline" disabled={results.data.page * results.data.limit >= results.data.total} onClick={() => setQuery(q => ({ ...q, page: Number(q.page || 1) + 1 }))}>{t('next')}</Button></div></> : results.data.items.length > 0 ? null : <p className={panelClass}>{t(recommended ? 'emptyRecommendations' : 'emptyJobs')}</p>}
      </section>
  </>;
  return <CareerFrame showFindJob={false} title={t(recommended ? 'recommended' : 'find')} description={t(recommended ? 'why' : 'catalogueDescription')} actions={recommended && <Button asChild variant="outline"><Link href="/candidate/alerts">{t('alerts')}</Link></Button>}>{body}</CareerFrame>;
}

function CvAtsSummary({ report }: { report: import('@/lib/api/career').AtsReport }) {
  const t = useCareerText(), tr = useReleaseText();
  const score = report.score, tone = score === null ? undefined : atsScoreTone(score);
  return <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-3" aria-label={tr('Score ATS du CV', 'CV ATS score', 'نتيجة ATS للسيرة')}>
    <div className="flex items-center gap-4"><span className={`text-3xl font-semibold tabular-nums ${tone?.value ?? ''}`}>{score ?? '—'}<small className="text-sm text-muted-foreground">/100</small></span><div><h2 className="text-sm font-semibold">{tr('Score ATS du CV', 'CV ATS score', 'نتيجة ATS للسيرة')}</h2><p className="text-xs text-muted-foreground">{tr('Explore les passages surlignés avec ton coach.', 'Explore highlighted passages with your coach.', 'شوف النصوص الملوّنة مع المدرّب.')}</p></div></div>
    <Link href="/candidate/cvs" className="text-sm text-primary underline underline-offset-4">{t('ats')}</Link>
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
      {analysisOnly && <div className="max-w-xl"><Field label={t('targetJob')}><select ref={targetSelect} className={selectClass} value={jobId} disabled={jobs.isPending || jobs.isError || !jobs.data?.items.length} onChange={e => setJobId(e.target.value)}><option value="">{ats(jobs.isPending ? 'jobsLoading' : jobs.isError ? 'jobsError' : !jobs.data?.items.length ? 'jobsEmpty' : 'noTarget')}</option>{jobs.data?.items.map(j => <option key={j.id} value={j.id}>{j.title} · {j.company?.commercialName || t('companyNotListed')}</option>)}</select></Field></div>}
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
}
export { CvDesigner as CvBuilder } from "./cv-designer";
export function CareerPreferences({ auto = false }: { auto?: boolean }) {
  const t = useCareerText(); const settings = useQuery({ queryKey: ['career-settings'], queryFn: careerApi.settings });
  // Settings remain accessible after downgrade so opt-in can always be disabled.
  const autoApplyEligible = settings.data?.autoApplyAccess?.eligible === true;
  return <CareerFrame title={t(auto ? 'auto' : 'alerts')} description={t(auto ? 'autoHelp' : 'requiresPro')}>{auto && <><AutoApplyStatus settings={settings.data} loading={settings.isPending} />{autoApplyEligible && <AutoApplyStats />}</>}{settings.isPending ? <Busy /> : settings.isError ? <Failure retry={() => settings.refetch()} /> : <PreferencesForm initial={settings.data} auto={auto} />}{auto && autoApplyEligible && <CareerHistory />}</CareerFrame>;
}
function PreferencesForm({ initial, auto }: { initial: CareerSettings; auto: boolean }) {
  const t = useCareerText();
  const ent = useEntitlement('CANDIDATE');
  const qc = useQueryClient();
  const prefill = initial.cvPrefill ?? { experienceLevels: [], domains: [], skills: [], locations: [], targetTitles: [] };
  const useCvPrefill = initial.preferencesInitialized !== true;
  const [value, setValue] = useState<CareerSettings>(() => ({
    ...initial,
    salaryCurrency: 'TND',
    domains: useCvPrefill && !initial.domains?.length ? prefill.domains : (initial.domains ?? []),
    requiredSkills: useCvPrefill && !initial.requiredSkills?.length ? prefill.skills : (initial.requiredSkills ?? []),
    locations: useCvPrefill && !initial.locations?.length ? prefill.locations : (initial.locations ?? []),
    targetTitles: useCvPrefill && !initial.targetTitles?.length ? prefill.targetTitles : (initial.targetTitles ?? []),
    experienceLevels: useCvPrefill && !initial.experienceLevels?.length ? prefill.experienceLevels : (initial.experienceLevels ?? []),
  }));
  const [unattendedConsent, setUnattendedConsent] = useState(false);
  const allowed = ent.feature(auto ? 'career.auto_apply' : 'career.alerts') === true;
  const locked = auto && (initial.autoApplyAccess?.eligible ?? allowed) === false;
  const save = useMutation({
    mutationFn: () => careerApi.saveSettings({
      domains: value.domains ?? [], locations: value.locations ?? [], workModes: value.workModes ?? [],
      employmentTypes: value.employmentTypes ?? [], contractTypes: value.contractTypes ?? [],
      minimumSalary: value.minimumSalary ?? null, maximumSalary: value.maximumSalary ?? null, salaryCurrency: 'TND', excludedJobs: value.excludedJobs ?? [],
      ...(auto ? {
        autoMinimumScore: value.autoMinimumScore, maxPerDay: value.maxPerDay,
        excludedJobTypes: value.excludedJobTypes ?? [],
        approvalRequired: value.approvalRequired ?? true, maxPerWeek: value.maxPerWeek ?? 10,
        targetTitles: value.targetTitles ?? [], requiredSkills: value.requiredSkills ?? [],
        excludedKeywords: value.excludedKeywords ?? [], experienceLevels: value.experienceLevels ?? [],
        unattendedConsent,
      } : { emailAlerts: value.emailAlerts, frequency: value.frequency, minimumScore: value.minimumScore }),
    }),
    onSuccess: result => { setValue(result); qc.invalidateQueries({ queryKey: ['career-settings'] }); toast.success(t('success')); },
    onError: () => toast.error(t('error')),
  });
  const toggle = (key: 'contractTypes' | 'workModes' | 'excludedJobTypes' | 'employmentTypes' | 'excludedJobs', option: string) => setValue(v => ({ ...v, [key]: (v[key] ?? []).includes(option) ? (v[key] ?? []).filter(k => k !== option) : [...(v[key] ?? []), option] }));
  return <form className="min-w-0 space-y-6" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
    {!allowed && <div className={`${panelClass} border-indigo-200 bg-indigo-50/50 text-sm dark:border-indigo-900 dark:bg-indigo-950/20`}><p className="text-indigo-700 dark:text-indigo-300">{t(auto ? 'requiresCareer' : 'requiresPro')} · <Link href="/candidate/subscription" className="font-semibold underline underline-offset-4">{t('upgrade')}</Link></p></div>}
    <fieldset disabled={locked} className={`min-w-0 space-y-6 ${locked ? 'opacity-75' : ''}`}>
      {!auto && <section className={`${panelClass} space-y-5`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold">{t('emailAlerts')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('emailAlertsHelp')}</p></div><label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"><Switch checked={Boolean(value.emailAlerts)} disabled={!allowed && value.emailAlerts} onCheckedChange={checked => setValue(v => ({ ...v, emailAlerts: checked }))} aria-label={t('emailAlerts')} /><span>{value.emailAlerts ? t('on') : t('off')}</span></label></div><div className="max-w-md"><Field label={t('frequency')}><select className={selectClass} value={value.frequency} onChange={event => setValue(v => ({ ...v, frequency: event.target.value }))}>{['INSTANT', 'DAILY', 'WEEKLY'].map(option => <option key={option} value={option}>{t(option)}</option>)}</select><span className="text-xs font-normal text-muted-foreground">{t('frequencyHelp')}</span></Field></div></section>}
      {auto && initial.activeCv === null && <section className={`${panelClass} flex items-start gap-3 text-sm`}><FileCheck2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" /><div><p className="font-medium">{t('autoApplyNeedsCv')}</p><Link href="/candidate/cvs" className="mt-1 inline-block text-primary underline underline-offset-4">{t('manageCvs')}</Link></div></section>}
      <section className={`${panelClass} space-y-6`}><div><h2 className="text-lg font-semibold">{t('minimumScore')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('profilePrefillNote')}</p></div><div className="grid min-w-0 gap-x-8 gap-y-6 md:grid-cols-2"><TagInput label={t('domain')} values={value.domains ?? []} onChange={domains => setValue(v => ({ ...v, domains }))} placeholder={t('comma')} removeLabel={t('delete')} /><TagInput label={t('location')} values={value.locations ?? []} onChange={locations => setValue(v => ({ ...v, locations }))} placeholder={t('comma')} removeLabel={t('delete')} /><Field label={t('minimumScore')}>{auto ? <Input type="number" min={0} max={100} required value={value.autoMinimumScore} onChange={event => setValue(v => ({ ...v, autoMinimumScore: Number(event.target.value) }))} /> : <Input type="number" min={0} max={100} value={value.minimumScore} onChange={event => setValue(v => ({ ...v, minimumScore: Number(event.target.value) }))} />}<span className="text-xs font-normal text-muted-foreground">{t('minimumScoreHelp')}</span></Field>{auto ? <Field label={t('maxPerDay')}><Input type="number" min={1} max={20} value={value.maxPerDay} onChange={event => setValue(v => ({ ...v, maxPerDay: Number(event.target.value) }))} /></Field> : <Field label={t('frequency')}><select className={selectClass} value={value.frequency} onChange={event => setValue(v => ({ ...v, frequency: event.target.value }))}>{['INSTANT', 'DAILY', 'WEEKLY'].map(option => <option key={option} value={option}>{t(option)}</option>)}</select><span className="text-xs font-normal text-muted-foreground">{t('frequencyHelp')}</span></Field>}<div className="space-y-3 md:col-span-2"><div><h3 className="text-sm font-semibold">{t('salary')}</h3><p className="mt-1 text-xs text-muted-foreground">{t('salaryPreferenceHelp')}</p></div><div className="grid gap-5 sm:grid-cols-2"><Field label={`${t('minimumSalary')} (TND)`}><Input type="number" min={0} value={value.minimumSalary ?? ''} onChange={event => setValue(v => ({ ...v, minimumSalary: event.target.value === '' ? null : Number(event.target.value) }))} /></Field><Field label={`${t('salaryMax')} (TND)`}><Input type="number" min={0} value={(value as CareerSettings & { maximumSalary?: number | null }).maximumSalary ?? ''} onChange={event => setValue(v => ({ ...v, maximumSalary: event.target.value === '' ? null : Number(event.target.value) } as CareerSettings))} /></Field></div></div></div></section>
      <section className={`${panelClass} space-y-6`}><div><h2 className="text-lg font-semibold">{t('contractType')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('preferencesSectionHelp')}</p></div><div className="grid gap-6 md:grid-cols-3"><PreferenceChoices t={t} label={t('contractType')} options={['CDI', 'CDD']} selected={value.contractTypes ?? []} onToggle={option => toggle('contractTypes', option)} /><PreferenceChoices t={t} label={t('allowedTypes')} options={TYPES} selected={value.employmentTypes ?? []} onToggle={option => toggle('employmentTypes', option)} /><PreferenceChoices t={t} label={t('workMode')} options={MODES} selected={value.workModes ?? []} onToggle={option => toggle('workModes', option)} /></div></section>
      {auto && <section className={`${panelClass} space-y-6`}><div><h2 className="text-lg font-semibold">{t('autoApplyOverview')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('autoHelp')}</p></div><JobExclusions selected={value.excludedJobs ?? []} onToggle={id => toggle('excludedJobs', id)} />{initial.activeCv && <p className="text-xs text-muted-foreground">{t('activeCv')}: {initial.activeCv.filename}</p>}<label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"><input className="mt-1 size-4" type="checkbox" checked={value.approvalRequired ?? true} onChange={event => setValue(v => ({ ...v, approvalRequired: event.target.checked }))} />{t('approvedCvRequired')}</label>{value.approvalRequired === false && <label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input className="mt-1 size-4" type="checkbox" checked={unattendedConsent} onChange={event => setUnattendedConsent(event.target.checked)} />{t('autoConsent')}</label>}<div className="grid gap-6 md:grid-cols-2"><NumberStepper label={t('weeklyApplicationLimit')} description={t('weeklyApplicationLimitHelp')} value={value.maxPerWeek ?? 10} min={1} max={100} onChange={maxPerWeek => setValue(v => ({ ...v, maxPerWeek }))} /><TagInput label={t('targetRoles')} values={value.targetTitles ?? []} onChange={targetTitles => setValue(v => ({ ...v, targetTitles }))} placeholder={t('comma')} removeLabel={t('delete')} /><TagInput label={t('skills')} values={value.requiredSkills ?? []} onChange={requiredSkills => setValue(v => ({ ...v, requiredSkills }))} placeholder={t('comma')} removeLabel={t('delete')} /><ExperienceLevelPicker label={t('experience')} values={value.experienceLevels ?? []} onChange={experienceLevels => setValue(v => ({ ...v, experienceLevels }))} /><TagInput label={t('excludedKeywords')} values={value.excludedKeywords ?? []} onChange={excludedKeywords => setValue(v => ({ ...v, excludedKeywords }))} placeholder={t('comma')} removeLabel={t('delete')} /></div></section>}
      <div className="flex justify-stretch pt-1 sm:justify-end"><Button className="h-12 w-full min-w-40 sm:w-auto" disabled={save.isPending || locked}>{save.isPending ? t('saving') : t('save')}</Button></div>
    </fieldset>
  </form>;
}

function PreferenceChoices({ t, label, options, selected, onToggle }: { t: (key: string) => string; label: string; options: string[]; selected: string[]; onToggle: (option: string) => void }) {
  return <fieldset className="min-w-0 space-y-3"><legend className="text-sm font-semibold">{label}</legend><div className="flex flex-wrap gap-2">{options.map(option => { const checked = selected.includes(option); return <label key={option} className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${checked ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}><input className="sr-only" type="checkbox" checked={checked} onChange={() => onToggle(option)} />{t(option)}</label>; })}</div></fieldset>;
}

function TagInput({ label, values, onChange, placeholder, removeLabel }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string; removeLabel: string }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => { const incoming = raw.split(/[,،\n]/).map(value => value.trim()).filter(Boolean); if (incoming.length) onChange([...new Set([...values, ...incoming])]); setDraft(''); };
  return <Field label={label}><div className="flex min-h-12 max-h-32 flex-wrap items-center gap-2 overflow-y-auto rounded-xl border border-input bg-background px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">{values.map((value, index) => <span key={`${value}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary"><span className="max-w-[18rem] truncate">{value}</span><button type="button" className="shrink-0 rounded-full px-0.5 hover:bg-primary/15" aria-label={`${value} ${removeLabel}`} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}<input className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(draft); } }} onBlur={() => add(draft)} placeholder={placeholder} /></div></Field>;
}

function ExperienceLevelPicker({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const t = useCareerText();
  const levels = ['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'];
  return <fieldset><legend className="mb-3 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">{levels.map(level => <label key={level} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${values.includes(level) ? 'border-primary bg-primary/12 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}><input className="sr-only" type="checkbox" checked={values.includes(level)} onChange={() => onChange(values.includes(level) ? values.filter(value => value !== level) : [...values, level])} />{t(level)}</label>)}</div></fieldset>;
}

function NumberStepper({ label, description, value, min, max, onChange }: { label: string; description?: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const t = useCareerText();
  return <Field label={label}><div className="flex items-center rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"><button type="button" className="grid size-10 place-items-center text-lg text-muted-foreground hover:text-foreground" aria-label={t('decrease')} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button><Input className="h-10 border-0 text-center [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" min={min} max={max} value={value} onChange={event => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} /><button type="button" className="grid size-10 place-items-center text-lg text-muted-foreground hover:text-foreground" aria-label={t('increase')} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button></div>{description && <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>}</Field>;
}

function AutoApplyStatus({ settings, loading }: { settings?: CareerSettings; loading: boolean }) {
  const t = useCareerText();
  const qc = useQueryClient();
  const ent = useEntitlement('CANDIDATE');
  const [committedEnabled, setCommittedEnabled] = useState<boolean | undefined>(undefined);
  const enabled = committedEnabled ?? settings?.autoApplyAccess?.enabled ?? Boolean(settings?.autoApply);
  const hasValidConfiguration = Boolean(settings && settings.preferencesInitialized !== false && settings.activeCv && Number.isFinite(settings.autoMinimumScore) && settings.autoMinimumScore >= 0 && settings.autoMinimumScore <= 100 && (settings.maxPerWeek ?? 0) > 0);
  const allowed = settings?.autoApplyAccess?.eligible ?? (ent.feature('career.auto_apply') === true);
  const update = useMutation({
    mutationFn: (next: boolean) => careerApi.saveSettings({ autoApply: next, ...(next ? { consent: true } : {}) }),
    onSuccess: (result, next) => {
      setCommittedEnabled(Boolean(result?.autoApply ?? next));
      qc.setQueryData<CareerSettings | undefined>(['career-settings'], current => current ? { ...current, ...result } : result);
      qc.invalidateQueries({ queryKey: ['career-settings'], refetchType: 'none' });
      toast.success(t(next ? 'autoApplyEnabled' : 'autoApplyPaused'));
    },
    onError: () => toast.error(t('error')),
  });
  const change = (next: boolean) => {
    if (next && !hasValidConfiguration) {
      toast.error(t(settings?.activeCv ? 'autoApplyNeedsPreferences' : 'autoApplyNeedsCv'));
      return;
    }
    update.mutate(next);
  };
  const status = loading ? 'loading' : enabled ? 'active' : 'paused';
  if (!loading && !allowed) return <section className={`${panelClass} flex flex-wrap items-center justify-between gap-5`}><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Crown className="size-4 text-amber-500" aria-hidden="true" />{t('autoApplyLabel')}<span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-500">{t('premiumFeature')}</span></p><p className="mt-1 text-xl font-semibold">{t('paused')}</p><p className="mt-1 text-sm text-muted-foreground">{t('autoApplyLockedHelp')}</p></div><Button asChild variant="outline"><Link href="/candidate/subscription">{t('upgrade')}</Link></Button></section>;
  return <section className={`${panelClass} flex flex-wrap items-center justify-between gap-5`}><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Crown className="size-4 text-amber-500" aria-hidden="true" />{t('autoApplyLabel')}</p><div className="mt-1 text-xl font-semibold">{loading ? <EasyJobLoader width={120} height={40} label={t('loading')} /> : t(status)}</div><p className="mt-1 text-sm text-muted-foreground">{t(enabled ? 'autoApplyActiveHelp' : 'autoApplyPausedHelp')}</p></div><div className="flex items-center gap-3"><span className="text-xs font-medium text-muted-foreground">{update.isPending ? <Loader2 className="size-4 animate-spin" aria-label={t('loading')} /> : enabled ? t('on') : t('off')}</span><Switch checked={enabled} onCheckedChange={change} disabled={loading || update.isPending || (!enabled && !hasValidConfiguration)} aria-label={t(enabled ? 'disableAutoApply' : 'enableAuto')} /></div></section>;
}

function AutoApplyStats() {
  const t = useCareerText();
  const query = useQuery({ queryKey: ['career-auto-stats'], queryFn: careerApi.autoStats, refetchInterval: 30000 });
  if (query.isPending) return <Busy />;
  if (query.isError) return <Failure retry={() => query.refetch()} />;
  const cards = [['applicationsToday', query.data.applicationsToday], ['applicationsSent', query.data.applicationsSent], ['averageMatch', query.data.averageMatch], ['jobsAnalyzed', query.data.jobsAnalyzed], ['jobsSkipped', query.data.jobsSkipped]] as const;
  return <section aria-label={t('autoApplyOverview')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([key, value]) => <div key={key} className="rounded-xl border bg-card/60 px-4 py-3"><p className="text-xs text-muted-foreground">{t(key)}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value == null ? '—' : key === 'averageMatch' ? `${Math.round(value)}%` : value}</p>{key === 'averageMatch' && value == null && <p className="mt-1 text-xs text-muted-foreground">{t('noDataYet')}</p>}</div>)}</section>;
}
function CareerHistory() {
  const t = useCareerText(); const q = useQuery({ queryKey: ['career-history'], queryFn: careerApi.history });
  return <section className={panelClass}><h2 className="mb-4 text-xl font-semibold">{t('history')}</h2>{q.isPending ? <Busy /> : q.isError ? <Failure retry={() => q.refetch()} /> : q.data.length ? <div className="divide-y">{q.data.map(d => <div key={d.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="font-medium">{d.job?.title || '—'}</p><p className="text-sm text-muted-foreground">{d.job?.company.commercialName} · {t(d.kind)} · {new Date(d.createdAt).toLocaleString()}</p>{d.reason && <p className="text-xs text-muted-foreground">{t(d.reason)}</p>}</div><p className="text-sm">{d.matchScore ?? '—'}% · {t(d.status)}</p></div>)}</div> : <div className="flex items-start gap-3 rounded-xl border border-dashed border-border/70 p-4"><FileCheck2 className="mt-0.5 size-5 text-muted-foreground" /><div><p className="font-medium">{t('noApplicationsYet')}</p><p className="mt-1 text-sm text-muted-foreground">{t('noApplicationsYetHelp')}</p></div></div>}</section>;
}
export function CandidatePlans() {
  const t = useCareerText(), { locale } = useI18n(), qc = useQueryClient(), ent = useEntitlement('CANDIDATE');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [checkoutCurrency, setCheckoutCurrency] = useState<'TND' | 'EUR' | 'USD'>('TND');
  const plans = useQuery({ queryKey: ['candidate-plans'], queryFn: () => billingApi.plans('CANDIDATE') });
  const current = useQuery({ queryKey: ['subscription-me', 'CANDIDATE', undefined], queryFn: () => billingApi.currentSubscription('CANDIDATE') });
  const quote = useQuery({ queryKey: ['candidate-plan-quote', checkoutPlan?.id, checkoutCurrency], queryFn: () => billingApi.quote(checkoutPlan!.id, checkoutCurrency), enabled: Boolean(checkoutPlan) && checkoutCurrency !== 'TND' });
  const checkout = useMutation({ mutationFn: ({ planId, currency }: { planId: string; currency: 'TND' | 'EUR' | 'USD' }) => billingApi.checkout({ planId, ownerType: 'CANDIDATE', currency }), onSuccess: r => { window.location.assign(r.checkoutUrl); }, onError: () => toast.error(t('error')) });
  const cancel = useMutation({ mutationFn: (id: string) => billingApi.cancel({ subscriptionId: id }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscription-me'] }); toast.success(t('success')); }, onError: () => toast.error(t('error')) });
  const currentPlan = current.data?.plan?.name ?? ent.planName;
  const currentDisplayName = current.data?.plan?.displayName ?? ({ FREE: 'EasyJob Start', PRO: 'EasyJob Boost', PREMIUM: 'EasyJob Max', CAREER_AI: 'EasyJob Max' } as Record<string, string>)[currentPlan] ?? currentPlan;
  return <CareerFrame title={t('subscription')} description={`${t('currentPlan')}: ${currentDisplayName}`}>
    {plans.isPending ? <Busy /> : plans.isError ? <Failure retry={() => plans.refetch()} /> : <>
      <div className="grid items-stretch gap-5 lg:grid-cols-3">{plans.data.map(p => <CandidatePlanCard key={p.id} plan={p} current={currentPlan} busy={checkout.isPending} checkout={() => { setCheckoutCurrency('TND'); setCheckoutPlan(p); }} canManage={Boolean(current.data?.subscription?.id)} manage={() => setCancelOpen(true)} />)}</div>
      <PlanComparison plans={plans.data} />
    </>}
    {current.data?.subscription?.id && <Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent><DialogHeader><DialogTitle>{t('cancelPlan')}</DialogTitle><DialogDescription>{current.data.subscription.currentPeriodEnd ? `${t('currentPlan')} · ${new Date(current.data.subscription.currentPeriodEnd).toLocaleDateString()}` : t('subscriptionHelp')}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setCancelOpen(false)}>{t('experienceCancel')}</Button><Button variant="destructive" disabled={cancel.isPending} onClick={() => { cancel.mutate(current.data!.subscription!.id); setCancelOpen(false); }}>{t('cancelPlan')}</Button></DialogFooter></DialogContent></Dialog>}
    <Dialog open={Boolean(checkoutPlan)} onOpenChange={open => { if (!open && !checkout.isPending) setCheckoutPlan(null); }}><DialogContent><DialogHeader><DialogTitle>{checkoutPlan ? candidatePlanLabel(checkoutPlan) : ''}</DialogTitle><DialogDescription>{checkoutPlan ? `${t('referencePrice')}: ${formatMoney(checkoutPlan.priceCents, 'TND', locale)} / ${t('planMonthly')}` : ''}</DialogDescription></DialogHeader>{checkoutPlan && <div className="space-y-4"><div><p className="mb-2 text-sm font-medium">{t('payIn')}</p><div className="grid grid-cols-3 gap-2">{(['TND', 'EUR', 'USD'] as const).map(currency => <Button key={currency} type="button" variant={checkoutCurrency === currency ? 'default' : 'outline'} onClick={() => setCheckoutCurrency(currency)}>{currency}</Button>)}</div></div><div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="text-muted-foreground">{t('estimatedAmount')}</p><p className="mt-1 text-xl font-semibold">{checkoutCurrency === 'TND' ? formatMoney(checkoutPlan.priceCents, 'TND', locale) : quote.isPending ? <Loader2 className="inline size-4 animate-spin" /> : quote.data ? formatMoney(quote.data.amountCents, checkoutCurrency, locale) : '—'}</p>{checkoutCurrency !== 'TND' && quote.isError && <p className="mt-1 text-xs text-destructive">{t('quoteUnavailable')}</p>}</div></div>}<DialogFooter><Button variant="outline" onClick={() => setCheckoutPlan(null)} disabled={checkout.isPending}>{t('experienceCancel')}</Button><Button disabled={!checkoutPlan || checkout.isPending || (checkoutCurrency !== 'TND' && (!quote.data || quote.isPending))} onClick={() => checkoutPlan && checkout.mutate({ planId: checkoutPlan.id, currency: checkoutCurrency })}>{checkout.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : null}{t('continueToPayment')}</Button></DialogFooter></DialogContent></Dialog>
    <BillingHistory subscription={current.data?.subscription ?? null} />
  </CareerFrame>;
}

function BillingHistory({ subscription }: { subscription: import('@/types/api').Subscription | null }) {
  const t = useCareerText(), { locale } = useI18n();
  const payments = subscription?.payments ?? [];
  return <section className={`${panelClass} space-y-3`}><h2 className="text-xl font-semibold">{t('billingHistory')}</h2>{payments.length ? <div className="divide-y">{payments.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{t('currentPlan')}</p><p className="text-xs text-muted-foreground">{new Date(payment.createdAt).toLocaleDateString(locale)}</p>{payment.baseAmountTndCents != null && <p className="text-xs text-muted-foreground">{t('referencePrice')}: {formatMoney(payment.baseAmountTndCents, 'TND', locale)}{payment.currency !== 'TND' ? ` · ${t('paidIn')} ${payment.currency}` : ''}</p>}</div><div className="text-end"><p className="font-medium">{formatMoney(payment.amountCents, payment.currency, locale)}</p><p className="text-xs text-muted-foreground">{payment.status}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">{t('noPaymentsYet')}</p>}</section>;
}

const candidateFeatureRows = [
  ['planFeatureJobSearch', 'job_search'], ['planFeatureTracking', 'tracking'], ['planFeatureCvs', 'cv_limit'],
  ['planFeatureBasicAts', 'basic_ats'], ['planFeatureAdvancedAts', 'advanced_ats'], ['planFeatureTailoring', 'cv_tailoring'],
  ['planFeatureMatching', 'detailed_matching'], ['planFeatureInterview', 'interview_preparation'], ['planFeatureCoding', 'coding_interview'],
  ['planFeatureAdaptive', 'adaptive_interview'], ['planFeatureAutoApply', 'auto_apply'], ['planFeatureAnalytics', 'advanced_analytics'],
  ['planFeatureAlerts', 'email_alerts'],
] as const;
const candidateCardHighlights: Record<string, string[]> = {
  FREE: ['planFeatureJobSearch', 'planFeatureTracking', 'planFeatureCvs', 'planFeatureBasicAts'],
  PRO: ['planFeatureJobSearch', 'planFeatureTracking', 'planFeatureCvs', 'planFeatureBasicAts', 'planFeatureAdvancedAts', 'planFeatureTailoring', 'planFeatureMatching', 'planFeatureInterview', 'planFeatureAnalytics', 'planFeatureAlerts'],
  PREMIUM: ['planFeatureJobSearch', 'planFeatureTracking', 'planFeatureCvs', 'planFeatureBasicAts', 'planFeatureAdvancedAts', 'planFeatureTailoring', 'planFeatureMatching', 'planFeatureInterview', 'planFeatureAnalytics', 'planFeatureAlerts', 'planFeatureAutoApply', 'planFeatureCoding', 'planFeatureAdaptive'],
};

function candidatePlanLabel(plan: Pick<import('@/types/api').Plan, 'name' | 'displayName'>): string {
  return plan.displayName ?? ({ FREE: 'EasyJob Start', PRO: 'EasyJob Boost', PREMIUM: 'EasyJob Max', CAREER_AI: 'EasyJob Max' } as Record<string, string>)[plan.name] ?? plan.name;
}

function candidateFeatureValue(plan: import('@/types/api').Plan, key: string): boolean | number {
  if (key === 'job_search' || key === 'tracking') return plan.features?.[key] === true;
  return (plan.features?.[key] as boolean | number | undefined) ?? (key === 'cv_limit' ? plan.features?.['cv.uploads'] as number ?? 0 : false);
}

function CandidatePlanCard({ plan: p, current, busy, checkout, canManage, manage }: { plan: import('@/types/api').Plan; current: string; busy: boolean; checkout: () => void; canManage: boolean; manage: () => void }) {
  const t = useCareerText(), { locale } = useI18n();
  const isCurrent = p.name === current || (p.name === 'PREMIUM' && current === 'CAREER_AI');
  const unavailable = p.priceCents > 0 && p.paymentAvailable === false;
  const positionKey = p.name === 'FREE' ? 'planPositionFree' : p.name === 'PRO' ? 'planPositionPro' : 'planPositionPremium';
  return <section className={`${panelClass} relative flex flex-col gap-4 ${p.name === 'PRO' ? 'border-indigo-400 ring-1 ring-indigo-400/30' : p.name === 'PREMIUM' ? 'border-amber-400/60' : ''}`}>
    {p.name === 'PRO' && <div className="absolute -top-3 start-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-indigo-300/70 bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm"><BadgeCheck className="size-3.5" aria-hidden="true" />{t('mostPopular')}</div>}
    {p.name === 'PREMIUM' && !isCurrent && <div className="absolute -top-3 start-5 inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-card px-2.5 py-1 text-xs font-semibold text-amber-500"><Crown className="size-3.5" />{candidatePlanLabel(p)}</div>}
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-semibold">{candidatePlanLabel(p)}</h2><p className="mt-1 text-sm text-muted-foreground">{t(positionKey)}</p></div>{isCurrent && <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-primary"><Check className="size-3.5" aria-hidden="true" />{t('planCurrent')}</span>}</div>
    <p className="text-3xl font-semibold">{formatMoney(p.priceCents, p.currency, locale)} <span className="text-sm font-normal text-muted-foreground">/ {t('planMonthly')}</span></p>
    <ul className="min-h-52 space-y-2">{(candidateCardHighlights[p.name] ?? []).map(key => { const value = key === 'planFeatureCvs' ? candidateFeatureValue(p, 'cv_limit') : null; return <li key={key} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /><span>{t(key)}{typeof value === 'number' ? <span className="font-semibold"> · {value}</span> : null}</span></li>; })}</ul>
    {unavailable && <p className="text-xs text-muted-foreground">{t('billingUnavailable')}</p>}
    {isCurrent ? canManage ? <Button className="mt-auto" variant="outline" onClick={manage}>{t('manageSubscription')}</Button> : <Button className="mt-auto" variant="outline" disabled>{t('planCurrent')}</Button> : p.priceCents === 0 ? <Button className="mt-auto" variant="outline" disabled>{t('planDowngrade')}</Button> : <Button className="mt-auto" disabled={busy || unavailable} onClick={checkout}>{busy ? <Loader2 className="me-2 size-4 animate-spin" /> : null}{t('planUpgrade').replace('{plan}', candidatePlanLabel(p))}</Button>}
  </section>;
}

function PlanComparison({ plans }: { plans: import('@/types/api').Plan[] }) {
  const t = useCareerText();
  return <section className={`${panelClass} overflow-x-auto`}><h2 className="text-xl font-semibold">{t('planCompare')}</h2><table className="mt-4 w-full min-w-[620px] text-sm"><thead><tr className="border-b text-start"><th className="py-3 pe-4 text-start font-medium text-muted-foreground">{t('planFeatureLabel')}</th>{plans.map(p => <th key={p.id} className="px-3 py-3 text-center font-semibold">{candidatePlanLabel(p)}</th>)}</tr></thead><tbody>{candidateFeatureRows.map(([label, key]) => <tr key={key} className="border-b last:border-0"><th className="py-3 pe-4 text-start font-medium">{t(label)}</th>{plans.map(p => { const v = candidateFeatureValue(p, key); return <td key={p.id} className="px-3 py-3 text-center">{typeof v === 'number' ? v : v ? <Check className="mx-auto size-4 text-emerald-500" /> : <Minus className="mx-auto size-4 text-muted-foreground/50" />}</td>; })}</tr>)}</tbody></table></section>;
}
