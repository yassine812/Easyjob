import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureGate, JobCard } from './career-shared';
import { CareerPreferences, FindJobs } from './career-pages';
import { CvPreview } from './cv-preview';
import { careerCopy } from '@/lib/i18n/career';
import type { CareerJob } from '@/lib/api/career';

const state = vi.hoisted(() => ({ paid: false, locale: 'en', save: vi.fn() }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: state.locale }) }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ feature: () => state.paid, loading: false, planName: state.paid ? 'CAREER_AI' : 'FREE' }) }));
vi.mock('@/lib/api/career', () => ({ careerApi: {
  autoStats: async () => ({ applicationsToday: 0, applicationsSent: 0, jobsAnalyzed: 0, jobsSkipped: 0, averageMatch: null }), settings: async () => ({ autoApply: false, emailAlerts: false, autoMinimumScore: 80, minimumScore: 70, maxPerDay: 3,
    domains: [], locations: [], workModes: [], excludedCompanies: [], excludedJobTypes: [], approvedDraftId: 'draft', frequency: 'DAILY' }),
  drafts: async () => [{ id: 'draft', title: 'Reviewed CV', approvedAt: '2026-09-09' }],
  facets: async () => ({ companies: [], domains: [], locations: [] }), history: async () => [],
  jobs: async () => ({ items: [], total: 0, page: 1, limit: 12 }), saveSettings: state.save,
} }));
function mount(content: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{content}</QueryClientProvider>);
}
afterEach(cleanup);
beforeEach(() => { state.paid = false; state.locale = 'en'; state.save.mockReset(); });
describe('Career candidate experience', () => {
  it('does not render premium controls for Free accounts', () => {
    mount(<FeatureGate feature="career.coach" advanced><button>Start interview</button></FeatureGate>);
    expect(screen.queryByText('Start interview')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: careerCopy.upgrade[0] })).toHaveAttribute('href', '/candidate/subscription');
  });
  it('renders no fabricated percentage for an unanalysed job', () => {
    const job = { id: 'job', title: 'Actual role', company: { commercialName: 'Verified company' }, location: null,
      workMode: 'HYBRID', remote: false, employmentType: 'FULL_TIME', experienceLevel: 'MID', salaryMin: null,
      salaryMax: null, skills: [], match: { score: null, classification: 'NOT_ANALYZED' } } as unknown as CareerJob;
    mount(<JobCard job={job} />);
    expect(screen.getByText('Actual role')).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });
  it('allows Free users to choose match sorting and handles no jobs', async () => {
    mount(<FindJobs />);
    expect(screen.getByText('Filters').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Filters'));
    expect(await screen.findByRole('option', { name: careerCopy.match[0] })).toBeInTheDocument();
    expect(await screen.findByText(careerCopy.emptyJobs[0])).toBeInTheDocument();
  });
  it('Auto Apply starts disabled and cannot be saved as enabled without consent', async () => {
    state.paid = true;
    mount(<CareerPreferences auto />);
    const checkbox = await screen.findByRole('checkbox', { name: careerCopy.enableAuto[0] });
    expect(checkbox).not.toBeChecked();
    expect(state.save).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    expect(screen.getByRole('button', { name: careerCopy.save[0] })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: careerCopy.autoConsent[0] }));
    expect(screen.getByRole('button', { name: careerCopy.save[0] })).toBeEnabled();
    expect(state.save).not.toHaveBeenCalled();
  });
  it('prevents Free accounts from enabling Auto Apply', async () => {
    mount(<CareerPreferences auto />);
    expect(await screen.findByRole('checkbox', { name: careerCopy.enableAuto[0] })).toBeDisabled();
  });
  it('renders Arabic navigation labels and all translations have three values', async () => {
    state.locale = 'ar';
    mount(<CareerPreferences />);
    await waitFor(() => expect(screen.getByRole('link', { name: careerCopy.find[2] })).toBeInTheDocument());
    for (const values of Object.values(careerCopy)) expect(values.every(v => v.trim().length > 0) && values.length === 3).toBe(true);
  });
  it('prints professional headings while keeping source HTML inert', () => {
    const { container } = mount(<CvPreview content={'# Jane Doe\n## Experience\n<img src=x onerror=alert(1)>'} />);
    expect(screen.getByRole('heading', { name: 'Jane Doe', level: 1 })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
