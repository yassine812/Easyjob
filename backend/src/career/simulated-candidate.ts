import type { InterviewJobAnalysis } from './interview-intelligence';

export type TestCandidatePersona = 'strong' | 'average' | 'weak' | 'inconsistent';

export interface SimulatedCandidateInput {
  question: string;
  jobTitle: string;
  locale: string;
  analysis?: InterviewJobAnalysis;
  rubric?: { competencies?: Array<{ label?: string; expectedEvidence?: string[] }> };
  previousAnswers: Array<{ answer?: string }>;
  persona: TestCandidatePersona;
  seed: number;
}

function seeded(seed: number, index: number) {
  let state = (seed ^ (index + 1) * 0x9e3779b9) >>> 0;
  state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
  return (state >>> 0) / 0xffffffff;
}

function language(input: SimulatedCandidateInput, fr: string, en: string, ar: string) {
  return input.locale === 'fr' ? fr : input.locale === 'ar' ? ar : en;
}

/**
 * Deterministic test-only answers. They are explicitly persisted as simulated
 * data and never assert facts about the candidate who owns the source CV.
 */
export class SimulatedCandidate {
  generateAnswer(input: SimulatedCandidateInput) {
    const index = input.previousAnswers.length;
    const skill = input.rubric?.competencies?.[index % Math.max(1, input.rubric.competencies.length)]?.label
      || input.analysis?.technicalSkills?.[index % Math.max(1, input.analysis.technicalSkills.length)]
      || input.jobTitle;
    const effective = input.persona === 'inconsistent'
      ? (seeded(input.seed, index) > 0.48 ? 'strong' : seeded(input.seed + 11, index) > 0.38 ? 'average' : 'weak')
      : input.persona;
    if (effective === 'strong') return language(input,
      `Scénario simulé : sur une fonctionnalité liée à ${skill}, j’ai pris en charge le diagnostic puis la correction. J’ai comparé deux options, retenu celle qui limitait les régressions, ajouté des tests et partagé le compromis avec l’équipe. Dans ce scénario de test, le délai initial est passé d’environ 2,8 secondes à 1,6 seconde après validation sur Android et iOS.`,
      `Simulated scenario: on a ${skill} feature, I owned the diagnosis and the fix. I compared two options, chose the one that limited regressions, added tests, and explained the trade-off to the team. In this test scenario, initial load time went from about 2.8 seconds to 1.6 seconds after Android and iOS validation.`,
      `سيناريو محاكى: في ميزة مرتبطة بـ ${skill}، توليت التشخيص والإصلاح. قارنت بين خيارين واخترت ما يحد من التراجعات وأضفت اختبارات وشرحت المقايضة للفريق. في هذا السيناريو انتقل زمن العرض من 2.8 إلى 1.6 ثانية بعد التحقق على Android وiOS.`);
    if (effective === 'average') return language(input,
      `Scénario simulé : j’ai travaillé avec ${skill} sur cette fonctionnalité. J’ai corrigé le problème avec l’équipe et vérifié que le comportement était meilleur.`,
      `Simulated scenario: I used ${skill} on this feature. I fixed the issue with the team and checked that the behaviour was better.`,
      `سيناريو محاكى: عملت بـ ${skill} على هذه الميزة. أصلحت المشكلة مع الفريق وتحققت أن السلوك أصبح أفضل.`);
    return language(input,
      `Scénario simulé : je connais ${skill}. Je l’ai déjà utilisé et je pense que c’est une bonne solution pour ce poste.`,
      `Simulated scenario: I know ${skill}. I have used it before and think it is a good solution for this role.`,
      `سيناريو محاكى: أعرف ${skill}. استخدمته من قبل وأعتقد أنه حل جيد لهذا المنصب.`);
  }
}
