import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureGate, JobCard } from './career-shared';
import { CareerPreferences, FindJobs } from './career-pages';
import { CvPreview } from './cv-preview';
import { careerCopy } from '@/lib/i18n/career';
import type { CareerJob } from '@/lib/api/career';

const state = vi.hoisted(() => ({ paid: false, locale: 'en', serverEnabled: false, save: vi.fn(), push: vi.fn(), search: vi.fn() }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: state.locale }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ feature: () => state.paid, loading: false, planName: state.paid ? 'CAREER_AI' : 'FREE' }) }));
vi.mock('@/lib/api/career', () => ({ careerApi: {
  autoStats: async () => ({ applicationsToday: 0, applicationsSent: 0, jobsAnalyzed: 0, jobsSkipped: 0, averageMatch: null }), settings: async () => ({ autoApply: state.serverEnabled, emailAlerts: false, autoMinimumScore: 80, minimumScore: 70, maxPerDay: 3, maxPerWeek: 10,
    preferencesInitialized: true, activeCv: { id: 'cv', filename: 'resume.pdf' }, domains: [], locations: [], workModes: [], excludedCompanies: [], excludedJobTypes: [], approvedDraftId: 'draft', frequency: 'DAILY' }),
  drafts: async () => [{ id: 'draft', title: 'Reviewed CV', approvedAt: '2026-09-09' }],
  facets: async () => ({ companies: [], domains: [], locations: [] }), history: async () => [],
  jobs: async (...args: unknown[]) => { state.search(...args); return ({ items: [], total: 0, page: 1, limit: 12, sources: [
    { type: 'JOOBLE', enabled: false, syncStatus: 'CONFIGURATION_REQUIRED' },
    { type: 'ANETI', enabled: true, syncStatus: 'ACTIVE' },
  ] }); },
  saveSettings: async (payload: { autoApply?: boolean }) => { state.serverEnabled = Boolean(payload.autoApply); state.save(payload); return { autoApply: state.serverEnabled }; },
} }));
function mount(content: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{content}</QueryClientProvider>);
}
afterEach(cleanup);
beforeEach(() => { state.paid = false; state.locale = 'en'; state.serverEnabled = false; state.save.mockReset(); });
describe('Career candidate experience', () => {
  it('browses recent jobs without silently applying CV preferences', async () => {
    state.search.mockClear();
    mount(<FindJobs />);
    await waitFor(() => expect(state.search).toHaveBeenCalledWith({ sort: 'newest', page: 1 }, false, expect.any(AbortSignal)));
  });
  it('keeps matching in the recommendations view', async () => {
    state.search.mockClear();
    mount(<FindJobs recommended />);
    await waitFor(() => expect(state.search).toHaveBeenCalledWith({ sort: 'match', page: 1 }, true, expect.any(AbortSignal)));
  });
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
  it('honors score visibility and renders a real 60% match without fabrication', () => {
    const base = { id: 'threshold-job', title: 'Threshold role', company: { commercialName: 'Verified company' }, location: 'Tunis',
      workMode: 'HYBRID', remote: false, employmentType: 'FULL_TIME', experienceLevel: 'MID', salaryMin: null,
      salaryMax: null, skills: [], description: 'A real job', match: { classification: 'POTENTIAL', method: 'evidence_coverage_v1', estimated: true } };
    mount(<JobCard job={{ ...base, match: { ...base.match, score: 59 } } as unknown as CareerJob} showMatchScore={false} />);
    expect(screen.queryByText(/59%/)).not.toBeInTheDocument();
    cleanup();
    mount(<JobCard job={{ ...base, match: { ...base.match, score: 60 } } as unknown as CareerJob} showMatchScore />);
    expect(screen.getByText(/60%/)).toBeInTheDocument();
  });
  it('shows a supplied closing date and removes the technical match breakdown', () => {
    const job = { id: 'deadline-job', title: 'Deadline role', company: { commercialName: 'Verified company' }, location: 'Tunis',
      workMode: 'HYBRID', remote: false, employmentType: 'FULL_TIME', experienceLevel: 'MID', salaryMin: null,
      salaryMax: null, skills: [], description: 'A real job', expiresAt: '2026-10-15T00:00:00.000Z',
      match: { score: 72, classification: 'POTENTIAL', matchedSkills: ['Python'], missingSkills: ['Docker'], dimensions: [{ key: 'skills', score: 70 }] } } as unknown as CareerJob;
    mount(<JobCard job={job} />);
    expect(screen.getByText(new RegExp(careerCopy.deadline[0]))).toBeInTheDocument();
    expect(screen.queryByText('Why this job matches')).not.toBeInTheDocument();
  });
  it('uses the same large button size for view and native EasyJob apply', () => {
    const job = { id: 'native-job', title: 'Native role', company: { commercialName: 'Verified company' }, location: 'Tunis',
      workMode: 'HYBRID', remote: false, employmentType: 'FULL_TIME', experienceLevel: 'MID', salaryMin: null,
      salaryMax: null, skills: [], description: 'A real job', applicationMethod: 'NATIVE_EASYJOB', isExternal: false,
      match: { score: null, classification: 'NOT_ANALYZED' } } as unknown as CareerJob;
    mount(<JobCard job={job} />);
    expect(screen.getByRole('link', { name: careerCopy.viewJob[0] })).toHaveAttribute('data-size', 'lg');
    expect(screen.getByRole('button', { name: careerCopy.apply[0] })).toHaveAttribute('data-size', 'lg');
  });
  it('keeps external applications inside EasyJob until the candidate opens the preparation flow', () => {
    const job = { id: 'aggregated-1', title: 'External role', company: null, location: null, workMode: null, remote: false,
      employmentType: 'Full-time', experienceLevel: null, salaryMin: null, salaryMax: null, salaryText: null,
      description: 'Source supplied summary', skills: [], isExternal: true, isSaved: false, applicationMethod: 'EXTERNAL_APPLICATION',
      sourceReferences: [{ type: 'JOOBLE', name: 'Jooble', label: 'Partner board', url: 'https://jobs.example.org/role', applicationMethod: 'EXTERNAL_APPLICATION' }],
      match: { score: null, classification: 'NOT_ANALYZED' } } as unknown as CareerJob;
    mount(<JobCard job={job} />);
    expect(screen.getByRole('button', { name: careerCopy.continueToEmployer[0] })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `${careerCopy.prepareApplication[0]} · EasyJob Boost` })).toHaveAttribute('href', '/candidate/subscription');
    expect(screen.getByRole('link', { name: careerCopy.viewJob[0] })).toHaveAttribute('href', '/candidate/jobs/aggregated-1');
    expect(screen.queryByRole('link', { name: /jobs\.example\.org/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Partner board')).not.toBeInTheDocument();
  });
  it('allows Free users to choose match sorting and handles no jobs', async () => {
    mount(<FindJobs />);
    expect(screen.getByText('Filters').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Filters'));
    expect(await screen.findByRole('option', { name: careerCopy.match[0] })).toBeInTheDocument();
    expect(screen.getByLabelText(careerCopy.salaryCurrency[0])).toHaveValue('');
    expect(screen.getByRole('option', { name: 'TND' })).toBeInTheDocument();
    expect(await screen.findByText(careerCopy.emptyJobs[0])).toBeInTheDocument();
  });
  it('keeps source configuration details out of the candidate empty state', async () => {
    state.locale = 'fr';
    mount(<FindJobs />);
    expect(await screen.findByText(careerCopy.emptyJobs[1])).toBeInTheDocument();
    expect(screen.queryByText('joobleNotConfigured')).not.toBeInTheDocument();
    expect(screen.queryByText('jobSourcesNote')).not.toBeInTheDocument();
  });
  it('enables Auto Apply from the status switch and persists the backend state', async () => {
    state.paid = true;
    mount(<CareerPreferences auto />);
    const user = userEvent.setup();
    const toggle = await screen.findByRole('switch', { name: careerCopy.enableAuto[0] });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    await waitFor(() => expect(state.save).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('switch', { name: careerCopy.disableAutoApply[0] })).toBeChecked());
    expect(state.save).toHaveBeenCalledWith({ autoApply: true, consent: true });
    expect(await screen.findByText(careerCopy.ACTIVE[0])).toBeInTheDocument();
  });
  it('locks Auto Apply for Free accounts and offers an upgrade', async () => {
    mount(<CareerPreferences auto />);
    expect(await screen.findByText(careerCopy.premiumFeature[0])).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: careerCopy.upgrade[0] }).some(link => link.getAttribute('href') === '/candidate/subscription')).toBe(true);
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
