import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionReason } from './question-reason';
import { presentQuestionReason, type QuestionReason as Reason } from '@/lib/interview-reason';
import { EasyJobFeatureLabel, EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }) }));
afterEach(cleanup);
const base: Reason = { reason_type: 'WEAK_EVIDENCE', skill: 'Backend Development', requirement_importance: 'UNKNOWN', source_types: ['JOB', 'CV'] };
describe('evidence-based interview explanations', () => {
  it.each([
    ['MISSING_EVIDENCE', 'Compétence à vérifier', 'ne permet pas'],
    ['WEAK_EVIDENCE', 'Preuve limitée', 'peu d’éléments concrets'],
    ['STRONG_EVIDENCE', 'Force à confirmer', 'éléments concrets'],
    ['TRANSFERABLE', 'Compétence transférable', 'Flask'],
    ['SENIORITY', 'Niveau à confirmer · Senior', 'autonomie'],
  ] as const)('presents %s as a human explanation', (reason_type, tag, text) => {
    const result = presentQuestionReason({ ...base, reason_type, transferable_from: 'Flask', seniority: 'SENIOR', excerpts: [{ source: 'CV', text: 'Built Flask services.' }] }, 'fr');
    expect(result.tag).toBe(tag); expect(result.text).toContain(text);
    expect(result.text).not.toMatch(/unknown requirement|CV evidence|job mention|Backend Development|custom_/);
    expect(result.importance).toBeNull();
  });
  it('does not invent transfer or seniority claims without structured evidence', () => {
    expect(presentQuestionReason({ ...base, reason_type: 'TRANSFERABLE', transferable_from: 'Flask' }, 'fr').tag).toBe('À explorer');
    expect(presentQuestionReason({ ...base, reason_type: 'SENIORITY' }, 'fr').tag).toBe('À explorer');
  });
  it('uses localized templates in all three languages', () => {
    expect(presentQuestionReason(base, 'fr').why).toBe('Pourquoi EasyJob la suggère');
    expect(presentQuestionReason(base, 'en').text).toContain('limited concrete evidence');
    expect(presentQuestionReason(base, 'ar').text).toContain('أدلة عملية محدودة');
  });
  it('only reveals the real excerpt on request and preserves keyboard disclosure', () => {
    const { container } = render(<QuestionReason reason={{ ...base, excerpts: [{ source: 'CV', text: 'Développement de services Django chez Acme.' }] }} />);
    const summary = container.querySelector('summary')!;
    expect(summary.textContent).toContain('Pourquoi EasyJob la suggère');
    expect(summary.querySelector('[data-easyjob-mark]')).toBeTruthy();
    expect(screen.queryByText('Développement de services Django chez Acme.')).not.toBeInTheDocument();
    fireEvent.click(summary);
    fireEvent.click(screen.getByRole('button', { name: 'Voir la preuve' }));
    expect(screen.getByText('Développement de services Django chez Acme.')).toBeVisible();
    expect(screen.getByText('Sources : Offre · CV')).toBeVisible();
  });
  it('offers no fabricated evidence link for legacy or empty evidence', () => {
    render(<QuestionReason reason={base} />);
    expect(screen.queryByText('Voir la preuve')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/UNKNOWN|WEAK_EVIDENCE|JOB_CV_EVIDENCE/);
  });
  it('reuses the official logo at the three supported sizes', () => {
    const { container } = render(<><EasyJobFeatureMark size="sm" /><EasyJobFeatureMark size="md" /><EasyJobFeatureLabel size="lg">Assistant EasyJob</EasyJobFeatureLabel></>);
    expect([...container.querySelectorAll('svg')].map(svg => svg.getAttribute('width'))).toEqual(['16', '20', '28']);
    expect([...container.querySelectorAll('image')].every(image => image.getAttribute('href') === '/easyjob-logo.png')).toBe(true);
  });
});
