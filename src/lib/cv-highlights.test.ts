import { describe, expect, it } from 'vitest';
import { isCvStrength, matchCvEvidence } from './cv-highlights';
import type { AtsCriterion } from './api/career';

const criterion = (key: string, evidence: string[], passed = true): AtsCriterion => ({ key, evidence, passed, weight: 10 });
describe('PDF evidence locations', () => {
  it('matches accented evidence across split PDF runs and line breaks', () => {
    const item = criterion('summary', ['Développeur full-stack expérimenté']);
    expect([...matchCvEvidence(['DÉVELOPPEUR ', 'full-stack', ' expérimenté', 'unrelated'], [item]).keys()]).toEqual([0, 1, 2]);
  });
  it('does not fabricate a location for a missing section or unmatched evidence', () => {
    expect(matchCvEvidence(['Python developer'], [criterion('skills', ['Kubernetes'], false), criterion('phone', [], false)]).size).toBe(0);
  });
  it('prioritizes actionable evidence over broad passing observations', () => {
    const broad = criterion('experience', ['Built four features']);
    const scope = { ...criterion('quantified_evidence', ['Built four features']), metrics: { kind: 'scope' } };
    expect(isCvStrength(scope)).toBe(false);
    expect(matchCvEvidence(['Built four features'], [broad, scope]).get(0)).toBe(scope);
  });
  it('keeps contact coordinates attached to the matching text', () => {
    const email = criterion('email', ['test@example.test']);
    expect([...matchCvEvidence(['Contact', 'test@example.test', 'Experience'], [email]).keys()]).toEqual([1]);
  });
});
