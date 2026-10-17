import type { Application } from '@/types/api';
export const toneClasses = {
  positive: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  promising: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  review: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  low: 'border-rose-500/20 bg-rose-500/5 text-rose-800 dark:text-rose-300',
  neutral: 'border-border bg-muted/40 text-muted-foreground',
};
export function analysisTone(value?: string | null) {
  return value === 'HIGH' || value === 'STRONG_MATCH' ? toneClasses.positive : value === 'PROMISING' ? toneClasses.promising : value === 'MEDIUM' || value === 'REVIEW' ? toneClasses.review : value === 'LOW' || value === 'LOW_ALIGNMENT' ? toneClasses.low : toneClasses.neutral;
}
export function potentialView(app: Application) {
  const stored = app.matchExplanation?.growthAnalysis;
  // The API owns applicability. The fallback protects older cached responses.
  const transferable = stored?.transferableEvidence?.some(e => e.concept === 'skill_transferability' && e.relevance >= .5 && e.confidence >= .5) || app.matchExplanation?.evidenceAnalysis?.requirements?.some(e => e.status === 'TRANSFERABLE');
  const applicable = app.potentialAssessment?.applicable ?? !(app.aiMatchScore != null && app.aiMatchScore < 25 && !transferable);
  const score = applicable ? stored?.score ?? app.growthPotential?.score ?? null : null;
  const category = applicable ? stored?.category ?? app.growthPotential?.level ?? app.potentialScore ?? 'UNDETERMINED' : 'NOT_APPLICABLE';
  return { applicable, score, category, tone: analysisTone(category) };
}
export function evidenceConfidence(app: Application) {
  const evidence = app.matchExplanation?.evidenceAnalysis;
  if (!evidence?.requirements?.length) return null;
  const supported = evidence.requirements.filter(row => row.evidence.some(item => item.source !== 'JOB' && item.quote.trim().length >= 20));
  return Math.round(100 * supported.length / evidence.requirements.length);
}
export const isTerminalApplication = (status: string) => ['REJECTED', 'HIRED', 'WITHDRAWN', 'CLOSED'].includes(status);
