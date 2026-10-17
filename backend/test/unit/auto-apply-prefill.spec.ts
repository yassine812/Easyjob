import { buildAutoApplyDefaultsFromCv } from '../../src/career/auto-apply-prefill';

describe('Auto Apply CV defaults', () => {
  it('keeps domains separate from CV skills and canonicalizes skills', () => {
    const defaults = buildAutoApplyDefaultsFromCv({
      experiences: [{ title: 'Backend Developer', startDate: new Date('2020-01-01') }],
      skills: [{ name: 'django' }, { name: 'Django REST Framework' }, { name: 'api rest' }, { name: 'DJANGO' }],
      explicitDomains: [],
    });

    expect(defaults.domains).toEqual(['Backend Development', 'Web Development']);
    expect(defaults.skills).toEqual(['Django', 'Django REST Framework', 'REST API']);
    expect(defaults.targetTitles).toEqual(['Backend Developer']);
    expect(defaults.experienceLevels).toEqual(['SENIOR']);
  });

  it('uses explicit structured domains only', () => {
    const defaults = buildAutoApplyDefaultsFromCv({
      skills: [{ name: 'Python' }],
      headline: 'Software Engineer',
      explicitDomains: ['Software Engineering', 'Software Engineering'],
    });

    expect(defaults.domains).toEqual(['Software Engineering']);
    expect(defaults.skills).toEqual(['Python']);
  });
});
