'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, FileText, Info, LayoutTemplate, ListPlus, Loader2, Pencil, Printer, Save, Settings2, Trash2, X, Undo2, Redo2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { careerApi, type AtsCriterion, type AtsReport, type Draft } from '@/lib/api/career';
import { resumesApi } from '@/lib/api/resumes';
import { useCareerText } from '@/lib/i18n/career';
import { useReleaseText } from '@/lib/i18n/release';
import { useAtsText } from '@/lib/i18n/ats';
import { cvSections, cvTemplates, joinCvSections, distinctCvDrafts } from '@/lib/cv-designer';
import { isCvStrength } from '@/lib/cv-highlights';
import { Busy, CareerFrame, Failure, FeatureGate, Field, panelClass, selectClass } from './career-shared';
import { CvTemplateGallery, CvDocumentCanvas } from './cv-template-gallery';
import { useCvEditorHistory } from '@/lib/cv-editor-history';
import styles from './cv-designer.module.css';
import coachStyles from './cv-pdf-viewer.module.css';
import { EasyJobCharacter } from '@/components/auth/easyjob-coach';
import { CvScoreComparison, CvImprovementReview, type SectionProposal } from './cv-improvement-review';
const subscribeToClient = () => () => {};

export function BuildingCv() {
  const tr = useReleaseText();
  return <section role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-6 rounded-2xl border bg-card p-8 sm:flex-row">
    <Image src="/images/coach/easyjob-builder.png" width={220} height={270} className="h-64 w-auto object-contain" alt={tr('Ton coach EasyJob en tenue d’ouvrier', 'Your EasyJob coach in construction gear', 'مدرب EasyJob بملابس البناء')} />
    <div className="max-w-sm"><span className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />EasyJob</span><h2 className="text-2xl font-semibold">{tr('Nous construisons ton CV.', 'We’re building your CV.', 'نحضّروا في سيرتك الذاتية.')}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{tr('Je retravaille la présentation à partir du CV choisi. Tu pourras vérifier et modifier chaque proposition avant de l’enregistrer.', 'I’m reworking the selected CV. You can review and edit every suggestion before saving it.', 'نحسّن السيرة المختارة. تنجّم تراجع وتعدّل كل اقتراح قبل الحفظ.')}</p></div>
  </section>;
}

export function CvDesigner() {
  const t = useCareerText();
  return <CareerFrame wide title={t('builder')} showFindJob={false} actions={<Button asChild variant="outline"><Link href="/candidate/cvs"><ArrowLeft className="me-2 size-4" />{t('cvs')}</Link></Button>}><FeatureGate feature="career.builder"><Suspense fallback={<Busy />}><DesignerStart /></Suspense></FeatureGate></CareerFrame>;
}

function DesignerStart() {
  const params = useSearchParams(), tr = useReleaseText(), t = useCareerText(), qc = useQueryClient();
  const [chosen, setChosen] = useState(params.get('resumeId') || ''), [mode, setMode] = useState(params.get('jobId') ? 'tailor' : params.get('mode') === 'optimize' ? 'optimize' : 'manual'), [active, setActive] = useState<Draft | null>(null);
  const cvs = useQuery({ queryKey: ['resumes'], queryFn: resumesApi.list });
  const drafts = useQuery({ queryKey: ['career-drafts'], queryFn: careerApi.drafts, select: distinctCvDrafts });
  const selected = cvs.data?.find(r => r.id === chosen) ?? (!chosen ? cvs.data?.find(r => r.isPrimary) ?? cvs.data?.[0] : undefined);
  const build = useMutation({ mutationFn: () => careerApi.build({ resumeId: selected?.id, jobId: params.get('jobId') || undefined, title: (selected?.filename.replace(/\.[^.]+$/, '') || 'CV').slice(0, 145), mode }), onSuccess: d => { setActive(d); void qc.invalidateQueries({ queryKey: ['career-drafts'] }); }, onError: () => toast.error(t('error')) });
  const opened = useRef(false), startBuild = build.mutate;
  useEffect(() => {
    if (!opened.current && params.get('resumeId') === selected?.id && selected?.processingStatus === 'COMPLETED' && ['manual', 'optimize', 'tailor'].includes(params.get('mode') || '')) {
      opened.current = true;
      startBuild();
    }
  }, [params, selected?.id, selected?.processingStatus, startBuild]);
  if (active) return <DesignerEditor key={active.id} draft={active} onSaved={setActive} onBack={() => setActive(null)} />;
  if (build.isPending) return mode === 'manual' ? <Busy /> : <BuildingCv />;
  return <div className="mx-auto max-w-4xl space-y-5">
    <section className={`${panelClass} space-y-5`}><div><p className="mb-2 text-xs uppercase tracking-wider text-primary">{tr('Un CV, plusieurs possibilités', 'One CV, more possibilities', 'سيرة واحدة وإمكانيات متعددة')}</p><h2 className="text-2xl font-semibold">{tr('Quel CV souhaites-tu travailler ?', 'Which CV would you like to work on?', 'أي سيرة تحبّ تحسّن؟')}</h2></div>
      {cvs.isPending ? <Busy /> : cvs.isError ? <Failure retry={() => cvs.refetch()} /> : !cvs.data.length ? <Button asChild><Link href="/candidate/cvs">{tr('Importer un CV', 'Upload a CV', 'تحميل سيرة')}</Link></Button> : <>
        <Field label={tr('CV source', 'Source CV', 'السيرة الأصلية')}><select className={selectClass} value={selected?.id ?? ''} onChange={e => setChosen(e.target.value)}>{cvs.data.map(cv => <option value={cv.id} key={cv.id}>{cv.filename} · {t(cv.processingStatus)}</option>)}</select></Field>
        <div className="grid gap-3 sm:grid-cols-2">{(['manual', 'optimize'] as const).map(key => <button type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)} className={`rounded-xl border p-5 text-start ${mode === key ? 'border-primary bg-primary/10' : 'border-border'}`}>{key === 'manual' ? <Pencil className="mb-3 size-5 text-primary" /> : <EasyJobFeatureMark size="md" className="mb-3  text-primary" />}<p className="font-semibold">{key === 'manual' ? tr('Modifier manuellement', 'Edit manually', 'تعديل يدوي') : tr('Améliorer avec EasyJob', 'Improve with EasyJob', 'تحسين مع EasyJob')}</p><p className="mt-2 text-sm text-muted-foreground">{key === 'manual' ? tr('Organise tes rubriques et choisis ton modèle avec un aperçu en direct.', 'Organize your sections and choose a template with a live preview.', 'رتّب الأقسام واختار قالب مع معاينة مباشرة.') : tr('Obtiens une proposition à partir de ce CV, puis garde la main sur chaque modification.', 'Get a proposal based on this CV and stay in control of every edit.', 'اقتراح من هذه السيرة مع التحكم في كل تعديل.')}</p></button>)}</div>
        {selected?.processingStatus !== 'COMPLETED' && <p role="status" className="text-sm text-amber-500">{tr('Attends la fin de l’analyse du CV avant de continuer.', 'Wait for CV processing to finish before continuing.', 'انتظر نهاية تحليل السيرة قبل المتابعة.')}</p>}
        <Button disabled={!selected || selected.processingStatus !== 'COMPLETED'} onClick={() => build.mutate()}>{mode === 'manual' ? tr('Ouvrir l’éditeur', 'Open editor', 'فتح المحرر') : tr('Construire ma nouvelle version', 'Build my new version', 'إنشاء نسخة جديدة')}</Button>
      </>}
    </section>
    {drafts.isError && <Failure retry={() => drafts.refetch()} />}
    {!!drafts.data?.filter(d => !selected || d.sourceResumeId === selected.id).length && <section className={`${panelClass} space-y-3`}><h2 className="font-semibold">{tr('Reprendre une version enregistrée', 'Continue a saved version', 'متابعة نسخة محفوظة')}</h2>{drafts.data.filter(d => !selected || d.sourceResumeId === selected.id).map(d => <button className="flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-start hover:bg-muted" key={d.id} onClick={() => setActive(d)}><span className="min-w-0 break-words">{d.title}<small className="mt-1 block text-muted-foreground">{t(d.approvedAt ? 'approved' : 'draft')}</small></span><span className="shrink-0 text-sm text-primary">ATS {d.afterScore ?? '—'}/100</span></button>)}</section>}
  </div>;
}

export function DesignerEditor({ draft, onSaved, onBack }: { draft: Draft; onSaved: (d: Draft) => void; onBack: () => void }) {
  const tr = useReleaseText(), t = useCareerText(), ats = useAtsText(), qc = useQueryClient();
  const portalReady = useSyncExternalStore(subscribeToClient, () => true, () => false);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);
  const history = useCvEditorHistory({ content: draft.content, title: draft.title, template: draft.template || 'classic', fontSize: draft.fontSize || 14, sections: cvSections(draft.content) });
  const { content, title, template, fontSize, sections } = history.current;
  const selectedTemplate = cvTemplates.find(layout => layout.id === template) ?? cvTemplates[0];
  const [showHighlights, setShowHighlights] = useState(true);
  const [proposal, setProposal] = useState<SectionProposal | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const revisions = useQuery({ queryKey: ['cv-revisions', draft.id], queryFn: () => careerApi.revisions(draft.id), enabled: versionsOpen });
  const [assessment, setAssessment] = useState<{ content: string; report: AtsReport } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ index: number; sequence: number }>();
  const focusSection = (index: number) => { setSectionIndex(index); setFocusRequest(previous => ({ index, sequence: (previous?.sequence ?? 0) + 1 })); };
  const contentField = useRef<HTMLTextAreaElement>(null);
  const [tool, setTool] = useState('content'), [sectionIndex, setSectionIndex] = useState(0), [finding, setFinding] = useState<AtsCriterion | null>(null), [approve, setApprove] = useState(Boolean(draft.approvedAt)), [published, setPublished] = useState('');
  const activeIndex = Math.min(sectionIndex, sections.length - 1);
  const current = sections[activeIndex];
  const dirty = content !== draft.content || title !== draft.title || template !== (draft.template || 'classic') || fontSize !== (draft.fontSize || 14);
  const textDirty = content !== draft.content;
  const currentReport = assessment?.content === content ? assessment.report : !textDirty ? draft.report : undefined;
  const currentScore = currentReport?.score ?? (!textDirty ? draft.afterScore : null);
  useEffect(() => { if (!dirty) return; const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  const save = useMutation({ mutationFn: (action: 'draft' | 'publish') => careerApi.saveDraft(draft.id, { content, title, template, fontSize, expectedVersion: draft.version, approve: action === 'publish' && approve }), onSuccess: (d, action) => { onSaved(d); setApprove(Boolean(d.approvedAt)); void qc.invalidateQueries({ queryKey: ['career-drafts'] }); void qc.invalidateQueries({ queryKey: ['cv-revisions', draft.id] }); if (action === 'publish') publish.mutate(); else { setSaveOpen(false); toast.success(t('success')); } }, onError: () => toast.error(t('error')) });
  const publish = useMutation({ mutationFn: () => careerApi.publish(draft.id), onSuccess: r => { setPublished(r.id); void qc.invalidateQueries({ queryKey: ['resumes'] }); toast.success(t('success')); }, onError: () => toast.error(t('error')) });
  const regenerate = useMutation({ mutationFn: (target: { sectionIndex: number; lineIndex?: number }) => careerApi.regenerateSection(draft.id, { content: joinCvSections(sections), ...target }), onSuccess: (r, target) => { setProposal({ ...r, heading: sections[target.sectionIndex].heading || tr('Informations & présentation', 'Information & introduction', 'معلومات ومقدمة') }); setFinding(null); }, onError: () => toast.error(t('error')) });
  const updateSection = (value: Partial<typeof current>) => { const next = sections.map((s, i) => i === activeIndex ? { ...s, ...value } : s); history.change({ sections: next, content: joinCvSections(next) }); setApprove(false); };
  const move = (direction: number) => { const destination = activeIndex + direction; if (activeIndex === 0 || destination < 1 || destination >= sections.length) return; const next = [...sections]; [next[activeIndex], next[destination]] = [next[destination], next[activeIndex]]; history.change({ sections: next, content: joinCvSections(next) }); setSectionIndex(destination); setApprove(false); };
  const changeContent = (next: string) => { history.change({ content: next, sections: cvSections(next) }); setApprove(false); };
  const locked = save.isPending || regenerate.isPending || publish.isPending;
  if (!portalReady) return <Busy />;
  if (regenerate.isPending) return createPortal(<div className={styles.editorWorkspace}><BuildingCv /></div>, document.body);
  return createPortal(<div className={styles.editorWorkspace} role="region" aria-label={tr('Éditeur de CV', 'CV editor', 'محرر السيرة')}>
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"><div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" aria-label={t('back')} onClick={() => { if (!dirty || window.confirm(tr('Quitter sans enregistrer les modifications ?', 'Leave without saving changes?', 'المغادرة دون حفظ التعديلات؟'))) onBack(); }}><ArrowLeft className="size-4" /></Button><div><p className="max-w-80 truncate text-sm font-semibold">{title}</p><p role="status" className="text-xs text-muted-foreground">{dirty ? tr('Modifications non enregistrées', 'Unsaved changes', 'تعديلات غير محفوظة') : tr('Version enregistrée', 'Saved version', 'نسخة محفوظة')}</p></div></div><div className="flex flex-wrap items-center gap-2"><div className="flex items-center border-e pe-2"><Button variant="ghost" size="icon" disabled={!history.past.length || locked} aria-label={tr('Annuler la modification', 'Undo edit', 'تراجع')} onClick={() => { history.undo(); setApprove(false); }}><Undo2 className="size-4" /></Button><Button variant="ghost" size="icon" disabled={!history.future.length || locked} aria-label={tr('Rétablir la modification', 'Redo edit', 'إعادة')} onClick={() => { history.redo(); setApprove(false); }}><Redo2 className="size-4" /></Button></div><Button variant="outline" onClick={() => setVersionsOpen(true)}>Versions{draft.version ? ` · ${draft.version}` : ''}</Button><Button variant="outline" onClick={() => window.print()}><Printer className="me-2 size-4" />{tr('Exporter en PDF', 'Export to PDF', 'تصدير PDF')}</Button><Button disabled={locked || content.trim().length < 20 || title.trim().length < 2} onClick={() => { setPublished(''); setSaveOpen(true); }}><Save className="me-2 size-4" />{save.isPending ? t('PROCESSING') : t('save')}</Button></div></header>
    <CvScoreComparison before={draft.beforeScore} after={currentScore} pending={!currentReport} comparison={content.trim() !== draft.originalContent.trim()} />
    <div className={styles.editorGrid}>
      <aside className={`${styles.editorTools} min-w-0 space-y-4 rounded-xl border bg-card p-4`}>
        <div className="grid grid-cols-3 gap-1">{[{ id: 'content', icon: FileText, label: tr('Contenu', 'Content', 'محتوى') }, { id: 'templates', icon: LayoutTemplate, label: tr('Modèles', 'Templates', 'قوالب') }, { id: 'layout', icon: Settings2, label: tr('Style', 'Style', 'تصميم') }].map(({ id, icon: Icon, label }) => <button key={id} aria-pressed={tool === id} onClick={() => setTool(id)} className={`flex flex-col items-center gap-2 rounded-lg p-3 text-xs ${tool === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}><Icon className="size-5" />{label}</button>)}</div>
        {tool === 'templates' ? <CvTemplateGallery content={content} template={template} fontSize={fontSize} onSelect={id => history.change({ template: id })} /> : tool === 'layout' ? <div className="space-y-5"><Field label={tr('Nom de la version', 'Version name', 'اسم النسخة')}><Input value={title} maxLength={150} onChange={e => history.change({ title: e.target.value })} /></Field><Field label={`${tr('Taille du texte', 'Text size', 'حجم النص')} · ${fontSize}px`}><input type="range" min={11} max={17} value={fontSize} onChange={e => history.change({ fontSize: Number(e.target.value) })} /></Field><p className="text-xs leading-5 text-muted-foreground">{tr('Chaque modèle conserve un ordre de lecture simple et du texte sélectionnable. Le score ATS évalue le contenu, pas le style.', 'Every template keeps a simple reading order and selectable text. ATS scoring evaluates content, not style.', 'القوالب تحافظ على ترتيب واضح ونص قابل للتحديد. تحليل ATS يقيّم المحتوى وليس التصميم.')}</p></div> : <div className="space-y-4"><nav aria-label={tr('Rubriques du CV', 'CV sections', 'أقسام السيرة')} className="space-y-1">{sections.map((section, index) => <button key={index} type="button" onClick={() => focusSection(index)} aria-current={index === activeIndex ? 'true' : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-xs ${index === activeIndex ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted'}`}><span className="font-mono opacity-60">{String(index + 1).padStart(2, '0')}</span><span className="truncate">{section.heading || tr('Informations & présentation', 'Information & introduction', 'معلومات ومقدمة')}</span></button>)}</nav>
          <div className="flex gap-1"><Button size="icon" variant="outline" disabled={activeIndex <= 1} onClick={() => move(-1)} aria-label={tr('Monter la rubrique', 'Move section up', 'نقل القسم للأعلى')}><ArrowUp className="size-4" /></Button><Button size="icon" variant="outline" disabled={activeIndex === 0 || activeIndex >= sections.length - 1} onClick={() => move(1)} aria-label={tr('Descendre la rubrique', 'Move section down', 'نقل القسم للأسفل')}><ArrowDown className="size-4" /></Button><Button size="icon" variant="outline" disabled={activeIndex === 0 || sections.length <= 1} onClick={() => { if (window.confirm(tr('Supprimer cette rubrique ?', 'Delete this section?', 'حذف هذا القسم؟'))) { changeContent(joinCvSections(sections.filter((_, i) => i !== activeIndex))); setSectionIndex(0); } }} aria-label={tr('Supprimer la rubrique', 'Delete section', 'حذف القسم')}><Trash2 className="size-4" /></Button></div>
          <Field label={tr('Titre de la rubrique', 'Section heading', 'عنوان القسم')}><Input value={current.heading} onChange={e => updateSection({ heading: e.target.value })} /></Field><Field label={tr('Ton contenu', 'Your content', 'محتواك')}><Textarea ref={contentField} className="min-h-72 text-sm leading-6" value={current.body} maxLength={40000} onChange={e => updateSection({ body: e.target.value })} /></Field>
          <Button variant="outline" className="w-full" onClick={() => { const next = [...sections, { heading: tr('Nouvelle rubrique', 'New section', 'قسم جديد'), body: '' }]; changeContent(joinCvSections(next)); setSectionIndex(next.length - 1); }}><ListPlus className="me-2 size-4" />{tr('Ajouter une rubrique', 'Add a section', 'إضافة قسم')}</Button>
          <Button variant="outline" className="w-full" disabled={locked || content.trim().length < 20 || !current.body.trim()} onClick={() => regenerate.mutate({ sectionIndex: activeIndex })}><EasyJobFeatureMark size="sm" className="me-2 " />{tr('Améliorer cette rubrique', 'Improve this section', 'تحسين هذا القسم')}</Button>
        </div>}
      </aside>
      <div className={styles.editorPreview}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{tr('Aperçu en direct · clique sur un crayon pour modifier une rubrique', 'Live preview · click a pencil to edit a section', 'معاينة مباشرة · اضغط القلم لتعديل قسم')}</p><Button size="sm" variant={showHighlights ? 'secondary' : 'outline'} aria-pressed={showHighlights} onClick={() => setShowHighlights(v => !v)}><Eye className="me-2 size-4" />{tr('Surlignages ATS', 'ATS highlights', 'تلوين ATS')}</Button></div>{showHighlights && <div className="flex gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3 text-emerald-500" />{tr('Point fort', 'Strength', 'نقطة قوة')}</span><span className="inline-flex items-center gap-1"><Info className="size-3 text-amber-500" />{tr('À améliorer · survole ⓘ', 'To improve · hover over ⓘ', 'للتحسين · مرّر فوق ⓘ')}</span></div>}<CvDocumentCanvas selectedSection={focusRequest?.index} focusRequest={focusRequest} content={content} template={template} fontSize={fontSize} report={showHighlights ? currentReport : undefined} onFinding={setFinding} onFindingEnd={() => setFinding(null)} onImproveLine={(sectionIndex, lineIndex) => { setFinding(null); regenerate.mutate({ sectionIndex, lineIndex }); }} onSelectSection={index => { setSectionIndex(index); setTool('content'); requestAnimationFrame(() => { contentField.current?.focus();  }); }} /></div>
    </div>
    <Dialog open={saveOpen} onOpenChange={open => { if (!locked) setSaveOpen(open); }}><DialogContent className="!max-w-lg"><DialogHeader><DialogTitle>{tr('Enregistrer ton CV', 'Save your CV', 'حفظ سيرتك')}</DialogTitle><DialogDescription>{tr('Conserve ton brouillon ou valide cette version pour l’ajouter à tes CV.', 'Keep your draft or approve this version to add it to your CVs.', 'احفظ المسودة أو وافق على النسخة لإضافتها إلى سيرك.')}</DialogDescription></DialogHeader>
      <p className="text-sm text-muted-foreground">L’ajout à la bibliothèque crée un PDF A4 à une colonne, avec texte sélectionnable, dans une nouvelle version. L’original est conservé. « Exporter en PDF » permet d’imprimer la mise en page du modèle affiché.</p>
      {published ? <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5"><CheckCircle2 className="size-8 text-emerald-500" /><p className="font-semibold">{tr('Ton CV est prêt dans ta bibliothèque.', 'Your CV is ready in your library.', 'سيرتك جاهزة في مكتبتك.')}</p><Button asChild><Link href={`/candidate/cvs/${published}`}>{tr('Voir cette version', 'View this version', 'عرض النسخة')}</Link></Button></div> : <><div className="rounded-xl border bg-muted/30 p-4"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{tr('Modèle', 'Template', 'القالب')} · {tr(selectedTemplate.fr, selectedTemplate.en, selectedTemplate.ar)}</p></div><label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-6"><input className="mt-1 size-4 accent-primary" type="checkbox" checked={approve} onChange={e => setApprove(e.target.checked)} />{t('approve')}</label><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={locked} onClick={() => save.mutate('draft')}>{tr('Enregistrer le brouillon', 'Save draft', 'حفظ المسودة')}</Button><Button disabled={locked || !approve} onClick={() => save.mutate('publish')}>{locked ? t('PROCESSING') : tr('Enregistrer et ajouter à mes CV', 'Save and add to my CVs', 'حفظ وإضافة إلى سيري')}</Button></div></>}
    </DialogContent></Dialog>
    <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Historique du CV</DialogTitle><DialogDescription>{draft.targetRole || 'CV général'} · {draft.language || 'fr'} · L’original est conservé.</DialogDescription></DialogHeader>{revisions.isPending ? <Busy /> : revisions.isError ? <Failure retry={() => revisions.refetch()} /> : !revisions.data.length ? <p className="text-sm text-muted-foreground">La première version sera conservée lors de ton prochain enregistrement.</p> : revisions.data.map(version => <div className="flex items-center justify-between gap-3 rounded-lg border p-3" key={version.id}><div><p className="font-medium">Version {version.version} · {version.title}</p><p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p></div><Button variant="outline" onClick={() => { history.change({ content: version.content, title: version.title, template: version.template, fontSize: version.fontSize, sections: cvSections(version.content) }); setAssessment({ content: version.content, report: version.report }); setApprove(false); setVersionsOpen(false); }}>Restaurer dans l’éditeur</Button></div>)}</DialogContent></Dialog>
    <CvImprovementReview proposal={proposal} onClose={() => setProposal(null)} onAccept={() => { if (!proposal) return; history.change({ content: proposal.content, sections: cvSections(proposal.content) }); setAssessment({ content: proposal.content, report: proposal.report }); setApprove(false); setProposal(null); }} />
    {finding && <div className={coachStyles.coach}><div className={coachStyles.character}><EasyJobCharacter floating pose={isCvStrength(finding) ? 2 : 1} /></div><div role="dialog" aria-modal="false" aria-label={tr('Explication du surlignage', 'Highlight explanation', 'تفسير التلوين')} className={coachStyles.bubble}><Button className="float-end" size="icon" variant="ghost" onClick={() => setFinding(null)} aria-label={tr('Fermer', 'Close', 'إغلاق')}><X className="size-4" /></Button><p className={`text-xs font-semibold ${isCvStrength(finding) ? 'text-emerald-500' : 'text-amber-500'}`}>{isCvStrength(finding) ? tr('Point fort', 'Strength', 'نقطة قوة') : tr('À améliorer', 'To improve', 'للتحسين')}</p><h3 className="mt-2 font-semibold">{t(finding.key)}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{ats(finding.key === 'quantified_evidence' && finding.metrics?.kind === 'scope' ? 'quantified_evidence_scope' : `${finding.key}_${finding.passed ? 'pass' : 'fail'}`, { count: finding.metrics?.count ?? '' }) || ats(isCvStrength(finding) ? 'fallback_pass' : 'fallback_fail')}</p>{!isCvStrength(finding) && <p className="mt-3 text-sm">{ats(`${finding.key}_action`) || ats('fallback_action')}</p>}</div></div>}
  </div>, document.body);
}
