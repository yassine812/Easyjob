import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Resume } from '@/types/api';
import { CvLibrary } from './cv-library';

const state = vi.hoisted(() => ({ rows: [] as Resume[], upload: vi.fn(), primary: vi.fn(), remove: vi.fn(), duplicate: vi.fn(), restore: vi.fn(), versions: vi.fn(), rename: vi.fn(), download: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ feature: () => false }) }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('@/lib/i18n/career', () => ({ useCareerText: () => (key: string) => ({ primary: 'CV principal', retry: 'Réessayer' }[key] ?? key) }));
vi.mock('./career-shared', () => ({ CareerFrame: ({ title, description, actions, children }: { title: string; description: string; actions: ReactNode; children: ReactNode }) => <main><h1>{title}</h1><p>{description}</p>{actions}{children}</main>, Busy: () => <p>Chargement</p>, Failure: () => <p role="alert">Erreur</p>, PremiumAiAction: () => <button type="button">Améliorer avec EasyJob</button> }));
vi.mock('@/lib/api/resumes', () => ({ resumesApi: { list: async () => state.rows, uploadPolicy: async () => ({ maxBytes: 10 * 1024 * 1024 }), upload: (...args: unknown[]) => state.upload(...args), setPrimary: (id: string) => state.primary(id), remove: (id: string) => state.remove(id), duplicate: (id: string) => state.duplicate(id), restore: (id: string, versionId: string) => state.restore(id, versionId), versions: (id: string) => state.versions(id), rename: (id: string, name: string) => state.rename(id, name), downloadUrl: (id: string) => state.download(id) } }));
const cv = (id: string, primary = false): Resume => ({ id, filename: `CV_${id}.pdf`, version: 1, mimeType: 'application/pdf', fileSize: 1200, isPrimary: primary, processingStatus: 'COMPLETED', createdAt: '2026-09-17T10:00:00Z', analysisSummary: { score: 79, pageCount: 2 } });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}><CvLibrary /></QueryClientProvider>) };
}
beforeEach(() => { state.rows = [cv('fr', true), cv('en')]; vi.clearAllMocks(); state.primary.mockImplementation(async id => { state.rows = state.rows.map(r => ({ ...r, isPrimary: r.id === id })); return { success: true }; }); state.duplicate.mockResolvedValue(cv('copy')); state.restore.mockResolvedValue(cv('restored')); state.rename.mockResolvedValue(cv('renamed')); state.download.mockResolvedValue({ url: '/download', filename: 'CV.pdf' }); state.versions.mockResolvedValue([{ id: 'v2-id', logicalCvId: 'resume:fr', version: 2, current: true, createdAt: '2026-09-25T10:42:00Z', filename: 'CV_fr.pdf', score: 95 }, { id: 'v1-id', logicalCvId: 'resume:fr', version: 1, current: false, createdAt: '2026-09-24T18:11:00Z', filename: 'CV_fr.pdf', score: 91 }]); });
afterEach(cleanup);

describe('CV library workflow', () => {
  it('gives every CV its own details link without a selected-document panel or fake metadata', async () => {
    state.rows[1] = { ...cv('en'), analysisSummary: undefined };
    mount();
    expect(await screen.findByRole('link', { name: 'Voir le CV : CV_fr.pdf' })).toHaveAttribute('href', '/candidate/cvs/fr');
    expect(screen.getByRole('link', { name: 'Voir le CV : CV_en.pdf' })).toHaveAttribute('href', '/candidate/cvs/en');
    expect(screen.queryByText('CV sélectionné')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getAllByText('79')).toHaveLength(1);
    expect(screen.getByText('Analyse disponible dans les détails')).toBeInTheDocument();
  });
  it('opens the native PDF input immediately and uploads the selected file without confirmation', async () => {
    let finish!: (r: Resume) => void;
    state.upload.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { client } = mount();
    await screen.findByText('CV_fr.pdf');
    const input = screen.getByLabelText('Choisir un CV PDF') as HTMLInputElement;
    expect(input.accept).toBe('application/pdf,.pdf');
    const click = vi.spyOn(input, 'click');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un CV' }));
    expect(click).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Importer un CV' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Importer/ })).not.toBeInTheDocument();
    const file = new File(['%PDF-1.7 test'], 'new.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(state.upload).toHaveBeenCalledWith(file));
    expect(screen.getByText('Téléversement du CV…')).toBeInTheDocument();
    const added = { ...cv('new'), filename: 'new.pdf', processingStatus: 'PENDING' as const, analysisSummary: undefined };
    state.rows = [...state.rows, added]; finish(added);
    expect(await screen.findByText('Extraction et analyse de ton CV…')).toBeInTheDocument();
    state.rows = state.rows.map(r => r.id === 'new' ? { ...r, processingStatus: 'COMPLETED' } : r);
    await client.invalidateQueries({ queryKey: ['resumes'] });
    expect(await screen.findByText('CV ajouté')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le CV : new.pdf' })).toHaveAttribute('href', '/candidate/cvs/new');
    expect(input.value).toBe('');
  });
  it('rejects invalid and oversized files before creating a CV and tolerates picker cancellation', async () => {
    mount(); await screen.findByText(/Import PDF avec texte sélectionnable · 10 Mo maximum/);
    const input = screen.getByLabelText('Choisir un CV PDF');
    fireEvent.change(input, { target: { files: [] } });
    expect(state.upload).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.txt', { type: 'text/plain' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choisis un PDF valide');
    const oversized = new File(['pdf'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversized, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByRole('alert')).toHaveTextContent('10 Mo');
    expect(state.upload).not.toHaveBeenCalled();
  });
  it('updates the principal through the API and preserves it after remounting', async () => {
    const first = mount(); await screen.findByText('CV_en.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Actions pour CV_en.pdf' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Définir comme CV principal' }));
    await waitFor(() => expect(state.primary).toHaveBeenCalledWith('en'));
    await waitFor(() => expect(within(screen.getByText('CV_en.pdf').closest('li')!).getByText('CV principal')).toBeInTheDocument());
    first.unmount(); mount();
    const card = (await screen.findByText('CV_en.pdf')).closest('li')!;
    expect(within(card).getByText('CV principal')).toBeInTheDocument();
    expect(screen.getAllByText('CV principal')).toHaveLength(1);
  });
  it('keeps a failed API upload visible and permits an explicit retry', async () => {
    state.upload.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(cv('new'));
    mount(); await screen.findByText('CV_fr.pdf');
    fireEvent.change(screen.getByLabelText('Choisir un CV PDF'), { target: { files: [new File(['%PDF'], 'new.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible d’ajouter');
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(state.upload).toHaveBeenCalledTimes(2));
  });
  it('keeps versions inside one CV card and restores an old version as a new current version', async () => {
    state.rows = [{ ...cv('fr', true), version: 2, versionCount: 2, workingDraftId: 'draft-fr' }];
    mount();
    expect(await screen.findByText('Version actuelle : v2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Modification en cours · Reprendre' })).toHaveAttribute('href', '/candidate/cvs/drafts/draft-fr');
    expect(screen.queryByText('En cours de création')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actions pour CV_fr.pdf' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Historique des versions' }));
    expect(await screen.findByText('Version initiale')).toBeInTheDocument();
    expect(screen.getByText('Actuelle')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurer' }));
    await waitFor(() => expect(state.restore).toHaveBeenCalledWith('fr', 'v1-id'));
  });
  it('creates a separate logical CV only through duplicate', async () => {
    mount(); await screen.findByText('CV_fr.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Actions pour CV_fr.pdf' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Dupliquer le CV' }));
    await waitFor(() => expect(state.duplicate).toHaveBeenCalledWith('fr'));
  });
});
