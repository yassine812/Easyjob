import { atsReport } from '../../src/career/career-engine';
import { CareerService } from '../../src/career/career.service';

const frenchCv = `Yassine Exemple
yassine@example.test
+216 20 123 456
COMPÉTENCES TECHNIQUES
Backend : Python · Django · API REST
Frontend : React Native · JavaScript
EXPÉRIENCES PROFESSIONNELLES
Développeur Full-Stack Juillet 2026 - Présent
AB Serve Tunisia - Département Développement, Tunisie
• Conception et livraison de fonctionnalités full-stack avec Python/Django et React Native pour des applications métier internes, couvrant la logique backend, les API, les interfaces mobiles et les flux de données.
• Contribution aux décisions d'architecture logicielle, aux revues de code entre pairs et à l'amélioration continue des pratiques de développement et de la qualité du code.
Développeur Full-Stack - Stage PFE Février 2026 - Mai 2026
AB Serve Tunisia - Département Développement, Tunisie
• Mise en œuvre de 4 fonctionnalités clés d'audit : gestion des workflows, administration des données de référence, reporting et soumission d'audits terrain.
• Structuration de la démarche de revue selon 3 axes.
• Livraison sur 2 plateformes avec une interface web et une application mobile.
FORMATION
Licence en informatique, Institut supérieur des études technologiques
2023 - 2026
CERTIFICATIONS & LANGUES
Français, Anglais`;

const criterion = (text: string, key: string) => atsReport(text).criteria.find(item => item.key === key)!;

describe('Specific and auditable CV diagnostics', () => {
  it('reports the actual French CV contacts, skills, experience entries and education evidence', () => {
    const report = atsReport(frenchCv);
    expect(report.wordCount).toBeGreaterThan(150);
    expect(criterion(frenchCv, 'email')).toMatchObject({ passed: true, evidence: ['yassine@example.test'], metrics: { count: 1 } });
    expect(criterion(frenchCv, 'phone')).toMatchObject({ passed: true, evidence: ['+216 20 123 456'], metrics: { count: 1 } });
    expect(criterion(frenchCv, 'skills').metrics.count).toBe(5);
    expect(criterion(frenchCv, 'experience')).toMatchObject({ passed: true, metrics: { count: 2 } });
    expect(criterion(frenchCv, 'education')).toMatchObject({ passed: true, metrics: { count: 2 } });
    expect(criterion(frenchCv, 'education').evidence).not.toContain('Français, Anglais');
  });

  it('does not invent a presentation when the CV starts with a name and skills', () => {
    expect(criterion(frenchCv, 'summary')).toMatchObject({ passed: false, evidence: [], metrics: { count: 0 }, priority: 'medium' });
    const withSummary = frenchCv.replace('COMPÉTENCES TECHNIQUES', 'Profil : Développeur spécialisé dans les outils internes.\nCOMPÉTENCES TECHNIQUES');
    expect(criterion(withSummary, 'summary')).toMatchObject({ passed: true, evidence: ['Développeur spécialisé dans les outils internes.'], metrics: { count: 6 } });
  });

  it('recognizes scope counts without presenting them as a demonstrated performance improvement', () => {
    expect(criterion(frenchCv, 'quantified_evidence')).toMatchObject({
      passed: true, metrics: { count: 3, scopeCount: 3, outcomeCount: 0, kind: 'scope' },
    });
    expect(criterion(frenchCv, 'quantified_evidence').evidence.join('\n')).toContain('4 fonctionnalités');
    expect(criterion(frenchCv, 'quantified_evidence').evidence.join('\n')).toContain('3 axes');
  });

  it('distinguishes a stated measured outcome from project scope in French and English', () => {
    const text = 'Expérience\nRéduction du temps de chargement de 30 %.\nDelivered 2 platforms.\nReduced monthly operating costs by 15 percent.';
    expect(criterion(text, 'quantified_evidence')).toMatchObject({ passed: true, metrics: { count: 3, scopeCount: 1, outcomeCount: 2, kind: 'outcome' } });
  });

  it('keeps a numeric scope as scope even when the same sentence also mentions an improvement', () => {
    const text = "Expérience\nAmélioration du parcours sur 2 plateformes et réduction des délais de 20 %.";
    expect(criterion(text, 'quantified_evidence').metrics).toEqual({ count: 2, scopeCount: 1, outcomeCount: 1, kind: 'outcome' });
  });

  it('does not turn phone numbers, date ranges or software versions into quantified results', () => {
    const text = '+216 20 123 456\nJuillet 2026 - Présent\n2023 - 2026\nPython 3.12, 2 ans d’expérience';
    expect(criterion(text, 'quantified_evidence')).toMatchObject({ passed: false, evidence: [], metrics: { count: 0, kind: 'none' } });
    expect(criterion('2023 - 2026', 'phone')).toMatchObject({ passed: false, evidence: [] });
    expect(criterion('0612345678', 'phone')).toMatchObject({ passed: true, evidence: ['0612345678'] });
  });

  it('counts professional project scope while excluding training durations and summary claims', () => {
    const text = 'Profil\nRéduction des délais de 25 %.\nFormation\nFormation Django — 40 heures\nProjets\nLivraison sur 2 plateformes.\nCertifications\nAtelier sécurité — 8 heures';
    expect(criterion(text, 'quantified_evidence')).toMatchObject({ passed: true, evidence: ['Livraison sur 2 plateformes.'], metrics: { count: 1, scopeCount: 1, outcomeCount: 0, kind: 'scope' } });
    for (const source of ['Formation\nFormation Django — 40 heures', 'Livraison sur 2 plateformes.', 'Profil\nRéduction du délai de 25 %.']) {
      expect(criterion(source, 'quantified_evidence')).toMatchObject({ passed: false, evidence: [], metrics: { count: 0, kind: 'none' } });
    }
  });

  it('recognizes an outcome across PDF line wraps without borrowing verbs from another bullet', () => {
    const source = 'Expérience\r\n• Réduction du temps de chargement\r\n  de 30\r\n  % après optimisation.\r\n• Amélioration du parcours utilisateur.\r\n• Support disponible pendant 4 heures.';
    const quantitative = criterion(source, 'quantified_evidence');
    expect(quantitative.metrics).toEqual({ count: 2, scopeCount: 1, outcomeCount: 1, kind: 'outcome' });
    for (const excerpt of quantitative.evidence) expect(source).toContain(excerpt);
  });

  it('uses its three excerpt slots for three complete wrapped claims rather than continuation lines', () => {
    const source = 'Expérience\r\n• Livraison de 4 fonctionnalités\r\n  couvrant les workflows et les données\r\n  de référence.\r\n• Contrôle selon 3 axes\r\n  avec revue des permissions et\r\n  contrôles d’intégrité.\r\n• Déploiement sur 2 plateformes\r\n  avec une interface web et\r\n  une application mobile.';
    const quantitative = criterion(source, 'quantified_evidence');
    expect(quantitative.metrics).toMatchObject({ count: 3, scopeCount: 3, kind: 'scope' });
    expect(quantitative.evidence).toHaveLength(3);
    ['4 fonctionnalités', '3 axes', '2 plateformes'].forEach((claim, index) => {
      const excerpt = quantitative.evidence[index];
      expect(excerpt).toContain(claim);
      expect(excerpt).toContain('\r\n  ');
      expect(excerpt.length).toBeLessThanOrEqual(240);
      expect(source).toContain(excerpt);
    });
  });

  it('returns no score, no success or fabricated evidence for empty or unreadable input', () => {
    for (const source of ['', '  \n', '... ### +++ �']) {
      const report = atsReport(source);
      expect(report.score).toBeNull();
      expect(report.wordCount).toBe(0);
      expect(report.strengths).toEqual([]);
      for (const item of report.criteria) {
        expect(item.passed).toBe(false);
        expect(item.evidence).toEqual([]);
        expect(item.metrics.count).toBe(0);
      }
    }
  });

  it('keeps every excerpt an exact, short fragment of the original CV', () => {
    const source = `${frenchCv}\n${'Contribution au produit et à la qualité des livraisons. '.repeat(25)}`;
    for (const item of atsReport(source).criteria) {
      expect(item.evidence.length).toBeLessThanOrEqual(3);
      for (const excerpt of item.evidence) {
        expect(excerpt.length).toBeLessThanOrEqual(240);
        expect(source).toContain(excerpt);
      }
    }
  });

  it('reports matched and missing target terms using boundaries rather than guessing qualifications', () => {
    const report = atsReport('Compétences\nReact Native · Python · C++', ['Python', 'Django', 'React', 'C++', 'C++', ' ']);
    expect(report.target).toEqual({ selected: true, keywords: ['Python', 'Django', 'React', 'C++'], matched: ['Python', 'React', 'C++'], missing: ['Django'] });
    expect(report.missingKeywords).toEqual(['Django']);
    expect(report.missingSkills).toEqual(['Django']);
    expect(atsReport('Reactive', ['React']).target.missing).toEqual(['React']);
  });

  it('distinguishes no selected job from a selected job with no structured keywords', () => {
    expect(atsReport(frenchCv).target).toEqual({ selected: false, keywords: [], matched: [], missing: [] });
    const report = atsReport(frenchCv, [], { selected: true, title: 'Développeur Full-Stack', company: 'Exemple' });
    expect(report.target).toEqual({ selected: true, title: 'Développeur Full-Stack', company: 'Exemple', keywords: [], matched: [], missing: [] });
    expect(report.limitations).not.toContain('select_job_for_keywords');
  });

  it('passes actual selected-job context through the owned-resume API even with no skills', async () => {
    const prisma = { candidateProfile: { findUnique: jest.fn().mockResolvedValue({ resumes: [{ id: 'owned', filename: 'cv.pdf', processingStatus: 'COMPLETED', parsedText: frenchCv }] }) } };
    const service = new CareerService(prisma as never, {} as never, {} as never, {} as never);
    jest.spyOn(service, 'job').mockResolvedValue({ title: 'Développeur', company: { commercialName: 'Exemple' }, skills: [] } as never);
    expect((await service.report('candidate', 'owned', 'selected')).report?.target).toEqual({ selected: true, title: 'Développeur', company: 'Exemple', keywords: [], matched: [], missing: [] });
  });
});
