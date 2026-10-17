import { matchCandidate } from '../../src/career/career-engine';
import { analyzeGrowthPotential } from '../../src/career/growth-potential';
import { recruitmentClassification } from '../../src/companies/recruitment-metrics';

const jobData = {
  id: 'backend-job', companyId: 'company', title: 'Backend Developer', description: 'Build Python and Django APIs.', location: 'Tunis', remote: false,
  employmentType: 'FULL_TIME', experienceLevel: 'MID', minimumYearsExperience: 2, requirements: ['Python', 'Django', 'REST API', 'PostgreSQL'],
  skills: [
    { skill: { name: 'Python' }, required: true }, { skill: { name: 'Django' }, required: true },
    { skill: { name: 'REST API' }, required: true }, { skill: { name: 'PostgreSQL' }, required: true },
    { skill: { name: 'Docker' }, required: false },
  ],
};
const job = jobData as never;

describe('persisted application analysis inputs', () => {
  it('produces concrete match and growth data for an Amel-like backend profile', () => {
    const profile = {
      headline: 'Backend Engineer', bio: 'Python backend engineer', location: 'Tunis', yearsExperience: 5,
      skills: [{ name: 'Python' }, { name: 'Django' }, { name: 'Django REST Framework' }, { name: 'PostgreSQL' }, { name: 'REST API' }],
      experiences: [{ title: 'Backend Engineer', companyName: 'A', description: 'Built Python Django REST APIs with PostgreSQL', startDate: new Date('2021-01-01'), endDate: null, current: true }],
      educations: [], professionalData: { sections: { projects: [], certifications: [] } }, resumes: [],
    };
    const match = matchCandidate(profile, job);
    const growth = analyzeGrowthPotential(profile, job, match);

    expect(match.score).toBeGreaterThan(80);
    expect(growth.score).not.toBeNull();
    expect(['HIGH', 'MEDIUM']).toContain(growth.category);
    expect(recruitmentClassification(match.score, growth.category)).toBe('STRONG_MATCH');
  });

  it('keeps an Omar-like adjacent profile analyzable instead of returning null potential', () => {
    const profile = {
      headline: 'Data Analyst', bio: 'Python and SQL analyst', location: 'Tunis', yearsExperience: 3,
      skills: [{ name: 'Python' }, { name: 'SQL' }, { name: 'React' }, { name: 'JavaScript' }, { name: 'Expo' }],
      experiences: [{ title: 'Data Analyst', companyName: 'A', description: 'Built Python and SQL dashboards', startDate: new Date('2022-01-01'), endDate: null, current: true }],
      educations: [], professionalData: { sections: { projects: ['React mobile project with Expo and API integration'], certifications: [] } }, resumes: [],
    };
    const mobileJob = { ...jobData, title: 'Mobile Developer React Native', skills: [{ skill: { name: 'React Native' }, required: true }, { skill: { name: 'Expo' }, required: true }, { skill: { name: 'REST API' }, required: false }] } as never;
    const match = matchCandidate(profile, mobileJob);
    const growth = analyzeGrowthPotential(profile, mobileJob, match);

    expect(growth.score).not.toBeNull();
    expect(growth.category).not.toBe('UNDETERMINED');
  });
});
