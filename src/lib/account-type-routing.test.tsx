import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveAccountType, getDashboardRoute } from '@/lib/permissions';
import { establishSession, clearSessionAtomic } from '@/lib/auth-session';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';
import { queryClient } from '@/providers/query-provider';
import { makeUser } from '@/test/factories';
import type { MeUser } from '@/types/api';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, prefetch: vi.fn() }),
}));

const meMock = vi.fn();
vi.mock('@/lib/api/auth', () => ({
  authApi: {
    me: () => meMock(),
    logout: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/lib/api/ws', () => ({
  disconnectSocket: vi.fn(),
  connectSocket: vi.fn(),
}));

describe('Account-Type Resolution and Role-Based Routing', () => {
  const candidateUser: MeUser = makeUser({
    id: 'cand-1',
    name: 'Candidate Alice',
    email: 'alice@candidate.dev',
    roles: ['CANDIDATE'],
    memberships: [],
  });

  const companyUser: MeUser = makeUser({
    id: 'comp-1',
    name: 'Company Bob',
    email: 'bob@company.dev',
    roles: ['HR'],
    memberships: [
      {
        companyId: 'company-acme-123',
        companyName: 'Acme Corp',
        companySlug: 'acme-corp',
        companyStatus: 'ACTIVE',
        role: 'HR',
      },
    ],
  });

  const adminUser: MeUser = makeUser({
    id: 'admin-1',
    name: 'Admin Boss',
    email: 'boss@platform.dev',
    roles: ['PLATFORM_ADMIN'],
    memberships: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionAtomic();
  });

  it('Test 1: Candidate login resolves to candidate dashboard', async () => {
    meMock.mockResolvedValue(candidateUser);
    const user = await establishSession('cand-token', 'alice@candidate.dev');

    expect(resolveAccountType(user)).toBe('candidate');
    expect(getDashboardRoute(user)).toBe('/candidate/dashboard');
  });

  it('Test 2: Company login resolves to company dashboard with active companyId', async () => {
    meMock.mockResolvedValue(companyUser);
    const user = await establishSession('comp-token', 'bob@company.dev');

    expect(resolveAccountType(user)).toBe('company');
    expect(getDashboardRoute(user)).toBe('/company/company-acme-123/dashboard');
  });

  it('Test 3: Admin login resolves to admin dashboard', async () => {
    meMock.mockResolvedValue(adminUser);
    const user = await establishSession('admin-token', 'boss@platform.dev');

    expect(resolveAccountType(user)).toBe('admin');
    expect(getDashboardRoute(user)).toBe('/admin/dashboard');
  });

  it('Test 4: Candidate account type cannot access company routes', () => {
    expect(resolveAccountType(candidateUser)).toBe('candidate');
    expect(getDashboardRoute(candidateUser)).not.toContain('/company/');
  });

  it('Test 5: Company account type cannot access candidate routes', () => {
    expect(resolveAccountType(companyUser)).toBe('company');
    expect(getDashboardRoute(companyUser)).not.toBe('/candidate/dashboard');
  });

  it('Test 6: Candidate A logout -> Company B login renders Company dashboard only', async () => {
    // 1. Candidate A logs in
    meMock.mockResolvedValue(candidateUser);
    await establishSession('cand-token-A', 'alice@candidate.dev');
    expect(useAuthStore.getState().user?.email).toBe('alice@candidate.dev');
    expect(getDashboardRoute(useAuthStore.getState().user)).toBe('/candidate/dashboard');

    // 2. Candidate A logs out
    clearSessionAtomic();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useCompanyStore.getState().activeCompanyId).toBeNull();

    // 3. Company B logs in
    meMock.mockResolvedValue(companyUser);
    const userB = await establishSession('comp-token-B', 'bob@company.dev');
    expect(userB.email).toBe('bob@company.dev');
    expect(resolveAccountType(userB)).toBe('company');
    expect(getDashboardRoute(userB)).toBe('/company/company-acme-123/dashboard');
  });

  it('Test 7: Company A logout -> Candidate B login renders Candidate dashboard only', async () => {
    // 1. Company A logs in
    meMock.mockResolvedValue(companyUser);
    await establishSession('comp-token-A', 'bob@company.dev');
    useCompanyStore.getState().setActiveCompanyId('company-acme-123');
    expect(getDashboardRoute(useAuthStore.getState().user)).toBe('/company/company-acme-123/dashboard');

    // 2. Company A logs out
    clearSessionAtomic();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useCompanyStore.getState().activeCompanyId).toBeNull();

    // 3. Candidate B logs in
    meMock.mockResolvedValue(candidateUser);
    const userB = await establishSession('cand-token-B', 'alice@candidate.dev');
    expect(userB.email).toBe('alice@candidate.dev');
    expect(resolveAccountType(userB)).toBe('candidate');
    expect(getDashboardRoute(userB)).toBe('/candidate/dashboard');
  });

  it('Test 8: Reload candidate session restores candidate dashboard route', async () => {
    meMock.mockResolvedValue(candidateUser);
    const user = await establishSession('cand-token-reload', 'alice@candidate.dev');

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(resolveAccountType(user)).toBe('candidate');
    expect(getDashboardRoute(user)).toBe('/candidate/dashboard');
  });

  it('Test 9: Reload company session restores company dashboard route', async () => {
    meMock.mockResolvedValue(companyUser);
    const user = await establishSession('comp-token-reload', 'bob@company.dev');

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(resolveAccountType(user)).toBe('company');
    expect(getDashboardRoute(user)).toBe('/company/company-acme-123/dashboard');
  });

  it('Test 10: Facial auth login for candidate routes to candidate dashboard', async () => {
    meMock.mockResolvedValue(candidateUser);
    const user = await establishSession('face-cand-token', 'alice@candidate.dev');

    expect(resolveAccountType(user)).toBe('candidate');
    expect(getDashboardRoute(user)).toBe('/candidate/dashboard');
  });

  it('Test 11: Facial auth login for company routes to company dashboard', async () => {
    meMock.mockResolvedValue(companyUser);
    const user = await establishSession('face-comp-token', 'bob@company.dev');

    expect(resolveAccountType(user)).toBe('company');
    expect(getDashboardRoute(user)).toBe('/company/company-acme-123/dashboard');
  });
});
