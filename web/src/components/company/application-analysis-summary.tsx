'use client';
import type { Application } from '@/types/api';
import { useRecruitmentText } from '@/lib/i18n/recruitment';
import { analysisTone, evidenceConfidence, potentialView } from '@/lib/recruitment-presentation';
import { EasyJobAvatar, EasyJobFeature, AnalysisInfo } from './easyjob-feature';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';

export function ApplicationAnalysisSummary({ application: app, companyId, compact = false, onAnalyze }: { application: Application; companyId: string; compact?: boolean; onAnalyze?: () => void }) {
  const t = useRecruitmentText(), potential = potentialView(app), confidence = evidenceConfidence(app);
  if (app.advancedAnalysisAvailable === false) return <p className="rounded-xl border p-4 text-sm text-muted-foreground">{t('advancedAnalysisPremium')}</p>;
  const classification = app.classification ?? app.aiQualification ?? 'REVIEW';
  const rows = app.matchExplanation?.evidenceAnalysis?.requirements ?? [];
  return <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-label={t('easyjobAnalysis')}>
    <EasyJobFeature companyId={companyId} />
    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
      <div><p className="text-xs text-muted-foreground"><AnalysisInfo label={t('match')} help={t('matchExplanationHelp')} /></p><p className="mt-2 text-xl font-semibold">{app.aiMatchScore == null ? '—' : `${app.aiMatchScore}%`}</p></div>
      <div><p className="text-xs text-muted-foreground"><AnalysisInfo label={t('potential')} help={t('potentialHelp')} /></p><span className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-xs font-medium ${potential.tone}`}>{t(potential.category)}{potential.score != null && !compact ? ` · ${potential.score}/100` : ''}</span></div>
      <div><p className="text-xs text-muted-foreground"><AnalysisInfo label={t('classification')} help={t('classificationHelp')} /></p><span className={`mt-2 inline-flex rounded-lg border px-2 py-1 text-xs font-medium ${analysisTone(classification)}`}>{t(classification)}</span></div>
      {!compact && <div><p className="text-xs text-muted-foreground"><AnalysisInfo label={t('confidence')} help={t('confidenceHelp')} /></p><p className="mt-2 text-xl font-semibold">{confidence == null ? '—' : `${confidence}%`}</p></div>}
    </div>
    {!potential.applicable && !compact && <p className="text-sm text-muted-foreground">{t('potentialNotRelevant')}</p>}
    {compact ? <Button variant="link" className="h-auto p-0" onClick={onAnalyze}>{t('fullAnalysis')}</Button> : <Dialog><DialogTrigger asChild><Button size="sm" variant="outline">{t('whyMatch')}</Button></DialogTrigger><DialogContent className="max-h-[85dvh] overflow-y-auto"><div className="flex items-start gap-3"><EasyJobAvatar /><div><DialogTitle>{t('whyMatch')}</DialogTitle><DialogDescription>{app.candidate?.headline || t('candidate')} → {app.job?.title}</DialogDescription></div></div><p className="text-sm text-muted-foreground">{t('matchExplanationHelp')}</p>{rows.length ? <ul className="space-y-3">{rows.map(row => <li key={row.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{row.label}</p><p className="mt-1 text-xs text-muted-foreground">{t(row.status === 'EXPLICITLY_SUPPORTED' ? 'covered' : row.status === 'TRANSFERABLE' || row.status === 'PARTIALLY_SUPPORTED' ? 'partiallyCovered' : 'notDemonstrated')}</p>{row.evidence.slice(0, 1).map((e, i) => <blockquote key={i} className="mt-2 border-s-2 ps-3 text-muted-foreground">{e.quote}</blockquote>)}</li>)}</ul> : <p>{t('noEvidenceInGroup')}</p>}<p className="text-xs text-muted-foreground">{t('humanReview')}</p></DialogContent></Dialog>}
  </section>;
}
