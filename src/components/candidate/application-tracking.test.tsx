import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationInsights, CandidateApplications } from './application-tracking';
import type { Application } from '@/types/api';

const state = vi.hoisted(() => ({ mine: vi.fn(), handlers: {} as Record<string, () => void> }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/hooks/use-socket', () => ({ useSocketEvent: (event: string, callback: () => void) => { state.handlers[event] = callback; } }));
vi.mock('./career-shared', () => ({ CareerFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>, Busy: () => <p>Loading</p>, Failure: () => <p>Error</p>, panelClass: '', selectClass: '' }));
vi.mock('@/lib/api/applications', () => ({ applicationsApi: { mine: state.mine } }));
vi.mock('@/lib/api/career', () => ({ careerApi: { externalApplications: async () => [] } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const base = { id: 'application', status: 'APPLIED', appliedAt: '2026-09-24T10:00:00Z', aiScreeningStatus: 'COMPLETED', aiScreenedAt: '2026-09-24T10:00:01Z', aiMatchScore: 87, atsScore: 79, matchExplanation: { matchedSkills: ['Python', 'Django'], missingSkills: ['SQL'] }, resume: { filename: 'Chosen CV.pdf' } } as Application;

it('renders measured scores and separate skill chips with a real timeline, not stage tabs', () => {
  render(<ApplicationInsights data={base} />);
  expect(screen.getByRole('meter', { name: 'Compatibilité' })).toHaveAttribute('aria-valuenow', '87');
  expect(screen.getByText('Python').tagName).toBe('SPAN');
  expect(screen.queryByText('SQL')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Analyse terminée. En attente');
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.getByText('Chosen CV.pdf')).toBeInTheDocument();
});

it('automatically refetches and advances the visible workflow when a recruiter event arrives', async () => {
  state.mine.mockResolvedValueOnce({ items: [base], total: 1 }).mockResolvedValue({ items: [{ ...base, status: 'UNDER_REVIEW', stageChangedAt: '2026-09-24T11:00:00Z' }], total: 1 });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CandidateApplications /></QueryClientProvider>);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /Ouvrir la candidature/ }));
  expect(await screen.findByText(/Analyse terminée. En attente/)).toBeInTheDocument();
  expect(screen.getByLabelText('Statut de candidature')).toBeInTheDocument();
  expect(screen.queryByText(/Résultats de mes candidatures/)).not.toBeInTheDocument();
  state.handlers['application.status_changed']();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Le recruteur examine'));
  expect(state.mine).toHaveBeenCalledTimes(2);
});

it('keeps application cards collapsed and allows only one timeline at a time', async () => {
  state.mine.mockResolvedValue({ items: [{ ...base, id: 'one' }, { ...base, id: 'two' }], total: 2 });
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CandidateApplications /></QueryClientProvider>);
  const toggles = await screen.findAllByRole('button', { name: /Ouvrir la candidature/ });
  expect(toggles.every(toggle => toggle.getAttribute('aria-expanded') === 'false')).toBe(true);
  await user.click(toggles[0]);
  expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByRole('status')).toHaveLength(1);
  await user.click(toggles[1]);
  expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
  expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByRole('status')).toHaveLength(1);
  await user.click(toggles[1]);
  expect(toggles[1]).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps a long list compact by mounting no timelines for 100 collapsed applications', async () => {
  state.mine.mockResolvedValue({ items: Array.from({ length: 100 }, (_, index) => ({ ...base, id: `application-${index}` })), total: 100 });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CandidateApplications /></QueryClientProvider>);
  expect(await screen.findAllByRole('button', { name: /Ouvrir la candidature/ })).toHaveLength(100);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
