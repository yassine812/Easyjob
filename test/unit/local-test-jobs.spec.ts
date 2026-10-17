import { availableJobWhere, isLocalTestJob } from '../../src/jobs/job-availability';

describe('local test offers', () => {
  const previous = { mode: process.env.NODE_ENV, enabled: process.env.EASYJOB_LOCAL_TEST_JOBS };
  afterEach(() => {
    if (previous.mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.mode;
    if (previous.enabled === undefined) delete process.env.EASYJOB_LOCAL_TEST_JOBS; else process.env.EASYJOB_LOCAL_TEST_JOBS = previous.enabled;
  });
  const fixture = { company: { slug: 'easyjob-test-lab' }, description: 'OFFRE DE TEST — aucune embauche réelle.' };
  it('allows only the explicitly enabled local test company', () => {
    process.env.NODE_ENV = 'development'; process.env.EASYJOB_LOCAL_TEST_JOBS = 'true';
    expect(isLocalTestJob(fixture)).toBe(true);
    expect(isLocalTestJob({ ...fixture, company: { slug: 'real-employer' } })).toBe(false);
    expect(isLocalTestJob({ ...fixture, description: 'Source officielle et candidature :' })).toBe(false);
    expect(JSON.stringify(availableJobWhere())).toContain('easyjob-test-lab');
  });
  it('never enables fixture discovery or submission in production', () => {
    process.env.NODE_ENV = 'production'; process.env.EASYJOB_LOCAL_TEST_JOBS = 'true';
    expect(isLocalTestJob(fixture)).toBe(false);
    expect(JSON.stringify(availableJobWhere())).not.toContain('easyjob-test-lab');
  });
  it('requires an explicit opt-in', () => {
    process.env.NODE_ENV = 'development'; delete process.env.EASYJOB_LOCAL_TEST_JOBS;
    expect(isLocalTestJob(fixture)).toBe(false);
  });
});
