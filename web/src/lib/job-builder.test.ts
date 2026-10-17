import { describe, expect, it } from 'vitest';
import { distinctRequirements, mergeSkills, processSteps, serializeSteps } from './job-builder';

describe('job builder data round trips', () => {
  const skills = [{ name: 'Docker', required: true, level: 'ADVANCED' as const }];
  it('removes exact duplicate skill requirements while retaining real qualifications', () => {
    expect(distinctRequirements(['Maîtrise de Docker', 'Docker.', 'Permis B obligatoire', 'Docker en production pendant 3 ans'], skills)).toEqual(['Permis B obligatoire', 'Docker en production pendant 3 ans']);
  });
  it('deduplicates names without weakening a required skill', () => {
    expect(mergeSkills([...skills, { name: ' docker ', required: false, level: 'BEGINNER' }])).toEqual(skills);
  });
  it('preserves legacy interview text and round trips ordered steps', () => {
    const old = 'Échange RH puis entretien technique en présence du responsable.';
    expect(processSteps(old)).toEqual([old]);
    const steps = ['Échange RH · 30 min', 'Entretien technique · 60 min'];
    expect(processSteps(serializeSteps(steps))).toEqual(steps);
    expect(serializeSteps([])).toBe('');
  });
});
