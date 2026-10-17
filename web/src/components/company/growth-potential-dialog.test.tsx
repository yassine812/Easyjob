import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Application } from '@/types/api';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GrowthPotentialDialog } from './growth-potential-dialog';

vi.mock('@/lib/i18n/recruitment', () => ({ useRecruitmentText: () => (key: string) => ({ potential: 'Potentiel d’évolution', HIGH: 'Élevé', MEDIUM: 'Moyen', growthWhy: 'Pourquoi ce candidat peut progresser', masteredSkills: 'Ce que le candidat maîtrise déjà', transferableSkills: 'Compétences transférables', growthGaps: 'Points d’évolution', allSources: 'Sources et preuves', candidate: 'Candidat', match: 'Compatibilité', classification: 'Classification', analysisStatus: 'État de l’analyse', REVIEW: 'À examiner', READY: 'Prête', humanReview: 'Revue humaine', growthEvidenceTraceability: 'Preuves traçables', strong: 'Fort', moderate: 'Modéré', supporting: 'Complémentaire', WORK_EXPERIENCE: 'Expérience professionnelle', PROJECT: 'Projet', SKILLS: 'Compétences', CV: 'CV', noDevelopmentPoints: 'Aucun point', noTransferableEvidence: 'Aucune relation', developmentPoint: 'Point d’évolution', criticalGap: 'Écart critique', notDeterminedHelp: 'Pas assez de preuves', incompleteAnalysisHelp: 'Analyse incomplète' }[key] ?? key) }));
vi.mock('@/hooks/use-entitlement', () => ({ useEntitlement: () => ({ isPaid: true, displayName: 'Company Max' }) }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));

const application = {
  id: 'application', jobId: 'job', candidateId: 'candidate', resumeId: null, motivation: null, coverLetter: null, status: 'APPLIED', aiMatchScore: 65,
  analysisStatus: 'READY', potentialScore: 'MEDIUM', classification: 'REVIEW', appliedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  candidate: { id: 'candidate', userId: 'user', headline: 'Backend Developer', location: 'Tunis', user: { id: 'user', name: 'Amel Ben Salem', email: 'amel@example.test' } },
  job: { id: 'job', title: 'Backend Developer — Python / Django', slug: 'backend', companyId: 'company', location: 'Tunis', remote: false, employmentType: 'FULL_TIME', company: { id: 'company', commercialName: 'EasyJob', slug: 'easyjob' } },
  matchExplanation: { growthAnalysis: { score: 54, category: 'MEDIUM', summary: 'Moderate documented evidence.', why: ['Python appears in two professional experiences.'], strengths: ['Python'], evidence: [{ id: 'growth-evidence-1', concept: 'relevant_skill_evidence', source: 'WORK_EXPERIENCE', sourceLabel: 'Backend Developer · ABC', section: 'professional_experience', evidence: 'Built Python Django REST APIs', strength: 'strong', relevance: 1, confidence: .95, relatedSkill: 'Python' }], transferableEvidence: [], gaps: [{ skill: 'Docker', currentEvidence: 'No direct evidence.', gap: 'Production evidence is still needed.', effort: 'moderate' }], coverLetter: { provided: false, relevance: 'not_provided', score: null, evidence: [], checks: { jobSpecificReferences: false, concreteExperience: false, relevantAchievements: false, technologiesWithExamples: false } }, components: { transferable: 70 }, componentBreakdown: [{ type: 'transferable_skill', label: 'Transferable skills', contribution: 54, evidenceIds: ['growth-evidence-1'] }], progression: { steps: [], summary: null }, method: 'deterministic_growth_evidence_v1' } },
} as unknown as Application;

afterEach(cleanup);

describe('growth potential analysis dialog', () => {
  it('opens from the list score and exposes traceable evidence', async () => {
    render(<TooltipProvider><GrowthPotentialDialog application={application} /></TooltipProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Voir l’analyse|viewgrowthanalysis/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Amel Ben Salem')).toBeInTheDocument();
    expect(screen.getAllByText(/Built Python Django REST APIs/).length).toBeGreaterThan(0);
    expect(screen.getByText('Sources et preuves')).toBeInTheDocument();
  });
});
