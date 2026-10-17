import { analyzeDeterministicInterview, selectDeterministicQuestions } from '../../src/career/deterministic-interview';

describe('deterministic CV to job interview preparation', () => {
  it('preserves custom skill names and asks a concrete question without inventing CV evidence', () => {
    const result = analyzeDeterministicInterview({ skills: [{ name: 'Redis', required: true }] }, '', 'fr');
    expect(result.requirements[0].label).toBe('Redis');
    const questions = selectDeterministicQuestions(result, 'fr');
    expect(questions.join(' ')).toContain('Redis');
    expect(questions.join(' ')).not.toMatch(/custom|démontrerais|Tu mentionnes/);
  });
  it('recognizes CV evidence for skills outside the taxonomy', () => {
    const result = analyzeDeterministicInterview({ skills: [{ name: 'Redis' }] }, 'EXPERIENCE\nBuilt a cache using Redis', 'fr');
    expect(result.evidence[0].status).toBe('strong');
  });
  it('recognizes REST endpoint evidence for an API Development requirement', () => {
    const result = analyzeDeterministicInterview({ title: 'Backend Developer', requirements: ['API Development required'], skills: [] }, 'EXPERIENCE\nBuilt REST endpoints using Django REST Framework');
    expect(result.evidence.find(item => item.concept === 'api_development')).toMatchObject({ status: 'strong' });
    expect(result.gaps.some(item => item.concept === 'api_development')).toBe(false);
  });

  it('marks Docker as missing and ranks it above a preferred Kubernetes gap', () => {
    const result = analyzeDeterministicInterview({ title: 'Backend Developer', description: 'Docker required. Kubernetes is a plus.', skills: [] }, 'SKILLS\nPython\nDjango\nPostgreSQL');
    const docker = result.gaps.find(item => item.concept === 'docker');
    const kubernetes = result.gaps.find(item => item.concept === 'kubernetes');
    expect(docker).toMatchObject({ status: 'missing', importance: 'REQUIRED' });
    expect(kubernetes).toMatchObject({ status: 'missing', importance: 'PREFERRED' });
    expect(result.topics.findIndex(topic => topic.concept === 'docker')).toBeLessThan(result.topics.findIndex(topic => topic.concept === 'kubernetes'));
  });

  it('selects reproducible, deduplicated questions from the local bank', () => {
    const result = analyzeDeterministicInterview({ title: 'Backend Developer', requirements: ['Docker required'], skills: [] }, '');
    const first = selectDeterministicQuestions(result, 'en', 3, 'session-1');
    expect(first).toEqual(selectDeterministicQuestions(result, 'en', 3, 'session-1'));
    expect(new Set(first.map(question => question.toLowerCase())).size).toBe(first.length);
    expect(first.join(' ')).toContain('Docker');
  });
});
