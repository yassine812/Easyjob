'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';


import { useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, FileText, GraduationCap, Mail, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EasyJobAvatar, EasyJobFeature } from './easyjob-feature';
import { potentialView, analysisTone } from '@/lib/recruitment-presentation';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import type { GrowthAnalysis, GrowthEvidence } from '@/lib/api/career';
import type { Application } from '@/types/api';

const scoreLabel = (score: number | null | undefined) => score == null ? '—' : `${Math.round(score)}/100`;

function fallbackAnalysis(application: Application, t: (key: string) => string): GrowthAnalysis {
  const stored = application.matchExplanation?.growthAnalysis;
  const category = application.growthPotential?.level === 'INCOMPLETE' ? 'INCOMPLETE' : application.potentialScore === 'HIGH' || application.potentialScore === 'MEDIUM' || application.potentialScore === 'LOW' ? application.potentialScore : 'UNDETERMINED';
  return stored ?? {
    score: application.growthPotential?.score ?? null,
    category,
    summary: application.potentialReason || application.growthPotential?.reasons.join(' ') || (category === 'INCOMPLETE' ? t('incompleteAnalysisHelp') : t('notDeterminedHelp')),
    why: application.growthPotential?.reasons ?? [],
    strengths: [], evidence: [], transferableEvidence: [], gaps: [],
    coverLetter: { provided: Boolean(application.coverLetter), relevance: application.coverLetter ? 'low' : 'not_provided', score: null, evidence: [], checks: { jobSpecificReferences: false, concreteExperience: false, relevantAchievements: false, technologiesWithExamples: false } },
    components: {}, componentBreakdown: [], progression: { steps: [], summary: null }, method: 'legacy',
  };
}

function EvidenceItem({ item, t }: { item: GrowthEvidence; t: (key: string) => string }) {
  return <details className="group rounded-xl border border-border/70 bg-muted/20 p-3 open:bg-muted/35">
    <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
      <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><SourceIcon source={item.source} /></span>
      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-medium">{item.relatedSkill ?? item.concept.replaceAll('_', ' ')}{item.strength && <span className="rounded-full border px-2 py-0.5 text-[10px] font-normal text-muted-foreground">{item.strength}</span>}</span><span className="mt-1 block text-xs text-muted-foreground">{item.sourceLabel || t(item.source)}{item.section ? ` · ${item.section.replaceAll('_', ' ')}` : ''}</span></span><span className="text-muted-foreground transition-transform group-open:rotate-90"><ArrowRight className="size-4" /></span>
    </summary>
    <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-sm"><p className="whitespace-pre-wrap leading-6">“{item.evidence}”</p><p className="text-xs text-muted-foreground">{t(item.source)}{item.recency ? ` · ${new Date(item.recency).toLocaleDateString()}` : ''}</p></div>
  </details>;
}

function SourceIcon({ source }: { source: GrowthEvidence['source'] }) {
  if (source === 'WORK_EXPERIENCE') return <BriefcaseBusiness className="size-4" />;
  if (source === 'PROJECT') return <FileText className="size-4" />;
  if (source === 'CERTIFICATION') return <GraduationCap className="size-4" />;
  if (source === 'COVER_LETTER') return <Mail className="size-4" />;
  return <FileText className="size-4" />;
}

export function GrowthPotentialDialog({ application }: { application: Application }) {
  const t = useRecruitmentText();
  const [open, setOpen] = useState(false);
  const analysis = fallbackAnalysis(application, t);
  const name = application.candidate?.user.name || t('candidate');
  const view = potentialView(application);
  const score = view.score;
  const evidence = analysis.evidence?.length ? analysis.evidence : analysis.transferableEvidence;
  const category = view.category;
  const percentValue = score == null ? 0 : Math.max(0, Math.min(100, score));
  const mastered = evidence.filter(item => item.concept === 'relevant_skill_evidence').slice(0, 8);
  const transferable = evidence.filter(item => item.concept === 'skill_transferability');
  const classification = application.classification ? t(application.classification) : t('REVIEW');
  const progression = analysis.progression;
  if (!view.applicable) return <Dialog><DialogTrigger asChild><Button size="sm" variant="ghost" className={`h-auto rounded-lg border px-2 py-1 text-xs ${view.tone}`}>{t('NOT_APPLICABLE')}</Button></DialogTrigger><DialogContent><div className="flex items-start gap-3"><EasyJobAvatar /><div><DialogTitle>{t('potential')}</DialogTitle><DialogDescription>{t('potentialNotRelevant')}</DialogDescription></div></div></DialogContent></Dialog>;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" size="sm" variant="ghost" className={`h-auto max-w-full rounded-lg border px-2 py-1 ${view.tone}`} aria-label={`${t('viewGrowthAnalysis')} ${name}`}><span className="truncate">{t(category)}{score != null ? ` · ${scoreLabel(score)}` : ''}</span><ArrowRight className="ms-1 size-3.5 shrink-0" /></Button></DialogTrigger><DialogContent className="!w-[min(1000px,calc(100vw-1rem))] !max-w-none max-h-[92dvh] overflow-x-hidden overflow-y-auto p-0 sm:!w-[min(1000px,calc(100vw-2rem))]">
    <DialogHeader className="border-b bg-muted/20 px-5 py-5 sm:px-7"><div className="flex items-start gap-3 pe-8"><EasyJobAvatar /><div className="min-w-0"><EasyJobFeature label={t("potential")} /><DialogTitle className="truncate text-xl">{name}</DialogTitle><DialogDescription className="mt-1 truncate">{application.candidate?.headline || application.job?.title || '—'}</DialogDescription></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label={t('match')} value={application.aiMatchScore == null ? '—' : `${Math.round(application.aiMatchScore)}%`} /><Metric label={t('potential')} value={`${scoreLabel(score)} · ${t(category)}`} tone={view.tone} /><Metric label={t('classification')} value={classification} /><Metric label={t('analysisStatus')} value={t(application.analysisStatus || application.aiScreeningStatus || 'PENDING')} /></div></DialogHeader>
    <div className="grid min-w-0 gap-6 p-5 sm:p-7 lg:grid-cols-[190px_minmax(0,1fr)]"><aside className="space-y-4 lg:sticky lg:top-0 lg:self-start"><div className="rounded-2xl border bg-muted/20 p-4 text-center"><div className="relative mx-auto grid size-28 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${percentValue}%, hsl(var(--muted)) 0)` }}><div className="grid size-20 place-items-center rounded-full bg-background"><span className="text-xl font-semibold tabular-nums">{score == null ? '—' : Math.round(score)}</span></div></div><p className="mt-3 font-semibold">{t('potential')}</p><p className="text-sm text-muted-foreground">{t(category)}</p></div><div className="rounded-xl border p-4 text-xs text-muted-foreground"><p className="font-semibold text-foreground">{t('humanReview')}</p><p className="mt-2">{t('growthEvidenceTraceability')}</p></div></aside><main className="min-w-0 space-y-7">
      <section><SectionTitle icon={EasyJobFeatureMark} title={t('growthWhy')} /><p className="mb-3 text-sm text-muted-foreground">{analysis.summary}</p><div className="space-y-2">{analysis.why.length ? analysis.why.map((reason, index) => <div key={`${reason}-${index}`} className={`flex gap-2 rounded-xl border p-3 text-sm ${analysisTone(category)}`}><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><p>{reason}</p></div>) : <EmptyText text={t('notDeterminedHelp')} />}</div></section>
      <section><SectionTitle icon={CheckCircle2} title={t('masteredSkills')} /><div className="grid gap-3 sm:grid-cols-2">{mastered.length ? mastered.map((item, index) => <EvidenceItem key={`${item.id ?? item.evidence}-${index}`} item={item} t={t} />) : <EmptyText text={t('notDeterminedHelp')} />}</div></section>
      <section><SectionTitle icon={TrendingUp} title={t('transferableSkills')} /><div className="space-y-3">{transferable.length ? transferable.map((item, index) => <div key={`${item.id ?? item.evidence}-${index}`} className="rounded-xl border p-4"><div className="flex items-center gap-2 font-medium"><span>{item.relatedSkill || item.evidence}</span><ArrowRight className="size-4 text-primary" /></div><p className="mt-2 text-sm text-muted-foreground">{item.evidence}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full border px-2 py-1">{t(item.source)}</span><span className="rounded-full bg-muted px-2 py-1">{t('moderate')}</span></div></div>) : <EmptyText text={t('noTransferableEvidence')} />}</div></section>
      <section><SectionTitle icon={AlertTriangle} title={t('growthGaps')} /><div className="space-y-3">{analysis.gaps.length ? analysis.gaps.map(gap => <div key={gap.skill} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{gap.skill}</p><span className={`rounded-full px-2 py-1 text-xs ${gap.critical ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>{gap.critical ? t('criticalGap') : t('developmentPoint')}</span></div><p className="mt-2 text-sm text-muted-foreground">{gap.currentEvidence}</p><p className="mt-2 text-sm">{gap.gap}</p><p className="mt-2 text-xs text-muted-foreground">{t(gap.effort)}</p></div>) : <EmptyText text={t('noDevelopmentPoints')} />}</div></section>
      {analysis.coverLetter.provided && <section><SectionTitle icon={Mail} title={t('coverLetterAnalysis')} /><div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="font-medium">{t('coverLetterRelevance')}: {t(analysis.coverLetter.relevance)}</p><ul className="mt-3 space-y-2 text-sm">{Object.entries(analysis.coverLetter.checks).map(([key, passed]) => <li key={key} className="flex gap-2"><span className={passed ? 'text-emerald-600' : 'text-muted-foreground'}>{passed ? '✓' : '—'}</span>{t(`coverLetter_${key}`)}</li>)}</ul>{analysis.coverLetter.evidence.length > 0 && <div className="mt-4 space-y-2 border-t pt-3 text-sm">{analysis.coverLetter.evidence.map((quote, index) => <p key={index}>“{quote}”</p>)}</div>}</div></section>}
      {progression?.steps.length ? <section><SectionTitle icon={TrendingUp} title={t('careerProgression')} /><div className="space-y-2">{progression.steps.map((step, index) => <div key={`${step.title}-${step.companyName}-${index}`} className="flex gap-3"><div className="flex flex-col items-center"><span className="mt-1 size-2.5 rounded-full bg-primary" />{index < progression.steps.length - 1 && <span className="h-full w-px bg-border" />}</div><div className="pb-3"><p className="font-medium">{step.title}</p><p className="text-sm text-muted-foreground">{step.companyName} · {new Date(step.startDate).getFullYear()} — {step.current ? t('present') : step.endDate ? new Date(step.endDate).getFullYear() : '—'}</p></div></div>)}{progression.summary && <p className="text-sm text-muted-foreground">{progression.summary}</p>}</div></section> : null}
      {analysis.componentBreakdown?.length ? <section><SectionTitle icon={EasyJobFeatureMark} title={t('scoreBreakdown')} /><div className="space-y-2">{analysis.componentBreakdown.map(component => <div key={component.type} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"><span>{component.label}</span><span className={component.contribution < 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>{component.contribution > 0 ? '+' : ''}{component.contribution}</span></div>)}</div></section> : null}
      {evidence.length > 0 && <section><SectionTitle icon={FileText} title={t('allSources')} /><div className="space-y-2">{evidence.map((item, index) => <EvidenceItem key={`${item.id ?? item.evidence}-${index}`} item={item} t={t} />)}</div></section>}
    </main></div>
  </DialogContent></Dialog>;
}

function Metric({ label, value, tone = '' }: { label: string; value: string; tone?: string }) { return <div className="rounded-xl border bg-background/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 truncate text-sm font-semibold ${tone}`}>{value}</p></div>; }
function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) { return <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><Icon className="size-4 text-primary" />{title}</h2>; }
function EmptyText({ text }: { text: string }) { return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{text}</p>; }
