/**
 * Recruiter-facing thresholds are backend policy.  `good`/`potential` remain
 * for the legacy analytics filters; `promising` and `review` drive the
 * Premium recruitment-intelligence workflow.
 */
export const DEFAULT_THRESHOLDS = { excellent: 90, strong: 80, promising: 65, review: 50, good: 70, potential: 55 };
export function normalizeThresholds(value?: Partial<typeof DEFAULT_THRESHOLDS> | null): typeof DEFAULT_THRESHOLDS {
  return { ...DEFAULT_THRESHOLDS, ...(value ?? {}) };
}
export function matchCategory(score: number | null, thresholds: Partial<typeof DEFAULT_THRESHOLDS> = DEFAULT_THRESHOLDS): string {
  const normalized = normalizeThresholds(thresholds);
  if (score === null) return 'UNANALYZED';
  if (score >= normalized.excellent) return 'EXCELLENT';
  if (score >= normalized.strong) return 'STRONG';
  if (score >= normalized.good) return 'GOOD';
  if (score >= normalized.potential) return 'POTENTIAL';
  return 'WEAK';
}
export function validThresholds(t: Partial<typeof DEFAULT_THRESHOLDS>) {
  const thresholds = normalizeThresholds(t);
  return thresholds.excellent > thresholds.strong && thresholds.strong > thresholds.good && thresholds.good > thresholds.potential && thresholds.strong > thresholds.promising && thresholds.promising > thresholds.review;
}

/**
 * Recruiter-facing classification. This is deliberately separate from the
 * legacy `matchCategory` values used by analytics. It is a routing hint for
 * human review, never an automatic rejection decision.
 */
export const RECRUITMENT_CLASSIFICATIONS = ['STRONG_MATCH', 'PROMISING', 'REVIEW', 'LOW_ALIGNMENT'] as const;
export type RecruitmentClassification = typeof RECRUITMENT_CLASSIFICATIONS[number];

export function recruitmentClassification(
  score: number | null,
  potential: string | null | undefined,
  thresholds: Partial<typeof DEFAULT_THRESHOLDS> = DEFAULT_THRESHOLDS,
  criticalGaps = 0,
): RecruitmentClassification {
  const normalized = normalizeThresholds(thresholds);
  if (score == null) return 'REVIEW';
  if (score >= normalized.strong) return 'STRONG_MATCH';

  // A candidate with a usable current match can still be promising when the
  // evidence shows strong transferable/growth potential and no critical
  // requirement is contradicted or missing. This keeps Match and Potential
  // distinct while keeping the 65-point promising threshold explicit.
  if (potential === 'HIGH' && score >= normalized.promising && criticalGaps === 0) return 'PROMISING';
  if (criticalGaps > 0 && score < normalized.strong) return 'LOW_ALIGNMENT';
  if (score >= normalized.review) return 'REVIEW';
  return 'LOW_ALIGNMENT';
}
