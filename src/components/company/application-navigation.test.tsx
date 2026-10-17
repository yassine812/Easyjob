import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api/jobs';
import { ApplicationJobsPage, JobApplicationsPage, CompanyJobsPage } from './recruitment-workspace';
import { applicationsApi } from '@/lib/api/applications';
import type { ReactNode } from 'react';

const state = vi.hoisted(() => ({ search: '', jobId: undefined as string | undefined }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useParams: () => ({ companyId: 'company-a', jobId: state.jobId }), useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ isPaid: true, displayName: 'Company Max' }) }));
vi.mock('@/hooks/use-auth', () => ({ useRole: () => ({ can: () => true }) }));
vi.mock('@/hooks/use-socket', () => ({ useSocketEvent: vi.fn() }));
vi.mock('@/components/shared/guards', () => ({ RequireCompanyPermission: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'en' }) }));
vi.mock('@/lib/i18n/recruitment', () => ({ useRecruitmentText: () => (key: string) => key }));
vi.mock('@/lib/i18n/ux', () => ({ useUxText: () => (key: string) => key }));
vi.mock('./workspace-interviews', () => ({ ScheduleInterviewAction: () => null }));
vi.mock('@/lib/api/applications', () => ({ applicationsApi: { companyList: vi.fn(), jobSummaries: vi.fn() } }));
vi.mock('@/lib/api/jobs', () => ({ jobsApi: { managed: vi.fn(), companyJobs: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  state.search = '';
  state.jobId = undefined;
  vi.clearAllMocks();
  vi.mocked(applicationsApi.companyList).mockResolvedValue({ items: [], total: 0, page: 1, limit: 30, totalPages: 1 });
  vi.mocked(applicationsApi.jobSummaries).mockResolvedValue({ items: [], total: 0, page: 1, limit: 12, totalPages: 1 });
});
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TooltipProvider><ApplicationJobsPage /></TooltipProvider></QueryClientProvider>);

describe('Application navigation', () => {
  it('links the DevOps card to its scoped applications and public preview', async () => {
    vi.mocked(jobsApi.companyJobs).mockResolvedValue({ items: [{ id: 'devops', companyId: 'company-a', title: 'DevOps Engineer', status: 'PUBLISHED', _count: { applications: 4 }, salaryMin: 4500, salaryMax: 7200, currency: 'TND' }], total: 1, page: 1, limit: 12 } as never);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TooltipProvider><CompanyJobsPage /></TooltipProvider></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'DevOps Engineer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'viewApplications' })).toHaveAttribute('href', '/company/company-a/jobs/devops/applications');
    expect(screen.getByRole('link', { name: 'viewOffer' })).toHaveAttribute('href', '/company/company-a/jobs/devops/preview');
    expect(screen.getByText(/4.*applications/)).toBeInTheDocument();
  });
  it('loads DevOps applications in job scope with four entries and no offer selector', async () => {
    state.jobId = 'devops';
    vi.mocked(jobsApi.managed).mockResolvedValue({ id: 'devops', companyId: 'company-a', title: 'DevOps Engineer' } as never);
    vi.mocked(applicationsApi.companyList).mockResolvedValue({ items: [], total: 4, page: 1, limit: 30, totalPages: 1, stageCounts: { APPLIED: 1, SHORTLISTED: 3 } });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TooltipProvider><JobApplicationsPage /></TooltipProvider></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'DevOps Engineer' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'all 4' })).toBeInTheDocument());
    expect(applicationsApi.companyList).toHaveBeenCalledWith('company-a', expect.objectContaining({ jobId: 'devops', includeLowAlignment: 'true' }));
    expect(screen.queryByRole('combobox', { name: 'offer' })).not.toBeInTheDocument();
    expect(applicationsApi.jobSummaries).not.toHaveBeenCalled();
  });
  it('opens all applications without forcing a first job and keeps the grouped view accessible', async () => {
    show();
    await waitFor(() => expect(applicationsApi.companyList).toHaveBeenCalledWith('company-a', expect.objectContaining({ jobId: undefined, page: 1 })));
    expect(screen.getByRole('tab', { name: 'applicationsByJob' })).toHaveAttribute('href', '/company/company-a/applications?view=jobs');
    expect(screen.getByRole('tab', { name: 'board' })).toHaveAttribute('href', '/company/company-a/applications?view=table');
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
