import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtsPanel } from './ats-report';
import type { AtsReport } from '@/lib/api/career';
const state = vi.hoisted(() => ({ locale: 'fr' }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: state.locale }) }));
afterEach(cleanup);
beforeEach(() => { state.locale = 'fr'; });
const report: AtsReport = {
  score: 90, wordCount: 620, strengths: ['skills', 'experience', 'quantified_evidence'], suggestions: ['summary'], missingKeywords: [], missingSkills: [], formattingProblems: [], limitations: [],
  target: { selected: false, keywords: [], matched: [], missing: [] },
  criteria: [
    { key: 'summary', weight: 10, passed: false, priority: 'medium', metrics: { count: 0 }, evidence: [] },
    { key: 'experience', weight: 15, passed: true, priority: 'high', metrics: { count: 5 }, evidence: ['Développeur Full-Stack Juillet 2026 - Présent'] },
    { key: 'skills', weight: 15, passed: true, priority: 'medium', metrics: { count: 25 }, evidence: ['Python · Django · React Native'] },
    { key: 'quantified_evidence', weight: 5, passed: true, priority: 'medium', metrics: { count: 2, scopeCount: 2, outcomeCount: 0, kind: 'scope' }, evidence: ['Mise en œuvre de 4 fonctionnalités clés', 'Amélioration sur 3 axes'] },
  ],
};
describe('Actionable CV diagnostic', () => {
  it('shows counts, real evidence and a draft built only from the supplied profile', () => {
    render(<AtsPanel report={report} profile={{ sections: {}, experiences: [{ title: 'Développeur Full-Stack', company: 'Example', period: '2026', description: [] }], skills: ['Python', 'Django', 'React Native'] }} />);
    expect(screen.getByText(/5 expériences ont été repérées/)).toBeInTheDocument();
    expect(screen.getByText(/25 compétences distinctes/)).toBeInTheDocument();
    expect(screen.getByText(/Développeur Full-Stack\. Compétences : Python, Django, React Native/)).toBeInTheDocument();
    expect(screen.getByText(/Aucune présentation professionnelle n’a été identifiée sous un titre reconnu/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
  });
  it('recognizes scope and gives a concrete improvement without inventing an impact figure', () => {
    render(<AtsPanel report={report} />);
    const priorities = screen.getByRole('region', { name: 'Tes prochaines améliorations' });
    expect(within(priorities).getAllByRole('article')).toHaveLength(2);
    expect(within(priorities).getByText(/Ton CV donne déjà 2 indications de périmètre/)).toBeInTheDocument();
    expect(within(priorities).getByText('Mise en œuvre de 4 fonctionnalités clés')).toBeInTheDocument();
    expect(within(priorities).getByText(/indicateur vérifié et période/)).toBeInTheDocument();
    expect(screen.queryByText(/30\s?%/)).not.toBeInTheDocument();
    expect(screen.getByText(/Modifier ton profil ne change pas ce fichier/)).toBeInTheDocument();
  });
  it('replaces empty cards with one actionable job-selection state', () => {
    const select = vi.fn(); render(<AtsPanel report={report} onSelectJob={select} />);
    expect(screen.getByText(/Aucune comparaison avec une offre n’a encore été effectuée/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choisir une offre' })); expect(select).toHaveBeenCalledOnce();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('Non attesté dans ton profil ou CV')).not.toBeInTheDocument();
    expect(screen.queryByText('Le texte extrait est à vérifier')).not.toBeInTheDocument();
  });
  it('lists a missing target term exactly once and explains what to do', () => {
    render(<AtsPanel report={{ ...report, target: { selected: true, title: 'Backend Engineer', company: 'Example', keywords: ['Python', 'Kubernetes'], matched: ['Python'], missing: ['Kubernetes'] }, missingKeywords: ['Kubernetes'], missingSkills: ['Kubernetes'] }} />);
    expect(screen.getAllByText('Kubernetes')).toHaveLength(1);
    expect(screen.getByText('1 termes repérés sur 2')).toBeInTheDocument();
    expect(screen.getByText(/N’ajoute pas de compétence que tu ne possèdes pas/)).toBeInTheDocument();
  });
  it('distinguishes an empty job specification from an all-present result', () => {
    const { rerender } = render(<AtsPanel report={{ ...report, target: { selected: true, keywords: [], matched: [], missing: [] } }} />);
    expect(screen.getByText(/ne contient pas de compétences structurées/)).toBeInTheDocument();
    rerender(<AtsPanel report={{ ...report, target: { selected: true, keywords: ['Python'], matched: ['Python'], missing: [] } }} />);
    expect(screen.getByText(/Tous les termes ciblés sont repérés/)).toBeInTheDocument();
    expect(screen.queryByText(/ne contient pas de compétences structurées/)).not.toBeInTheDocument();
  });
  it('handles older reports without inventing counts or showing a numeric score for null', () => {
    render(<AtsPanel report={{ ...report, score: null, wordCount: undefined, target: undefined, criteria: [{ key: 'email', weight: 10, passed: false }] }} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Pas assez de données pour une note')).toBeInTheDocument();
    expect(screen.getByText('Cet élément est à vérifier dans le document d’origine.')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });
  it('renders extracted HTML as text and provides native evidence disclosures', () => {
    const { container } = render(<AtsPanel report={{ ...report, criteria: [{ key: 'skills', weight: 15, passed: true, metrics: { count: 1 }, evidence: ['<img src=x onerror=alert(1)>'] }] }} />);
    expect(container.querySelector('img')).toBeNull();
    const evidence = screen.getByText('<img src=x onerror=alert(1)>');
    const details = evidence.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(details.querySelector('summary')!);
    expect(details).toHaveAttribute('open');
    expect(screen.getByRole('link', { name: 'Relire les informations extraites' })).toHaveAttribute('href', '#cv-extracted-review');
  });
  it('supplies Arabic diagnostic and next-step copy', () => {
    state.locale = 'ar'; render(<AtsPanel report={report} />);
    expect(screen.getByRole('heading', { name: 'تشخيص سيرتك الذاتية' })).toBeInTheDocument();
    expect(screen.getAllByText('الإجراء المقترح')).toHaveLength(2);
    expect(screen.queryByText(/fallback_|_action|_scope/)).not.toBeInTheDocument();
  });
});
