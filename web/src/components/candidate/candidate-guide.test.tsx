import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CandidateGuide } from './candidate-guide';
import CandidatePage from '@/app/(candidate)/candidate/page';

const state = vi.hoisted(() => ({ pathname: '/candidate/dashboard', userId: 'guide-user', push: vi.fn(), replace: vi.fn(), redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname, useRouter: () => ({ push: state.push, replace: state.replace }), redirect: state.redirect }));
vi.mock('@/store/auth-store', () => ({ useAuthStore: (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: state.userId } }) }));
vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (_fr: string, en: string) => en }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'en' }) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); state.pathname = '/candidate/dashboard'; state.userId = 'guide-user'; });

it('redirects the old candidate URL to the dashboard', () => {
  CandidatePage();
  expect(state.redirect).toHaveBeenCalledWith('/candidate/dashboard');
});

it('guides the user through the app and finishes on the dashboard', () => {
  render(<CandidateGuide />);
  expect(screen.getByRole('heading')).toHaveTextContent('Welcome to EasyJob');
  for (const route of ['cvs', 'jobs', 'applications', 'interview-coach', 'profile']) {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(state.push).toHaveBeenLastCalledWith(`/candidate/${route}`);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(localStorage.getItem('easyjob:app-guide:v1:guide-user')).toBe('done');
  expect(state.replace).toHaveBeenLastCalledWith('/candidate/dashboard');
});

it('allows skipping immediately and does not reopen for the same account', () => {
  const view = render(<CandidateGuide />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }));
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  view.unmount();
  render(<CandidateGuide />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

it('restores an interrupted guide on its current page', () => {
  localStorage.setItem('easyjob:app-guide:v1:guide-user', '2');
  state.pathname = '/candidate/jobs';
  render(<CandidateGuide />);
  expect(screen.getByRole('heading')).toHaveTextContent('Find suitable jobs');
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(state.push).toHaveBeenLastCalledWith('/candidate/cvs');
});

it('keeps dismissal separate for each account', () => {
  localStorage.setItem('easyjob:app-guide:v1:other-user', 'done');
  render(<CandidateGuide />);
  expect(screen.getByRole('region')).toBeInTheDocument();
});

it('shows the human coach with only tour navigation and no voice or choice controls', () => {
  render(<CandidateGuide />);
  expect(screen.getByRole('img', { name: 'Your EasyJob coach' })).toBeInTheDocument();
  expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Skip guide', 'Previous', 'Next']);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('heading')).toHaveTextContent('Your CV and its analysis');
  expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual(['Skip guide', 'Previous', 'Next']);
});

it('responds to navigation in the app and lets the user reopen a skipped guide', () => {
  const view = render(<CandidateGuide />);
  state.pathname = '/candidate/profile';
  view.rerender(<CandidateGuide />);
  expect(screen.getByRole('heading')).toHaveTextContent('Keep your profile up to date');
  fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }));
  fireEvent.click(screen.getByRole('button', { name: 'Replay guide' }));
  expect(screen.getByRole('heading')).toHaveTextContent('Welcome to EasyJob');
  expect(state.push).toHaveBeenLastCalledWith('/candidate/dashboard');
});

it('spotlights the explained area and removes the spotlight when skipped', () => {
  const target = document.createElement('div');
  target.dataset.guide = 'dashboard';
  target.getBoundingClientRect = () => ({ x: 300, y: 200, left: 300, top: 200, right: 800, bottom: 300, width: 500, height: 100, toJSON() {} });
  document.body.appendChild(target);
  render(<CandidateGuide />);
  expect(screen.getByTestId('guide-spotlight')).toHaveStyle({ left: '292px', top: '192px', width: '516px', height: '116px' });
  fireEvent.click(screen.getByRole('button', { name: 'Skip guide' }));
  expect(screen.queryByTestId('guide-spotlight')).not.toBeInTheDocument();
  target.remove();
});
