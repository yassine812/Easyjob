import type {
  ApplicationStatus,
  ExperienceLevel,
  EmploymentType,
  InterviewStatus,
  InterviewType,
  JobStatus,
  SkillLevel,
  VerificationStatus,
  ProcessingStatus,
  SubscriptionStatus,
  AssessmentStatus,
  CompanyStatus,
} from '@/types/api';

export const PIPELINE_ORDER: ApplicationStatus[] = [
  'APPLIED',
  'SCREENING',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'HIRED',
];

export const TERMINAL_STATUSES: ApplicationStatus[] = ['HIRED', 'REJECTED', 'WITHDRAWN'];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  PAUSED: 'Paused',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  EXPIRED: 'Expired',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  UNDER_REVIEW: 'Under review',
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  SHORTLISTED: 'Shortlisted',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Employment offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  FREELANCE: 'Freelance',
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  JUNIOR: 'Junior',
  MID: 'Mid-level',
  SENIOR: 'Senior',
  LEAD: 'Lead',
  EXECUTIVE: 'Executive',
};

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  HR: 'HR', BEHAVIORAL: 'Behavioral', MANAGERIAL: 'Managerial', AI: 'AI Interview', FINAL: 'Final',
  PHONE: 'Phone',
  VIDEO: 'Video',
  ONSITE: 'On-site',
  TECHNICAL: 'Technical',
};

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  IN_PROGRESS: 'In progress',
  NO_SHOW: 'No-show',
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  PENDING_VERIFICATION: 'Pending verification',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
};

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  PENDING: 'Queued',
  PROCESSING: 'Processing',
  COMPLETED: 'Ready',
  FAILED: 'Failed',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  PENDING: 'Pending',
  TRIALING: 'Trial',
  ACTIVE: 'Active',
  PAST_DUE: 'Past due',
  CANCELED: 'Canceled',
  EXPIRED: 'Expired',
};

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

export const MEMBER_ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: 'Company admin',
  HR: 'HR',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring manager',
  INTERVIEWER: 'Interviewer',
  CANDIDATE: 'Candidate',
  PLATFORM_ADMIN: 'Platform admin',
  SUPER_ADMIN: 'Super admin',
  OPERATIONS_ADMIN: 'Operations admin',
  BILLING_ADMIN: 'Billing admin',
  SUPPORT_ADMIN: 'Support admin',
  READ_ONLY_ADMIN: 'Read-only admin',
};

export const AI_TYPE_LABELS: Record<string, string> = {
  CV_ANALYZE: 'CV analysis',
  CV_GENERATE: 'CV generation',
  CV_TAILOR: 'CV tailoring',
  JOB_ANALYZE: 'Job analysis',
  MATCH: 'Job matching',
  COVER_LETTER: 'Cover letter',
  INTERVIEW: 'Interview questions',
};

/** Badge variant per status (shadcn badge variants). */
export function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' {
  switch (status) {
    case 'ACTIVE':
    case 'VERIFIED':
    case 'COMPLETED':
    case 'HIRED':
    case 'PUBLISHED':
    case 'APPROVED':
    case 'CONFIRMED':
      return 'success';
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'PENDING_VERIFICATION':
    case 'UNDER_REVIEW':
    case 'PROCESSING':
    case 'SCHEDULED':
    case 'TRIALING':
    case 'DRAFT':
    case 'ASSESSMENT':
    case 'INTERVIEW':
      return 'warning';
    case 'REJECTED':
    case 'FAILED':
    case 'SUSPENDED':
    case 'PAST_DUE':
    case 'CANCELLED':
    case 'CLOSED':
    case 'EXPIRED':
    case 'WITHDRAWN':
      return 'destructive';
    default:
      return 'secondary';
  }
}
