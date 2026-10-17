import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkspaceInterviews } from './interview-workspace';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useParams: () => ({ companyId: 'company' }) }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/lib/i18n/hiring', () => ({ useHiringText: () => (key: string) => key }));
vi.mock('@/hooks/use-auth', () => ({ useRole: () => ({ can: () => false }) }));
vi.mock('@/hooks/use-company', () => ({ useCompanyRole: () => 'OWNER' }));
vi.mock('@/lib/api/client', () => ({ api: { get: () => Promise.resolve({ items: [] }) }, apiBlob: vi.fn() }));
vi.mock('@/lib/api/company-workspace', () => ({ workspaceApi: { interviews: () => Promise.resolve({ items: [], total: 0, totalPages: 1 }) } }));
vi.mock('./interview-calendar', () => ({ InterviewCalendar: () => <div data-testid="calendar-grid" /> }));
vi.mock('./interview-scheduler', () => ({ InterviewEditor: () => null, FeedbackEditor: () => null }));
vi.mock('./employment-offers', () => ({ HiringSelect: () => null }));
vi.mock('./workspace-overview', () => ({ WorkspaceError: () => null, WorkspaceLoading: () => null }));
afterEach(cleanup);
it('opens calendar first and lets the user switch to the secondary list and back', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WorkspaceInterviews /></QueryClientProvider>);
  expect(screen.getByRole('button', { name: 'calendar' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
  const modes = screen.getByRole('group', { name: 'view' });
  expect(modes.querySelector('button')).toHaveTextContent('calendar');
  fireEvent.click(screen.getByRole('button', { name: 'list' }));
  expect(screen.queryByTestId('calendar-grid')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'list' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'calendar' }));
  expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
});
