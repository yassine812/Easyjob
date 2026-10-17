import { RoomServiceClient } from 'livekit-server-sdk';
import { ForbiddenException } from '@nestjs/common';
import { RecruitmentOffersService } from '../../src/companies/recruitment-offers.service';
import { MeetingService } from '../../src/interviews/meeting.service';
import { EasyJobMeetingProvider } from '../../src/interviews/meeting-provider';
import { InterviewInvitationsService } from '../../src/interviews/interview-invitations.service';
import { interviewCalendar } from '../../src/interviews/interview-calendar';
import { InterviewsService } from '../../src/interviews/interviews.service';
import { verify } from 'jsonwebtoken';

describe('Employment offers',()=>{
  function setup(){
    const app={id:'app',status:'INTERVIEW',aiMatchScore:90,potentialScore:'HIGH',candidate:{userId:'candidate'},job:{companyId:'co',title:'Backend',company:{commercialName:'Test',recruitmentSettings:null}}};
    const offer={id:'offer',applicationId:'app',createdById:'hr',status:'DRAFT',title:'Backend',terms:'Welcome',contractType:'CDI',salaryAmount:5800,workMode:'HYBRID',expiresAt:new Date(Date.now()+86400000)};
    const prisma:any={application:{findFirst:jest.fn().mockResolvedValue(app),findUnique:jest.fn().mockResolvedValue(app),findUniqueOrThrow:jest.fn().mockResolvedValue(app),update:jest.fn()},recruitmentOffer:{create:jest.fn().mockResolvedValue(offer),findFirst:jest.fn().mockResolvedValue(offer),findUniqueOrThrow:jest.fn().mockResolvedValue(offer),findMany:jest.fn().mockResolvedValue([]),updateMany:jest.fn().mockResolvedValue({count:1})},applicationEvent:{create:jest.fn()},candidateCommunication:{create:jest.fn()}};
    prisma.$transaction=jest.fn((fn:any)=>fn(prisma));const notifications={create:jest.fn()};const access={assertApplicationPermission:jest.fn()};
    const service=new RecruitmentOffersService(prisma,access as never,notifications as never,{log:jest.fn()} as never,{emitToCompany:jest.fn()} as never);
    return{app,offer,prisma,service,notifications,access};
  }
  it('saves a structured draft without changing stage or notifying the candidate',async()=>{
    const {service,prisma,notifications}=setup();await service.create('hr','co','app',{title:'Backend',contractType:'CDI',salaryAmount:5800,salaryCurrency:'TND',salaryPeriod:'MONTH',workMode:'HYBRID',benefits:[],terms:''});
    expect(prisma.application.update).not.toHaveBeenCalled();expect(notifications.create).not.toHaveBeenCalled();expect(prisma.recruitmentOffer.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({salaryAmount:5800,companyName:'Test'})}));
  });
  it('sending moves to OFFER and creates history, message and queued email',async()=>{
    const {service,prisma,notifications}=setup();prisma.recruitmentOffer.findFirst.mockReset().mockResolvedValueOnce({id:'offer',applicationId:'app',status:'DRAFT',title:'Backend',contractType:'CDI',salaryAmount:5800,workMode:'HYBRID',expiresAt:new Date(Date.now()+86400000)}).mockResolvedValueOnce(null);await service.send('hr','co','offer');
    expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'OFFER'})}));expect(prisma.applicationEvent.create).toHaveBeenCalled();expect(prisma.candidateCommunication.create).toHaveBeenCalled();expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({userId:'candidate',email:expect.objectContaining({subject:expect.stringContaining('embauche')})}));
  });
  it.each(['ACCEPTED','DECLINED'] as const)('%s has the correct stage semantics',async response=>{
    const {service,prisma,app,offer}=setup();app.status='OFFER';offer.status='VIEWED';await service.respond('candidate','offer',response,'Conditions');
    if(response==='ACCEPTED')expect(prisma.application.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'HIRED'})}));else expect(prisma.application.update).not.toHaveBeenCalled();
    expect(prisma.recruitmentOffer.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({responseReason:'Conditions',status:response})}));
  });
  it('an expired offer cannot be accepted',async()=>{const{service,offer}=setup();offer.status='SENT';offer.expiresAt=new Date(0);await expect(service.respond('candidate','offer','ACCEPTED')).rejects.toThrow();});
  it('company scope is checked before a draft is written',async()=>{const{service,access,prisma}=setup();access.assertApplicationPermission.mockRejectedValue(new ForbiddenException());await expect(service.create('stranger','co','app',{} as never)).rejects.toThrow(ForbiddenException);expect(prisma.recruitmentOffer.create).not.toHaveBeenCalled();});
});

describe('Meeting authorization and consent',()=>{
  function setup(){
    const item={id:'i',applicationId:'a',scheduledById:'hr',meetingRoomId:'private-room',locationType:'EASYJOB',assistantEnabled:false,status:'SCHEDULED',startAt:new Date(Date.now()-60000),endAt:new Date(Date.now()+3600000),consents:[] as any[],participants:[] as any[],application:{candidate:{userId:'candidate',user:{name:'Candidate'}},job:{companyId:'co',title:'Backend',company:{commercialName:'Co'}}}};
    const prisma:any={interview:{findUnique:jest.fn().mockResolvedValue(item)},user:{findUniqueOrThrow:jest.fn().mockResolvedValue({id:'candidate',name:'Candidate'})},interviewConsent:{upsert:jest.fn()}};
    const access={assertInterviewPermission:jest.fn(),assertMembership:jest.fn().mockResolvedValue({role:'RECRUITER'})};const entitlements={assertRecruitmentIntelligence:jest.fn(),hasRecruitmentIntelligence:jest.fn().mockResolvedValue(true)};const provider={getJoinAccess:jest.fn().mockReturnValue({jwt:'short-lived'}),configured:()=>true};
    return{item,prisma,access,entitlements,provider,service:new MeetingService(prisma,access as never,entitlements as never,provider as never)};
  }
  it('saves coverage for every brief question, including indices beyond six', async () => {
    const { service, item, prisma } = setup();
    Object.assign(item, { assistantEnabled: true, brief: { questions: Array.from({ length: 8 }, (_, i) => ({ question: `Question ${i}` })) } });
    prisma.interview.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await service.notes('hr', 'i', 'Private note', [6, 7], 'fr');
    expect(prisma.interview.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { assistantNotes: expect.objectContaining({ covered: [6, 7], questions: expect.arrayContaining(['Question 7']) }) } }));
    await expect(service.notes('hr', 'i', '', [8], 'fr')).rejects.toThrow('Unknown question');
  });
  it('repairs old generated questions but preserves recruiter questions', async () => {
    const { service, item } = setup();
    Object.assign(item, { assistantEnabled: true, brief: { questions: [{ question: 'Comment démontrerais-tu ton expérience avec custom redis ?', sourceType: 'JOB_CV_EVIDENCE' }, { question: 'Comment démontrerais-tu ton expérience avec custom redis ?', sourceType: 'RECRUITER' }] } });
    const result = await service.details('hr', 'i', 'fr');
    expect(result.brief?.questions[0].question).not.toContain('custom');
    expect(result.brief?.questions[1].question).toContain('custom redis');
  });
  it('lets the candidate and assigned scheduler join',async()=>{const{service,provider}=setup();await service.join('candidate','i');await service.join('hr','i');expect(provider.getJoinAccess).toHaveBeenCalledTimes(2);});
  it('denies an unassigned recruiter even inside the company',async()=>{const{service}=setup();await expect(service.join('unassigned','i')).rejects.toThrow(ForbiddenException);});
  it('requires explicit consent for the assistant',async()=>{const{service,item,provider}=setup();item.assistantEnabled=true;await expect(service.join('candidate','i')).rejects.toThrow(ForbiddenException);expect(provider.getJoinAccess).not.toHaveBeenCalled();item.consents=[{userId:'candidate',revokedAt:null}];await service.join('candidate','i');});
  it('rechecks entitlements at join time',async()=>{const{service,item,entitlements}=setup();item.assistantEnabled=true;entitlements.assertRecruitmentIntelligence.mockRejectedValue(new ForbiddenException());await expect(service.join('candidate','i')).rejects.toThrow(ForbiddenException);});
  it.each(['COMPLETED','CANCELLED','NO_SHOW'])('blocks a %s room',async status=>{const{service,item}=setup();item.status=status;await expect(service.join('candidate','i')).rejects.toThrow('Room is not open');});
  it('does not expose recruiter notes or suggested questions to candidates',async()=>{const{service,item}=setup();Object.assign(item,{assistantEnabled:true,assistantNotes:{notes:'private'},feedback:[{summary:'private'}]});const result=await service.details('candidate','i');expect(result).not.toHaveProperty('assistantNotes');expect(result).not.toHaveProperty('questions');expect(result).not.toHaveProperty('feedback');});
  it('will not transcribe while any expected participant has not consented',async()=>{const old=process.env.EASYJOB_TRANSCRIPTION_ENABLED;process.env.EASYJOB_TRANSCRIPTION_ENABLED='true';try{const{service,item}=setup();item.assistantEnabled=true;item.consents=[{userId:'candidate',revokedAt:null}];await expect(service.transcribe('candidate','i',{buffer:Buffer.from('audio'),mimetype:'audio/webm'} as never)).rejects.toThrow(ForbiddenException);}finally{if(old===undefined)delete process.env.EASYJOB_TRANSCRIPTION_ENABLED;else process.env.EASYJOB_TRANSCRIPTION_ENABLED=old;}});
});

describe('Calendar and invitations',()=>{
  const item={id:'i',startAt:new Date('2026-10-10T14:00:00Z'),endAt:new Date('2026-10-10T14:45:00Z'),status:'SCHEDULED',calendarSequence:2,timezone:'Africa/Tunis',location:'Tunis'};
  it('keeps a stable UID and sequence for updates and cancellation',()=>{const ics=interviewCalendar(item,'Backend, API','https://easyjob.test/meetings/i');expect(ics).toContain('UID:i@easyjob');expect(ics).toContain('SEQUENCE:2');expect(ics).toContain('DTSTART:20261010T140000Z');expect(ics).toContain('SUMMARY:Backend\\, API');expect(interviewCalendar({...item,status:'CANCELLED'},'Backend','https://easyjob.test')).toContain('METHOD:CANCEL');});
  it.each(['scheduled','updated','cancelled'])('%s queues candidate and interviewer email with ICS',async action=>{
    const prisma={interview:{findUniqueOrThrow:jest.fn().mockResolvedValue({...item,status:action==='cancelled'?'CANCELLED':'SCHEDULED',applicationId:'a',scheduledById:'hr',locationType:'EASYJOB',application:{candidate:{userId:'candidate'},job:{title:'Backend',companyId:'co',company:{commercialName:'Co'}}},participants:[{member:{status:'ACTIVE',userId:'interviewer'}}]})},interviewParticipant:{updateMany:jest.fn()}};const notifications={create:jest.fn()};await new InterviewInvitationsService(prisma as never,notifications as never).send('i',action);expect(notifications.create).toHaveBeenCalledTimes(3);expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({userId:'candidate',email:expect.objectContaining({attachments:[expect.objectContaining({filename:'interview.ics',content:expect.stringContaining('UID:i@easyjob')})]})}));
  });
  it('tokens are room-scoped, role-specific and short lived',async()=>{
    const saved = {...process.env};
    Object.assign(process.env,{EASYJOB_MEETING_ENABLED:'true',LIVEKIT_URL:'ws://localhost:7880',LIVEKIT_API_KEY:'test-key',LIVEKIT_API_SECRET:'test-secret-test-secret-test-secret'});
    const create = jest.spyOn(RoomServiceClient.prototype,'createRoom').mockResolvedValue({} as never);
    try {
      const result=await new EasyJobMeetingProvider().getJoinAccess('room',{id:'u',name:'Name'},false);
      const claims=verify(result.token,process.env.LIVEKIT_API_SECRET!) as any;
      expect(claims.video.room).toBe('room'); expect(claims.video.roomJoin).toBe(true); expect(claims.video.roomAdmin).not.toBe(true);
      expect(claims.exp-claims.nbf).toBeLessThanOrEqual(60); expect(JSON.parse(claims.metadata).role).toBe('candidate');
    } finally { create.mockRestore(); process.env=saved; }
  });
});

describe('Interview scheduling lifecycle',()=>{
  function setup(){
    const application={id:'a',status:'SHORTLISTED',candidateId:'c',jobId:'j',job:{id:'j',companyId:'co',title:'Backend'},candidate:{userId:'candidate',user:{email:'candidate@example.test'}}};
    const interview={id:'i',applicationId:'a',application,status:'SCHEDULED',startAt:new Date(Date.now()+86400000),endAt:new Date(Date.now()+89100000),timezone:'Africa/Tunis',locationType:'EXTERNAL',location:'https://meet.example.test',assistantEnabled:false,meetingRoomId:null,updatedAt:new Date(),type:'HR',notes:null,aiReport:null};
    const prisma:any={application:{findUnique:jest.fn().mockResolvedValue(application),update:jest.fn()},companyMember:{count:jest.fn().mockResolvedValue(0)},interview:{create:jest.fn().mockResolvedValue(interview),findUnique:jest.fn().mockResolvedValue(interview),update:jest.fn().mockResolvedValue(interview)}};
    const access={assertPermission:jest.fn().mockResolvedValue({role:'RECRUITER'}),assertApplicationPermission:jest.fn(),assertInterviewPermission:jest.fn()};const invitations={send:jest.fn()};const meetings={createRoom:jest.fn().mockReturnValue('easyjob-interview-test'),closeRoom:jest.fn()};
    const service=new InterviewsService(prisma,access as never,{log:jest.fn()} as never,{} as never,{} as never,{emitToCompany:jest.fn(),emitToUser:jest.fn()} as never,{emit:jest.fn()} as never,meetings as never,{} as never,invitations as never);
    return{service,prisma,interview,invitations,meetings};
  }
  it('persists the schedule before dispatching invitations',async()=>{const{service,prisma,interview,invitations}=setup();await service.create('hr',{applicationId:'a',type:'HR',startAt:interview.startAt.toISOString(),endAt:interview.endAt.toISOString(),locationType:'EXTERNAL',location:'https://meet.example.test'},{});expect(prisma.interview.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'SCHEDULED',timezone:'Africa/Tunis',locationType:'EXTERNAL'})}));expect(invitations.send).toHaveBeenCalledWith('i','scheduled');});
  it('creates a native EasyJob room without an external URL',async()=>{const{service,prisma,interview,meetings}=setup();await service.create('hr',{applicationId:'a',type:'TECHNICAL',startAt:interview.startAt.toISOString(),endAt:interview.endAt.toISOString(),locationType:'EASYJOB'},{});expect(meetings.createRoom).toHaveBeenCalled();expect(prisma.interview.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({timezone:'Africa/Tunis',meetingProvider:'EASYJOB',meetingRoomId:'easyjob-interview-test',meetingUrl:null})}));});
  it('rescheduling resets reminders and sends an updated invitation',async()=>{const{service,prisma,interview,invitations}=setup();await service.update('hr','i',{startAt:new Date(interview.startAt.getTime()+3600000).toISOString(),endAt:new Date(interview.endAt.getTime()+3600000).toISOString()},{});expect(prisma.interview.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({reminderSentAt:null,reminderHourSentAt:null,calendarSequence:{increment:1}})}));expect(invitations.send).toHaveBeenCalledWith('i','updated');});
  it('cancellation sends a cancellation invitation',async()=>{const{service,invitations}=setup();await service.update('hr','i',{status:'CANCELLED'},{});expect(invitations.send).toHaveBeenCalledWith('i','cancelled');});
  it('completion stores its timestamp without creating an evaluation pipeline stage',async()=>{const{service,prisma,invitations}=setup();await service.update('hr','i',{status:'COMPLETED'},{});expect(prisma.interview.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'COMPLETED',completedAt:expect.any(Date)})}));expect(prisma.application.update).not.toHaveBeenCalled();expect(invitations.send).not.toHaveBeenCalled();});
});

