import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CandidateGuide } from './candidate-guide';

const state = vi.hoisted(() => ({ userId: 'guide-user' }));
vi.mock('@/store/auth-store', () => ({ useAuthStore: (select: (s: { user: { id: string } | null }) => unknown) => select({ user: state.userId ? { id: state.userId } : null }) }));
vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (fr: string, en: string) => en }));

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); state.userId = 'guide-user'; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('shows the welcome message once and dismisses it automatically', () => {
  render(<CandidateGuide />);
  expect(screen.getByRole('status')).toHaveTextContent('Welcome back');
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(localStorage.getItem('easyjob:welcome:v1:guide-user')).toBe('done');
});

it('does not show the welcome message again for the same account', () => {
  localStorage.setItem('easyjob:welcome:v1:guide-user', 'done');
  render(<CandidateGuide />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps first-login state separate between accounts', () => {
  localStorage.setItem('easyjob:welcome:v1:other-user', 'done');
  render(<CandidateGuide />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});

it('welcomes a returning user after code verification and clears the one-time welcome', () => {
  localStorage.setItem('easyjob:welcome:v1:guide-user', 'done');
  sessionStorage.setItem('easyjob:verification-welcome:guide-user', 'pending');
  const view = render(<CandidateGuide />);
  expect(screen.getByRole('status')).toHaveTextContent('Welcome back');
  expect(view.container.querySelector('img')).toHaveAttribute('src', expect.stringContaining('easyjob-human-transparent'));
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(sessionStorage.getItem('easyjob:verification-welcome:guide-user')).toBeNull();
});
