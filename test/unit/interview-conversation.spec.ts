import { analyzeTurn, decideFollowUp, interviewRubric } from '../../src/career/interview-conversation';
import { analyzeInterviewJob } from '../../src/career/interview-intelligence';
import { SimulatedCandidate } from '../../src/career/simulated-candidate';
describe('interview conversation evidence and decisions', () => {
  it('weights the actual vacancy and separates HR from technical evidence', () => {
    const analysis = analyzeInterviewJob({ title: 'Mobile developer', skills: [{name:'React Native', required:true}, {name:'Docker', required:false}], description: 'Collaborer avec les équipes et développer une application mobile.' }, 'React Native');
    const technical = interviewRubric(analysis, 'TECHNICAL');
    expect(technical.competencies.find(c => c.label === 'React Native')?.importance).toBe(1);
    expect(technical.competencies.find(c => c.label === 'Docker')?.importance).toBe(0.6);
    expect(interviewRubric(analysis, 'HR').competencies.every(c => c.expectedEvidence.includes('personal contribution'))).toBe(true);
    expect(technical.candidateEvidence).toContain('React Native');
  });
  it('does not manufacture model scores when the provider is unavailable', () => {
    const turn = analyzeTurn({method:'guided_practice'}, 'Nous utilisons React Native.', 'Quel était ton rôle ?', 'fr', 'TECHNICAL');
    expect(turn.analysis.overall_relevance).toBeNull();
    expect(turn.followUpQuestion).toContain('Nous utilisons React Native.');
    expect(turn.analysis.follow_up_needed).toBe(true);
  });
  it('uses a valid model analysis and contextual probe, rejecting malformed scores', () => {
    const answerAnalysis = { overall_relevance:82, specificity:60, evidence_quality:45, communication_clarity:80, role_alignment:70, strengths:['Choix expliqué'], missing_points:['Validation à préciser'], detected_claims:['Migration du rendu'], follow_up_needed:true, follow_up_reason:'Missing validation' };
    const result = analyzeTurn({method:'ai_coaching', answerAnalysis, followUpQuestion:'Quel outil as-tu utilisé pour distinguer le rendu du réseau ?'}, 'J’ai corrigé les performances du rendu.', 'Comment ?', 'fr', 'TECHNICAL');
    expect(result.analysis.overall_relevance).toBe(82); expect(result.followUpQuestion).toContain('réseau');
    expect(analyzeTurn({method:'ai_coaching', answerAnalysis:{...answerAnalysis, specificity:NaN}}, 'Un exemple.', 'Comment ?', 'fr', 'TECHNICAL').analysis.specificity).toBeNull();
  });
  it('accepts normalized deterministic local analysis without an LLM score', () => {
    const answerAnalysis = { overall_relevance:.72, specificity:.61, evidence_quality:.75, communication_clarity:.82, role_alignment:.7, strengths:['Résultat mesuré'], missing_points:['Contexte à préciser'], detected_claims:[], follow_up_needed:true, follow_up_reason:'ASK_FOR_EXAMPLE' };
    const result = analyzeTurn({ method:'local_deterministic', answerAnalysis, followUpQuestion:'Peux-tu donner un exemple précis ?' }, 'J’ai corrigé une API et réduit le délai de 40%.', 'Comment ?', 'fr', 'TECHNICAL');
    expect(result.analysis.overall_relevance).toBe(72);
    expect(result.analysis.method).toBe('local_deterministic');
    expect(result.followUpQuestion).toContain('exemple précis');
  });
  it('allows a probe immediately but prevents repeated probes and endless sessions', () => {
    const a = analyzeTurn({}, 'Bref.', 'Comment ?', 'fr', 'HR').analysis;
    expect(decideFollowUp(a, [], 5)).toBe(true);
    expect(decideFollowUp(a, [{decision:{action:'FOLLOW_UP'}}], 6)).toBe(false);
    expect(decideFollowUp(a, [1, 2, 3].map(() => ({decision:{action:'FOLLOW_UP'}})).concat({decision:{action:'NEXT_TOPIC'}}), 9)).toBe(false);
  });
  it('generates deterministic personas from the real interview context without claiming candidate facts', () => {
    const candidate = new SimulatedCandidate();
    const base = { question: 'Comment abordez-vous le débogage ?', jobTitle: 'Développeur React Native', locale: 'fr', rubric: { competencies: [{ label: 'React Native' }] }, previousAnswers: [], seed: 42 };
    const strong = candidate.generateAnswer({ ...base, persona: 'strong' });
    const weak = candidate.generateAnswer({ ...base, persona: 'weak' });
    expect(strong).toContain('Scénario simulé');
    expect(strong).toContain('React Native');
    expect(strong).toContain('2,8 secondes');
    expect(weak).toContain('Scénario simulé');
    expect(weak.length).toBeLessThan(strong.length);
    const weakAnalysis = analyzeTurn({ method: 'guided_practice' }, weak, base.question, 'fr', 'TECHNICAL').analysis;
    expect(weakAnalysis.follow_up_needed).toBe(true);
    expect(decideFollowUp(weakAnalysis, [], 1)).toBe(true);
    expect(candidate.generateAnswer({ ...base, persona: 'inconsistent' })).toBe(candidate.generateAnswer({ ...base, persona: 'inconsistent' }));
  });
});
