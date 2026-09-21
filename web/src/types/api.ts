/**
 * Domain types mirroring the ACTUAL backend response shapes.
 * Source of truth: docs/FRONTEND_INTEGRATION.md + the backend code.
 * Request bodies come from the generated OpenAPI types (lib/api/schema.d.ts).
 */

export type ID = string;

export type Role =
  | 'PLATFORM_ADMIN'
  | 'COMPANY_ADMIN'
  | 'HR'
  | 'RECRUITER'
  | 'HIRING_MANAGER'
  | 'INTERVIEWER'
  | 'CANDIDATE';

export type MemberRole = Exclude<Role, 'PLATFORM_ADMIN' | 'CANDIDATE'>;
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type CompanyStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';
export type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
export type CandidateVisibility = 'PUBLIC' | 'RECRUITERS_ONLY' | 'PRIVATE';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
export type ExperienceLevel = 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE';
export type JobStatus =
  | 'PAUSED'
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'EXPIRED'
  | 'CLOSED'
  | 'REJECTED';
export type ApplicationStatus =
  | 'UNDER_REVIEW'
  | 'APPLIED'
  | 'SCREENING'
  | 'SHORTLISTED'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';
export type InterviewType = 'PHONE' | 'VIDEO' | 'ONSITE' | 'TECHNICAL' | 'HR' | 'BEHAVIORAL' | 'MANAGERIAL' | 'AI' | 'FINAL';
export type InterviewStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type PlanType = 'CANDIDATE' | 'COMPANY';
export type SubscriptionStatus = 'PENDING' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type AiAnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type AiAnalysisType =
  | 'CV_ANALYZE'
  | 'CV_GENERATE'
  | 'CV_TAILOR'
  | 'JOB_ANALYZE'
  | 'MATCH'
  | 'COVER_LETTER'
  | 'INTERVIEW';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type AssessmentStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type QuestionType = 'MULTIPLE_CHOICE' | 'TEXT' | 'CODING';
export type AutomationTriggerType =
  | 'CANDIDATE_APPLIED'
  | 'APPLICATION_STATUS_CHANGED'
  | 'CANDIDATE_MATCH_SCORE_UPDATED'
  | 'INTERVIEW_SCHEDULED'
  | 'JOB_EXPIRING';
/** Action types the backend automation processor actually executes. */
export type AutomationActionType =
  | 'send_notification'
  | 'send_email'
  | 'move_application'
  | 'notify_recruiter';
export type AutomationExecutionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CompanyMembership {
  companyId: ID;
  companyName: string;
  companySlug: string;
  companyStatus: CompanyStatus;
  role: MemberRole;
}

export interface MeUser {
  mustChangePassword?: boolean;
  id: ID;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Role[];
  candidateProfileId: ID | null;
  memberships: CompanyMembership[];
}

export interface AuthSession {
  accessToken: string;
  user: MeUser;
}

export interface Company {
  id: ID;
  legalName: string;
  commercialName: string;
  slug: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  professionalEmail: string | null;
  registrationIdentifier: string | null;
  logoKey: string | null;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
  members?: CompanyMember[];
  myRole?: MemberRole;
}

export interface CompanyMember {
  isOwner?: boolean;
  position?: string | null;
  id: ID;
  userId: ID;
  name: string;
  email: string;
  role: MemberRole;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface CompanyInvitation {
  id: ID;
  email: string;
  role: MemberRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  invitationUrl?: string | null;
}

export interface VerificationDocument {
  id: ID;
  filename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface CompanyVerification {
  id: ID;
  companyId: ID;
  status: VerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  documents: VerificationDocument[];
}

export interface Skill {
  id: ID;
  name: string;
  normalizedName: string;
}

/** Backend profile endpoints return skills as { id, name, level }. */
export interface CandidateSkill {
  id: ID;
  name: string;
  level: SkillLevel;
}

export interface Experience {
  id: ID;
  companyName: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  current: boolean;
}

export interface Education {
  id: ID;
  institution: string;
  degree: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface Resume {
  id: ID;
  filename: string;
  mimeType: string;
  fileSize: number;
  version: number;
  isPrimary: boolean;
  processingStatus: ProcessingStatus;
  createdAt: string;
}

export interface JobPreference {
  id: ID;
  jobTitle: string | null;
  location: string | null;
  remote: boolean | null;
  employmentType: EmploymentType | null;
  experienceLevel: ExperienceLevel | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  keywords: string[];
}

export interface CandidateProfile {
  professionalData?: unknown;
  id: ID;
  userId: ID;
  headline: string | null;
  bio: string | null;
  location: string | null;
  phone: string | null;
  yearsExperience: number | null;
  visibility: CandidateVisibility;
  remotePreference: boolean | null;
  employmentTypePreference: EmploymentType | null;
  savedJobs: SavedJob[];
  skills: CandidateSkill[];
  experiences: Experience[];
  educations: Education[];
  resumes: Resume[];
  jobPreference: JobPreference | null;
  user?: { id: ID; name: string; email: string };
}

export interface SavedJob {
  applied?: boolean;
  id: ID;
  jobId: ID;
  job?: Job;
  createdAt: string;
}

export interface JobSkill {
  required: boolean;
  level: SkillLevel;
  skill: Skill;
}

export interface Job {
  department?: string | null; benefits?: string[]; preferredEducation?: string | null; preferredLanguages?: string[]; positions?: number; interviewProcess?: string | null;
  id: ID;
  companyId: ID;
  createdById: ID;
  title: string;
  slug: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  location: string | null;
  remote: boolean;
  domain?: string | null;
  workMode?: 'REMOTE' | 'HYBRID' | 'ONSITE' | null;
  contractType?: string | null; languages?: string[]; educationRequirement?: string | null;
  minimumYearsExperience?: number | null;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  status: JobStatus;
  expiresAt: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: ID;
    commercialName: string;
    slug: string;
    logoKey: string | null;
  };
  skills?: JobSkill[];
  _count?: { applications: number };
}

export interface Application {
  id: ID;
  jobId: ID;
  candidateId: ID;
  resumeId: ID | null;
  motivation: string | null;
  status: ApplicationStatus;
  aiMatchScore?: number | null;
  matchExplanation?: import('@/lib/api/career').JobMatch | null;
  autoApplied?: boolean;
  cvTextSnapshot?: string | null;
  interviews?: { id: string; startAt: string; endAt: string; status: string; type: string; location: string | null }[];
  atsScore?: number | null;
  aiQualification?: string | null;
  aiRecommendation?: string | null;
  aiSummary?: string | null;
  potentialScore?: 'HIGH' | 'MEDIUM' | 'LOW' | string | null;
  potentialReason?: string | null;
  strengths?: string | null;
  missingRequirements?: string | null;
  aiScreeningStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  aiScreenedAt?: string | null;
  stageChangedAt?: string | null;
  stageChangedById?: string | null;
  stageChangeSource?: 'AI' | 'HR' | 'SYSTEM' | string;
  appliedAt: string;
  updatedAt: string;
  job?: {
    id: ID;
    title: string;
    slug: string;
    companyId: ID;
    location: string | null;
    remote: boolean;
  domain?: string | null;
  workMode?: 'REMOTE' | 'HYBRID' | 'ONSITE' | null;
  contractType?: string | null; languages?: string[]; educationRequirement?: string | null;
  minimumYearsExperience?: number | null;
    employmentType: EmploymentType;
    company?: { id: ID; commercialName: string; slug: string };
  };
  candidate?: {
    id: ID;
    userId: ID;
    headline: string | null;
    location: string | null;
    user: { id: ID; name: string; email: string };
  };
  resume?: {
    id: ID;
    filename: string;
    mimeType: string;
    fileSize: number;
    version: number;
  } | null;
  _count?: { events: number; notes: number };
}

export interface ApplicationEvent {
  id: ID;
  applicationId: ID;
  actorId: ID | null;
  previousStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: ID; name: string };
}

export interface ApplicationNote {
  id: ID;
  applicationId: ID;
  authorId: ID;
  content: string;
  createdAt: string;
  author?: { id: ID; name: string };
}

export interface Interview {
  id: ID;
  applicationId: ID;
  scheduledById: ID;
  startAt: string;
  endAt: string;
  type: InterviewType;
  location: string | null;
  notes: string | null;
  status: InterviewStatus;
  createdAt: string;
  updatedAt: string;
  application?: {
    id: ID;
    status: ApplicationStatus;
    job?: { id: ID; title: string };
    candidate?: { id: ID; user: { id: ID; name: string; email: string } };
  };
  scheduledBy?: { id: ID; name: string };
}

export interface Notification {
  id: ID;
  userId: ID;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface Plan {
  id: ID;
  name: string;
  type: PlanType;
  priceCents: number;
  priceTndCents?: number | null;
  pricesJson?: Record<string, number> | null;
  currency: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  active: boolean;
  features: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: ID;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  provider?: string;
  orderId?: string;
  billingCountry?: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface Subscription {
  id: ID;
  ownerType: PlanType;
  planId: ID;
  provider: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
  payments: Payment[];
}

export interface CurrentSubscription {
  plan: Plan;
  subscription: Subscription | null;
}

export interface AiAnalysis {
  id: ID;
  userId: ID;
  type: AiAnalysisType;
  status: AiAnalysisStatus;
  inputReference: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  scores: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AssessmentQuestion {
  id: ID;
  prompt: string;
  type: QuestionType;
  options?: { label: string; value: string }[];
  points: number;
  order: number;
}

export interface Assessment {
  jobId?: string | null;
  id: ID;
  companyId: ID;
  title: string;
  description: string | null;
  type: 'SKILL' | 'BEHAVIORAL' | 'TECHNICAL';
  durationMinutes: number | null;
  status: AssessmentStatus;
  questions?: AssessmentQuestion[];
  _count?: { questions: number; invitations: number };
}

export interface AssessmentAttemptQuestion {
  id: ID;
  prompt: string;
  type: QuestionType;
  options?: { label: string; value: string }[];
  points: number;
  order: number;
}

export interface AssessmentAttempt {
  id: ID;
  startedAt: string;
  durationMinutes: number | null;
  questions: AssessmentAttemptQuestion[];
}

export interface AssessmentInvitation {
  id: ID;
  token?: string;
  expiresAt: string | null;
  candidate?: { id: ID; headline: string | null; user: { id: ID; name: string; email: string } };
  attempt?: { id: ID; status: string; score: number | null } | null;
}

export interface AutomationRule {
  id: ID;
  companyId: ID;
  createdById: ID;
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  conditions: Array<{ field: string; op: string; value: unknown }>;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecution {
  id: ID;
  ruleId: ID;
  triggerType: AutomationTriggerType;
  entityType: string;
  entityId: string;
  status: AutomationExecutionStatus;
  attempt: number;
  result: Record<string, unknown> | null;
  error: string | null;
  executedAt: string | null;
  createdAt: string;
  rule?: { id: ID; name: string; triggerType: AutomationTriggerType };
}

export interface AuditLog {
  id: ID;
  actorId: ID | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor?: { id: ID; name: string; email: string } | null;
}

export interface AdminUser {
  id: ID;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles?: Role[];
}

export interface AdminCompany extends Company {
  _count?: { members: number; jobs: number };
}

export interface AdminJob extends Job {
  company?: { id: ID; commercialName: string; slug: string; logoKey: string | null };
  _count?: { applications: number };
}

export interface AdminVerification {
  id: ID;
  companyId: ID;
  status: VerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  company?: { id: ID; legalName: string; commercialName: string; slug: string; registrationIdentifier: string | null };
  documents?: VerificationDocument[];
}

export interface AdminSubscription {
  id: ID;
  ownerType: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
  plan?: { id: ID; name: string; type: PlanType };
  owner?: { id: ID; name: string; email: string } | null;
}

export interface CompanyAnalytics {
  companyId: ID;
  activeJobs: number;
  totalJobs: number;
  totalApplications: number;
  applicationsLast7Days: number;
  applicationsByStatus: Record<string, number>;
  screeningRate: number;
  interviewRate: number;
  offerRate: number;
  hireRate: number;
  hires: number;
  avgTimeToHireDays: number | null;
  interviewsScheduled: number;
}

export interface PlatformAnalytics {
  users: number;
  candidates: number;
  companies: number;
  verifiedCompanies: number;
  jobs: number;
  applications: number;
  hires: number;
  activeSubscriptions: number;
  revenueByCurrencyCents: Record<string, number>;
  aiUsage: Record<string, number>;
}

