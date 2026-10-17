import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyCv } from './career-pages';

const state = vi.hoisted(() => ({ jobs: vi.fn(), report: vi.fn() }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/lib/api/career', () => ({ careerApi: { jobs: state.jobs, report: state.report } }));
vi.mock('@/lib/api/resumes', () => ({ resumesApi: { list: async () => [{ id: 'cv-one', filename: 'Mon CV.pdf', processingStatus: 'COMPLETED' }] } }));
vi.mock('./career-shared', () => ({
  CareerFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CvUpload: () => null, Busy: () => <p>Chargement du rapport</p>,
  Failure: () => <p>Erreur du rapport</p>,
  Field: ({ label, children }: { label: string; children: React.ReactNode }) => <label>{label}{children}</label>,
  AtsPanel: ({ report }: { report: { score: number } }) => <p>Note {report.score}</p>,
  panelClass: '', selectClass: '',
}));
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MyCv analysisOnly /></QueryClientProvider>); }
beforeEach(() => {
  state.jobs.mockReset(); state.report.mockReset();
  state.report.mockResolvedValue({ status: 'COMPLETED', report: { score: 90 }, extracted: null });
});
afterEach(cleanup);
describe('CV target selection states', () => {
  it('explains a failed request and lets the candidate reload offers', async () => {
    state.jobs.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({ items: [{ id: 'job', title: 'Backend', company: { commercialName: 'Studio' } }] });
    mount();
    const retry = await screen.findByRole('button', { name: 'Recharger les offres' });
    expect(screen.getByRole('combobox', { name: /Offre ciblée/ })).toBeDisabled();
    fireEvent.click(retry);
    expect(await screen.findByRole('option', { name: 'Backend · Studio' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Offre ciblée/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Recharger les offres' })).not.toBeInTheDocument();
  });
  it('distinguishes an empty offer list from a request in progress', async () => {
    let resolve!: (value: { items: [] }) => void;
    state.jobs.mockReturnValue(new Promise(r => { resolve = r; }));
    mount();
    expect(await screen.findByRole('option', { name: 'Chargement des offres…' })).toBeInTheDocument();
    resolve({ items: [] });
    expect(await screen.findByRole('option', { name: 'Aucune offre publiée disponible pour la comparaison.' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Offre ciblée/ })).toBeDisabled();
  });
  it('requests a new diagnostic for the selected job and hides the previous score during loading', async () => {
    state.jobs.mockResolvedValue({ items: [{ id: 'job', title: 'Backend', company: { commercialName: 'Studio' } }] });
    mount();
    expect(await screen.findByText('Note 90')).toBeInTheDocument();
    let resolve!: (value: unknown) => void;
    state.report.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    fireEvent.change(screen.getByRole('combobox', { name: /Offre ciblée/ }), { target: { value: 'job' } });
    await waitFor(() => expect(state.report).toHaveBeenLastCalledWith('cv-one', 'job'));
    expect(screen.queryByText('Note 90')).not.toBeInTheDocument();
    resolve({ status: 'COMPLETED', report: { score: 84 }, extracted: null });
    expect(await screen.findByText('Note 84')).toBeInTheDocument();
  });
});
