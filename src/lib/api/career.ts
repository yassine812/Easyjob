import { api, qs } from './client';
import type { ApplicationQuality, EvidenceAnalysis, JobIntelligence, ProfessionalAudit, DocumentInspection } from './recruitment';
export interface AtsReport {
  audit?: ProfessionalAudit; documentInspection?: DocumentInspection | null;
  score: number | null; strengths: string[]; suggestions: string[]; missingKeywords: string[];
  missingSkills: string[]; formattingProblems: string[]; limitations: string[];
  wordCount?: number;
  criteria: AtsCriterion[];
  target?: { selected: boolean; title?: string; company?: string; keywords: string[]; matched: string[]; missing: string[] };
}
export interface AtsCriterion { key: string; weight: number; passed: boolean; evidence?: string[]; metrics?: Record<string, number | string>; priority?: 'high' | 'medium' | 'low' }
export interface JobMatch {
  method?: string;
  evidenceAnalysis?: EvidenceAnalysis; applicationQuality?: ApplicationQuality;
  growthAnalysis?: GrowthAnalysis;
  score: number | null; classification: string; matchedSkills?: string[]; missingSkills?: string[];
  matchedTitleTerms?: string[]; unverifiedRequirements?: string[]; summary?: string;
  growthPotential?: 'HIGH' | 'MEDIUM' | 'LOW' | null; growthPotentialScore?: number | null; growthPotentialReasons?: string[];
  dimensions?: { key: string; score: number | null; evidence: string[] }[];
}
export interface GrowthEvidence { id?: string; concept: string; source: 'WORK_EXPERIENCE' | 'PROJECT' | 'CERTIFICATION' | 'SKILLS' | 'CV' | 'COVER_LETTER'; sourceLabel?: string; sourceId?: string; section?: string; evidence: string; strength?: 'strong' | 'moderate' | 'supporting' | 'context'; recency?: string | null; relevance: number; confidence: number; relatedSkill?: string }
export interface GrowthGap { skill: string; currentEvidence: string; gap: string; effort: 'reasonable' | 'moderate' | 'substantial'; critical?: boolean; evidence?: GrowthEvidence }
export interface GrowthComponent { type: string; label: string; contribution: number; evidenceIds: string[] }
export interface GrowthProgression { steps: { title: string; companyName: string; startDate: string; endDate: string | null; current: boolean }[]; summary: string | null }
export interface GrowthAnalysis { score: number | null; category: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNDETERMINED' | 'INCOMPLETE'; summary: string; why: string[]; strengths: string[]; evidence: GrowthEvidence[]; transferableEvidence: GrowthEvidence[]; gaps: GrowthGap[]; coverLetter: { provided: boolean; relevance: 'high' | 'medium' | 'low' | 'not_provided'; score: number | null; evidence: string[]; checks: { jobSpecificReferences: boolean; concreteExperience: boolean; relevantAchievements: boolean; technologiesWithExamples: boolean } }; components: Record<string, number>; componentBreakdown?: GrowthComponent[]; progression?: GrowthProgression; method: string }
export interface ApplicationField { id: string; label: string; type: 'text' | 'textarea' | 'email' | 'phone' | 'url' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'file'; required: boolean; options?: string[]; source?: 'EASYJOB_STANDARD' | 'SOURCE_PROVIDER' | 'COMPANY' | 'JOB'; sourceId?: string }
export interface ApplicationRequirements {
  job: { id: string; title: string; location: string | null; employmentType: string | null; isExternal: boolean };
  company: { id: string; name: string; website: string | null } | null;
  applicationCapability: 'NATIVE_EASY_APPLY' | 'SOURCE_API_APPLY' | 'EMAIL_APPLY' | 'EXTERNAL_ONLY' | 'UNAVAILABLE';
  steps: { information: boolean; cv: boolean; questions: boolean; coverLetter: boolean; verification: boolean };
  fields: ApplicationField[]; questions: ApplicationField[];
  requiredDocuments: { type: string; required: boolean; acceptedMimeTypes: string[] }[];
  coverLetterRequired: boolean;
}
export interface CareerJob {
  intelligence?: JobIntelligence;
  applicationFields?: ApplicationField[]; reference?: string | null; benefits?: string[]; niceToHave?: string[]; education?: string[];
  experienceMax?: number | null; contractDuration?: string | null; country?: string | null; region?: string | null; city?: string | null;
  address?: string | null; salaryPeriod?: string | null; positions?: number | null; expiresAt?: string | null;

  contractType?: string | null; languages?: string[]; isSaved?: boolean; publishedAt?: string | null;
  id: string; title: string; description: string; location: string | null; employmentType: string | null; experienceLevel: string | null;
  responsibilities?: string[]; requirements?: string[]; educationRequirement?: string | null; minimumYearsExperience?: number | null;
  workMode: string | null; remote: boolean; domain: string | null; salaryMin: number | null; salaryMax: number | null; currency: string | null;
  salaryText?: string | null; sourceUpdatedAt?: string | null; isExternal?: boolean;
  applicationMethod?: 'NATIVE_EASYJOB' | 'EXTERNAL_APPLICATION' | 'EMAIL_APPLICATION' | 'UNKNOWN';
  sourceReferences?: { type: string; name: string; label: string; url: string | null; applicationMethod: string; lastSyncedAt?: string }[];
  company: { id: string; commercialName: string; industry: string | null; website?: string | null; logoKey?: string | null } | null;
  skills: { skill: { name: string }; required: boolean }[]; match: JobMatch;
}
export interface CareerJobSource { type: string; name: string; enabled: boolean; syncStatus?: string; lastSyncAt?: string | null; applicationMethod: string; error?: string | null }
export interface JobResults { items: CareerJob[]; total: number; page: number; limit: number; advanced: boolean; sources?: CareerJobSource[] }
export interface CareerOverview {
  name: string;
  dashboard: {
    stats: { applicationsSent: number; applicationsThisWeek: number; inReview: number; interviews: number; offers: number; averageMatch: number | null };
    activity: { date: string; count: number }[];
    pipeline: { applied: number; review: number; interview: number; offer: number; hired: number };
    recentApplications: { id: string; status: string; appliedAt: string; aiMatchScore: number | null; job: { id: string; title: string; company: { commercialName: string } | null } }[];
    insights: { mostAppliedRole: string | null; mostRequestedSkill: string | null; averageMatchThisMonth: number | null };
    weeklyProgress: { current: number; limit: number } | null;
  };
}
export interface CandidateApplicationSnapshot {
  fullName: string; email: string; phone?: string; location?: string; professionalTitle?: string; experience?: string; education?: string;
  skills?: string[]; languages?: string[]; certifications?: string[]; portfolio?: string; linkedIn?: string; github?: string;
}
export interface ExternalApplicationPreparation {
  id: string; status: 'READY_TO_APPLY_EXTERNALLY' | 'EXTERNAL_SITE_OPENED'; applied: false; preparedAt: string; externalSiteOpenedAt: string | null;
  resume: { id: string; filename: string } | null; job: CareerJob;
}
export interface Draft { id: string; title: string; content: string; originalContent: string; sourceResumeId?: string | null; template?: string; fontSize?: number; report?: AtsReport; targetJobId: string | null; beforeScore: number | null; afterScore: number | null; approvedAt: string | null; keywords: string[] }
export interface CareerSettings {
  approvalRequired?: boolean; preferredResumeId?: string | null; preferencesInitialized?: boolean; maxPerWeek?: number;
  targetTitles?: string[]; requiredSkills?: string[]; excludedKeywords?: string[]; experienceLevels?: string[];

  contractTypes?: string[]; employmentTypes?: string[]; excludedJobs?: string[]; minimumSalary?: number | null; maximumSalary?: number | null; salaryCurrency?: string;
  emailAlerts: boolean; frequency: string; domains: string[]; locations: string[]; workModes: string[]; minimumScore: number;
  autoApply: boolean; autoMinimumScore: number; maxPerDay: number; excludedCompanies: string[]; excludedJobTypes: string[]; approvedDraftId: string | null;
  activeCv?: { id: string; filename: string; processingStatus?: string } | null;
  autoApplyAccess?: { eligible: boolean; enabled: boolean; status: 'active' | 'paused' | 'locked' };
  cvPrefill?: { experienceLevels: string[]; domains: string[]; skills: string[]; locations: string[]; targetTitles: string[] };
}
export interface Draft { version?: number; language?: string; targetRole?: string | null; createdAt?: string; updatedAt?: string }
export interface SpeechMetrics { durationSeconds: number | null; wordCount: number; wordsPerMinute: number | null; fillerCount: number; fillerRate: number; longPauseCount: number | null; source: 'browser_transcript' | 'text_only' }
export interface Feedback { good: string[]; improve: string[]; betterAnswer: string; keywords: string[]; clarity: string; relevance: string; wordsPerMinute?: number | null; method: string; speechMetrics?: SpeechMetrics }
export interface ResearchBlock { text: string; citations: { url: string; title: string; start_index: number; end_index: number }[] }
export type InterviewState = 'READY' | 'INTERVIEWER_SPEAKING' | 'LISTENING' | 'ANSWERING' | 'ANALYZING' | 'INTERVIEWER_FEEDBACK' | 'COMPLETED';
export type TestCandidatePersona = 'strong' | 'average' | 'weak' | 'inconsistent';
export interface InterviewAutoTest { mode: 'AUTOMATED_INTERVIEW_TEST'; status: 'RUNNING' | 'PASSED' | 'FAILED' | 'STOPPED'; persona: TestCandidatePersona; speed: number; disableTts: boolean; seed: number; maxTopics: number; startedAt: string; initialQuestionCount: number; trace: { timestamp: string; stateBefore: string; event: string; stateAfter: string; questionIndex?: number; followUpDecision?: string; reason?: string }[]; result?: { passed: boolean; errors: string[]; durationMs: number; persona: TestCandidatePersona; mainQuestions: number; followUps: number; answersAnalyzed: number; stateMachine: boolean; adaptiveQuestions: boolean; persistence: boolean; finalDebrief: boolean } }
export interface AnswerAnalysis { overall_relevance: number | null; specificity: number | null; evidence_quality: number | null; communication_clarity: number | null; role_alignment: number | null; strengths: string[]; missing_points: string[]; detected_claims: string[]; follow_up_needed: boolean; follow_up_reason?: string; method: string }
export interface CoachSession { id: string; jobId?: string | null; jobTitle: string; company: string | null; locale?: string; interviewType: string; questions: string[]; answers: { question?: string; answer: string; feedback: Feedback; analysis?: AnswerAnalysis; decision?: { action: string; reason: string } }[]; visionConsent: boolean;
  conversation?: { state: InterviewState; questionIndex: number; transcript: string; code: string; pendingAnswer?: { questionIndex: number; answer: string } };
  autoTest?: InterviewAutoTest;
  preparation?: { method?: string; analysis_engine?: string; topicCount?: number; topics?: { concept: string; label: string; priority: number; status: string; evidenceScore: number; reason: string; questions: string[] }[]; score?: number | null; adaptiveEnabled?: boolean; jobDescription?: string; companyDescription?: string; website?: string; skills?: string[];
    research?: { status: string; blocks?: ResearchBlock[]; sources: { url: string; title: string }[]; checkedAt?: string }; analysis?: InterviewJobAnalysis } }
export interface InterviewRequirement { skill: string; category: string; importance: string; evidence: string }
export interface InterviewJobAnalysis { role: string; normalizedRole: string; company: string; department: string | null; industry: string | null; location: string | null; workplaceType: string | null; employmentType: string | null; seniority: string; technicalSkills: string[]; tools: string[]; responsibilities: string[]; softSkills: string[]; education: string[]; experienceRequirements: string[]; domainKnowledge: string[]; niceToHave: string[]; interviewSignals: string[]; requirements: InterviewRequirement[]; recommendedTypes: string[]; optionalTypes: string[]; difficulty: string; preparationPlan: string[]; candidateEvidence: string[]; gaps: string[] }
export interface InterviewJobSummary { role: string; company: string; seniority: string; recommendedTypes: string[]; optionalTypes: string[]; difficulty: string }
export interface CvExperience { title: string; company: string; period: string; description: string[] }
export interface CvEducation { degree: string; field: string; institution: string; location?: string; period: string; current?: boolean }
export interface CvLanguage { name: string; level: string }
export interface CvProject { name: string; description: string; githubUrl: string }
export interface CvCertification { name: string; issuer?: string; period?: string }
export interface ProfileDetails { sections: Record<string, string[]>; experiences?: CvExperience[]; educations?: CvEducation[]; languages?: CvLanguage[]; certifications?: CvCertification[]; projects?: CvProject[]; skills?: string[]; headline?: string | null; location?: string | null; phone?: string | null; email?: string | null; summary?: string | null; needsReview?: boolean }
export interface PreparationWorkspace {
  recommendedResume: { id: string; filename: string; score: number | null } | null;
  suggestedSummary: string; skillsToEmphasize: string[]; missingEvidence: string[]; cvChanges: string[];
  relevantExperiences: { title: string; company: string; description: string | null }[]; checklist: string[]; requiresReview: boolean; submitted: false;
  interviewTopicCount?: number; interviewTopics?: { concept: string; label: string; priority: number; status: string; questions: string[] }[];
}
export interface CandidateJobFit { alignment: 'STRONG_ALIGNMENT' | 'PARTIAL_ALIGNMENT' | 'NEEDS_REVIEW'; score: number | null; strengths: { skill: string; evidence: string[] }[]; matchingSkills: string[]; missingEvidence: string[]; gaps: { skill: string; status: string; evidence: string[] }[]; method: string; hiringDecision: false }
export interface CandidateTailoring { suggestions: { type: string; label: string; evidence: string[]; action: string; requiresConfirmation: true }[]; missingEvidence: { label: string; reason: string }[]; applyAutomatically: false; inventedFacts: false; method: string }
export interface CandidateInterviewPrep { likelyThemes: { label: string; priority: number; status: string; reason: string }[]; technicalQuestions: string[]; behavioralQuestions: string[]; projectDeepDives: string[]; gapsToPrepare: string[]; suggestedExamples: string[]; linkedStarStories?: { id: string; title: string }[]; method: string }
export interface CandidateFollowUp { status: string; daysWaiting: number; nextAction: string; followUpSuggested: boolean; reminderAfterDays: number | null; source: string }
export interface StarStory { id: string; title: string; situation: string; task: string; action: string; result: string; relatedSkills: string[]; relatedRoles: string[]; createdAt: string; updatedAt: string }
export const careerApi = {
  qualityCheck: (id: string, data: object) => api.post<ApplicationQuality>(`/career/jobs/${id}/quality-check`, data),
  evidence: (id: string, resumeId: string) => api.get<{ resumeId: string; filename: string; intelligence: JobIntelligence; evidenceAnalysis: EvidenceAnalysis }>(`/career/jobs/${id}/evidence${qs({ resumeId })}`),
  fit: (id: string, resumeId?: string, locale?: string) => api.get<CandidateJobFit>(`/career/jobs/${id}/fit${qs({ resumeId, locale })}`),
  tailoring: (id: string, resumeId?: string, locale?: string) => api.get<CandidateTailoring>(`/career/jobs/${id}/tailoring${qs({ resumeId, locale })}`),
  interviewPrep: (id: string, resumeId?: string, locale?: string) => api.get<CandidateInterviewPrep>(`/career/jobs/${id}/interview-prep${qs({ resumeId, locale })}`),
  applicationFollowUp: (id: string, locale?: string) => api.get<CandidateFollowUp>(`/career/applications/${id}/follow-up${qs({ locale })}`),
  starStories: () => api.get<StarStory[]>('/career/star-stories'),
  createStarStory: (data: Partial<StarStory>) => api.post<StarStory>('/career/star-stories', data),
  updateStarStory: (id: string, data: Partial<StarStory>) => api.patch<StarStory>(`/career/star-stories/${id}`, data),
  deleteStarStory: (id: string) => api.delete<{ success: boolean }>(`/career/star-stories/${id}`),
  revisions: (id: string) => api.get<{ id: string; version: number; content: string; title: string; template: string; fontSize: number; report: AtsReport; createdAt: string }[]>(`/career/drafts/${id}/revisions`),
  preparation: (id: string) => api.get<PreparationWorkspace>(`/career/jobs/${id}/preparation`),
  applicationRequirements: (id: string) => api.get<ApplicationRequirements>(`/career/jobs/${id}/application-requirements`),
  overview: () => api.get<CareerOverview>('/career/overview'),
  jobs: (params: object = {}, recommended = false, signal?: AbortSignal) => api.get<JobResults>(`/career/${recommended ? 'recommendations' : 'jobs'}${qs(params)}`, { signal }),
  job: (id: string) => api.get<CareerJob>(`/career/jobs/${id}`),
  savedExternalJobs: () => api.get<{ id: string; createdAt: string; job: CareerJob }[]>('/career/saved-external'),
  generateJobCoverLetter: (id: string, resumeId?: string, locale?: string, length = 'standard') => api.post<{ coverLetter: string }>(`/career/jobs/${id}/cover-letter`, { resumeId, locale, length }),
  saveExternalJob: (id: string) => api.post<{ success: boolean; isSaved: boolean }>(`/career/jobs/${id}/save`, {}),
  removeExternalSavedJob: (id: string) => api.delete<{ success: boolean; isSaved: boolean }>(`/career/jobs/${id}/save`),
  generateExternalCoverLetter: (id: string, resumeId?: string, locale?: string, length = 'standard') => api.post<{ coverLetter: string }>(`/career/external-jobs/${id}/cover-letter`, { resumeId, locale, length }),
  prepareExternalApplication: (id: string, data: object) => api.post<ExternalApplicationPreparation>(`/career/external-jobs/${id}/prepare`, data),
  openExternalApplication: (id: string) => api.post<{ status: 'EXTERNAL_SITE_OPENED'; applicationUrl: string; submitted: false }>(`/career/external-jobs/${id}/open`, {}),
  externalApplications: () => api.get<ExternalApplicationPreparation[]>('/career/external-applications'),
  facets: () => api.get<{ domains: string[]; locations: string[]; companies: { id: string; name: string }[] }>('/career/facets'),
  companySuggestions: (query: string) => api.get<{ name: string; domain: string; website: string; source: string; industry?: string | null }[]>(`/career/company-suggestions${qs({ q: query })}`),
  report: (id: string, jobId?: string) => api.get<{ id: string; filename: string; status: string; report: AtsReport | null; extracted: ProfileDetails | null }>(`/career/resumes/${id}/report${qs({ jobId })}`),
  importResume: (id: string) => api.post<ProfileDetails>(`/career/resumes/${id}/import`),
  profile: () => api.get<ProfileDetails>('/career/profile-details'),
  saveProfile: (values: Record<string, string>) => api.put<ProfileDetails>('/career/profile-details', values),
  drafts: () => api.get<Draft[]>('/career/drafts'),
  build: (data: object) => api.post<Draft>('/career/drafts', data),
  saveDraft: (id: string, data: object) => api.patch<Draft>(`/career/drafts/${id}`, data),
  regenerateSection: (id: string, data: { content: string; sectionIndex: number; lineIndex?: number }) => api.post<{ content: string; before: string; after: string; scope: 'line' | 'section'; beforeScore: number | null; score: number | null; beforeReport?: AtsReport; report: AtsReport; improvedChecks: string[] }>(`/career/drafts/${id}/sections/regenerate`, data),
  publish: (id: string) => api.post<{ id: string }>(`/career/drafts/${id}/publish`),
  settings: () => api.get<CareerSettings>('/career/settings'),
  saveSettings: (data: object) => api.patch<CareerSettings>('/career/settings', data),
  history: () => api.get<{ id: string; kind: string; status: string; reason: string | null; matchScore: number | null; createdAt: string; job: { title: string; company: { commercialName: string } } | null }[]>('/career/history'),
  autoStats: () => api.get<{ applicationsToday: number; applicationsSent: number; averageMatch: number | null; jobsAnalyzed: number; jobsSkipped: number }>('/career/auto-stats'),
  sessions: () => api.get<CoachSession[]>('/career/coach'),
  analyzeCoachJob: (id: string) => api.get<InterviewJobSummary>(`/career/coach/analyze/${id}`),
  createSession: (data: object) => api.post<CoachSession>('/career/coach', data),
  answer: (id: string, data: object) => api.post<CoachSession>(`/career/coach/${id}/answers`, data),
  saveTurn: (id: string, data: object) => api.patch<{ saved: boolean }>(`/career/coach/${id}/turn`, data),
  startAutoTest: (id: string, data: { persona: TestCandidatePersona; speed: number; disableTts: boolean; seed: number; maxTopics?: number }) => api.post<CoachSession>(`/career/coach/${id}/autotest`, data),
  autoTestAnswer: (id: string) => api.post<CoachSession>(`/career/coach/${id}/autotest/answer`, {}),
  completeAutoTest: (id: string) => api.post<CoachSession>(`/career/coach/${id}/autotest/complete`, {}),
  stopAutoTest: (id: string) => api.post<CoachSession>(`/career/coach/${id}/autotest/stop`, {}),
  targetedPractice: (id: string) => api.post<CoachSession>(`/career/coach/${id}/targeted-practice`, {}),
  enableVision: (id: string) => api.post<CoachSession>(`/career/coach/${id}/vision-consent`, {}),
  vision: (id: string, frame: Blob) => { const data = new FormData(); data.append('frame', frame, 'frame.jpg'); return api.post<{ observations: string[] }>(`/career/coach/${id}/vision`, data); },
};
