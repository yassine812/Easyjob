import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DesignerEditor } from './cv-designer';
import { CvLibrary } from './cv-workspace';
import { cvSections, joinCvSections, distinctCvDrafts } from '@/lib/cv-designer';
import type { Draft } from '@/lib/api/career';

beforeAll(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); Element.prototype.scrollTo = vi.fn(); });
const mocks = vi.hoisted(() => ({ save: vi.fn(), publish: vi.fn(), regenerate: vi.fn(), report: vi.fn(async (id: string) => ({ status: 'COMPLETED', report: { score: id === 'a' ? 60 : 80 } })) }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ feature: () => true, loading: false }) }));
vi.mock('@/lib/api/career', () => ({ careerApi: { saveDraft: mocks.save, publish: mocks.publish, report: mocks.report, regenerateSection: mocks.regenerate } }));
vi.mock('./cv-pdf-viewer', () => ({ CvPdfViewer: ({ resume, report }: { resume: { id: string }; report?: { score: number } }) => <article aria-label={`Aperçu ${resume.id}`}>ATS {report?.score ?? '—'}</article> }));
vi.mock('@/lib/api/resumes', () => ({ resumesApi: { list: async () => [{ id: 'a', filename: 'CV A.pdf', createdAt: '2026-09-24', processingStatus: 'COMPLETED', isPrimary: true }, { id: 'b', filename: 'CV B.pdf', createdAt: '2026-09-24', processingStatus: 'COMPLETED' }] } }));
const draft: Draft = { id: 'draft', title: 'Version source', content: '# Source Name\n\n## Compétences\nPython\n', originalContent: '', targetJobId: null, beforeScore: 60, afterScore: 60, approvedAt: null, keywords: [], report: { score: 60, strengths: [], suggestions: [], missingSkills: [], missingKeywords: [], formattingProblems: [], limitations: [], criteria: [{ key: 'skills', passed: true, weight: 10, evidence: ['Python'], metrics: { count: 1 } }] } };
function mount(children: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>); }
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('CV library and designer', () => {
  it('applies the revised PDF bullet while preserving the following line', async () => {
    const before = "● Mise en œuvre de 4 fonctionnalités clés d'audit : gestion des workflows, administration des données de référence,";
    const after = before.replace('Mise en œuvre de 4', 'Mettre en œuvre 4');
    const content = '# Source Name\n\n## Expérience\n' + before + '\nreporting et soumission d’audits terrain.';
    const revised = content.replace(before, after);
    mocks.regenerate.mockResolvedValue({ content: revised, before, after, scope: 'line', beforeScore: 79, score: 79, report: { ...draft.report, score: 79 }, improvedChecks: [] });
    mount(<DesignerEditor draft={{ ...draft, content, originalContent: content, beforeScore: 79, afterScore: 79 }} onSaved={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Améliorer cette ligne' })[0]);
    const modal = await screen.findByRole('dialog', { name: 'Comparer la ligne améliorée' });
    expect(modal).toHaveTextContent('1 passage modifié');
    expect(modal).toHaveTextContent(after);
    expect(mocks.regenerate).toHaveBeenCalledWith('draft', expect.objectContaining({ sectionIndex: 1, lineIndex: 0 }));
    fireEvent.click(within(modal).getByRole('button', { name: 'Appliquer les améliorations' }));
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Expérience/ }));
    expect(screen.getByLabelText('Ton contenu')).toHaveValue(after + '\nreporting et soumission d’audits terrain.');
    expect(screen.getByRole('region', { name: 'Comparaison des scores ATS' })).toHaveTextContent('79');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('shows only the current score for an untouched CV and keeps style changes out of comparisons', () => {
    const { unmount } = mount(<DesignerEditor draft={{ ...draft, originalContent: draft.content }} onSaved={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Score ATS actuel' })).toHaveTextContent('60');
    expect(screen.queryByText('Avant')).not.toBeInTheDocument();
    expect(screen.queryByText('Après')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modèles' }));
    fireEvent.click(screen.getByRole('button', { name: /Studio/ }));
    expect(screen.queryByRole('region', { name: 'Comparaison des scores ATS' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Éditeur de CV' }).parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('groups identical drafts while retaining different edits, layouts and sources', () => {
    const original = { ...draft, sourceResumeId: 'a' };
    const changed = { ...original, id: 'changed', content: 'Edited content' };
    const layout = { ...original, id: 'layout', template: 'technology' };
    const source = { ...original, id: 'source', sourceResumeId: 'b' };
    expect(distinctCvDrafts([original, { ...original, id: 'copy' }, changed, layout, source]).map(d => d.id)).toEqual(['draft', 'changed', 'layout', 'source']);
  });
  it('focuses the document section and opens at readable width with fullscreen controls', () => {
    const { unmount } = mount(<DesignerEditor draft={draft} onSaved={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Largeur' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Rubriques du CV' })).getByRole('button', { name: /Compétences/ }));
    expect(document.activeElement).toHaveAttribute('data-cv-section', '1');
    expect(Element.prototype.scrollTo).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Plein écran' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Plein écran' }));
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('shows the human coach and explanation on hover without requiring a click', async () => {
    mount(<DesignerEditor draft={draft} onSaved={vi.fn()} onBack={vi.fn()} />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Pourquoi ce passage est surligné' }));
    expect(await screen.findByRole('dialog', { name: 'Explication du surlignage' })).toHaveTextContent(/compétences/i);
    expect(screen.getByRole('img', { name: 'Ton coach EasyJob' })).toBeInTheDocument();
    fireEvent.pointerLeave(screen.getByRole('button', { name: 'Pourquoi ce passage est surligné' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('reviews old and new section content before accepting and updates the real score on acceptance', async () => {
    const revised = draft.content.replace('Python', 'Python — développement d’outils');
    mocks.regenerate.mockResolvedValue({ content: revised, before: '## Compétences\nPython', after: '## Compétences\nPython — développement d’outils', beforeScore: 60, score: 72, report: { ...draft.report, score: 72 }, improvedChecks: ['skills'] });
    mount(<DesignerEditor draft={draft} onSaved={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Compétences/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Améliorer cette rubrique' }));
    const modal = await screen.findByRole('dialog', { name: 'Comparer la rubrique améliorée' });
    expect(modal).toHaveTextContent('Python — développement d’outils');
    expect(modal).toHaveTextContent('Ce qui a changé');
    expect(screen.getByLabelText('Ton contenu')).toHaveValue('Python');
    fireEvent.click(within(modal).getByRole('button', { name: 'Garder l’ancienne version' }));
    expect(screen.getByLabelText('Ton contenu')).toHaveValue('Python');
    fireEvent.click(screen.getByRole('button', { name: 'Améliorer cette rubrique' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Appliquer les améliorations' }));
    expect(screen.getByLabelText('Ton contenu')).toHaveValue('Python — développement d’outils');
    expect(screen.getByRole('region', { name: 'Comparaison des scores ATS' })).toHaveTextContent('72');
    expect(screen.queryByText('Diagnostic de cette version')).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('keeps the document in details and changes the details link with the selection', async () => {
    mount(<CvLibrary />);
    expect(await screen.findByRole('link', { name: /Voir le CV : CV A\.pdf/ })).toHaveAttribute('href', '/candidate/cvs/a');
    expect(screen.queryByRole('article', { name: 'Aperçu a' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir le CV : CV B\.pdf/ })).toHaveAttribute('href', '/candidate/cvs/b');
    expect(screen.queryByRole('article', { name: 'Aperçu a' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Aperçu b' })).not.toBeInTheDocument();
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it('preserves actual source facts when dividing plain extracted text into sections', () => {
    const source = 'Name\nContact\nCOMPÉTENCES\nPython\nFORMATION\nDiplôme 2025';
    const result = joinCvSections(cvSections(source));
    expect(result.replace(/^## /gm, '').split(/\s+/)).toEqual(source.split(/\s+/));
  });
  it('keeps trailing newlines while typing and saves both edits and template', async () => {
    mocks.save.mockImplementation(async (_id, data) => ({ ...draft, ...data }));
    mount(<DesignerEditor draft={draft} onSaved={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Ton contenu'), { target: { value: '# Source Name\nNew line\n' } });
    expect(screen.getByLabelText('Ton contenu')).toHaveValue('# Source Name\nNew line\n');
    expect(screen.getByText('Enregistre pour actualiser l’analyse et les surlignages.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modèles' }));
    fireEvent.click(screen.getByRole('button', { name: /Studio/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Enregistrer$/ }));
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('draft', expect.objectContaining({ template: 'technology', content: expect.stringContaining('New line') })));
  });
  it('explains an actual highlighted passage through its info button', () => {
    mount(<DesignerEditor draft={draft} onSaved={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pourquoi ce passage est surligné' }));
    expect(screen.getByRole('dialog', { name: 'Explication du surlignage' })).toBeInTheDocument();
  });
  it('opens approval only from Save and saves approval before adding the CV', async () => {
    mocks.save.mockImplementation(async (_id, data) => ({ ...draft, ...data, approvedAt: '2026-09-24' }));
    mocks.publish.mockResolvedValue({ id: 'published' });
    mount(<DesignerEditor draft={draft} onSaved={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Enregistrer$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Enregistrer ton CV' });
    const publish = within(dialog).getByRole('button', { name: 'Enregistrer et ajouter à mes CV' });
    expect(publish).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(publish);
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith('draft'));
    expect(mocks.save).toHaveBeenCalledWith('draft', expect.objectContaining({ approve: true }));
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.publish.mock.invocationCallOrder[0]);
    expect(await screen.findByRole('link', { name: 'Voir cette version' })).toHaveAttribute('href', '/candidate/cvs/published');
  });
  it('targets one document line and waits for acceptance', async () => {
    mocks.regenerate.mockResolvedValue({ content: draft.content, before: 'Python', after: 'Python', scope: 'line', beforeScore: 60, score: 60, report: draft.report, improvedChecks: [] });
    mount(<DesignerEditor draft={draft} onSaved={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Améliorer cette ligne' }));
    expect(await screen.findByRole('dialog', { name: 'Comparer la ligne améliorée' })).toBeInTheDocument();
    expect(mocks.regenerate).toHaveBeenCalledWith('draft', expect.objectContaining({ sectionIndex: 1, lineIndex: 0 }));
    expect(screen.getByRole('button', { name: 'Appliquer les améliorations' })).toBeDisabled();
  });
});
