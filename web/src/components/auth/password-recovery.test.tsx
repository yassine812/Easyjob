import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordPage, ResetPasswordPage } from './password-recovery';
import { I18nProvider } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';
import { makeUser } from '@/test/factories';
const forgot = vi.fn(), reset = vi.fn(), push = vi.fn();
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('token=test-reset-token'), useRouter: () => ({ push }) }));
vi.mock('@/lib/api/auth', () => ({ authApi: { forgotPassword: (...args: unknown[]) => forgot(...args), resetPassword: (...args: unknown[]) => reset(...args) } }));
beforeEach(() => { vi.clearAllMocks(); useAuthStore.getState().clearSession(); });
describe('Password recovery', () => {
  it('keeps recovery accessible with an existing authenticated account', async () => {
    useAuthStore.getState().setSession('existing-token', makeUser({ mustChangePassword: true }));
    forgot.mockResolvedValue({ sent: true });
    render(<I18nProvider><ForgotPasswordPage /></I18nProvider>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'owner@workspace.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(forgot).toHaveBeenCalledWith('owner@workspace.test');
    expect(push).not.toHaveBeenCalled();
  });
  it('clears the local session after a successful password reset', async () => {
    reset.mockResolvedValue({ success: true });
    useAuthStore.getState().setSession('old-token', makeUser());
    render(<I18nProvider><ResetPasswordPage /></I18nProvider>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New password'), 'NewPassw0rd!');
    await user.type(screen.getByLabelText('Confirm password'), 'NewPassw0rd!');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
    expect(reset).toHaveBeenCalledWith({ token: 'test-reset-token', newPassword: 'NewPassw0rd!' });
  });
});
