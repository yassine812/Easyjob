import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Application } from '@/types/api';
import { ApplicationAnalysisSummary } from './application-analysis-summary';
import { ApplicationStageControl, nextApplicationStages } from './application-stage-control';
import { SubmittedCvPanel } from './submitted-cv-panel';
import { RecruiterHome } from './recruiter-home';
import { analysisTone, potentialView } from '@/lib/recruitment-presentation';
import type { WorkspaceOverview } from '@/lib/api/company-workspace';

const mocks = vi.hoisted(() => ({ move: vi.fn(async () => ({})), cv: vi.fn(async () => ({ url: '/signed/submitted', filename: 'submitted-v1.pdf' })) }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/lib/i18n/recruitment', () => ({ useRecruitmentText: () => (key: string) => key }));
vi.mock('@/lib/i18n/company', () => ({ useCompanyText: () => (key: string) => key }));
vi.mock('@/lib/i18n/ux', () => ({ useUxText: () => (key: string) => key }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ isPaid: true, displayName: 'Actual company plan' }) }));
vi.mock('@/hooks/use-auth', () => ({ useRole: () => ({ can: () => true }) }));
vi.mock('@/lib/api/applications', () => ({ applicationsApi: { updateStatus: mocks.move, cvUrl: mocks.cv } }));
vi.mock('@/lib/api/resumes', () => ({ resolveResumeUrl: (url: string) => `http://api.test${url}` }));
vi.mock('@/components/candidate/cv-pdf-viewer', () => ({ CvPdfViewer: ({ sourceUrl }: { sourceUrl: string }) => <iframe title="submitted PDF" src={sourceUrl} /> }));
vi.mock('@/components/ui/select', () => ({ Select: ({ children, value, onValueChange, disabled }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void; disabled?: boolean }) => <select aria-label="stage" value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)}>{children}</select>, SelectTrigger: () => null, SelectValue: () => null, SelectContent: ({ children }: { children: React.ReactNode }) => children, SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option> }));

const app = { id: 'a', status: 'APPLIED', aiMatchScore: 8, potentialScore: 'LOW', potentialAssessment: { applicable: false }, advancedAnalysisAvailable: true, classification: 'LOW_ALIGNMENT', candidate: { user: { name: 'Nour' } }, job: { title: 'DevOps' }, matchExplanation: { growthAnalysis: { score: 0, category: 'LOW', transferableEvidence: [] } }, appliedAt: '2026-09-30', resumeId: null } as unknown as Application;
function mount(children: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><TooltipProvider>{children}</TooltipProvider></QueryClientProvider>); }
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('recruiter workflow presentation', () => {
  it('never presents a low potential as positive or an irrelevant zero', () => {
    expect(analysisTone('LOW')).not.toContain('emerald');
    expect(potentialView(app)).toMatchObject({ applicable: false, score: null, category: 'NOT_APPLICABLE' });
    mount(<ApplicationAnalysisSummary application={app} companyId="company" />);
    expect(screen.getByText('easyjobAnalysis')).toBeInTheDocument();
    expect(screen.getByText('8%')).toBeInTheDocument();
    expect(screen.getByText('NOT_APPLICABLE')).toBeInTheDocument();
    expect(screen.queryByText('0/100', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'potentialHelp' })).toBeInTheDocument();
  });
  it('keeps overview compact and sends users to detailed analysis', () => {
    const analyze = vi.fn(); mount(<ApplicationAnalysisSummary application={app} companyId="company" compact onAnalyze={analyze} />);
    expect(screen.queryByText('confidence')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'whyMatch' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'fullAnalysis' })); expect(analyze).toHaveBeenCalledOnce();
  });
  it('requires confirmation for rejection but not shortlisting', async () => {
    mount(<ApplicationStageControl application={app} companyId="company" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'REJECTED' } });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument(); expect(mocks.move).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'confirmStage' }));
    await waitFor(() => expect(mocks.move).toHaveBeenCalledWith('a', { newStatus: 'REJECTED', source: 'HR' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SHORTLISTED' } });
    await waitFor(() => expect(mocks.move).toHaveBeenCalledWith('a', { newStatus: 'SHORTLISTED', source: 'HR' }));
  });
  it('requires an explicit reason before a low-alignment interview', () => {
    mount(<ApplicationStageControl application={app} companyId="company" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INTERVIEW' } });
    expect(screen.getByRole('button', { name: 'confirmStage' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Additional verified experience' } });
    expect(screen.getByRole('button', { name: 'confirmStage' })).toBeEnabled(); expect(mocks.move).not.toHaveBeenCalled();
  });
  it('offers no transition from a terminal state or obsolete assessment stage', () => {
    expect(nextApplicationStages('REJECTED')).toEqual([]); expect(nextApplicationStages('APPLIED')).not.toContain('ASSESSMENT');
    mount(<ApplicationStageControl application={{ ...app, status: 'REJECTED' }} companyId="company" />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
  it('displays the submitted file even after the primary CV was deleted', async () => {
    mount(<SubmittedCvPanel allowed application={{ ...app, submittedCv: { filename: 'submitted-v1.pdf', version: 1, fileSize: 1200, mimeType: 'application/pdf', submittedAt: '2026-09-30', resumeId: 'old' } }} />);
    expect(await screen.findByTitle('submitted PDF')).toHaveAttribute('src', 'http://api.test/signed/submitted');
    expect(screen.getByText('submitted-v1.pdf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'openCv' })).toHaveAttribute('href', 'http://api.test/signed/submitted');
  });
  it('shows intelligence widgets only with the backend entitlement', () => {
    const data = { from: '2026-10-01', to: '2026-10-06', jobs: { PUBLISHED: 1 }, stages: {}, totalApplications: 0, daily: [], recent: [], upcoming: [], applicationsByJob: [], advancedAnalysisAvailable: true, attention: { newApplications: 3, review: 2, overdue: 1, interviewsToday: 0, offers: 0 } } as unknown as WorkspaceOverview;
    const view = mount(<RecruiterHome companyId="company" data={data} controls={null} loading={null} />);
    expect(screen.getByText('applicationQuality')).toBeInTheDocument(); expect(screen.getByText('topReview')).toBeInTheDocument(); expect(screen.getByText('attentionToday')).toBeInTheDocument();
    view.unmount(); mount(<RecruiterHome companyId="company" data={{ ...data, advancedAnalysisAvailable: false }} controls={null} loading={null} />);
    expect(screen.queryByText('applicationQuality')).not.toBeInTheDocument(); expect(screen.queryByText('topReview')).not.toBeInTheDocument();
  });
});
