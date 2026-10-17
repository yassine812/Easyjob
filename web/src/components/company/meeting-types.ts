import type { QuestionReason } from '@/lib/interview-reason';
export interface MeetingQuestion {
  id: string; question: string; priority: string; skill?: string | null; sourceType?: string; sourceReference?: string;
  rationale?: string; reason?: QuestionReason | null; covered?: boolean;
}
export interface Meeting {
  id: string; applicationId: string; companyId: string; companyName: string; title: string;
  candidateName: string; candidate: boolean; status: string; startAt: string; endAt: string;
  timezone: string; locationType: string; location: string | null; assistantEnabled: boolean;
  consented: boolean; transcriptionAvailable: boolean; transcriptionReady: boolean; joinAvailable: boolean;
  type?: string; participants?: { member: { id: string; user: { name: string } } }[];
  questions?: string[];
  candidateSummary?: { score?: number | null; potential?: string | null; classification?: string | null; coverLetter?: string | null };
  brief?: { questions?: MeetingQuestion[]; strengths?: { label: string }[]; gaps?: { label: string }[]; analysisSnapshot?: { score?: number | null } } | null;
  assistantNotes?: { notes?: string; covered?: number[]; questions?: string[]; segments?: { text: string; speaker: string; participantId?: string | null; startedAt?: string; endedAt?: string; at: string; source?: string }[] };
  feedback?: { id: string; summary: string; recommendation?: string; criteria?: { label: string; score: number }[] }[];
}
export const meetingQuestions = (meeting: Meeting): MeetingQuestion[] => meeting.brief?.questions?.length
  ? meeting.brief.questions
  : (meeting.assistantNotes?.questions ?? meeting.questions ?? []).map((question, index) => ({ id: String(index), question, priority: 'MEDIUM' }));
export function meetingTime(meeting: Meeting, locale: string) {
  const options: Intl.DateTimeFormatOptions = { timeZone: meeting.timezone, hour: '2-digit', minute: '2-digit', hour12: false };
  return `${new Date(meeting.startAt).toLocaleTimeString(locale, options)}–${new Date(meeting.endAt).toLocaleTimeString(locale, options)}`;
}
