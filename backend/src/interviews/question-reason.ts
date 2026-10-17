export interface QuestionReason {
  reason_type: 'MISSING_EVIDENCE' | 'WEAK_EVIDENCE' | 'STRONG_EVIDENCE' | 'TRANSFERABLE' | 'SENIORITY' | 'GENERAL';
  skill?: string;
  requirement_importance?: string;
  evidence_count?: number;
  source_types: ('JOB' | 'CV' | 'INTERVIEW')[];
  excerpts?: { source: 'JOB' | 'CV'; text: string }[];
  transferable_from?: string;
  seniority?: string;
}

/** Compatibility for persisted briefs: use structured evidence, never parse diagnostic prose. */
export function questionReason(question: { sourceType?: string | null; skill?: string | null; evidence?: unknown; category?: string | null }): QuestionReason | null {
  if (question.sourceType === 'RECRUITER') return null;
  const evidence = question.evidence as { status?: string; reason?: QuestionReason } | null;
  if (evidence?.reason) return evidence.reason;
  const status = evidence?.status;
  const reason_type = status === 'missing' || question.category === 'GAP' ? 'MISSING_EVIDENCE'
    : status === 'strong' || question.category === 'STRENGTH' ? 'STRONG_EVIDENCE'
    : ['weak', 'partial'].includes(status ?? '') ? 'WEAK_EVIDENCE' : 'GENERAL';
  return { reason_type, ...(question.skill ? { skill: question.skill.replace(/^custom[_ ]+/i, '') } : {}), source_types: question.sourceType === 'JOB_CV_EVIDENCE' ? ['JOB', 'CV'] : ['INTERVIEW'] };
}

export function presentInterviewBrief<T extends { questions?: any[] } | null>(brief: T) {
  if (!brief) return null;
  return { ...brief, questions: brief.questions?.map(question => ({ ...question, reason: questionReason(question) })) };
}
