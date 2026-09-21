import { describe, expect, it, vi, beforeEach } from 'vitest';
import { establishSession, AuthIdentityError } from './auth-session';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';
import { queryClient } from '@/providers/query-provider';
import { makeUser } from '@/test/factories';

const meMock = vi.fn();
vi.mock('@/lib/api/auth', () => ({
  authApi: {
    me: () => meMock(),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

const socketDisconnectMock = vi.fn();
const socketConnectMock = vi.fn();
vi.mock('@/lib/api/ws', () => ({
  disconnectSocket: () => socketDisconnectMock(),
  connectSocket: () => socketConnectMock(),
}));

const candidateA = makeUser({
  id: 'cand-a',
  name: 'Candidate A',
  email: 'cand.a@test.dev',
  roles: ['CANDIDATE'],
  memberships: [],
});

const companyUserB = makeUser({
  id: 'comp-b',
  name: 'Company B Admin',
  email: 'admin.b@company.dev',
  roles: ['COMPANY_ADMIN'],
  memberships: [{ companyId: 'company-b-id', role: 'COMPANY_ADMIN' }],
});

beforeEach(() => {
  meMock.mockReset();
  socketDisconnectMock.mockReset();
  socketConnectMock.mockReset();
  useAuthStore.getState().clearSession();
  useCompanyStore.getState().clearCompanyState();
  queryClient.clear();
});

describe('Centralized establishSession Pipeline', () => {
  it('keeps protected routes loading until a restored identity is verified', async () => {
    useAuthStore.getState().setStatus('loading');
    const observedStatuses: string[] = [];
    const unsubscribe = useAuthStore.subscribe(state => observedStatuses.push(state.status));
    let completeIdentity!: (value: typeof candidateA) => void;
    meMock.mockImplementationOnce(() => new Promise(resolve => { completeIdentity = resolve; }));
    try {
      const restored = establishSession('restored-token');
      expect(useAuthStore.getState().status).toBe('loading');
      expect(useAuthStore.getState().user).toBeNull();
      completeIdentity(candidateA);
      await restored;
      expect(observedStatuses).not.toContain('unauthenticated');
      expect(useAuthStore.getState().status).toBe('authenticated');
    } finally {
      unsubscribe();
    }
  });

  it('a late response from an earlier login cannot replace the current account', async () => {
    let completeFirst!: (value: typeof candidateA) => void;
    meMock.mockImplementationOnce(() => new Promise(resolve => { completeFirst = resolve; }));
    const first = establishSession('old-token');
    const rejected = expect(first).rejects.toThrow(AuthIdentityError);
    meMock.mockResolvedValueOnce(companyUserB);
    await establishSession('current-token');
    completeFirst(candidateA);
    await rejected;
    expect(useAuthStore.getState().user?.id).toBe(companyUserB.id);
    expect(useAuthStore.getState().accessToken).toBe('current-token');
    expect(useCompanyStore.getState().activeCompanyId).toBe('company-b-id');
  });
  it('TEST 1: Candidate A -> Candidate B account switching is completely isolated', async () => {
    // 1. Establish session for Candidate A
    meMock.mockResolvedValue(candidateA);
    await establishSession('tok-a', 'cand.a@test.dev');

    expect(useAuthStore.getState().user?.id).toBe('cand-a');
    expect(useCompanyStore.getState().activeCompanyId).toBeNull();

    // 2. Switch directly to Candidate B
    const candidateB = makeUser({
      id: 'cand-b',
      name: 'Candidate B',
      email: 'cand.b@test.dev',
      roles: ['CANDIDATE'],
    });
    meMock.mockResolvedValue(candidateB);

    await establishSession('tok-b', 'cand.b@test.dev');

    // 3. Verify Candidate B is installed and Candidate A is completely gone
    expect(useAuthStore.getState().accessToken).toBe('tok-b');
    expect(useAuthStore.getState().user?.id).toBe('cand-b');
    expect(useAuthStore.getState().user?.name).toBe('Candidate B');
    expect(useCompanyStore.getState().activeCompanyId).toBeNull();
  });

  it('TEST 2: Candidate A -> Company B account switching replaces session & company state', async () => {
    // Establish Candidate A
    meMock.mockResolvedValue(candidateA);
    await establishSession('tok-a', 'cand.a@test.dev');

    // Switch to Company B
    meMock.mockResolvedValue(companyUserB);
    await establishSession('tok-b', 'admin.b@company.dev');

    expect(useAuthStore.getState().user?.id).toBe('comp-b');
    expect(useAuthStore.getState().user?.roles).toContain('COMPANY_ADMIN');
    expect(useCompanyStore.getState().activeCompanyId).toBe('company-b-id');
  });

  it('TEST 3: Company A -> Candidate B account switching resets companyStore to null', async () => {
    // Establish Company User
    meMock.mockResolvedValue(companyUserB);
    await establishSession('tok-b', 'admin.b@company.dev');
    expect(useCompanyStore.getState().activeCompanyId).toBe('company-b-id');

    // Switch to Candidate B (no memberships)
    const candidateB = makeUser({ id: 'cand-b', email: 'cand.b@test.dev', roles: ['CANDIDATE'] });
    meMock.mockResolvedValue(candidateB);
    await establishSession('tok-cand-b', 'cand.b@test.dev');

    expect(useAuthStore.getState().user?.id).toBe('cand-b');
    expect(useCompanyStore.getState().activeCompanyId).toBeNull();
  });

  it('TEST 4: Company A -> Company B replaces activeCompanyId with B membership', async () => {
    const companyUserA = makeUser({
      id: 'comp-a',
      email: 'admin.a@comp-a.dev',
      memberships: [{ companyId: 'comp-a-id', role: 'COMPANY_ADMIN' }],
    });
    meMock.mockResolvedValue(companyUserA);
    await establishSession('tok-comp-a', 'admin.a@comp-a.dev');
    expect(useCompanyStore.getState().activeCompanyId).toBe('comp-a-id');

    meMock.mockResolvedValue(companyUserB);
    await establishSession('tok-comp-b', 'admin.b@company.dev');
    expect(useCompanyStore.getState().activeCompanyId).toBe('company-b-id');
  });

  it('TEST 5: Socket is disconnected and reconnected on session transition', async () => {
    meMock.mockResolvedValue(candidateA);
    await establishSession('tok-a', 'cand.a@test.dev');

    expect(socketDisconnectMock).toHaveBeenCalled();
    expect(socketConnectMock).toHaveBeenCalled();
  });

  it('TEST 6: Identity mismatch between expectedEmail and /auth/me causes total session teardown', async () => {
    // Backend returns Candidate B when expecting Candidate A
    const candidateB = makeUser({ id: 'cand-b', email: 'cand.b@test.dev' });
    meMock.mockResolvedValue(candidateB);

    await expect(establishSession('mismatched-tok', 'cand.a@test.dev')).rejects.toThrow(
      AuthIdentityError,
    );

    // Verify complete teardown on mismatch
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useCompanyStore.getState().activeCompanyId).toBeNull();
  });

  it('TEST 7: Language and Theme settings persist across account switching', () => {
    // Set simulated localStorage keys for theme and language
    window.localStorage.setItem('ss.locale', 'ar');
    window.localStorage.setItem('theme', 'dark');

    // Run session reset
    useAuthStore.getState().clearSession();
    useCompanyStore.getState().clearCompanyState();

    // Verify non-auth preferences remain
    expect(window.localStorage.getItem('ss.locale')).toBe('ar');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });
});
