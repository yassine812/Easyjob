import { ApplicationStatus } from '@prisma/client';
import { TERMINAL_STATUSES } from './pipeline';

export const LOW_ALIGNMENT_THRESHOLD = 25;
export function potentialAssessment(score: number | null | undefined, explanation: unknown) {
  const data = (explanation ?? {}) as { growthAnalysis?: { score?: number | null; transferableEvidence?: Array<{ relevance?: number; confidence?: number; concept?: string }> }; evidenceAnalysis?: { requirements?: Array<{ status?: string }> } };
  const transferable = data.growthAnalysis?.transferableEvidence?.some(e => e.concept === 'skill_transferability' && (e.relevance ?? 0) >= .5 && (e.confidence ?? 0) >= .5)
    || data.evidenceAnalysis?.requirements?.some(e => e.status === 'TRANSFERABLE');
  const applicable = !(score != null && score < LOW_ALIGNMENT_THRESHOLD && !transferable);
  return { applicable, reason: applicable ? null : 'LOW_ALIGNMENT_INSUFFICIENT_EVIDENCE', score: applicable ? data.growthAnalysis?.score ?? null : null };
}

export function applicationWorkflow(status: ApplicationStatus, enteredAt: Date, targetHours: number, now = Date.now()) {
  const terminal = TERMINAL_STATUSES.has(status);
  const elapsedSeconds = terminal ? 0 : Math.max(0, Math.floor((now - enteredAt.getTime()) / 1000));
  const targetSeconds = terminal ? 0 : Math.round(targetHours * 3600);
  const overdueBySeconds = terminal ? 0 : Math.max(0, elapsedSeconds - targetSeconds);
  return { stage: status, stageEnteredAt: enteredAt, terminal, closedAt: terminal ? enteredAt : null, elapsedSeconds, targetSeconds, overdue: overdueBySeconds > 0, recruiterProcessingOverdue: overdueBySeconds > 0, overdueBySeconds, recruiterProcessingOverdueBySeconds: overdueBySeconds };
}

/** Completed intervals only; terminal states never accrue processing time. */
export function stageDurations(events: Array<{ newStatus: ApplicationStatus; createdAt: Date }>) {
  const ordered = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const sorted = ordered.filter((event, i) => i === 0 || event.newStatus !== ordered[i - 1].newStatus);
  return sorted.flatMap((event, i) => {
    const next = sorted[i + 1];
    if (!next || TERMINAL_STATUSES.has(event.newStatus)) return [];
    const stage = event.newStatus === 'SCREENING' ? 'UNDER_REVIEW' : event.newStatus === 'ASSESSMENT' ? 'INTERVIEW' : event.newStatus;
    return [{ stage, seconds: Math.max(0, (next.createdAt.getTime() - event.createdAt.getTime()) / 1000) }];
  });
}

export function criticalGapCount(explanation: unknown): number {
  const evidence = (explanation as { evidenceAnalysis?: { requirements?: Array<{ priority?: string; status?: string }> } } | null)?.evidenceAnalysis;
  return (evidence?.requirements ?? []).filter(row => row.priority === 'REQUIRED' && ['NOT_FOUND', 'CONFLICTING'].includes(row.status ?? '')).length;
}

export function rankingScoreForApplication(
  application: { aiMatchScore: number | null; potentialScore: string | null; matchExplanation?: unknown },
): number {
  const match = application.aiMatchScore ?? 0;
  const explanation = application.matchExplanation && typeof application.matchExplanation === 'object' && !Array.isArray(application.matchExplanation)
    ? application.matchExplanation as { evidenceAnalysis?: { score?: number | null; requirements?: Array<{ status?: string }> } }
    : null;
  const requiredCoverage = explanation?.evidenceAnalysis?.score ?? match;
  const potential = application.potentialScore === 'HIGH' ? 100 : application.potentialScore === 'MEDIUM' ? 60 : application.potentialScore === 'LOW' ? 25 : 0;
  const confidenceWeights: Record<string, number> = { EXPLICITLY_SUPPORTED: 1, PARTIALLY_SUPPORTED: .75, TRANSFERABLE: .6, NOT_FOUND: .2, CONFLICTING: 0 };
  const requirements = explanation?.evidenceAnalysis?.requirements ?? [];
  const confidence = application.aiMatchScore == null ? 0 : requirements.length
    ? Math.round(100 * requirements.reduce((sum, requirement) => sum + (confidenceWeights[requirement.status ?? ''] ?? .2), 0) / requirements.length)
    : 0;
  const criticalPenalty = criticalGapCount(application.matchExplanation) * 8;
  // Stable, explainable ranking used only for recruiter ordering and Top N.
  return Math.round((match * 0.5 + requiredCoverage * 0.2 + potential * 0.2 + confidence * 0.1 - criticalPenalty) * 100) / 100;
}
