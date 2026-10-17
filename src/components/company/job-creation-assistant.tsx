'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';


import { useRef, useState } from 'react';
import { Check, Crown, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useEntitlement } from '@/hooks/use-entitlement';
import { useCompanyText } from '@/lib/i18n/company';
import { useBuilderText } from '@/lib/i18n/job-builder';
import { jobsApi, type JobAutofillDraft, type JobSuggestionInput, type JobTitleSuggestion } from '@/lib/api/jobs';
import { externalResearchApi } from '@/lib/api/external-research';
import type { BuilderSkill } from '@/lib/job-builder';
import styles from './job-suggestions.module.css';
import { PublicContextPanel } from './public-context-panel';

export type JobSuggestionSelection = { description?: string; responsibilities: string[]; skills: BuilderSkill[] };
export function JobCreationAssistant({ companyId, title, role, input, scope, existingDescription, onApply }: {
  companyId: string; title: string; role: JobTitleSuggestion | null;
  input: Omit<JobSuggestionInput, 'roleId'>; scope: 'description' | 'responsibilities' | 'skills' | 'all';
  existingDescription: string; onApply: (selection: JobSuggestionSelection) => void;
}) {
  const copy = useCompanyText(), text = useBuilderText(), rt = useRecruitmentText();
  const entitlement = useEntitlement('COMPANY', companyId);
  const premium = entitlement.feature('smart_job_creation') === true;
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<JobAutofillDraft | null>(null), [error, setError] = useState('');
  const [variant, setVariant] = useState('professional'), [includeDescription, setIncludeDescription] = useState(false);
  const [responsibilities, setResponsibilities] = useState<string[]>([]), [skills, setSkills] = useState<string[]>([]), [publicSkills, setPublicSkills] = useState<string[]>([]);
  const request = useRef(0), loading = useRef(false);
  const withDescription = scope === 'description' || scope === 'all';
  const withResponsibilities = scope === 'responsibilities' || scope === 'all';
  const withSkills = scope === 'skills' || scope === 'all';
  async function prepare() {
    if (loading.current) return;
    setOpen(true); setDraft(null); setError(''); setResponsibilities([]); setSkills([]); setPublicSkills([]); setVariant('professional'); setIncludeDescription(false);
    if (!premium) return;
    const current = ++request.current;
    loading.current = true; setBusy(true);
    try {
      const selected = role ?? (await jobsApi.titleSuggestions(title))[0];
      if (current !== request.current) return;
      if (!selected) { setError(text('chooseRole')); return; }
      const result = await jobsApi.autofill({ ...input, roleId: selected.id }, companyId);
      if (current === request.current) setDraft(result);
    } catch {
      if (current === request.current) { setError(copy('jobPreparationUnavailable')); toast.error(copy('jobPreparationUnavailable')); }
    } finally { if (current === request.current) { loading.current = false; setBusy(false); } }
  }
  function close(value: boolean) {
    setOpen(value);
    if (!value) { request.current++; loading.current = false; setBusy(false); }
  }
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  const suggestedSkills: BuilderSkill[] = draft ? [
    ...draft.skills as BuilderSkill[],
    ...draft.preferredSkills.filter(name => !draft.skills.some(skill => skill.name === name)).map(name => ({ name, level: 'INTERMEDIATE' as const, required: false })),
  ] : [];
  const selectedDescription = draft?.descriptions.find(item => item.id === variant)?.text;
  const canApply = Boolean((includeDescription && selectedDescription) || responsibilities.length || skills.length || publicSkills.length);
  const publicContext = useQuery({ queryKey: ['external-research', 'job-context', companyId, title, input.seniority, input.skills?.join(',')], queryFn: () => externalResearchApi.jobContext(companyId, { title, seniority: input.seniority, technologies: input.skills }), enabled: Boolean(draft?.externalResearch && premium && open && title), refetchInterval: query => query.state.data?.status === 'QUEUED' ? 4000 : false, staleTime: 15000 });
  const chosenCount = Number(includeDescription) + Number(responsibilities.length > 0) + Number(skills.length > 0) + Number(publicSkills.length > 0);
  return <>
    <Tooltip><TooltipTrigger asChild><button type="button" className={styles.trigger} disabled={busy || entitlement.loading} onClick={() => void prepare()} aria-label={`${text('suggestion')} — ${text(scope === 'all' ? 'information' : scope)}`}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : premium ? <EasyJobFeatureMark size="sm" /> : <Crown size={13} />}{text('suggestion')}
    </button></TooltipTrigger><TooltipContent>{premium ? `${entitlement.displayName}. ` : ''}{rt('smartDraftHelp')}</TooltipContent></Tooltip>
    <Dialog open={open} onOpenChange={close}><DialogContent className={styles.dialog} data-scope={scope} style={{ translate: '-50% -50%', transform: 'none' }}>
      <header className={styles.dialogHeader}>
        <span className={styles.eyebrow}><EasyJobFeatureMark size="sm" />EasyJob</span>
        <DialogTitle>{text('prepareDraft')}</DialogTitle>
        <DialogDescription>{premium ? draft?.title || title : copy('premiumJobCreationHelp')}</DialogDescription>
      </header>
      <div className={styles.dialogBody}>
        {busy && <p role="status" className={styles.loading}><Loader2 size={20} className="animate-spin" />{text('preparingDraft')}</p>}
        {error && <p role="alert">{error}</p>}
        {draft && <div className={styles.draftGrid}>
          {draft.externalResearch && <div className="col-span-full"><PublicContextPanel result={publicContext.data} isLoading={publicContext.isLoading} isError={publicContext.isError} appliedSkills={publicSkills} onApplySkill={technology => setPublicSkills(values => values.includes(technology) ? values : [...values, technology])} onRefresh={async () => { await externalResearchApi.enqueueJobContext(companyId, { title, seniority: input.seniority, technologies: input.skills }); await publicContext.refetch(); }} /></div>}
          {withDescription && <section className={styles.sectionCard} data-section="description" data-included={includeDescription}>
            <header className={styles.cardHeader}><h3>{text('description')}</h3><label className={styles.include}><span>{text(includeDescription ? 'included' : 'includeSection')}</span><Switch size="sm" aria-label={text('includeDescription')} checked={includeDescription} onCheckedChange={setIncludeDescription} /></label></header>
            <div className={styles.tabs} aria-label={text('descriptionVariants')}>{draft.descriptions.map(item => <button type="button" key={item.id} aria-pressed={variant === item.id} onClick={() => setVariant(item.id)}>{text(`variant_${item.id}`)}</button>)}</div>
            <div className={styles.description}>{selectedDescription}</div>
            {includeDescription && existingDescription && <p className={styles.replacementNotice}>{text('descriptionWillReplace')}</p>}
          </section>}
          <div className={styles.supportingSections}>
            {withResponsibilities && <section className={styles.sectionCard} data-included={responsibilities.length > 0}>
              <header className={styles.cardHeader}><h3>{text('responsibilities')}</h3><label className={styles.include}><span>{text(responsibilities.length ? 'included' : 'includeSection')}</span><Switch size="sm" aria-label={text('includeResponsibilities')} checked={responsibilities.length > 0} onCheckedChange={checked => setResponsibilities(checked ? [...draft.responsibilities] : [])} /></label></header>
              <div className={styles.selectionSummary}><span>{responsibilities.length}/{draft.responsibilities.length}</span><button type="button" onClick={() => setResponsibilities(responsibilities.length === draft.responsibilities.length ? [] : [...draft.responsibilities])}>{text(responsibilities.length === draft.responsibilities.length ? 'clearSelection' : 'selectAll')}</button></div>
              <div className={styles.choices}>{draft.responsibilities.map(value => <label key={value} className={styles.choice}><Checkbox checked={responsibilities.includes(value)} onCheckedChange={() => setResponsibilities(items => toggle(items, value))} />{value}</label>)}</div>
            </section>}
            {withSkills && <section className={styles.sectionCard} data-included={skills.length > 0}>
              <header className={styles.cardHeader}><h3>{text('suggestedSkills')}</h3><label className={styles.include}><span>{text(skills.length ? 'included' : 'includeSection')}</span><Switch size="sm" aria-label={text('includeSkills')} checked={skills.length > 0} onCheckedChange={checked => setSkills(checked ? suggestedSkills.map(skill => skill.name) : [])} /></label></header>
              {[true, false].filter(required => suggestedSkills.some(skill => skill.required === required)).map(required => <div className={styles.skillGroup} key={String(required)}><h4>{text(required ? 'required' : 'preferred')}</h4><div className={styles.chips}>{suggestedSkills.filter(skill => skill.required === required).map(skill => <button type="button" key={skill.name} aria-pressed={skills.includes(skill.name)} onClick={() => setSkills(items => toggle(items, skill.name))}>{skills.includes(skill.name) && <Check size={12} />}{draft.skillLabels?.[skill.name] || skill.name}</button>)}</div></div>)}
            </section>}
          </div>
        </div>}
      </div>
      <footer className={styles.actions}><p className={styles.hint}>{chosenCount ? `${chosenCount} ${text(chosenCount === 1 ? 'sectionSelected' : 'sectionsSelected')}` : text('selectSections')}</p><div><Button type="button" variant="ghost" onClick={() => close(false)}>{copy('cancel')}</Button>
        {error && <Button type="button" variant="outline" onClick={() => void prepare()}>{text('retrySuggestion')}</Button>}
        {draft && <Button type="button" disabled={!canApply} onClick={() => {
          onApply({ description: includeDescription ? selectedDescription : undefined, responsibilities, skills: [...suggestedSkills.filter(skill => skills.includes(skill.name)), ...publicSkills.filter(name => !suggestedSkills.some(skill => skill.name.toLowerCase() === name.toLowerCase())).map(name => ({ name, level: 'INTERMEDIATE' as const, required: false }))] });
          close(false); toast.success(copy('jobPreparationApplied'));
        }}>{text('applyDraft')}</Button>}
      </div></footer>
    </DialogContent></Dialog>
  </>;
}
