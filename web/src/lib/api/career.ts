import { api, qs } from './client';
export interface AtsReport {
  score: number | null; strengths: string[]; suggestions: string[]; missingKeywords: string[];
  missingSkills: string[]; formattingProblems: string[]; limitations: string[];
  wordCount?: number;
  criteria: AtsCriterion[];
  target?: { selected: boolean; title?: string; company?: string; keywords: string[]; matched: string[]; missing: string[] };
}
export interface AtsCriterion { key: string; weight: number; passed: boolean; evidence?: string[]; metrics?: Record<string, number | string>; priority?: 'high' | 'medium' | 'low' }
export interface JobMatch {
  score: number | null; classification: string; matchedSkills?: string[]; missingSkills?: string[];
  unverifiedRequirements?: string[]; summary?: string;
  dimensions?: { key: string; score: number | null; evidence: string[] }[];
}
export interface CareerJob {
  contractType?: string | null; languages?: string[]; isSaved?: boolean; publishedAt?: string | null;
  id: string; title: string; description: string; location: string | null; employmentType: string; experienceLevel: string;
  workMode: string | null; remote: boolean; domain: string | null; salaryMin: number | null; salaryMax: number | null; currency: string | null;
  company: { id: string; commercialName: string; industry: string | null; website?: string | null }; skills: { skill: { name: string }; required: boolean }[]; match: JobMatch;
}
export interface JobResults { items: CareerJob[]; total: number; page: number; limit: number; advanced: boolean }
export interface Draft { id: string; title: string; content: string; originalContent: string; targetJobId: string | null; beforeScore: number | null; afterScore: number | null; approvedAt: string | null; keywords: string[] }
export interface CareerSettings {
  contractTypes?: string[]; employmentTypes?: string[]; excludedJobs?: string[]; minimumSalary?: number | null; salaryCurrency?: string;
  emailAlerts: boolean; frequency: string; domains: string[]; locations: string[]; workModes: string[]; minimumScore: number;
  autoApply: boolean; autoMinimumScore: number; maxPerDay: number; excludedCompanies: string[]; excludedJobTypes: string[]; approvedDraftId: string | null;
}
export interface Feedback { good: string[]; improve: string[]; betterAnswer: string; keywords: string[]; clarity: string; relevance: string; wordsPerMinute?: number | null; method: string }
export interface ResearchBlock { text: string; citations: { url: string; title: string; start_index: number; end_index: number }[] }
export interface CoachSession { id: string; jobTitle: string; company: string | null; locale?: string; interviewType: string; questions: string[]; answers: { answer: string; feedback: Feedback }[]; visionConsent: boolean;
  preparation?: { method?: string; jobDescription?: string; companyDescription?: string; website?: string; skills?: string[];
    research?: { status: string; blocks?: ResearchBlock[]; sources: { url: string; title: string }[]; checkedAt?: string } } }
export interface CvExperience { title: string; company: string; period: string; description: string[] }
export interface CvEducation { degree: string; field: string; institution: string; location?: string; period: string; current?: boolean }
export interface CvLanguage { name: string; level: string }
export interface CvProject { name: string; description: string; githubUrl: string }
export interface CvCertification { name: string; issuer?: string; period?: string }
export interface ProfileDetails { sections: Record<string, string[]>; experiences?: CvExperience[]; educations?: CvEducation[]; languages?: CvLanguage[]; certifications?: CvCertification[]; projects?: CvProject[]; skills?: string[]; headline?: string | null; location?: string | null; phone?: string | null; summary?: string | null; needsReview?: boolean }
export const careerApi = {
  overview: () => api.get<{ name: string; plan: { name: string; features: Record<string, unknown> }; profileCompletion: number; applications: number; interviews: number; savedJobs: number; autoApply: boolean; upcomingInterview: { startAt: string; type: string; application: { id: string; job: { title: string } } } | null;
    resume: { id: string; filename: string; status: string; createdAt: string; ats: AtsReport | null } | null; recommendations: JobResults | null }>('/career/overview'),
  jobs: (params: object = {}, recommended = false) => api.get<JobResults>(`/career/${recommended ? 'recommendations' : 'jobs'}${qs(params)}`),
  facets: () => api.get<{ domains: string[]; locations: string[]; companies: { id: string; name: string }[] }>('/career/facets'),
  companySuggestions: (query: string) => api.get<{ name: string; domain: string; website: string; source: string; industry?: string | null }[]>(`/career/company-suggestions${qs({ q: query })}`),
  report: (id: string, jobId?: string) => api.get<{ id: string; filename: string; status: string; report: AtsReport | null; extracted: ProfileDetails | null }>(`/career/resumes/${id}/report${qs({ jobId })}`),
  importResume: (id: string) => api.post<ProfileDetails>(`/career/resumes/${id}/import`),
  profile: () => api.get<ProfileDetails>('/career/profile-details'),
  saveProfile: (values: Record<string, string>) => api.put<ProfileDetails>('/career/profile-details', values),
  drafts: () => api.get<Draft[]>('/career/drafts'),
  build: (data: object) => api.post<Draft>('/career/drafts', data),
  saveDraft: (id: string, data: object) => api.patch<Draft>(`/career/drafts/${id}`, data),
  regenerateSection: (id: string, data: { content: string; sectionIndex: number }) => api.post<{ content: string; score: number | null }>(`/career/drafts/${id}/sections/regenerate`, data),
  publish: (id: string) => api.post<{ id: string }>(`/career/drafts/${id}/publish`),
  settings: () => api.get<CareerSettings>('/career/settings'),
  saveSettings: (data: object) => api.patch<CareerSettings>('/career/settings', data),
  history: () => api.get<{ id: string; kind: string; status: string; reason: string | null; matchScore: number | null; createdAt: string; job: { title: string; company: { commercialName: string } } | null }[]>('/career/history'),
  autoStats: () => api.get<{ applicationsToday: number; applicationsSent: number; averageMatch: number | null; jobsAnalyzed: number; jobsSkipped: number }>('/career/auto-stats'),
  sessions: () => api.get<CoachSession[]>('/career/coach'),
  createSession: (data: object) => api.post<CoachSession>('/career/coach', data),
  answer: (id: string, data: object) => api.post<CoachSession>(`/career/coach/${id}/answers`, data),
  vision: (id: string, frame: Blob) => { const data = new FormData(); data.append('frame', frame, 'frame.jpg'); return api.post<{ observations: string[] }>(`/career/coach/${id}/vision`, data); },
};
