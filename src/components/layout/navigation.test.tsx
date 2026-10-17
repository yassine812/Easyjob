import { describe, expect, it } from 'vitest';
import { isNavActive } from './app-shell';
describe('Workspace navigation matching', () => {
  it('keeps related tools within the parent module', () => {
    expect(isNavActive('/candidate/cvs/cv-1', { href: '/candidate/cvs' })).toBe(true);
    expect(isNavActive('/candidate/ats', { href: '/candidate/cvs' })).toBe(false);
    expect(isNavActive('/company/a/pipeline', { href: '/company/a/applications', activePaths: ['/company/a/pipeline'] })).toBe(true);
  });
  it('matches route boundaries and the correct company', () => {
    expect(isNavActive('/company/a/jobs/job-1', { href: '/company/a/jobs' })).toBe(true);
    expect(isNavActive('/company/ab/jobs', { href: '/company/a/jobs' })).toBe(false);
    expect(isNavActive('/candidate/jobs-other', { href: '/candidate/jobs' })).toBe(false);
  });
});
