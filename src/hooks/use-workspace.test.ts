import { describe, expect, it } from 'vitest';
import { resolveWorkspace } from './use-workspace';
import type { MeUser } from '@/types/api';

const recruiter = { roles: ['RECRUITER'], memberships: [{ companyId: 'first' }, { companyId: 'active' }] } as MeUser;
describe('workspace destinations', () => {
  it('retains the active authorized company for logo, jobs and dashboard', () => {
    expect(resolveWorkspace(recruiter, 'active')).toEqual({ currentWorkspace: 'recruiter', companyId: 'active', home: '/company/active/dashboard', jobs: '/company/active/jobs' });
  });
  it('ignores a persisted company from another session', () => { expect(resolveWorkspace(recruiter, 'foreign').jobs).toBe('/company/first/jobs'); });
  it('keeps candidate and anonymous navigation separate', () => {
    expect(resolveWorkspace({ roles: ['CANDIDATE'], memberships: [] } as unknown as MeUser, null).jobs).toBe('/candidate/jobs');
    expect(resolveWorkspace(null, 'stale').home).toBe('/');
  });
});
