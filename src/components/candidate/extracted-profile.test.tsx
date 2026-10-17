import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { ExtractedProfile, ExperienceDraftEditor, serializeExperiences } from './extracted-profile';
import type { CvExperience } from '@/lib/api/career';
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
afterEach(cleanup);
const experiences: CvExperience[] = [
  { title: 'Développeur Full-Stack', company: 'Entreprise A', period: 'Juillet 2026 - Présent', description: ['● Livraison de services', 'pour les clients.', '● Revue du code.'] },
  { title: 'Stage PFE', company: 'Entreprise A', period: 'Février 2026 - Mai 2026', description: ['● Création d’un module.'] },
];
describe('Readable CV review', () => {
  it('shows separate roles with dates, company and rejoined mission bullets', () => {
    render(<ExtractedProfile profile={{ sections: { experience: ['original'], skills: ['Python · Django'] }, experiences, skills: ['Python', 'Django'] }} />);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Juillet 2026 - Présent')).toBeInTheDocument();
    expect(within(cards[0]).getAllByRole('listitem')).toHaveLength(2);
    expect(within(cards[0]).getByText('Livraison de services pour les clients.')).toBeInTheDocument();
    expect(within(cards[1]).queryByText('Revue du code.')).not.toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });
  it('edits and removes one experience without modifying the other', () => {
    let saved: CvExperience[] = [];
    function Editor() { const [entries, setEntries] = useState(experiences); saved = entries; return <ExperienceDraftEditor entries={entries} onChange={setEntries} />; }
    render(<Editor />);
    fireEvent.change(screen.getAllByLabelText('Poste occupé')[1], { target: { value: 'Stage Backend' } });
    expect(saved[0].title).toBe('Développeur Full-Stack');
    expect(serializeExperiences(saved)).toContain('Poste: Stage Backend\nEntreprise: Entreprise A');
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer cette expérience' })[0]);
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe('Stage Backend');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une expérience' }));
    expect(saved[1]).toEqual({ title: '', company: '', period: '', description: [] });
  });
  it('offers an honest empty state without example employment', () => {
    render(<ExtractedProfile profile={{ sections: {} }} />);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByText(/Aucune expérience détectée/)).toBeInTheDocument();
  });
});
