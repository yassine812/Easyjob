import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompanySearch } from './company-search';
import { WorkspaceCandidates } from './workspace-candidates';
import { RecruiterHome } from './recruiter-home';
import { workspaceApi, type WorkspaceOverview } from '@/lib/api/company-workspace';
import { AnalysisProcessing } from '@/components/shared/analysis-processing';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/lib/i18n/ux', () => ({ useUxText: () => (key: string) => key }));
vi.mock('@/lib/i18n/company', () => ({ useCompanyText: () => (key: string) => key }));
vi.mock('@/hooks/use-auth', () => ({ useRole: () => ({ can: (_id: string, permission: string) => permission !== 'team.invite' }) }));
vi.mock('@/hooks/use-company', () => ({ useCompanyRole: () => 'COMPANY_ADMIN' }));
vi.mock('@/hooks/use-socket', () => ({ useSocketEvent: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ companyId: 'company-a' }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/company/company-a/candidates', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api/company-workspace', () => ({ workspaceApi: { candidates: vi.fn(), search: vi.fn() } }));
function show(element: React.ReactNode) { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>); }
afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => { vi.mocked(workspaceApi.candidates).mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 }); });

describe('Recruitment UX', () => {
  it('opens commands with Ctrl+K, filters restricted actions and restores focus with Escape', async () => {
    show(<CompanySearch companyId="company-a" />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'postJob' })).toHaveAttribute('href', '/company/company-a/jobs/new');
    expect(screen.getByRole('link', { name: 'schedule' })).toHaveAttribute('href', '/company/company-a/interviews?compose=1');
    expect(screen.queryByRole('link', { name: 'invite' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('searches within the current company after typing, without a submit step', async () => {
    vi.mocked(workspaceApi.search).mockResolvedValue({ jobs: [{ id: 'job-a', title: 'Platform Engineer', status: 'DRAFT' }], applications: [], candidates: [], interviews: [], members: [] });
    show(<CompanySearch companyId="company-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'search' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Platform' } });
    expect(await screen.findByRole('link', { name: 'Platform Engineer' })).toHaveAttribute('href', '/company/company-a/jobs/job-a');
    expect(workspaceApi.search).toHaveBeenCalledWith('company-a', 'Platform');
  });
  it('keeps advanced filters hidden and removes an applied filter from both request and form', async () => {
    show(<WorkspaceCandidates />);
    expect(screen.queryByLabelText('skill')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'filters' }));
    fireEvent.change(screen.getByLabelText('skill'), { target: { value: 'TypeScript' } });
    fireEvent.click(screen.getByRole('button', { name: 'search' }));
    await waitFor(() => expect(workspaceApi.candidates).toHaveBeenLastCalledWith('company-a', expect.objectContaining({ skill: 'TypeScript', page: 1 })));
    fireEvent.click(screen.getByRole('button', { name: 'removeFilter: skill' }));
    await waitFor(() => expect(workspaceApi.candidates).toHaveBeenLastCalledWith('company-a', expect.objectContaining({ skill: '', page: 1 })));
    expect(screen.getByLabelText('skill')).toHaveValue('');
  });
  it('shows actionable real counts without inventing unlocked intelligence', () => {
    const data: WorkspaceOverview = { from: '2026-10-01', to: '2026-10-06', jobs: { PUBLISHED: 2, DRAFT: 1 }, stages: { APPLIED: 7 }, totalApplications: 10, analyzed: 6, distribution: {}, averageMatch: null, averageTimeToHireDays: null, averageTimeToInterviewDays: null, hiringRate: null, sources: { manual: 10, autoApply: 0 }, daily: [], applicationsByJob: [], recent: [], upcoming: [] };
    show(<RecruiterHome companyId="company-a" data={data} controls={null} loading={null} />);
    expect(screen.getByRole('link', { name: /reviewApplications\s*7/ })).toHaveAttribute('href', '/company/company-a/pipeline?status=APPLIED');
    expect(screen.queryByRole('link', { name: /reviewOffers/ })).not.toBeInTheDocument();
    expect(screen.getByText('attentionToday')).toBeInTheDocument();
    expect(screen.queryByText('applicationQuality')).not.toBeInTheDocument();
  });
  it('does not invent a percentage or processing stage for an analysis', () => {
    render(<AnalysisProcessing />);
    expect(screen.getByRole('status')).toHaveTextContent('processing');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('status').textContent).not.toMatch(/\d+%/);
  });
});
