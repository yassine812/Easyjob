import { CareerService } from '../../src/career/career.service';
import { NotFoundException } from '@nestjs/common';

describe('interview turn persistence', () => {
  let row: any, service: CareerService, prisma: any;
  beforeEach(() => {
    row = { id:'session', candidateId:'candidate', jobId:null, jobTitle:'Mobile developer', company:'Example', locale:'fr', interviewType:'TECHNICAL', questions:['Explique ton choix.', 'Comment testes-tu ?'], answers:[], visionConsent:false, preparation:{ cvTextSnapshot:'React Native', skills:['React Native'], conversation:{state:'READY',questionIndex:0,transcript:'',code:''} }, createdAt:new Date(), updatedAt:new Date(0) };
    prisma = { coachSession: {
      findFirst: jest.fn(async ({where}: any) => where.candidateId === row.candidateId ? structuredClone(row) : null),
      findUnique: jest.fn(async () => structuredClone(row)),
      updateMany: jest.fn(async ({where,data}: any) => { if (+where.updatedAt !== +row.updatedAt) return {count:0}; row = {...row,...data,updatedAt:new Date(+row.updatedAt+1)}; return {count:1}; }),
    } };
    service = new CareerService(prisma, {assertCan:jest.fn(), can:jest.fn().mockResolvedValue(true)} as any, {careerCoach:jest.fn().mockRejectedValue(new Error('offline'))} as any, {} as any);
    jest.spyOn(service, 'profile').mockResolvedValue({id:'candidate'} as any);
  });
  it('saves the in-progress draft, inserts a follow-up next, persists evidence and returns idempotently', async () => {
    await service.saveCoachTurn('user','session',{questionIndex:0,state:'ANSWERING',transcript:'J’ai choisi React Native.',code:''});
    const result = await service.answerCoach('user','session',{questionIndex:0,answer:'J’ai choisi React Native.'});
    expect(row.preparation.rubric.competencies.length).toBeGreaterThan(0);
    expect(row.answers[0].analysis.method).toBe('guided_practice');
    expect(row.answers[0].decision.action).toBe('FOLLOW_UP');
    expect(row.questions[1]).toContain('J’ai choisi React Native.');
    expect(row.questions[2]).toBe('Comment testes-tu ?');
    expect(result?.conversation?.state).toBe('INTERVIEWER_FEEDBACK');
    await service.answerCoach('user','session',{questionIndex:0,answer:'J’ai choisi React Native.'});
    expect(row.answers).toHaveLength(1);
    expect(result?.preparation).not.toHaveProperty('cvTextSnapshot');
  });
  it('rejects stale drafts and cannot update another candidate’s session', async () => {
    await expect(service.saveCoachTurn('user','session',{questionIndex:1,state:'ANSWERING',transcript:'Stale',code:''})).rejects.toThrow();
    jest.spyOn(service,'profile').mockResolvedValue({id:'other'} as any);
    await expect(service.saveCoachTurn('other','session',{questionIndex:0,state:'ANSWERING',transcript:'No access',code:''})).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.coachSession.updateMany).not.toHaveBeenCalled();
  });
  it('does not overwrite a submitted answer while analyzing', async () => {
    row.preparation.conversation = {state:'ANALYZING',questionIndex:0,transcript:'Saved',code:'',pendingAnswer:{questionIndex:0,answer:'Saved'}};
    await expect(service.saveCoachTurn('user','session',{questionIndex:0,state:'ANSWERING',transcript:'Changed',code:''})).rejects.toThrow();
    await expect(service.answerCoach('user','session',{questionIndex:0,answer:'Changed'})).rejects.toThrow();
  });
  it('stores the submitted transcript and code even when the last checkpoint is older', async () => {
    row.preparation.conversation.transcript = 'Old checkpoint';
    await service.answerCoach('user','session',{questionIndex:0,answer:'function sum() {}\nNew explanation',transcript:'New explanation',code:'function sum() {}'});
    expect(row.answers[0].transcript).toBe('New explanation');
    expect(row.answers[0].code).toBe('function sum() {}');
  });
  it('does not insert adaptive follow-ups without the adaptive entitlement', async () => {
    (service as any).entitlements.can.mockResolvedValue(false);
    await service.answerCoach('user', 'session', { questionIndex: 0, answer: 'J’ai choisi React Native.' });
    expect(row.answers[0].decision.action).toBe('NEXT_TOPIC');
    expect(row.questions).toEqual(['Explique ton choix.', 'Comment testes-tu ?']);
  });
});
