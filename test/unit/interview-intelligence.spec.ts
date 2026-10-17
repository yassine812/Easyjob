import { analyzeInterviewJob } from '../../src/career/interview-intelligence';

describe('interview intelligence', () => {
  it('builds an evidence-based preparation profile from a selected role', () => {
    const result = analyzeInterviewJob({
      title: 'Développeur Full-Stack Python Django React',
      description: 'Développer des API REST et collaborer avec une équipe. Docker est apprécié.',
      company: { commercialName: 'EasyJob Test Lab' },
      skills: [{ name: 'Python', required: true }, { name: 'Django', required: true }, { name: 'Docker', required: false }],
    }, 'Python et Django');

    expect(result.technicalSkills).toEqual(expect.arrayContaining(['Python', 'Django', 'React', 'REST', 'API']));
    expect(result.tools).toContain('Docker');
    expect(result.recommendedTypes).toEqual(expect.arrayContaining(['TECHNICAL', 'CODING', 'BEHAVIORAL', 'HR']));
    expect(result.gaps).toContain('React');
    expect(result.requirements.some(item => item.evidence.length > 0)).toBe(true);
  });
});
