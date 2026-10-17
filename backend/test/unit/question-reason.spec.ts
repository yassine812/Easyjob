import { presentInterviewBrief, questionReason } from '../../src/interviews/question-reason';

describe('structured interview question reasons', () => {
  it.each([['missing', 'MISSING_EVIDENCE'], ['weak', 'WEAK_EVIDENCE'], ['partial', 'WEAK_EVIDENCE'], ['strong', 'STRONG_EVIDENCE']])('presents persisted %s evidence without interpreting diagnostic text', (status, type) => {
    const brief = presentInterviewBrief({ questions: [{ evidence: { status }, skill: 'custom_redis', sourceType: 'JOB_CV_EVIDENCE', rationale: 'weak CV evidence · unknown requirement · 1 job mention(s)' }] });
    expect(brief?.questions?.[0].reason).toEqual({ reason_type: type, skill: 'redis', source_types: ['JOB', 'CV'] });
    expect(brief?.questions?.[0].reason.excerpts).toBeUndefined();
  });
  it('preserves real excerpts and structured metadata', () => {
    const reason = { reason_type: 'WEAK_EVIDENCE', skill: 'Django', requirement_importance: 'REQUIRED', source_types: ['CV', 'JOB'], excerpts: [{ source: 'CV', text: 'Developed Django services.' }] };
    expect(questionReason({ evidence: { reason } })).toEqual(reason);
  });
  it('does not ascribe recruiter questions to EasyJob', () => {
    expect(questionReason({ sourceType: 'RECRUITER', category: 'GAP' })).toBeNull();
  });
  it('does not invent missing evidence for questions selected by interview type', () => {
    expect(questionReason({ sourceType: 'INTERVIEW_TYPE' })).toEqual({ reason_type: 'GENERAL', source_types: ['INTERVIEW'] });
    expect(presentInterviewBrief(null)).toBeNull();
  });
});
