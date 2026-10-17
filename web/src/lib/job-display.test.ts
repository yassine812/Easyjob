import { describe, expect, it } from 'vitest';
import { recruiterJobRoute, recruiterJobApplicationsRoute, employmentTypeKey, publicJobViewMode, recruiterJobEditRoute, recruiterJobPreviewRoute, recruiterJobsRoute, toJobDisplayStatus, workModeKey } from './job-display';

describe('job display helpers', () => {
  it('normalizes backend job statuses into the four recruiter statuses', () => {
    expect(toJobDisplayStatus('PUBLISHED')).toBe('active');
    expect(toJobDisplayStatus('PAUSED')).toBe('paused');
    expect(toJobDisplayStatus('PENDING_APPROVAL')).toBe('draft');
    expect(toJobDisplayStatus('EXPIRED')).toBe('closed');
  });

  it('maps backend work mode values to translated keys', () => {
    expect(workModeKey('ON_SITE')).toBe('ONSITE');
    expect(workModeKey('HYBRID')).toBe('HYBRID');
    expect(workModeKey(undefined, true)).toBe('REMOTE');
  });

  it('only returns supported employment type keys', () => {
    expect(employmentTypeKey('FULL_TIME')).toBe('FULL_TIME');
    expect(employmentTypeKey('UNKNOWN')).toBeUndefined();
  });

  it('keeps recruiter previews free of public apply actions', () => {
    expect(publicJobViewMode(true, false)).toBe('recruiter-preview');
    expect(publicJobViewMode(true, true)).toBe('recruiter-preview');
    expect(publicJobViewMode(false, true)).toBe('candidate');
    expect(publicJobViewMode(false, false)).toBe('login');
  });

  it('uses the recruiter jobs list as the preview return destination', () => {
    expect(recruiterJobApplicationsRoute('company-a', 'job-1')).toBe('/company/company-a/jobs/job-1/applications');
    expect(recruiterJobRoute('company-a', 'job-1')).toBe('/company/company-a/jobs/job-1');
    expect(recruiterJobsRoute('company-a')).toBe('/company/company-a/jobs');
    expect(recruiterJobPreviewRoute('company-a', 'job-1')).toBe('/company/company-a/jobs/job-1/preview');
    expect(recruiterJobEditRoute('company-a', 'job-1')).toBe('/company/company-a/jobs/job-1/edit');
  });
});
