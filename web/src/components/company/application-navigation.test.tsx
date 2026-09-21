import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationJobsPage } from './recruitment-workspace';
import { applicationsApi } from '@/lib/api/applications';
import type { ReactNode } from 'react';

const state = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ companyId: 'company-a' }), useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock('@/hooks/use-auth', () => ({ useRole: () => ({ can: () => true }) }));
vi.mock('@/hooks/use-socket', () => ({ useSocketEvent: vi.fn() }));
vi.mock('@/components/shared/guards', () => ({ RequireCompanyPermission: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'en' }) }));
vi.mock('@/lib/i18n/recruitment', () => ({ useRecruitmentText: () => (key: string) => key }));
vi.mock('@/lib/i18n/ux', () => ({ useUxText: () => (key: string) => key }));
vi.mock('./workspace-interviews', () => ({ ScheduleInterviewAction: () => null }));
vi.mock('@/lib/api/applications', () => ({ applicationsApi: { companyList: vi.fn(), jobSummaries: vi.fn() } }));
vi.mock('@/lib/api/jobs', () => ({ jobsApi: { managed: vi.fn() } }));

beforeEach(() => {
  state.search = '';
  vi.clearAllMocks();
  vi.mocked(applicationsApi.companyList).mockResolvedValue({ items: [], total: 0, page: 1, limit: 30, totalPages: 1 });
  vi.mocked(applicationsApi.jobSummaries).mockResolvedValue({ items: [], total: 0, page: 1, limit: 12, totalPages: 1 });
});
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ApplicationJobsPage /></QueryClientProvider>);

describe('Application navigation', () => {
  it('opens all applications without forcing a first job and keeps the grouped view accessible', async () => {
    show();
    await waitFor(() => expect(applicationsApi.companyList).toHaveBeenCalledWith('company-a', expect.objectContaining({ jobId: undefined, page: 1 })));
    expect(screen.getByRole('link', { name: 'applicationsByJob' })).toHaveAttribute('href', '/company/company-a/applications?view=jobs');
    fireEvent.click(screen.getByRole('button', { name: 'board' }));
    expect(screen.getByRole('button', { name: 'board' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('applies a valid status from a dashboard action to the scoped request', async () => {
    state.search = 'status=APPLIED';
    show();
    await waitFor(() => expect(applicationsApi.companyList).toHaveBeenLastCalledWith('company-a', expect.objectContaining({ status: 'APPLIED' })));
  });
  it('preserves applications grouped by job as a secondary view', async () => {
    state.search = 'view=jobs';
    show();
    expect(await screen.findByRole('heading', { name: 'applicationsByJob' })).toBeInTheDocument();
    expect(applicationsApi.companyList).not.toHaveBeenCalled();
    expect(applicationsApi.jobSummaries).toHaveBeenCalledWith('company-a', expect.objectContaining({ page: 1 }));
  });
});
