import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';
import { useAuthStore } from '@/store/auth-store';
import { makeUser } from '@/test/factories';
import { I18nProvider } from '@/lib/i18n';

function renderForm() {
  return render(<I18nProvider><LoginForm /></I18nProvider>);
}

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, prefetch: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const loginMock = vi.fn();
const meMock = vi.fn();
vi.mock('@/lib/api/auth', () => ({
  authApi: {
    login: (...args: unknown[]) => loginMock(...args),
    me: () => meMock(),
  },
}));

const candidate = makeUser({
  id: 'u2',
  name: 'Candidate',
  email: 'c@test.dev',
  roles: ['CANDIDATE'],
});

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  loginMock.mockReset();
  meMock.mockReset();
  useAuthStore.getState().clearSession();
  useAuthStore.getState().setLastEmail('');
});

describe('LoginForm', () => {
  it('does not redirect to a dashboard when recovery is chosen during a pending login', async () => {
    let resolveLogin!: (value: { accessToken: string }) => void;
    loginMock.mockImplementation(() => new Promise(resolve => { resolveLogin = resolve; }));
    meMock.mockResolvedValue(candidate);
    const user = userEvent.setup();
    const view = renderForm();
    await user.type(screen.getByLabelText(/Email/i), 'c@test.dev');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /^continue$|^log in$/i }));
    const recovery = screen.getByRole('link', { name: /forgot/i });
    expect(recovery).toHaveAttribute('href', '/forgot-password');
    recovery.addEventListener('click', e => e.preventDefault());
    await user.click(recovery);
    await act(async () => { resolveLogin({ accessToken: 'late-token' }); });
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(meMock).not.toHaveBeenCalled();
    view.unmount();
  });
  it('shows validation errors for invalid input', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /^continue$|^log in$/i }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('logs in a candidate and routes to the candidate dashboard', async () => {
    loginMock.mockResolvedValue({ accessToken: 'tok', user: { ...candidate, memberships: undefined } });
    meMock.mockResolvedValue(candidate);
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Email/i), 'c@test.dev');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /^continue$|^log in$/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith({ email: 'c@test.dev', password: 'Password123' }));
    await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith('/candidate/dashboard'));
    expect(push).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().user?.email).toBe('c@test.dev');
  });

  it('routes company members to their company dashboard', async () => {
    const hr = makeUser({
      ...candidate,
      email: 'hr@test.dev',
      roles: ['HR'],
      memberships: [{ companyId: 'c1', role: 'HR' }],
    });
    loginMock.mockResolvedValue({ accessToken: 'tok', user: { ...hr, memberships: undefined } });
    meMock.mockResolvedValue(hr);
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Email/i), 'hr@test.dev');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /^continue$|^log in$/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith('/company/c1/dashboard'));
  });

  it('routes platform admins to the admin dashboard', async () => {
    const admin = makeUser({ ...candidate, email: 'a@test.dev', roles: ['PLATFORM_ADMIN'] });
    loginMock.mockResolvedValue({ accessToken: 'tok', user: { ...admin, memberships: undefined } });
    meMock.mockResolvedValue(admin);
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Email/i), 'a@test.dev');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /^continue$|^log in$/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith('/admin/dashboard'));
  });

  it('shows a useful translated error on failed login', async () => {
    const { ApiError } = await import('@/lib/api/client');
    loginMock.mockRejectedValue(new ApiError(401, 'Invalid credentials'));
    meMock.mockRejectedValue(new Error('should not be called'));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Email/i), 'c@test.dev');
    await user.type(screen.getByLabelText('Password'), 'WrongPassword1');
    await user.click(screen.getByRole('button', { name: /^continue$|^log in$/i }));

    expect(await screen.findByText('Unable to sign in. Check your email and password and try again.')).toBeInTheDocument();
  });

  it('allows a different account to sign in after the previous account logs out', async () => {
    const { useCompanyStore } = await import('@/store/company-store');
    // Pre-set stale session data (User A / Company A)
    useAuthStore.getState().setSession('old-tok', candidate);
    useCompanyStore.getState().setActiveCompanyId('old-company-id');
    const { clearSessionAtomic } = await import('@/lib/auth-session');
    clearSessionAtomic();

    const companyUser = makeUser({
      id: 'u3',
      name: 'Company Admin B',
      email: 'b@company.dev',
      roles: ['COMPANY_ADMIN'],
      memberships: [{ companyId: 'company-b', role: 'COMPANY_ADMIN' }],
    });
    loginMock.mockResolvedValue({ accessToken: 'new-tok-b', user: { ...companyUser, memberships: undefined } });
    meMock.mockResolvedValue(companyUser);

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Email/i), 'b@company.dev');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /^continue$|^log in$/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith('/company/company-b/dashboard'));
    expect(useAuthStore.getState().accessToken).toBe('new-tok-b');
    expect(useAuthStore.getState().user?.id).toBe('u3');
    expect(useAuthStore.getState().user?.email).toBe('b@company.dev');
    expect(useCompanyStore.getState().activeCompanyId).toBe('company-b');
  });

  it.each([
    [candidate, '/candidate/dashboard'],
    [makeUser({ roles: ['HR'], memberships: [{ companyId: 'acme', role: 'HR' }] }), '/company/acme/dashboard'],
    [makeUser({ roles: ['PLATFORM_ADMIN'] }), '/admin/dashboard'],
    [makeUser({ roles: ['COMPANY_ADMIN'], mustChangePassword: true }), '/change-password'],
  ] as const)('resumes an authenticated account at its own workspace', async (account, route) => {
    renderForm();
    await act(async () => { useAuthStore.getState().setSession('restored-token', account); });
    await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith(route));
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('keeps recovery navigation when identity validation finishes late', async () => {
    let resolveIdentity!: (value: typeof candidate) => void;
    loginMock.mockResolvedValue({ accessToken: 'tok' });
    meMock.mockImplementation(() => new Promise(resolve => { resolveIdentity = resolve; }));
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Email/i), candidate.email);
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await waitFor(() => expect(meMock).toHaveBeenCalled());
    const recovery = screen.getByRole('link', { name: /forgot/i });
    recovery.addEventListener('click', event => event.preventDefault());
    await user.click(recovery);
    await act(async () => { resolveIdentity(candidate); });
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('does not navigate if the server returns another account identity', async () => {
    loginMock.mockResolvedValue({ accessToken: 'tok' });
    meMock.mockResolvedValue(makeUser({ email: 'another@example.test' }));
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Email/i), candidate.email);
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(await screen.findByText(/Unable to sign in/)).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(replace).not.toHaveBeenCalled();
  });
});
