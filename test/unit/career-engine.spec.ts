import { atsReport, containsFact, extractProfile, matchCandidate, matchesPreferences, type CareerJob } from '../../src/career/career-engine';

const job: CareerJob = { id: 'j', companyId: 'co', title: 'Developer', description: 'Build APIs', location: 'Tunis',
  remote: true, workMode: 'REMOTE', employmentType: 'FULL_TIME', experienceLevel: 'MID', requirements: [],
  skills: [{ skill: { name: 'React' }, required: true }, { skill: { name: 'Django' }, required: true }] };
describe('Evidence-based career estimates', () => {
  it('enforces salary currency, contract choices and individual job exclusions', () => {
    const prefs = { domains: [], locations: [], workModes: [], excludedCompanies: [], excludedJobTypes: [], minimumSalary: 40000, salaryCurrency: 'EUR', employmentTypes: ['FULL_TIME'], excludedJobs: [] as string[] };
    const offer = { ...job, salaryMin: 35000, salaryMax: 45000, currency: 'EUR' };
    expect(matchesPreferences(offer, prefs)).toBe(true);
    expect(matchesPreferences({ ...offer, currency: 'TND' }, prefs)).toBe(false);
    expect(matchesPreferences({ ...offer, salaryMax: 39000 }, prefs)).toBe(false);
    expect(matchesPreferences(job, prefs)).toBe(false);
    expect(matchesPreferences(offer, { ...prefs, employmentTypes: ['INTERNSHIP'] })).toBe(false);
    expect(matchesPreferences(offer, { ...prefs, excludedJobs: ['j'] })).toBe(false);
    expect(matchesPreferences({ ...offer, contractType: 'CDD' }, { ...prefs, contractTypes: ['CDI'] })).toBe(false);
    expect(matchesPreferences({ ...offer, contractType: 'CDI' }, { ...prefs, contractTypes: ['CDI'] })).toBe(true);
    expect(matchesPreferences(job, { ...prefs, minimumSalary: null })).toBe(true);
  });
  it('has no score when no readable CV exists', () => {
    expect(atsReport('   ').score).toBeNull();
    expect(matchCandidate({ skills: [] }, job).score).toBeNull();
  });
  it('extracts verbatim professional sections in French and Arabic', () => {
    const source = 'Compétences\nReact, Django\nFormation\nLicence informatique\nLangues\nFrançais\nالمشاريع\nتطبيق ويب';
    const result = extractProfile(source);
    expect(result.skills).toEqual(['React', 'Django']);
    expect(result.sections.education).toEqual(['Licence informatique']);
    expect(result.sections.projects).toEqual(['تطبيق ويب']);
    expect(result.needsReview).toBe(true);
    expect(result.email).toBeNull();
  });
  it('reports only missing keywords from the actual target job', () => {
    expect(atsReport('Skills\nReact').missingKeywords).toEqual([]);
    expect(atsReport('Skills\nReact', ['React', 'Django', 'Django']).missingKeywords).toEqual(['Django']);
    expect(Number.isFinite(atsReport('Skills\nReact', [' ']).score)).toBe(true);
  });
  it('does not award an excellent score for scope numbers without measurable outcomes', () => {
    const text = `Profile\nBackend developer\nSkills\nDjango, REST\nExperience\nBuilt services across 3 platforms and 4 modules.\nEducation\nLicence informatique\nEmail: person@example.com\nPhone: +216 20 000 000\n${'Delivered reliable backend services. '.repeat(8)}`;
    const report = atsReport(text);
    expect(report.criteria.find(item => item.key === 'quantified_evidence')?.passed).toBe(false);
    expect(report.score).toBeLessThanOrEqual(79);
  });
  it('does not treat substrings or regex characters as skill evidence', () => {
    expect(containsFact('Reactive C NodeXjs', 'React')).toBe(false);
    expect(containsFact('C', 'C++')).toBe(false);
    expect(containsFact('NodeXjs', 'Node.js')).toBe(false);
    expect(containsFact('Skills: C++, Node.js', 'C++')).toBe(true);
  });
  it('can identify potential without pretending missing skills are present', () => {
    const result = matchCandidate({ skills: [{ name: 'React' }] }, job);
    expect(result.score).toBe(60);
    expect(result.classification).toBe('POTENTIAL');
    expect(result.matchedSkills).toEqual(['React']);
    expect(result.missingSkills).toEqual(['Django']);
    expect(result.dimensions.find(d => d.key === 'experience')?.score).toBeNull();
  });
  it('penalizes an explicit qualification without evidence', () => {
    const p = { skills: [{ name: 'React' }, { name: 'Django' }] };
    expect(matchCandidate(p, { ...job, educationRequirement: 'MSc', minimumYearsExperience: 5 }).score)
      .toBeLessThan(matchCandidate(p, job).score!);
    expect(matchCandidate(p, { ...job, requirements: ['Valid licence'] }).unverifiedRequirements).toContain('Valid licence');
  });
  it('respects hybrid, location, domain and exclusions independently', () => {
    const prefs = { domains: ['Software'], locations: ['Tunis'], workModes: ['HYBRID'], excludedCompanies: [], excludedJobTypes: [] };
    const hybrid = { ...job, workMode: 'HYBRID', domain: 'Software' };
    expect(matchesPreferences(hybrid, prefs)).toBe(true);
    expect(matchesPreferences(job, prefs)).toBe(false);
    expect(matchesPreferences(hybrid, { ...prefs, excludedCompanies: ['co'] })).toBe(false);
    expect(matchesPreferences(hybrid, { ...prefs, excludedJobTypes: ['FULL_TIME'] })).toBe(false);
  });
});
