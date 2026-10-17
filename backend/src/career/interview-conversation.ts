import { InterviewJobAnalysis } from './interview-intelligence';

export type InterviewState = 'READY' | 'INTERVIEWER_SPEAKING' | 'LISTENING' | 'ANSWERING' | 'ANALYZING' | 'INTERVIEWER_FEEDBACK' | 'COMPLETED';
export interface Conversation { state: InterviewState; questionIndex: number; transcript: string; code: string }
export interface AnswerAnalysis {
  overall_relevance: number | null; specificity: number | null; evidence_quality: number | null;
  communication_clarity: number | null; role_alignment: number | null;
  strengths: string[]; missing_points: string[]; detected_claims: string[];
  follow_up_needed: boolean; follow_up_reason?: string; method: string; analysis_engine?: 'local_hybrid' | 'local_deterministic_fallback';
}
export function interviewRubric(analysis: InterviewJobAnalysis, type: string) {
  const behavioral = ['HR', 'BEHAVIORAL', 'MANAGERIAL', 'SITUATIONAL'].includes(type);
  const requirements = analysis.requirements.filter(r => !behavioral || ['RESPONSIBILITY', 'SOFT_SKILL', 'BEHAVIORAL_SIGNAL', 'EXPERIENCE'].includes(r.category));
  return { version: 1, role: analysis.role, company: analysis.company, seniority: analysis.seniority, interviewType: type,
    candidateEvidence: analysis.candidateEvidence, competencies: (requirements.length ? requirements : [{ skill: analysis.role, importance: 'REQUIRED', evidence: analysis.responsibilities.join('; ') }]).slice(0, 12).map((r, i) => ({
      key: `competency_${i}`, label: r.skill, importance: r.importance === 'REQUIRED' ? 1 : r.importance === 'PREFERRED' ? 0.6 : 0.3,
      sourceEvidence: r.evidence, expectedEvidence: behavioral ? ['specific situation', 'personal contribution', 'observable outcome', 'connection to vacancy'] : type === 'CODING' ? ['working implementation', 'reasoning', 'edge cases', 'test cases'] : ['technical decision', 'reasoning', 'trade-offs', 'validation'],
      positiveSignals: ['specific example', 'explained decision', 'supported outcome'], weakSignals: ['unsupported claim', 'unclear contribution', 'unanswered question'],
      probeQuestions: [`What evidence supports your decision concerning ${r.skill}?`],
    })) };
}
const metricKeys = ['overall_relevance', 'specificity', 'evidence_quality', 'communication_clarity', 'role_alignment'] as const;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
export function analyzeTurn(feedback: Record<string, unknown>, answer: string, question: string, locale: string, type: string) {
  const pick = (fr: string, en: string, ar: string) => locale === 'fr' ? fr : locale === 'ar' ? ar : en;
  const proposed = feedback.answerAnalysis as AnswerAnalysis | undefined;
  const local = feedback.method === 'local_deterministic';
  const valid = (feedback.method === 'ai_coaching' || local) && proposed && metricKeys.every(k => typeof proposed[k] === 'number' && Number.isFinite(proposed[k]) && proposed[k]! >= 0 && proposed[k]! <= (local ? 1 : 100))
    && [proposed.strengths, proposed.missing_points, proposed.detected_claims].every(strings) && typeof proposed.follow_up_needed === 'boolean';
  const short = answer.trim().split(/\s+/).length < 35;
  const analysis: AnswerAnalysis = valid ? {
    overall_relevance: local ? proposed!.overall_relevance! * 100 : proposed!.overall_relevance, specificity: local ? proposed!.specificity! * 100 : proposed!.specificity,
    evidence_quality: local ? proposed!.evidence_quality! * 100 : proposed!.evidence_quality, communication_clarity: local ? proposed!.communication_clarity! * 100 : proposed!.communication_clarity,
    role_alignment: local ? proposed!.role_alignment! * 100 : proposed!.role_alignment, strengths: proposed!.strengths.slice(0, 6),
    missing_points: proposed!.missing_points.slice(0, 6), detected_claims: proposed!.detected_claims.slice(0, 10),
    follow_up_needed: proposed!.follow_up_needed,
    follow_up_reason: typeof proposed!.follow_up_reason === 'string' ? proposed!.follow_up_reason.slice(0, 1000) : undefined,
    method: local ? 'local_deterministic' : 'ai_coaching',
    analysis_engine: proposed!.analysis_engine === 'local_hybrid' || proposed!.analysis_engine === 'local_deterministic_fallback' ? proposed!.analysis_engine : undefined,
  } : {
    overall_relevance: null, specificity: null, evidence_quality: null, communication_clarity: null, role_alignment: null,
    strengths: [], missing_points: short ? [pick('Un exemple plus détaillé aiderait à préciser ta réponse.', 'A more detailed example would help clarify your answer.', 'سيساعد مثال أكثر تفصيلاً في توضيح إجابتك.')] : [],
    detected_claims: [], follow_up_needed: short, follow_up_reason: short ? 'brief_answer' : undefined, method: 'guided_practice',
  };
  const quote = answer.replace(/\s+/g, ' ').trim().slice(0, 180);
  const followUpQuestion = valid && typeof feedback.followUpQuestion === 'string' && feedback.followUpQuestion.trim().length > 12
    ? feedback.followUpQuestion.trim().slice(0, 1500)
    : type === 'CODING'
      ? pick(`À propos de ta solution : « ${quote} ». Peux-tu compléter l’implémentation et montrer un cas de test ?`, `About your solution: “${quote}”. Can you complete the implementation and show a test case?`, `بخصوص حلك «${quote}»، هل يمكنك إكمال التنفيذ وعرض حالة اختبار؟`)
      : pick(`Tu as répondu « ${quote} ». Peux-tu préciser ton action personnelle et comment tu as vérifié le résultat ?`, `You answered “${quote}”. Can you clarify your own contribution and how you verified the outcome?`, `أجبت «${quote}». هل يمكنك توضيح مساهمتك وكيف تحققت من النتيجة؟`);
  return { analysis, followUpQuestion, question };
}

export function decideFollowUp(analysis: AnswerAnalysis, answers: unknown[], questionCount: number, maxQuestions = 20) {
  const last = answers[answers.length - 1] as { decision?: { action?: string } } | undefined;
  const count = answers.filter(a => (a as { decision?: { action?: string } })?.decision?.action === 'FOLLOW_UP').length;
  // One probe per topic and at most three extra turns: no endless follow-up loop.
  return analysis.follow_up_needed && last?.decision?.action !== 'FOLLOW_UP' && count < 3 && questionCount < maxQuestions;
}
