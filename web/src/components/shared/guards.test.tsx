import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render as renderView, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth-store';
import {
  RequireAdmin,
  RequireAuth,
  RequireCandidate,
  RequireCompanyMember,
  RequireCompanyPermission,
} from './guards';
import type { MeUser } from '@/types/api';
import { makeUser } from '@/test/factories';

const routerReplace = vi.fn();
const render = (element: ReactNode) => renderView(<I18nProvider>{element}</I18nProvider>);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace, push: vi.fn(), prefetch: vi.fn() }),
}));

const companyMember = (role: string, companyId = 'c1'): MeUser =>
  makeUser({
    id: 'u1',
    name: 'Member',
    email: 'm@test.dev',
    roles: [role as MeUser['roles'][number]],
    memberships: [{ companyId, role: role as MeUser['memberships'][number]['role'] }],
  });

const candidate: MeUser = makeUser({
  id: 'u2',
  name: 'Candidate',
  email: 'c@test.dev',
  roles: ['CANDIDATE'],
  memberships: [],
});

beforeEach(() => {
  routerReplace.mockReset();
  useAuthStore.getState().clearSession();
});

describe('RequireAuth', () => {
  it('renders children for an authenticated user', () => {
    useAuthStore.getState().setSession('t', candidate);
    render(<RequireAuth>protected</RequireAuth>);
    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    useAuthStore.getState().setStatus('unauthenticated');
    render(<RequireAuth>protected</RequireAuth>);
    expect(routerReplace).toHaveBeenCalledWith('/login');
  });
});

describe('RequireAdmin', () => {
  it('renders children only for PLATFORM_ADMIN', () => {
    useAuthStore.getState().setSession('t', {
      ...candidate,
      roles: ['PLATFORM_ADMIN'],
    });
    render(<RequireAdmin>admin-panel</RequireAdmin>);
    expect(screen.getByText('admin-panel')).toBeInTheDocument();
  });

  it('blocks company admins and candidates from admin panel', () => {
    useAuthStore.getState().setSession('t', companyMember('COMPANY_ADMIN'));
    render(<RequireAdmin>admin-panel</RequireAdmin>);
    expect(screen.queryByText('admin-panel')).not.toBeInTheDocument();
    expect(routerReplace).toHaveBeenCalledWith('/company/c1/dashboard');
  });
});

describe('RequireCandidate', () => {
  it('renders for a pure candidate', () => {
    useAuthStore.getState().setSession('t', candidate);
    render(<RequireCandidate>candidate-area</RequireCandidate>);
    expect(screen.getByText('candidate-area')).toBeInTheDocument();
  });

  it('blocks company users from candidate area and redirects to company dashboard', () => {
    useAuthStore.getState().setSession('t', companyMember('HR'));
    render(<RequireCandidate>candidate-area</RequireCandidate>);
    expect(screen.queryByText('candidate-area')).not.toBeInTheDocument();
    expect(routerReplace).toHaveBeenCalledWith('/company/c1/dashboard');
  });

  it('blocks admin users from candidate area and redirects to admin dashboard', () => {
    useAuthStore.getState().setSession('t', {
      ...candidate,
      roles: ['PLATFORM_ADMIN'],
    });
    render(<RequireCandidate>candidate-area</RequireCandidate>);
    expect(screen.queryByText('candidate-area')).not.toBeInTheDocument();
    expect(routerReplace).toHaveBeenCalledWith('/admin/dashboard');
  });
});

describe('RequireCompanyMember', () => {
  it('renders for a member of the company', () => {
    useAuthStore.getState().setSession('t', companyMember('HR', 'c1'));
    render(<RequireCompanyMember companyId="c1">company-dashboard</RequireCompanyMember>);
    expect(screen.getByText('company-dashboard')).toBeInTheDocument();
  });

  it('blocks candidates from company area and redirects to candidate dashboard', () => {
    useAuthStore.getState().setSession('t', candidate);
    render(<RequireCompanyMember companyId="c1">company-dashboard</RequireCompanyMember>);
    expect(screen.queryByText('company-dashboard')).not.toBeInTheDocument();
    expect(routerReplace).toHaveBeenCalledWith('/candidate/dashboard');
  });

  it('shows error state for non-member company user attempting access to another company', () => {
    useAuthStore.getState().setSession('t', companyMember('HR', 'c2'));
    render(<RequireCompanyMember companyId="c1">company-dashboard</RequireCompanyMember>);
    expect(screen.queryByText('company-dashboard')).not.toBeInTheDocument();
    expect(screen.getByText(/Not a member of this company/i)).toBeInTheDocument();
  });
});

describe('RequireCompanyPermission', () => {
  it('renders children when the member has the permission', () => {
    useAuthStore.getState().setSession('t', companyMember('COMPANY_ADMIN'));
    render(
      <RequireCompanyPermission companyId="c1" permission="team.manage">
        team-panel
      </RequireCompanyPermission>,
    );
    expect(screen.getByText('team-panel')).toBeInTheDocument();
  });

  it('shows an access message instead of the page for insufficient permission', () => {
    useAuthStore.getState().setSession('t', companyMember('INTERVIEWER'));
    render(
      <RequireCompanyPermission companyId="c1" permission="billing.manage">
        billing-panel
      </RequireCompanyPermission>,
    );
    expect(screen.queryByText('billing-panel')).not.toBeInTheDocument();
    expect(screen.getByText("You don't have access")).toBeInTheDocument();
  });

  it('redirects candidates to candidate dashboard', () => {
    useAuthStore.getState().setSession('t', candidate);
    render(
      <RequireCompanyPermission companyId="c1" permission="job.create">
        jobs-panel
      </RequireCompanyPermission>,
    );
    expect(screen.queryByText('jobs-panel')).not.toBeInTheDocument();
    expect(routerReplace).toHaveBeenCalledWith('/candidate/dashboard');
  });
});
