import { analyzeGrowthPotential } from '../../src/career/growth-potential';

const job = {
  id: 'job', companyId: 'company', title: 'Backend Developer', description: 'Build APIs', location: null, remote: true,
  employmentType: 'FULL_TIME', experienceLevel: 'MID', requirements: ['Django', 'REST API'], skills: [{ skill: { name: 'Django' }, required: true }, { skill: { name: 'PostgreSQL' }, required: true }],
} as never;

describe('deterministic growth potential', () => {
  it('uses adjacent professional evidence and career progression', () => {
    const result = analyzeGrowthPotential({
      headline: 'Backend developer', bio: null, location: null, yearsExperience: 3,
      skills: [{ name: 'Flask' }, { name: 'PostgreSQL' }],
      experiences: [
        { title: 'Junior Developer', companyName: 'A', description: 'Built REST API services with Flask', startDate: new Date('2022-01-01'), endDate: new Date('2023-01-01'), current: false },
        { title: 'Backend Developer', companyName: 'B', description: 'Maintained PostgreSQL services', startDate: new Date('2023-01-01'), endDate: null, current: true },
      ],
      educations: [], professionalData: { sections: { projects: [], certifications: [] } }, resumes: [],
    }, job, { growthPotentialScore: 40 });

    expect(result.score).toBeGreaterThan(0);
    expect(result.transferableEvidence.some(evidence => evidence.relatedSkill?.includes('-> Django'))).toBe(true);
    expect(result.components.progression).toBeGreaterThan(0);
    expect(result.why.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('uses cover letter evidence as supporting evidence without replacing work evidence', () => {
    const result = analyzeGrowthPotential({ headline: null, bio: null, location: null, yearsExperience: null, skills: [], experiences: [], educations: [], professionalData: { sections: {} }, resumes: [] }, job, { growthPotentialScore: null }, 'I built REST APIs with Flask and use Docker on personal projects.');
    expect(result.coverLetter.provided).toBe(true);
    expect(result.coverLetter.checks.concreteExperience).toBe(true);
    expect(result.transferableEvidence.every(evidence => evidence.source === 'COVER_LETTER')).toBe(true);
  });

  it('returns undetermined when there is no professional evidence', () => {
    const result = analyzeGrowthPotential({ headline: null, bio: null, location: null, yearsExperience: null, skills: [], experiences: [], educations: [], professionalData: { sections: {} }, resumes: [] }, job, { growthPotentialScore: null });
    expect(result.category).toBe('UNDETERMINED');
    expect(result.score).toBeNull();
    expect(result.summary).toMatch(/No sufficient/);
  });

  it('keeps cover-letter claims below documented work evidence', () => {
    const work = analyzeGrowthPotential({ headline: null, bio: null, location: null, yearsExperience: null, skills: [], experiences: [{ title: 'Backend Developer', companyName: 'A', description: 'Built Django APIs with PostgreSQL', startDate: new Date('2022-01-01'), endDate: null, current: true }], educations: [], professionalData: { sections: {} }, resumes: [] }, job, { growthPotentialScore: null });
    const letter = analyzeGrowthPotential({ headline: null, bio: null, location: null, yearsExperience: null, skills: [], experiences: [], educations: [], professionalData: { sections: {} }, resumes: [] }, job, { growthPotentialScore: null }, 'I built Django APIs with PostgreSQL.');
    expect(work.score ?? 0).toBeGreaterThan(letter.score ?? 0);
    expect(letter.transferableEvidence.every(evidence => evidence.source === 'COVER_LETTER')).toBe(true);
  });
});
