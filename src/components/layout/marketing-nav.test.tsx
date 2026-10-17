import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';
import { makeUser } from '@/test/factories';
import { MarketingNav } from './marketing-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/components/ui/theme-toggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/layout/logo', () => ({ Logo: () => <span>EasyJob</span> }));

beforeEach(() => {
  useAuthStore.getState().clearSession();
});

describe('Marketing navigation session', () => {
  it('links guests to the correct login and signup pages on desktop and mobile', async () => {
    render(<I18nProvider><MarketingNav /></I18nProvider>);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Menu' }));
    for (const link of screen.getAllByRole('link', { name: 'Sign in' })) expect(link).toHaveAttribute('href', '/login');
    for (const link of screen.getAllByRole('link', { name: 'Sign up' })) expect(link).toHaveAttribute('href', '/register');
  });

  it.each([
    [makeUser({ roles: ['CANDIDATE'] }), '/candidate/dashboard'],
    [makeUser({ roles: ['HR'], memberships: [{ companyId: 'acme', role: 'HR' }] }), '/company/acme/dashboard'],
    [makeUser({ roles: ['PLATFORM_ADMIN'] }), '/admin/dashboard'],
  ] as const)('links directly to the restored account workspace on desktop and mobile', async (account, route) => {
    render(<I18nProvider><MarketingNav /></I18nProvider>);
    await act(async () => { useAuthStore.getState().setSession('restored', account); });
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', route);
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(2);
    for (const link of screen.getAllByRole('link', { name: 'Dashboard' })) expect(link).toHaveAttribute('href', route);
    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
  });
});
