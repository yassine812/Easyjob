import { splitCvExperiences } from '../../src/career/cv-experience';
import { extractProfile } from '../../src/career/career-engine';

describe('CV experience separation', () => {
  it('separates current role, graduation internship and summer internship at the same company', () => {
    const parsed = extractProfile(`EXPÉRIENCES PROFESSIONNELLES
Développeur Full-Stack Juillet 2026 - Présent
AB Serve Tunisia - Département Développement, Tunisie
● Conception avec Python/Django et React Native
pour des applications internes.
Développeur Full-Stack - Stage PFE Février 2026 - Mai 2026
AB Serve Tunisia - Département Développement, Tunisie
● Gestion des workflows.
Développeur Backend - Stage Juin 2025 - Août 2025
AB Serve Tunisia
● Développement API.
COMPÉTENCES
Backend : Python · Django · PHP
CERTIFICATIONS & LANGUES
Français : courant`);
    expect(parsed.experiences).toHaveLength(3);
    expect(parsed.experiences[0]).toMatchObject({ title: 'Développeur Full-Stack', period: 'Juillet 2026 - Présent', company: 'AB Serve Tunisia - Département Développement, Tunisie' });
    expect(parsed.experiences[1].description).toEqual(['● Gestion des workflows.']);
    expect(parsed.skills).toEqual(['Python', 'Django', 'PHP']);
    expect(parsed.sections.certifications).toEqual(['Français : courant']);
  });
  it('keeps unknown source without inventing dates or employer', () => {
    expect(splitCvExperiences(['Worked on a community project', 'Built a website'])).toEqual([{ title: '', company: '', period: '', description: ['Worked on a community project', 'Built a website'] }]);
  });
  it('recognizes dates on a separate line and preserves subsequent missions', () => {
    const result = splitCvExperiences(['Software Engineer', 'Example Studio', '2021 — 2024', '• Built APIs']);
    expect(result).toEqual([{ title: 'Software Engineer', company: 'Example Studio', period: '2021 — 2024', description: ['• Built APIs'] }]);
  });
  it('round trips reviewed entries with empty fields and dates inside missions', () => {
    const result = splitCvExperiences(['Poste: Engineer', 'Entreprise: ', 'Période: ', 'Migrated systems in 2020 - 2024', 'Poste: Intern', 'Entreprise: Studio', 'Période: Summer', '• Testing']);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ title: 'Engineer', company: '', period: '', description: ['Migrated systems in 2020 - 2024'] });
  });
});
