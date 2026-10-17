import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blankDocument, newSection, type StudioDraft, type StudioProposal } from '@/lib/api/cv-studio';
import { StudioSuggestion } from './studio-ai';
import { I18nProvider } from '@/lib/i18n';

const mocks = vi.hoisted(() => ({ suggest: vi.fn() }));
vi.mock('@/lib/api/cv-studio', async original => ({ ...await original<object>(), studioApi: { suggest: mocks.suggest } }));
const document = blankDocument(), skills = newSection('skills'); skills.entries[0].text = 'Données & Outils : SQL · Git'; document.sections = [skills];
const draft: StudioDraft = { id: 'draft', title: 'Mon CV', version: 2, template: 'modern', document, updatedAt: '', approvedAt: null, beforeScore: 79, nextQuestion: null, report: { score: 79, criteria: [], strengths: [], suggestions: [], missingKeywords: [], missingSkills: [], formattingProblems: [], limitations: [] }, issues: [] };
const after = 'Bases de données : SQL\nOutils & méthodes : Git';
const proposal: StudioProposal = { document: structuredClone(document), before: skills.entries[0].text, after, changed: true, reason: 'Voici une version plus claire et mieux structurée à partir de tes informations actuelles.', question: null, beforeScore: 79, report: draft.report };
proposal.document.sections[0].entries[0].text = after;
function setup() {
  const onApply = vi.fn(), onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<I18nProvider><QueryClientProvider client={client}><StudioSuggestion draft={draft} target={{ sectionId: skills.id }} onApply={onApply} onClose={onClose} /></QueryClientProvider></I18nProvider>);
  return { onApply, onClose };
}
beforeEach(() => { vi.clearAllMocks(); mocks.suggest.mockResolvedValue(proposal); });
describe('Suggestion-first CV editing', () => {
  it('generates on opening, hides optional facts and changes the CV only on Apply', async () => {
    const user = userEvent.setup(), { onApply } = setup();
    expect(await screen.findByLabelText('Ajuster la suggestion')).toHaveValue(after);
    expect(mocks.suggest).toHaveBeenCalledTimes(1);
    expect(mocks.suggest).toHaveBeenCalledWith('draft', { sectionId: skills.id, expectedVersion: 2 });
    expect(screen.getByText('Pour aller plus loin · facultatif').closest('details')).not.toHaveAttribute('open');
    expect(onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Appliquer la proposition' }));
    expect(onApply.mock.calls[0][0].document.sections[0].entries[0].text).toBe(after);
    expect(document.sections[0].entries[0].text).toBe('Données & Outils : SQL · Git');
  });
  it('recovers from a failed initial request with an explicit retry', async () => {
    mocks.suggest.mockRejectedValueOnce(new Error('Indisponible'));
    const user = userEvent.setup(); setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Indisponible');
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(screen.getByLabelText('Ajuster la suggestion')).toHaveValue(after));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('keeps the original fixed and sends the current suggestion separately when regenerating', async () => {
    const user = userEvent.setup(); setup();
    expect(await screen.findByLabelText('Ajuster la suggestion')).toHaveValue(after);
    await user.click(screen.getByRole('button', { name: 'Nouvelle proposition' }));
    await waitFor(() => expect(mocks.suggest).toHaveBeenCalledTimes(2));
    expect(mocks.suggest).toHaveBeenLastCalledWith('draft', expect.objectContaining({ currentSuggestion: after, alternativeIndex: 1, facts: '', instruction: '' }));
    expect(screen.getByText('Version originale').parentElement).toHaveTextContent('Données & Outils : SQL · Git');
  });
  it('uses a refinement instruction without putting the instruction in the CV', async () => {
    const user = userEvent.setup(); setup();
    expect(await screen.findByLabelText('Ajuster la suggestion')).toHaveValue(after);
    await user.click(screen.getByRole('button', { name: 'Regrouper par catégories' }));
    await waitFor(() => expect(mocks.suggest).toHaveBeenLastCalledWith('draft', expect.objectContaining({ instruction: 'Regrouper par catégories' })));
    expect(screen.getByLabelText('Ajuster la suggestion')).not.toHaveValue('Regrouper par catégories');
  });
});
