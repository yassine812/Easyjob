import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CandidateCvOnboarding } from './cv-registration';

const state = vi.hoisted(() => ({
  status: 'PENDING', profileError: false, reportError: false,
  profile: { headline: 'Developer' },
  refetch: vi.fn(), invalidate: vi.fn(),
}));
vi.mock('@/lib/i18n/release', () => ({ useReleaseText: () => (fr: string) => fr }));
vi.mock('@/lib/i18n/career', () => ({ useCareerText: () => (key: string) => key }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ feature: () => false }) }));
vi.mock('@/components/candidate/career-pages', () => ({ ProfessionalDetails: () => <p>Editable details</p> }));
vi.mock('@/components/candidate/profile-photo', () => ({ ProfilePhoto: () => null }));
vi.mock('./face-enrollment', () => ({ FaceEnrollment: () => null }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === 'candidate-profile'
    ? { data: state.profileError ? undefined : state.profile, isError: state.profileError, refetch: state.refetch }
    : { data: { status: state.status }, isError: state.reportError, refetch: state.refetch },
}));
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); state.status = 'PENDING'; state.profileError = false; state.reportError = false; vi.clearAllMocks(); });
const show = () => render(<CandidateCvOnboarding candidateEmail="test@example.test" initialResumeId="resume-1" onFinishFace={vi.fn()} onFinishDashboard={vi.fn()} />);

it('finishes onboarding and clears the draft when Maybe later is selected on step six', () => {
  vi.useFakeTimers();
  localStorage.setItem('easyjob:onboarding:test@example.test', JSON.stringify({ step: 5, id: 'resume-1', resumeStep: false }));
  const finish = vi.fn();
  render(<CandidateCvOnboarding candidateEmail="test@example.test" onFinishFace={vi.fn()} onFinishDashboard={finish} />);
  fireEvent.click(screen.getByRole('button', { name: 'Peut-être plus tard' }));
  act(() => vi.advanceTimersByTime(2600));
  expect(finish).toHaveBeenCalledOnce();
  expect(localStorage.getItem('easyjob:onboarding:test@example.test')).toBeNull();
});

it('shows the coach while pending, then the editable profile when extraction completes', () => {
  const view = show();
  expect(screen.getByText(/Quelques instants/)).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Ton coach EasyJob' })).toBeInTheDocument();
  expect(screen.queryByText('Editable details')).not.toBeInTheDocument();
  state.status = 'COMPLETED';
  view.rerender(<CandidateCvOnboarding candidateEmail="test@example.test" initialResumeId="resume-1" onFinishFace={vi.fn()} onFinishDashboard={vi.fn()} />);
  expect(screen.getByText('Editable details')).toBeInTheDocument();
});
it('offers manual review immediately for a failed CV instead of an endless spinner', () => {
  state.status = 'FAILED'; show();
  expect(screen.getByText('Un petit contretemps')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continuer manuellement' }));
  expect(screen.getByText('Editable details')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'next' })).not.toBeDisabled();
});
it('allows manual review after 90 seconds when processing is stuck', () => {
  vi.useFakeTimers(); show();
  expect(screen.queryByRole('button', { name: 'Continuer manuellement' })).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(90_000));
  fireEvent.click(screen.getByRole('button', { name: 'Continuer manuellement' }));
  expect(screen.getByText('Editable details')).toBeInTheDocument();
});
it('exposes a profile request error immediately and allows checking again', () => {
  state.profileError = true; show();
  expect(screen.getByText('Un petit contretemps')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Vérifier à nouveau' }));
  expect(state.refetch).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Continuer manuellement' })).not.toBeInTheDocument();
});
