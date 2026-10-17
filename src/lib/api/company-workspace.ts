import { api } from './client';
export interface CompanyPreferences { domains: string[]; positions: string[]; locations: string[]; languages: string[]; workModes: string[]; hiringVolume: number; thresholds: { excellent: number; strong: number; good: number; potential: number }; stageSlaHours?: Partial<Record<'APPLIED' | 'SCREENING' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER', number>>; }
export interface WorkspaceCompany { slug?: string; professionalEmail?: string | null; registrationIdentifier?: string | null; culture?: string | null; benefits?: string[]; id: string; commercialName: string; legalName: string; industry: string | null; size: string | null; country: string | null; city: string | null; website: string | null; description: string | null; phone: string | null; address: string | null; onboardingCompletedAt: string | null; }
export interface InterviewAiReport { content: string; strengths?: string[]; gaps?: string[]; followUp?: string[]; technical?: number | null; communication?: number | null; problemSolving?: number | null; roleKnowledge?: number | null; }
export interface InterviewRow { timezone?: string; locationType?: string; meetingRoomId?: string | null; assistantEnabled?: boolean; questions?: { items: string[]; locale: string } | null; aiReport?: InterviewAiReport | null; id: string; applicationId: string; startAt: string; endAt: string; type: string; status: string; location: string | null; notes: string | null; application: { id: string; candidate: { id?: string; user: { name: string } }; job: { id?: string; title: string } }; participants?: { member: { id: string; user: { name: string } } }[]; feedback?: { id: string; summary: string; followUp?: string; technical?: number; communication?: number; problemSolving?: number; roleKnowledge?: number }[]; }
export interface WorkspaceOverview {
  comparison?: { previousApplications: number; applicationsPercent: number | null };
  velocity?: { key: string; averageDays: number | null; sampleSize: number }[];
  funnel?: { stage: string; count: number; conversion: number | null }[];
  from: string; to: string;
  upcomingCount?: number;
  attention?: { newApplications: number; review: number; overdue: number; interviewsToday: number; offers: number };
  bottlenecks?: { stage: string; averageDays: number | null; completedIntervals: number }[];
  topCandidates?: { classification?: string; id: string; candidateName: string; jobTitle: string; aiMatchScore: number | null; potentialScore: string | null; potentialAssessment: { applicable: boolean } }[];
 advancedAnalysisAvailable?: boolean; jobs: Record<string, number>; stages: Record<string, number>; totalApplications: number; analyzed: number; distribution: Record<string, number>; classificationDistribution?: Record<string, number>; averageMatch: number | null; averageTimeToHireDays: number | null; averageTimeToInterviewDays: number | null; hiringRate: number | null; sources: { manual: number; autoApply: number }; daily: { date: string; count: number }[]; applicationsByJob: { id: string; title: string; total: number; hired: number; pending: number; interviews: number; overdue: number }[]; recent: { appliedAt?: string; id: string; status: string; aiMatchScore?: number | null; category?: string; candidate: { user: { name: string } }; job: { title: string } }[]; upcoming: InterviewRow[]; }
export interface CandidateRow { id: string; headline: string | null; location: string | null; user: { name: string }; skills: { skill: { name: string } }[]; applications: { id: string; status: string; aiMatchScore?: number | null; job: { id: string; title: string } }[]; }
export interface Page<T> { items: T[]; total: number; page: number; limit: number; totalPages: number; }
export interface EmailTemplate { id: string; name: string; subject: string; body: string; }
export interface CompanySearch { applications: { id: string; candidateName: string; jobTitle: string; status: string }[]; jobs: { id: string; title: string; status: string }[]; candidates: CandidateRow[]; interviews: InterviewRow[]; members: { id: string; role: string; user: { name: string } }[]; }
const root = (id: string) => `/companies/${id}/workspace`;
const query = (values: Record<string, string | number | undefined>) => { const q = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') q.set(key, String(value)); return `?${q}`; };
export const workspaceApi = {
  overview: (id: string, params: Record<string, string | number | undefined> = {}) => api.get<WorkspaceOverview>(`${root(id)}/overview${query(params)}`),
  settings: (id: string) => api.get<{ company: WorkspaceCompany; preferences: CompanyPreferences }>(`${root(id)}/settings`),
  saveSettings: (id: string, preferences: CompanyPreferences & { completeOnboarding?: boolean }) => api.patch(`${root(id)}/settings`, preferences),
  interviews: (id: string, params: Record<string, string | number | undefined> = {}) => api.get<Page<InterviewRow>>(`${root(id)}/interviews${query(params)}`),
  candidates: (id: string, params: Record<string, string | number | undefined> = {}) => api.get<Page<CandidateRow> & { advancedAnalysisAvailable?: boolean }>(`${root(id)}/candidates${query(params)}`),
  search: (id: string, q: string) => api.get<CompanySearch>(`${root(id)}/search${query({ q })}`),
  assign: (id: string, jobId: string, memberIds: string[]) => api.patch(`${root(id)}/jobs/${jobId}/assignments`, { memberIds }),
  templates: (id: string) => api.get<EmailTemplate[]>(`${root(id)}/templates`),
  saveTemplate: (id: string, template: Omit<EmailTemplate, 'id'>) => api.post(`${root(id)}/templates`, template),
  communicate: (id: string, appId: string, message: { name: string; subject: string; body: string; channel: string; requestId: string }) => api.post(`${root(id)}/applications/${appId}/messages`, message),
  feedback: (id: string, interviewId: string, feedback: Record<string, unknown>) => api.post(`${root(id)}/interviews/${interviewId}/feedback`, feedback),
  audit: (id: string, page: number) => api.get<Page<{ id: string; action: string; createdAt: string; entityType: string; actor: { name: string } | null }>>(`${root(id)}/audit${query({ page })}`),
};
