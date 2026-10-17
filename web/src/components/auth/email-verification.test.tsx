import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyEmailContent } from './email-verification';

const mocks = vi.hoisted(() => ({ verify: vi.fn(), resend: vi.fn(), establish: vi.fn(), replace: vi.fn(), setLastEmail: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params }));
vi.mock('@/lib/api/auth', () => ({ authApi: { verifyEmail: mocks.verify, resendVerification: mocks.resend } }));
vi.mock('@/lib/auth-session', () => ({ establishSession: mocks.establish }));
vi.mock('@/store/auth-store', () => ({ useAuthStore: { getState: () => ({ lastEmail: 'jane@test.com', setLastEmail: mocks.setLastEmail }) } }));
vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (_fr: string, en: string) => en }));
vi.mock('@/lib/permissions', () => ({ getDashboardRoute: () => '/candidate/dashboard' }));

beforeEach(() => {
  cleanup(); vi.clearAllMocks(); sessionStorage.clear(); mocks.params = new URLSearchParams();
  mocks.verify.mockResolvedValue({ verified: true, accessToken: 'verified-token' });
  mocks.establish.mockResolvedValue({ id: 'u1', email: 'jane@test.com' });
  mocks.resend.mockResolvedValue({ sent: true });
});

it('uses a numeric code, establishes the session, and opens the dashboard with a welcome', async () => {
  render(<VerifyEmailContent />);
  await userEvent.type(screen.getByLabelText('Verification code'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm and open dashboard' }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/candidate/dashboard'));
  expect(mocks.verify).toHaveBeenCalledWith({ email: 'jane@test.com', code: '123456' });
  expect(mocks.establish).toHaveBeenCalledWith('verified-token', 'jane@test.com');
  expect(sessionStorage.getItem('easyjob:verification-welcome:u1')).toBe('pending');
});

it('keeps an invalid code on the form without creating a session', async () => {
  mocks.verify.mockRejectedValue(new Error('Invalid code'));
  render(<VerifyEmailContent />);
  await userEvent.type(screen.getByLabelText('Verification code'), '111111');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm and open dashboard' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect or expired code');
  expect(mocks.establish).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it('requests the code once when continuing from face login and enables a resend cooldown', async () => {
  mocks.params = new URLSearchParams('send=1');
  render(<VerifyEmailContent />);
  expect(await screen.findByRole('button', { name: /Resend in/ })).toBeDisabled();
  expect(mocks.resend).toHaveBeenCalledExactlyOnceWith('jane@test.com');
});
