'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Check, ChevronDown, Circle, Eye, EyeOff, Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { jobsApi, type JobTitleSuggestion } from '@/lib/api/jobs';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyText } from '@/lib/i18n/company';
import { useCareerText } from '@/lib/i18n/career';
import { useBuilderText } from '@/lib/i18n/job-builder';
import { useI18n } from '@/lib/i18n';
import { builderSkills, distinctRequirements, mergeSkills, processSteps, serializeSteps } from '@/lib/job-builder';
import { formatJobSalary } from '@/lib/format';
import type { Job } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BuilderSelect, InlineList, SkillEditor, TagEditor } from './job-builder-controls';
import { JobCreationAssistant, type JobSuggestionSelection } from './job-creation-assistant';
import { JobTitleInput } from './job-title-input';
import suggestionStyles from './job-suggestions.module.css';
import { JobStatusBadge } from './job-status-badge';
import styles from './job-builder.module.css';

const numberOrEmpty = z.union([z.literal(''), z.coerce.number().int().min(0)]);
const schema = (copy: (key: string) => string) => z.object({
  title: z.string().min(3, copy('titleValidation')).max(150), description: z.string().min(20, copy('descriptionValidation')).max(10000),
  location: z.string().max(120), workMode: z.enum(['ONSITE', 'REMOTE', 'HYBRID']),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']),
  experienceLevel: z.enum(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']),
  contractType: z.enum(['', 'CDI', 'CDD']), domain: z.string().max(120), minimumYearsExperience: numberOrEmpty,
  educationRequirement: z.string().max(200), languages: z.array(z.string().max(80)).max(20),
  department: z.string().max(150), positions: z.coerce.number().int().min(1).max(10000), benefits: z.array(z.string().max(500)).max(30),
  steps: z.array(z.string()).refine(steps => serializeSteps(steps).length <= 3000, copy('descriptionValidation')),
  responsibilities: z.array(z.string()), requirements: z.array(z.string()),
  skills: z.array(z.object({ name: z.string().min(1).max(80), required: z.boolean(), level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']) })),
  salaryMin: numberOrEmpty, salaryMax: numberOrEmpty, currency: z.enum(['TND', 'EUR', 'USD']), hideSalary: z.boolean(), expiresAt: z.string(),
}).refine(v => v.salaryMin === '' || v.salaryMax === '' || Number(v.salaryMax) >= Number(v.salaryMin), { path: ['salaryMax'], message: copy('salaryRangeValidation') });
type Values = z.output<ReturnType<typeof schema>>;
function defaults(job?: Job): Values {
  const skills = builderSkills(job);
  return {
    title: job?.title ?? '', description: job?.description ?? '', location: job?.location ?? '', workMode: job?.workMode ?? (job?.remote ? 'REMOTE' : 'ONSITE'),
    employmentType: job?.employmentType ?? 'FULL_TIME', experienceLevel: job?.experienceLevel ?? 'MID', contractType: job?.contractType === 'CDI' || job?.contractType === 'CDD' ? job.contractType : '',
    domain: job?.domain ?? '', minimumYearsExperience: job?.minimumYearsExperience ?? '', educationRequirement: job?.educationRequirement || job?.preferredEducation || '',
    languages: [...new Set([...(job?.languages ?? []), ...(job?.preferredLanguages ?? [])])], department: job?.department ?? '', positions: job?.positions ?? 1,
    benefits: job?.benefits ?? [], steps: processSteps(job?.interviewProcess), responsibilities: job?.responsibilities ?? [], requirements: distinctRequirements(job?.requirements ?? [], skills), skills,
    salaryMin: job?.salaryMin ?? '', salaryMax: job?.salaryMax ?? '', currency: job?.currency === 'EUR' || job?.currency === 'USD' ? job.currency : 'TND', hideSalary: job?.salaryVisible === false, expiresAt: job?.expiresAt?.slice(0, 10) ?? '',
  };
}
const sections = ['general', 'role', 'skills', 'process', 'compensation', 'publication'] as const;
type Section = typeof sections[number];

export function JobForm({ companyId, job }: { companyId: string; job?: Job; cancelHref?: string }) {
  const router = useRouter(), queryClient = useQueryClient(), copy = useCompanyText(), career = useCareerText(), text = useBuilderText();
  const { locale } = useI18n();
  const form = useForm<Values>({ resolver: zodResolver(schema(copy)) as Resolver<Values>, defaultValues: defaults(job) });
  const values = useWatch({ control: form.control }) as Values;
  const [activeSection, setActiveSection] = useState<Section>('general');
  const [preview, setPreview] = useState(true), [previewDialog, setPreviewDialog] = useState(false), [reset, setReset] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null), saving = useRef(false);
  const [selectedRole, setSelectedRole] = useState<JobTitleSuggestion | null>(null);
  const membershipName = useAuthStore(state => state.user?.memberships.find(member => member.companyId === companyId)?.companyName);
  const companyName = job?.company?.commercialName || membershipName || '';
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dirty = form.formState.isDirty;
  const salary = values.hideSalary || (values.salaryMin === '' && values.salaryMax === '') ? text('undisclosed') : formatJobSalary(values.salaryMin === '' ? null : Number(values.salaryMin), values.salaryMax === '' ? null : Number(values.salaryMax), values.currency, locale === 'fr' ? 'fr-TN' : locale === 'ar' ? 'ar-TN' : 'en');
  const completed: Record<Section, boolean> = { general: values.title.trim().length >= 3 && values.description.trim().length >= 20, role: Boolean(values.location.trim() || values.workMode === 'REMOTE'), skills: values.skills.some(s => s.required), process: values.steps.length > 0, compensation: values.hideSalary || values.salaryMin !== '' || values.salaryMax !== '', publication: Boolean(values.expiresAt) };
  const completion = Math.round(Object.values(completed).filter(Boolean).length / sections.length * 100);
  const set = <K extends keyof Values>(name: K, value: Values[K]) => form.setValue(name, value as never, { shouldDirty: true, shouldValidate: true });

  const save = useMutation({ mutationFn: async (v: Values) => {
    const payload = { title: v.title, description: v.description, location: v.location, workMode: v.workMode, remote: v.workMode === 'REMOTE', employmentType: v.employmentType, experienceLevel: v.experienceLevel,
      contractType: v.contractType, domain: v.domain, minimumYearsExperience: v.minimumYearsExperience === '' ? null : Number(v.minimumYearsExperience),
      educationRequirement: v.educationRequirement, preferredEducation: '', languages: v.languages, preferredLanguages: [], department: v.department, positions: v.positions, benefits: v.benefits,
      interviewProcess: serializeSteps(v.steps), responsibilities: v.responsibilities.filter(Boolean), requirements: distinctRequirements(v.requirements, v.skills), skills: mergeSkills(v.skills),
      salaryVisible: !v.hideSalary, salaryMin: v.salaryMin === '' ? null : Number(v.salaryMin), salaryMax: v.salaryMax === '' ? null : Number(v.salaryMax), currency: v.currency, expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : null };
    return job ? jobsApi.update(job.id, payload, companyId) : jobsApi.create(payload, companyId);
  }, onSuccess: saved => {
    form.reset(defaults(saved)); toast.success(copy(job ? 'offerUpdated' : 'saved'));
    void queryClient.invalidateQueries({ queryKey: ['company-jobs', companyId] });
    void queryClient.invalidateQueries({ queryKey: ['company-job', companyId] });
    void queryClient.invalidateQueries({ queryKey: ['company-job-edit', companyId] });
    if (!job) router.push(`/company/${companyId}/jobs/${saved.id}/edit`);
  }, onError: () => { setError(copy('saveError')); toast.error(copy('saveError')); }, onSettled: () => { saving.current = false; } });

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (!saving.current) { (document.activeElement as HTMLElement | null)?.blur(); formRef.current?.requestSubmit(); } } };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('keydown', keyboard); window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('keydown', keyboard); window.removeEventListener('beforeunload', beforeUnload); };
  }, [dirty]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top); if (visible[0]) setActiveSection(visible[0].target.id.replace('builder-', '') as Section); }, { rootMargin: '-130px 0px -55% 0px', threshold: 0 });
    sections.forEach(key => { const el = document.getElementById(`builder-${key}`); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  function field(name: 'title' | 'location' | 'minimumYearsExperience' | 'positions' | 'salaryMin' | 'salaryMax' | 'expiresAt', label: string, type = 'text') {
    return <FormField control={form.control} name={name} render={({ field: props }) => <FormItem className={styles.field}><FormLabel>{label}</FormLabel><FormControl><Input {...props} type={type} min={type === 'number' ? name === 'positions' ? 1 : 0 : undefined} /></FormControl><FormMessage /></FormItem>} />;
  }
  function select(name: 'employmentType' | 'experienceLevel' | 'workMode' | 'domain' | 'contractType' | 'educationRequirement' | 'department' | 'currency', label: string, options: [string, string][]) {
    return <FormField control={form.control} name={name} render={({ field: props }) => <FormItem className={styles.field}><FormLabel>{label}</FormLabel><BuilderSelect value={props.value} onChange={props.onChange} label={label} options={options} /><FormMessage /></FormItem>} />;
  }
  function section(id: Section, title: string, children: ReactNode, extra?: ReactNode) {
    return <details open id={`builder-${id}`} className={styles.section}><summary><span>{title}</span><ChevronDown size={15} /></summary>{extra && <div className={styles.sectionAction}>{extra}</div>}<div className={styles.sectionBody}>{children}</div></details>;
  }
  function applySuggestion(selection: JobSuggestionSelection) {
    if (selection.description !== undefined) set('description', selection.description);
    if (selection.responsibilities.length) set('responsibilities', [...new Set([...values.responsibilities, ...selection.responsibilities])]);
    if (selection.skills.length) set('skills', mergeSkills([...values.skills, ...selection.skills]));
  }
  function suggestions(scope: 'description' | 'responsibilities' | 'skills' | 'all') {
    return <JobCreationAssistant companyId={companyId} title={values.title} role={selectedRole?.label === values.title ? selectedRole : null}
      input={{ seniority: values.experienceLevel === 'EXECUTIVE' ? 'LEAD' : values.experienceLevel, workMode: values.workMode, location: values.location, employmentType: values.employmentType, contractType: values.contractType, skills: values.skills.filter(skill => skill.required).map(skill => skill.name).slice(0, 30), locale }}
      scope={scope} existingDescription={values.description} onApply={applySuggestion} />;
  }
  const candidatePreview = <article className={styles.candidatePreview}>
    <div className={styles.previewEyebrow}>{text('preview')}</div><h2>{values.title || copy('jobTitle')}</h2>{companyName && <p className={styles.company}>{companyName}</p>}
    <p className={styles.previewMeta}>{[values.location, career(values.workMode), career(values.experienceLevel)].filter(Boolean).join(' · ')}</p><p className={styles.previewSalary}>{salary || text('undisclosed')}</p>
    <p className={styles.previewDescription}>{values.description || copy('description')}</p>
    {values.responsibilities.length > 0 && <section><h3>{text('responsibilities')}</h3><ul>{values.responsibilities.slice(0, 4).map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
    {values.skills.length > 0 && <section><h3>{text('skills')}</h3><div className={styles.chips}>{values.skills.map(skill => <span key={skill.name} className={styles.tag}>{skill.name}</span>)}</div></section>}
    {values.benefits.length > 0 && <section><h3>{text('benefits')}</h3><p>{values.benefits.join(' · ')}</p></section>}
    {values.steps.length > 0 && <section><h3>{text('interviews')}</h3><ol>{values.steps.map((step, i) => <li key={i}>{step}</li>)}</ol></section>}
  </article>;

  return <div className={styles.builder} data-preview={preview}>
    <header className={styles.toolbar}><div className={styles.heading}><Link href={`/company/${companyId}/jobs`} className={styles.back}><ArrowLeft size={15} />{copy('backToOffers')}</Link><div className={styles.titleLine}><h1>{values.title || copy('newJob')}</h1><JobStatusBadge status={job?.status || 'DRAFT'} /></div><p className={styles.saveState}><span data-dirty={dirty} />{dirty ? text('unsaved') : job ? text('saved') : text('draft')}{job?.status === 'PUBLISHED' && <span className={styles.activeNote}>{text('saveNotice')}</span>}</p></div>
      <div className={styles.actions}><Button type="button" variant="ghost" size="icon" disabled={!dirty || save.isPending} onClick={() => setReset(true)} aria-label={text('reset')}><RotateCcw size={16} /></Button><Button type="button" variant="outline" className={styles.desktopPreviewToggle} onClick={() => setPreview(v => !v)}>{preview ? <EyeOff size={16} /> : <Eye size={16} />}{text(preview ? 'hidePreview' : 'showPreview')}</Button><Button type="button" variant="outline" className={styles.mobilePreviewToggle} onClick={() => setPreviewDialog(true)}><Eye size={16} />{text('preview')}</Button><Button type="submit" form="job-builder-form" disabled={save.isPending} className={styles.saveButton}>{save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{copy(save.isPending ? 'saving' : job ? 'save' : 'saveDraft')}</Button></div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sectionNav}><nav aria-label={copy('editorSections')}>{sections.map(key => <a href={`#builder-${key}`} key={key} aria-current={activeSection === key ? 'location' : undefined} onClick={() => { setActiveSection(key); const el = document.getElementById(`builder-${key}`) as HTMLDetailsElement; if (el) el.open = true; }}>{completed[key] ? <Check size={14} className={styles.completeIcon} /> : <Circle size={12} />}<span>{text(key)}</span></a>)}</nav><div className={styles.completion}><span>{text('complete')}</span><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div></div></aside>
      <Form {...form}><form id="job-builder-form" ref={formRef} className={styles.editor} onSubmit={event => { void form.handleSubmit(v => { if (saving.current) return; saving.current = true; setError(''); save.mutate(v); }, errors => { const key = Object.keys(errors)[0]; const node = formRef.current?.querySelector(`[name="${key}"]`); const parent = node?.closest('details'); if (parent) parent.open = true; toast.error(text('invalid')); })(event); }}><fieldset disabled={save.isPending} className={styles.formFields}>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {section('general', text('information'), <><FormField control={form.control} name="title" render={({ field: props }) => <FormItem className={styles.field}><FormLabel>{copy('jobTitle')} *</FormLabel><FormControl><JobTitleInput {...props} onChange={value => { props.onChange(value); setSelectedRole(null); }} onSelect={role => { setSelectedRole(role); if (role.id === 'senior_devops_engineer') set('experienceLevel', 'SENIOR'); }} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="description" render={({ field: props }) => <FormItem className={styles.field}><div className={suggestionStyles.labelRow}><FormLabel>{copy('description')} *</FormLabel>{suggestions('description')}</div><FormControl><Textarea {...props} rows={4} /></FormControl><FormMessage /></FormItem>} /></>, suggestions('all'))}
        {section('role', text('organization'), <div className={styles.grid}>
          {field('location', copy('city'))}{select('workMode', copy('workMode'), ['ONSITE', 'HYBRID', 'REMOTE'].map(v => [v, career(v)]))}
          {select('employmentType', text('workTime'), ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'].map(v => [v, career(v)]))}{select('experienceLevel', copy('experience'), ['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'].map(v => [v, career(v)]))}
          {select('domain', career('domain'), [['', text('unspecified')], ...[['Software & Product', 'software'], ['Data', 'data'], ['Finance', 'finance'], ['Sales', 'sales'], ['Marketing', 'marketing'], ['Human Resources', 'people'], ['Operations', 'operations'], ['Engineering', 'engineering']].map(([key, label]) => [key, text(label)] as [string, string])])}{field('minimumYearsExperience', career('yearsExperience'), 'number')}
        </div>)}
        {section('skills', text('skills'), <><div className={suggestionStyles.labelRow}><h3 className={styles.subheading}>{text('skills')}</h3>{suggestions('skills')}</div><SkillEditor value={values.skills} onChange={v => set('skills', v)} /><div className={suggestionStyles.labelRow}><h3 className={styles.subheading}>{text('responsibilities')}</h3>{suggestions('responsibilities')}</div><InlineList value={values.responsibilities} onChange={v => set('responsibilities', v)} label={text('addResponsibility')} />{values.requirements.length > 0 && <><h3 className={styles.subheading}>{text('otherRequirements')}</h3><InlineList value={values.requirements} onChange={v => set('requirements', v)} label={text('otherRequirements')} /></>}</>)}
        {section('process', text('additional'), <><div className={styles.grid}>
          {select('department', text('department'), [['', text('unspecified')], ...['engineering', 'product', 'sales', 'marketing', 'operations', 'finance', 'people'].map(key => [text(key), text(key)] as [string, string])])}{field('positions', text('positions'), 'number')}
          {select('educationRequirement', text('education'), [['', text('none')], ...['secondary', 'bachelor', 'master', 'doctorate'].map(key => [text(key), text(key)] as [string, string])])}{select('contractType', text('contract'), [['', text('unspecified')], ['CDI', career('CDI')], ['CDD', career('CDD')]])}
        </div><h3 className={styles.subheading}>{text('languages')}</h3><TagEditor value={values.languages} onChange={v => set('languages', v)} label={text('addLanguage')} max={20} maxLength={80} suggestions={['french', 'english', 'arabic'].map(text)} /><h3 className={styles.subheading}>{text('benefits')}</h3><TagEditor value={values.benefits} onChange={v => set('benefits', v)} label={text('addBenefit')} suggestions={['remote', 'health', 'meals', 'training'].map(text)} /><h3 className={styles.subheading}>{text('interviews')}</h3><InlineList value={values.steps} onChange={v => set('steps', v)} label={text('addStep')} suggestions={['hr', 'technical', 'final'].map(text)} /><p className={styles.helper}>{text('stepHint')}</p>{form.formState.errors.steps && <p role="alert" className={styles.error}>{form.formState.errors.steps.message}</p>}</>)}
        {section('compensation', text('compensation'), <><div className={styles.salaryGrid}>{field('salaryMin', copy('salaryMin'), 'number')}{field('salaryMax', copy('salaryMax'), 'number')}{select('currency', text('currency'), [['TND', 'TND'], ['EUR', 'EUR'], ['USD', 'USD']])}</div><label className={styles.checkbox}><Checkbox checked={values.hideSalary} onCheckedChange={v => set('hideSalary', v === true)} />{text('hideSalary')}</label><p className={styles.helper}>{values.hideSalary ? text('hiddenSalaryHelp') : `${text('visibleSalary')} : ${salary}`}</p></>)}
        {section('publication', text('publication'), <div className={styles.dateField}>{field('expiresAt', copy('deadline'), 'date')}<p className={styles.helper}>{copy('publishedExpiryHelp')}</p></div>)}
      </fieldset></form></Form>
      {preview && <aside className={styles.previewPanel}><p className={styles.previewLive}><span />{text('live')}</p>{candidatePreview}</aside>}
    </div>
    {mounted && createPortal(<Button type="submit" form="job-builder-form" disabled={save.isPending} className={styles.mobileSave}>{save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{copy(save.isPending ? 'saving' : job ? 'save' : 'saveDraft')}</Button>, document.body)}
    <Dialog open={previewDialog} onOpenChange={setPreviewDialog}><DialogContent className={styles.previewDialog} style={{ translate: "none", transform: "none" }}><DialogTitle className="sr-only">{text('preview')}</DialogTitle><DialogDescription className="sr-only">{text('live')}</DialogDescription>{candidatePreview}</DialogContent></Dialog>
    <Dialog open={reset} onOpenChange={setReset}><DialogContent><DialogTitle>{text('resetTitle')}</DialogTitle><DialogDescription>{text('resetHelp')}</DialogDescription><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setReset(false)}>{copy('cancel')}</Button><Button type="button" variant="destructive" onClick={() => { form.reset(); setError(''); setReset(false); }}>{text('reset')}</Button></div></DialogContent></Dialog>
  </div>;
}
