import type { AtsCriterion } from './api/career';

export function isCvStrength(item: AtsCriterion) {
  return item.passed && !(item.key === 'quantified_evidence' && item.metrics?.kind === 'scope');
}

const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Match backend evidence to actual PDF text runs, never guessed page coordinates. */
export function matchCvEvidence(textRuns: string[], criteria: AtsCriterion[]): Map<number, AtsCriterion> {
  const runs = textRuns.map(normalize);
  const joined = runs.join('');
  const offsets: number[] = [];
  let offset = 0;
  for (const run of runs) { offsets.push(offset); offset += run.length; }
  const matches = new Map<number, AtsCriterion>();
  // Specific weak passages win over broad passing observations on the same text.
  const ordered = [...criteria].filter(c => !['readable_text', 'readable_length'].includes(c.key)).sort((a, b) => Number(isCvStrength(a)) - Number(isCvStrength(b)));
  for (const item of ordered) {
    for (const raw of item.evidence ?? []) {
      const evidence = normalize(raw);
      if (evidence.length < 4) continue;
      let start = joined.indexOf(evidence);
      while (start >= 0) {
        const end = start + evidence.length;
        runs.forEach((run, i) => {
          if (run.length && offsets[i] < end && offsets[i] + run.length > start && !matches.has(i)) matches.set(i, item);
        });
        start = joined.indexOf(evidence, end);
      }
    }
  }
  return matches;
}
