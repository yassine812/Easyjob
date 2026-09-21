export const DEFAULT_THRESHOLDS = { excellent: 90, strong: 80, good: 70, potential: 55 };
export function matchCategory(score: number | null, thresholds = DEFAULT_THRESHOLDS): string {
  if (score === null) return 'UNANALYZED';
  if (score >= thresholds.excellent) return 'EXCELLENT';
  if (score >= thresholds.strong) return 'STRONG';
  if (score >= thresholds.good) return 'GOOD';
  if (score >= thresholds.potential) return 'POTENTIAL';
  return 'WEAK';
}
export function validThresholds(t: typeof DEFAULT_THRESHOLDS) {
  return t.excellent > t.strong && t.strong > t.good && t.good > t.potential;
}
