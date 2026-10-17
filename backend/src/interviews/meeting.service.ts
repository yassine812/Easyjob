import { Interval } from '@nestjs/schedule';
import { presentInterviewBrief } from './question-reason';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from '../companies/company-access.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { EasyJobMeetingProvider } from './meeting-provider';
import { analyzeDeterministicInterview, selectDeterministicQuestions, extractDeterministicRequirements, contextualInterviewQuestion } from '../career/deterministic-interview';
import { toJson } from '../common/utils/json';
import { interviewCalendar } from './interview-calendar';

const text = (value: unknown) => String(value ?? '').trim();

@Injectable()
export class MeetingService {
  private sweeping = false;
  constructor(private readonly prisma: PrismaService, private readonly access: CompanyAccessService, private readonly entitlements: EntitlementService, private readonly provider: EasyJobMeetingProvider) {}
  private transcriptionEnabled() { return process.env.INTERVIEW_TRANSCRIPTION_ENABLED === 'true' || process.env.EASYJOB_TRANSCRIPTION_ENABLED === 'true'; }
  async capabilities(userId: string, companyId: string) {
    await this.access.assertPermission(userId, companyId, 'application.view');
    return { meetingAvailable: this.provider.configured(), assistantAvailable: process.env.INTERVIEW_LIVE_ASSISTANT_ENABLED !== 'false' && await this.entitlements.hasRecruitmentIntelligence(companyId), transcriptionAvailable: this.transcriptionEnabled() };
  }
  private async authorized(userId: string, id: string) {
    const item = await this.prisma.interview.findUnique({ where: { id }, include: { application: { include: { job: { include: { company: true } }, candidate: { include: { user: { select: { id: true, name: true } } } } } }, participants: { include: { member: { include: { user: { select: { name: true } } } } } }, consents: true, transcriptSegments: { orderBy: { startedAt: 'asc' } }, feedback: true, brief: { include: { questions: { orderBy: { order: 'asc' } } } } } });
    if (!item) throw new NotFoundException('Interview not found');
    const candidate = item.application.candidate.userId === userId;
    if (!candidate) {
      await this.access.assertInterviewPermission(userId, item.application.job.companyId, id, 'application.view');
      const membership = await this.access.assertMembership(userId, item.application.job.companyId);
      if (!['OWNER', 'ADMIN'].includes(membership.role) && item.scheduledById !== userId && !item.participants.some(p => p.member.userId === userId && p.member.status === 'ACTIVE')) throw new ForbiddenException('You are not an assigned interviewer');
    }
    return { item, candidate };
  }
  async details(userId: string, id: string, locale = 'fr') {
    const { item, candidate } = await this.authorized(userId, id);
    const allowed = item.assistantEnabled && await this.entitlements.hasRecruitmentIntelligence(item.application.job.companyId);
    // Repair only the old generated fallback at read time; recruiter-authored questions stay untouched.
    if (!candidate && allowed && item.brief) {
      for (const question of item.brief.questions) {
        const match = question.question.match(/^(?:Comment démontrerais-tu ton expérience avec (.+) \?|How would you demonstrate your experience with (.+)\?)$/);
        if (question.sourceType !== 'RECRUITER' && match) question.question = contextualInterviewQuestion(match[1] || match[2], locale);
      }
    }
    const analysis = !candidate && allowed ? analyzeDeterministicInterview(item.application.job, item.application.cvTextSnapshot ?? '', locale, id) : null;
    const transcriptSegments = (item.transcriptSegments ?? []).map(segment => ({ text: segment.text, speaker: segment.participantRole, participantId: segment.participantId, startedAt: segment.startedAt, endedAt: segment.endedAt, at: segment.createdAt, source: segment.source }));
    return { id, applicationId: item.applicationId, companyId: item.application.job.companyId, companyName: item.application.job.company.commercialName, title: item.application.job.title, candidateName: item.application.candidate.user.name, startAt: item.startAt, endAt: item.endAt, status: item.status, startedAt: item.startedAt, endedAt: item.endedAt, timezone: item.timezone, locationType: item.locationType, location: item.location, meetingProvider: item.meetingProvider, meetingRoomId: item.meetingRoomId, meetingUrl: item.meetingUrl, candidate, assistantEnabled: allowed, transcriptionAvailable: this.transcriptionEnabled(), transcriptionReady: this.allConsented(item), consented: item.consents.some(c => c.userId === userId && !c.revokedAt), joinAvailable: ['SCHEDULED','CONFIRMED','IN_PROGRESS'].includes(item.status) && Date.now() >= item.startAt.getTime()-15*60000 && Date.now() < item.endAt.getTime()+30*60000, ...(candidate ? {} : { type: item.type, participants: item.participants.map(p => ({ member: { id: p.member.id, user: { name: p.member.user.name } } })), candidateSummary: allowed ? { score: item.application.aiMatchScore, potential: item.application.potentialScore, classification: item.application.aiQualification, coverLetter: item.application.coverLetter || item.application.motivation } : null, questions: item.brief?.questions?.map((q: any) => q.question) ?? (analysis ? selectDeterministicQuestions(analysis, locale, 10, id) : []), brief: allowed ? presentInterviewBrief(item.brief) : null, assistantNotes: allowed ? { ...((item.assistantNotes ?? {}) as object), segments: transcriptSegments.length ? transcriptSegments : ((item.assistantNotes as any)?.segments ?? []) } : null, feedback: item.feedback, scorecardCriteria: extractDeterministicRequirements(item.application.job).slice(0,8).map(r=>r.label) }) };
  }
  async consent(userId: string, id: string, accepted: boolean) {
    const { item } = await this.authorized(userId, id);
    if (!item.assistantEnabled || !['SCHEDULED','CONFIRMED','IN_PROGRESS'].includes(item.status)) throw new BadRequestException('Assistant is not active');
    await this.entitlements.assertRecruitmentIntelligence(item.application.job.companyId);
    await this.prisma.interviewConsent.upsert({ where: { interviewId_userId: { interviewId: id, userId } }, create: { interviewId: id, userId, revokedAt: accepted ? null : new Date() }, update: { acceptedAt: new Date(), revokedAt: accepted ? null : new Date(), version: '1' } });
    return { accepted };
  }
  async join(userId: string, id: string) {
    const { item, candidate } = await this.authorized(userId, id);
    if (!['SCHEDULED','CONFIRMED','IN_PROGRESS'].includes(item.status) || Date.now() < item.startAt.getTime()-15*60000 || Date.now() >= item.endAt.getTime()+30*60000) throw new BadRequestException('Room is not open');
    if (item.locationType !== 'EASYJOB' || !item.meetingRoomId) throw new BadRequestException('No EasyJob room for this interview');
    if (item.assistantEnabled) {
      await this.entitlements.assertRecruitmentIntelligence(item.application.job.companyId);
      if (!item.consents.some(c => c.userId === userId && !c.revokedAt)) throw new ForbiddenException('Explicit assistant consent is required');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true } });
    return this.provider.getJoinAccess(item.meetingRoomId, user, !candidate);
  }
  async started(userId: string, id: string) {
    const { item, candidate } = await this.authorized(userId, id);
    if (candidate) throw new ForbiddenException('Only an interviewer may start the interview');
    if (!item.meetingRoomId || !['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(item.status) || Date.now() < item.startAt.getTime() - 900000 || Date.now() >= item.endAt.getTime() + 1800000) throw new BadRequestException('Room is not open');
    await this.provider.assertConnected(item.meetingRoomId, userId);
    await this.prisma.interview.updateMany({ where: { id, status: { in: ['SCHEDULED', 'CONFIRMED'] } }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    return { started: true };
  }
  async webhook(body: string, authorization: string) {
    const event = await this.provider.receiveWebhook(body, authorization);
    const room = event.room?.name;
    if (!room || !['participant_joined', 'room_started'].includes(event.event ?? '')) return;
    const item = await this.prisma.interview.findUnique({ where: { meetingRoomId: room } });
    if (!item || !['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(item.status) || Date.now() < item.startAt.getTime() - 900000 || Date.now() >= item.endAt.getTime() + 1800000) await this.provider.closeRoom(room);
  }
  @Interval(15000)
  async closeExpiredRooms() {
    if (this.sweeping || !this.provider.configured()) return;
    this.sweeping = true;
    try {
      const rooms = await this.provider.activeRooms();
      if (!rooms.length) return;
      const items = await this.prisma.interview.findMany({ where: { meetingProvider: 'EASYJOB', meetingRoomId: { in: rooms } }, select: { meetingRoomId: true, status: true, startAt: true, endAt: true } });
      const valid = new Set(items.filter(item => ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(item.status) && Date.now() >= item.startAt.getTime() - 900000 && Date.now() < item.endAt.getTime() + 1800000).map(item => item.meetingRoomId));
      for (const room of rooms) if (!valid.has(room)) await this.provider.closeRoom(room);
    } catch { /* Retry after media/database outages without overlapping sweeps. */ }
    finally { this.sweeping = false; }
  }
  @Interval(60 * 60 * 1000)
  async purgeExpiredTranscriptSegments() {
    const days = Math.max(1, Number.parseInt(process.env.INTERVIEW_TRANSCRIPT_RETENTION_DAYS ?? '90', 10) || 90);
    await this.prisma.interviewTranscriptSegment.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86400000) } } });
  }
  async calendar(userId: string, id: string) {
    const { item } = await this.authorized(userId, id);
    return { filename: 'interview.ics', content: interviewCalendar(item, item.application.job.title, `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/meetings/${id}`) };
  }
  private allConsented(item: Awaited<ReturnType<MeetingService['authorized']>>['item']) {
    const participants = new Set([item.application.candidate.userId, item.scheduledById, ...item.participants.filter(p=>p.member.status==='ACTIVE').map(p=>p.member.userId), ...item.consents.map(c=>c.userId)]);
    return [...participants].every(id=>item.consents.some(c=>c.userId===id&&!c.revokedAt));
  }
  async transcribe(userId: string, id: string, file: Express.Multer.File, locale?: string) {
    let { item } = await this.authorized(userId,id);
    if (!this.transcriptionEnabled()) throw new ServiceUnavailableException('Local transcription is not configured');
    await this.entitlements.assertRecruitmentIntelligence(item.application.job.companyId);
    const allowed = () => item.assistantEnabled && this.allConsented(item) && ['SCHEDULED','CONFIRMED','IN_PROGRESS'].includes(item.status) && Date.now() >= item.startAt.getTime()-900000 && Date.now() < item.endAt.getTime()+1800000;
    if (!allowed()) throw new ForbiddenException('All participants must consent before transcription');
    if (!file?.buffer?.length || !['audio/webm','audio/ogg','audio/mp4'].includes(file.mimetype)) throw new BadRequestException('Unsupported audio');
    const form = new FormData(); form.append('file',new Blob([new Uint8Array(file.buffer)],{type:file.mimetype}),'audio.webm');
    const language = locale && ['fr', 'en', 'ar'].includes(locale) ? `?language=${locale}` : '';
    const response = await fetch(`${process.env.AI_SERVICE_URL ?? 'http://localhost:8000'}/ai/interviews/transcribe${language}`,{method:'POST',body:form,headers:process.env.AI_API_KEY?{Authorization:`Bearer ${process.env.AI_API_KEY}`}:{},signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new ServiceUnavailableException('Local transcription is unavailable');
    const transcript = await response.json() as { available: boolean; text: string; engine?: string; segments?: Array<{ start?: number; end?: number; text?: string; confidence?: number | null }> };
    if (!transcript.available) throw new ServiceUnavailableException('Local speech model is unavailable');
    // Recheck after inference: withdrawal of consent or completion cancels persistence.
    ({ item } = await this.authorized(userId,id));
    if (!allowed()) throw new ForbiddenException('Transcription consent is no longer valid');
    if (!transcript.text.trim()) return { saved: false };
    const old = (item.assistantNotes ?? {}) as { segments?: unknown[] };
    const speaker = await this.prisma.user.findUniqueOrThrow({where:{id:userId},select:{name:true}});
    const role = item.application.candidate.userId === userId ? 'CANDIDATE' : 'RECRUITER';
    const segments = (transcript.segments ?? []).filter(segment => text(segment.text)).map(segment => ({ interviewId: id, participantId: userId, participantRole: role, text: text(segment.text).slice(0, 10000), startedAt: new Date(item.startAt.getTime() + Math.max(0, Number(segment.start ?? 0)) * 1000), endedAt: new Date(item.startAt.getTime() + Math.max(Number(segment.start ?? 0), Number(segment.end ?? segment.start ?? 0)) * 1000), source: transcript.engine ?? 'FASTER_WHISPER', confidence: segment.confidence == null ? undefined : Number(segment.confidence) }));
    const result = await this.prisma.$transaction(async tx => {
      const updated = await tx.interview.updateMany({where:{id,updatedAt:item.updatedAt},data:{assistantNotes:toJson({...old,segments:[...(old.segments??[]),{speaker:speaker.name,userId,text:transcript.text.slice(0,10000),at:new Date().toISOString()}].slice(-1000)})}});
      if (updated.count && segments.length) await tx.interviewTranscriptSegment.createMany({ data: segments });
      return updated;
    });
    if (!result.count) throw new ConflictException('Transcript changed; retry this segment');
    return { saved: true };
  }
  async notes(userId: string, id: string, notes: string, covered: number[], locale: string) {
    const { item, candidate } = await this.authorized(userId, id);
    if (candidate) throw new ForbiddenException('Interviewer notes are private');
    await this.access.assertInterviewPermission(userId, item.application.job.companyId, id, 'interview.update');
    await this.entitlements.assertRecruitmentIntelligence(item.application.job.companyId);
    if (!item.assistantEnabled || item.status === 'CANCELLED') throw new BadRequestException('Assistant is not enabled');
    const questions = item.brief?.questions?.length ? item.brief.questions.map(question => question.question) : selectDeterministicQuestions(analyzeDeterministicInterview(item.application.job, item.application.cvTextSnapshot ?? '', locale, id), locale, 10, id);
    if (covered.some(index => !Number.isInteger(index) || index < 0 || index >= questions.length)) throw new BadRequestException('Unknown question');
    const old = (item.assistantNotes ?? {}) as Record<string, unknown>;
    const result = await this.prisma.interview.updateMany({ where: { id, updatedAt: item.updatedAt }, data: { assistantNotes: toJson({ ...old, notes, covered, questions, updatedBy: userId, updatedAt: new Date().toISOString() }) } });
    if (!result.count) throw new ConflictException('Notes changed. Reload before saving.');
    return { saved: true };
  }
}
