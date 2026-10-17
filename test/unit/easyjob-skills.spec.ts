import { EasyJobSkillHandlers } from '../../src/skills/easyjob/easyjob-skill.handlers';
import { EasyJobSkillRegistry } from '../../src/skills/easyjob/easyjob-skill.registry';
import { EasyJobSkillRuntime } from '../../src/skills/easyjob/easyjob-skill.runtime';

function context(input: Record<string, unknown>, permissions: string[] = ['application.view']) {
  return { userId: 'u1', locale: 'fr' as const, permissions, input };
}

describe('EasyJob Skills', () => {
  let registry: EasyJobSkillRegistry;
  let runtime: EasyJobSkillRuntime;

  beforeEach(() => {
    registry = new EasyJobSkillRegistry();
    for (const definition of new EasyJobSkillHandlers(undefined).definitions()) registry.register(definition);
    runtime = new EasyJobSkillRuntime(registry);
  });

  it('registers versioned executable skills', () => {
    expect(registry.listSkills().map(skill => skill.name)).toEqual(expect.arrayContaining(['smart-job-creation', 'company-public-context', 'candidate-evidence', 'interview-brief', 'interview-question-followup', 'interview-skill-coverage', 'interview-notes', 'post-interview-summary', 'candidate-cv-tailoring', 'candidate-job-fit-explainer', 'candidate-interview-prep', 'candidate-star-story', 'candidate-application-followup', 'duplicate-job-detector', 'negotiation-prep']));
  });

  it('executes deterministic candidate evidence without an LLM', async () => {
    const result = await runtime.execute('candidate-evidence', context({ cvText: 'SKILLS\nPython\nDjango', job: { skills: [{ name: 'Python', required: true }, { name: 'Kubernetes', required: true }] } }));
    expect(result.status).toBe('COMPLETED');
    expect((result.output as any).evidence).toEqual(expect.arrayContaining([expect.objectContaining({ skill: 'Python', status: 'STRONG_EVIDENCE' })]));
  });

  it('refuses execution when the required permission is missing', async () => {
    await expect(runtime.execute('candidate-evidence', context({ cvText: 'Python', job: { skills: [] } }, []))).rejects.toThrow('Missing skill permission');
  });

  it('tailors only from existing CV evidence and requires confirmation', async () => {
    const result = await runtime.execute('candidate-cv-tailoring', context({ cvText: 'SKILLS\nTypeScript\n\nEXPERIENCE\nBuilt APIs', job: { skills: [{ name: 'TypeScript', required: true }, { name: 'Kubernetes', required: true }] } }, ['candidate.cv.edit']));
    expect(result.status).toBe('COMPLETED');
    expect((result.output as any).inventedFacts).toBe(false);
    expect((result.output as any).applyAutomatically).toBe(false);
    expect((result.output as any).missingEvidence).toEqual(expect.arrayContaining([expect.objectContaining({ label: expect.any(String) })]));
  });

  it('flags duplicate jobs without hiding them', async () => {
    const result = await runtime.execute('duplicate-job-detector', context({ jobs: [{ id: 'a', companyName: 'Acme', title: 'Backend Engineer', location: 'Tunis', reference: 'x' }, { id: 'b', companyName: 'Acme', title: 'Backend Engineer', location: 'Tunis', reference: 'x' }] }, ['candidate.job.view']));
    expect(result.status).toBe('COMPLETED');
    expect((result.output as any).pairs).toHaveLength(1);
    expect((result.output as any).autoHidden).toBe(false);
  });

  it('keeps STAR content candidate-authored', async () => {
    const result = await runtime.execute('negotiation-prep', context({ offeredSalary: 3000, candidateTarget: 3800, currency: 'TND' }, ['candidate.job.view']));
    expect(result.status).toBe('COMPLETED');
    expect((result.output as any).inventedFacts).toBe(false);
  });
});
