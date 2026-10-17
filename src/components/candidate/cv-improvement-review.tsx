'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';

import { useRef } from 'react';
import { FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useReleaseText } from '@/lib/i18n/release';
import type { AtsReport } from '@/lib/api/career';
import { useCareerText } from '@/lib/i18n/career';

export type SectionProposal = { content: string; before: string; after: string; heading: string; scope?: 'line' | 'section'; beforeScore: number | null; score: number | null; beforeReport?: AtsReport; report: AtsReport; improvedChecks: string[] };

export function CvScoreComparison({ before, after, pending = false, unchangedContent = false, comparison = true }: { before: number | null; after: number | null; pending?: boolean; unchangedContent?: boolean; comparison?: boolean }) {
  const tr = useReleaseText();
  const delta = before !== null && after !== null ? after - before : null;
  if (!comparison) return <section aria-label={tr('Score ATS actuel', 'Current ATS score', 'نتيجة ATS الحالية')} className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border bg-card px-5 py-2">
    <p className="text-sm font-semibold">{tr('Score ATS actuel', 'Current ATS score', 'نتيجة ATS الحالية')}</p>
    <p className="text-xl font-semibold tabular-nums text-primary">{after ?? before ?? '—'}<small className="text-xs text-muted-foreground"> /100</small></p>
    <p className="text-xs text-muted-foreground">{tr('Analyse de ton CV', 'Your CV analysis', 'تحليل سيرتك الذاتية')}</p>
  </section>;
  return <section aria-label={tr('Comparaison des scores ATS', 'ATS score comparison', 'مقارنة نتائج ATS')} className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border bg-card px-5 py-3">
    <p className="text-sm font-semibold">Score ATS</p>
    <div><span className="text-xs text-muted-foreground">{tr('Avant', 'Before', 'قبل')}</span><p className="text-xl font-semibold tabular-nums">{before ?? '—'}<small className="text-xs text-muted-foreground"> /100</small></p></div>
    <span aria-hidden="true" className="text-muted-foreground">→</span>
    <div><span className="text-xs text-muted-foreground">{tr('Après', 'After', 'بعد')}</span><p className="text-xl font-semibold tabular-nums text-primary">{pending ? '—' : after ?? '—'}<small className="text-xs text-muted-foreground"> /100</small></p></div>
    <p className="max-w-xl text-xs leading-5 text-muted-foreground">{pending ? tr('Enregistre pour actualiser l’analyse et les surlignages.', 'Save to refresh the analysis and highlights.', 'احفظ لتحديث التحليل والتلوين.') : delta === 0 ? unchangedContent ? tr('Le contenu est inchangé. Le score reste identique.', 'Content is unchanged. The score stays the same.', 'المحتوى لم يتغير. النتيجة تبقى نفسها.') : tr('Score inchangé : une reformulation ne valide pas forcément de nouveaux critères ATS.', 'Unchanged score: rewording does not necessarily satisfy additional ATS checks.', 'النتيجة ثابتة: إعادة الصياغة لا تحقق بالضرورة معايير إضافية.') : delta !== null ? `${delta > 0 ? '+' : ''}${delta} ${tr('points · calculés sur le contenu analysé', 'points · calculated from analyzed content', 'نقاط · محسوبة من المحتوى')}` : tr('Analyse du contenu du CV', 'CV content analysis', 'تحليل محتوى السيرة')}</p>
  </section>;
}

export function CvImprovementReview({ proposal, onClose, onAccept }: { proposal: SectionProposal | null; onClose: () => void; onAccept: () => void }) {
  const tr = useReleaseText(), t = useCareerText();
  const left = useRef<HTMLDivElement>(null), right = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const lines = (value: string) => value.split('\n').map(s => s.trim()).filter(Boolean);
  const oldLines = lines(proposal?.before ?? ''), newLines = lines(proposal?.after ?? '');
  const additions = newLines.filter(line => !oldLines.includes(line)), removals = oldLines.filter(line => !newLines.includes(line));
  const unchanged = newLines.filter(line => oldLines.includes(line)).length;
  const modifiedCount = Math.max(additions.length, removals.length);
  const changed = proposal?.before.trim() !== proposal?.after.trim();
  const sync = (source: HTMLDivElement, destination: HTMLDivElement | null) => {
    if (!destination) return;
    const top = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight) * (destination.scrollHeight - destination.clientHeight);
    if (Math.abs(destination.scrollTop - top) > 2) destination.scrollTop = top;
  };
  function column(after: boolean) {
    const source = after ? newLines : oldLines, other = after ? oldLines : newLines;
    return <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${after ? 'bg-emerald-500/10' : 'bg-muted/60'}`}><h3 className="flex items-center gap-2 text-sm font-semibold">{after ? <EasyJobFeatureMark size="sm" className=" text-emerald-500" /> : <FileText className="size-4 text-muted-foreground" />}{after ? tr('Proposition EasyJob', 'EasyJob proposal', 'اقتراح EasyJob') : tr('Version originale', 'Original version', 'النسخة الأصلية')}</h3><span className="text-xs text-muted-foreground">{source.join(' ').split(/\s+/).filter(Boolean).length} {tr('mots', 'words', 'كلمة')}</span></div>
      <div ref={after ? right : left} onScroll={e => sync(e.currentTarget, after ? left.current : right.current)} className="max-h-[38vh] overflow-y-auto p-4">
        {source.map((line, i) => { const modified = !other.includes(line), title = /^#+\s/.test(line); return <p key={i} className={`mb-2 break-words rounded-md border-s-2 px-3 py-2 text-sm leading-6 ${title ? 'font-semibold tracking-wide' : ''} ${modified ? after ? 'border-emerald-500 bg-emerald-500/10' : 'border-rose-400 bg-rose-400/10' : 'border-transparent text-muted-foreground'}`}>{line.replace(/^#+\s*/, '').replace(/^[-*]\s/, '• ')}</p>; })}
      </div>
    </section>;
  }
  return <Dialog open={Boolean(proposal)} onOpenChange={open => { if (!open) onClose(); }}><DialogContent onOpenAutoFocus={e => { e.preventDefault(); heading.current?.focus(); }} className="!w-[min(1160px,96vw)] !max-w-none !p-0 max-h-[92dvh] overflow-hidden flex flex-col gap-0">
    <DialogHeader className="border-b bg-gradient-to-r from-primary/10 to-transparent px-6 py-5"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><EasyJobFeatureMark size="sm" className="" />EasyJob · {proposal?.scope === 'line' ? tr('Une ligne, plus claire', 'One clearer line', 'سطر أوضح') : tr('Une rubrique, plus claire', 'A clearer section', 'قسم أوضح')}</div><DialogTitle ref={heading} tabIndex={-1} className="text-xl outline-none">{proposal?.scope === 'line' ? tr('Comparer la ligne améliorée', 'Review the improved line', 'مراجعة السطر المحسن') : tr('Comparer la rubrique améliorée', 'Review the improved section', 'مراجعة القسم المحسن')}</DialogTitle><DialogDescription>{proposal?.heading} · {tr('Les passages modifiés sont mis en évidence.', 'Changed passages are highlighted.', 'المقاطع المعدلة مميزة بالألوان.')}</DialogDescription></DialogHeader>
    {proposal && <><div className="min-h-0 space-y-4 overflow-y-auto p-5 sm:p-6">
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-600 dark:text-emerald-300">{modifiedCount} {modifiedCount === 1 ? tr('passage modifié', 'changed passage', 'مقطع معدل') : tr('passages modifiés', 'changed passages', 'مقاطع معدلة')}</span><span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{unchanged} {unchanged === 1 ? tr('passage conservé', 'unchanged passage', 'مقطع محفوظ') : tr('passages conservés', 'unchanged passages', 'مقاطع محفوظة')}</span></div>
      <div className="grid gap-4 md:grid-cols-2">{column(false)}{column(true)}</div>
      <section className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">{tr('Ce qui a changé', 'What changed', 'ما الذي تغير')}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{changed ? tr('Compare les passages roses avec les passages verts. Seule cette sélection sera remplacée après ton accord.', 'Compare the pink passages with the green ones. Only this selection will be replaced after acceptance.', 'قارن المقاطع الوردية بالخضراء. سيتم استبدال الاختيار فقط بعد موافقتك.') : tr('Ce passage ne contient pas de reformulation automatique applicable. Tu peux le préciser directement dans le contenu du CV.', 'No automatic rewording applies to this passage. You can refine it directly in the CV content.', 'لا توجد إعادة صياغة تلقائية مناسبة لهذا المقطع. يمكنك تعديله مباشرة في محتوى السيرة.')}</p>{!!proposal.improvedChecks.length && <p className="mt-2 text-sm text-emerald-600">{tr('Critères ATS validés', 'ATS checks passed', 'معايير ATS متحققة')} : {proposal.improvedChecks.map(t).join(' · ')}</p>}</div></section>
      <CvScoreComparison before={proposal.beforeScore} after={proposal.score} unchangedContent={!changed} />
      {proposal.beforeReport?.audit && <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Comparer les dimensions de l’audit</summary><div className="mt-3 divide-y">{proposal.report.audit?.dimensions.map(d => <div key={d.key} className="flex justify-between gap-4 py-2 text-sm"><span>{({ ats_compatibility: 'Compatibilité ATS (texte)', content_quality: 'Contenu', recruiter_readability: 'Lisibilité', job_relevance: 'Pertinence pour l’offre', keyword_coverage: 'Termes de l’offre', experience_clarity: 'Clarté des expériences', achievement_strength: 'Résultats démontrés', structure_quality: 'Structure', contact_completeness: 'Coordonnées' } as Record<string, string>)[d.key] ?? d.key}</span><span className="tabular-nums">{proposal.beforeReport?.audit?.dimensions.find(b => b.key === d.key)?.score ?? '—'} → {d.score ?? '—'}</span></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Même méthode avant et après. Une reformulation peut laisser les contrôles inchangés.</p></details>}
    </div><div className="flex shrink-0 flex-wrap justify-end gap-3 border-t bg-card px-6 py-4"><Button variant="outline" onClick={onClose}>{tr('Garder l’ancienne version', 'Keep original', 'الاحتفاظ بالأصل')}</Button><Button disabled={!changed} onClick={onAccept}>{tr('Appliquer les améliorations', 'Apply improvements', 'تطبيق التحسينات')}<ArrowRight className="ms-2 size-4" /></Button></div></>}
  </DialogContent></Dialog>;
}
