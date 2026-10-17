import { PlanType } from "@prisma/client";

export type CandidatePlanDefinition = {
  name: "FREE" | "PRO" | "PREMIUM";
  displayName: string;
  priceCents: number;
  positioning: string;
  features: Record<string, boolean | number>;
  highlights: string[];
};

/**
 * Candidate plans are defined here once.  The database remains the runtime
 * source of truth, while this catalogue lets old seeded databases expose the
 * current entitlement vocabulary until they are reseeded.
 */
export const CANDIDATE_PLAN_CATALOG: Record<
  CandidatePlanDefinition["name"],
  CandidatePlanDefinition
> = {
  FREE: {
    name: "FREE",
    displayName: "EasyJob Start",
    priceCents: 0,
    positioning: "Start your job search with the essentials.",
    features: {
      job_search: true,
      tracking: true,
      cv_import: true,
      cv_limit: 3,
      "cv.uploads": 3,
      basic_ats: true,
      "ats.basic": true,
      advanced_ats: false,
      cv_tailoring: false,
      "ai.cv_tailor": false,
      "career.builder": false,
      detailed_matching: false,
      "career.match": false,
      interview_preparation: false,
      coding_interview: false,
      adaptive_interview: false,
      auto_apply: false,
      "career.auto_apply": false,
      advanced_analytics: false,
      application_analytics: false,
      email_alerts: false,
      "career.alerts": false,
      "ai.cv_analyze": true,
      "ai.cv_generate": false,
      "ai.match": false,
      "ai.cover_letter": false,
      "ai.interview": false,
      "career.coach": false,
      "career.vision": false,
      applications: 10000,
    },
    highlights: [
      "Job search and filters",
      "Application tracking",
      "CV versions · 3",
      "Basic ATS diagnostics",
    ],
  },
  PRO: {
    name: "PRO",
    displayName: "EasyJob Boost",
    priceCents: 4900,
    positioning: "Tailor your CV and prepare for every opportunity.",
    features: {
      job_search: true,
      tracking: true,
      cv_import: true,
      cv_limit: 20,
      "cv.uploads": 20,
      basic_ats: true,
      "ats.basic": true,
      advanced_ats: true,
      cv_tailoring: true,
      "ai.cv_tailor": true,
      "career.builder": true,
      detailed_matching: true,
      "career.match": true,
      interview_preparation: true,
      coding_interview: false,
      auto_apply: false,
      "career.auto_apply": false,
      advanced_analytics: true,
      application_analytics: true,
      email_alerts: true,
      "career.alerts": true,
      "ai.cv_analyze": true,
      "ai.cv_generate": true,
      "ai.match": true,
      "ai.cover_letter": true,
      "ai.interview": true,
      // Technical interview preparation is available from EasyJob Boost. EasyJob Max adds
      // coding and adaptive sessions through the dedicated keys below.
      "career.coach": true,
      "career.vision": false,
      adaptive_interview: false,
      applications: 100000,
    },
    highlights: [
      "Job search and filters",
      "Application tracking",
      "CV versions · 20",
      "Basic ATS diagnostics",
      "Advanced ATS analysis",
      "Job-specific CV tailoring",
      "Detailed CV ↔ job matching",
      "Technical interview preparation",
      "Application insights and analytics",
      "Email alerts",
    ],
  },
  PREMIUM: {
    name: "PREMIUM",
    displayName: "EasyJob Max",
    priceCents: 7900,
    positioning: "Automate and accelerate your job search.",
    features: {
      job_search: true,
      tracking: true,
      cv_import: true,
      cv_limit: 50,
      "cv.uploads": 50,
      basic_ats: true,
      "ats.basic": true,
      advanced_ats: true,
      cv_tailoring: true,
      "ai.cv_tailor": true,
      "career.builder": true,
      detailed_matching: true,
      "career.match": true,
      interview_preparation: true,
      coding_interview: true,
      adaptive_interview: true,
      auto_apply: true,
      "career.auto_apply": true,
      advanced_analytics: true,
      application_analytics: true,
      email_alerts: true,
      "career.alerts": true,
      "ai.cv_analyze": true,
      "ai.cv_generate": true,
      "ai.match": true,
      "ai.cover_letter": true,
      "ai.interview": true,
      "career.coach": true,
      "career.vision": true,
      "career.auto_apply.daily_limit": 10,
      "career.auto_apply.weekly_limit": 50,
      applications: 100000,
    },
    highlights: [
      "Job search and filters",
      "Application tracking",
      "CV versions · 50",
      "Basic ATS diagnostics",
      "Advanced ATS analysis",
      "Job-specific CV tailoring",
      "Detailed CV ↔ job matching",
      "Technical interview preparation",
      "Application insights and analytics",
      "Email alerts",
      "Auto Apply",
      "Coding interview preparation",
      "Adaptive interview sessions",
    ],
  },
};

export function candidatePlanDefinition(
  name: string,
): CandidatePlanDefinition | undefined {
  const normalized = name === "CAREER_AI" ? "PREMIUM" : name;
  return CANDIDATE_PLAN_CATALOG[normalized as CandidatePlanDefinition["name"]];
}

export function candidatePlanDisplayName(name: string): string {
  return candidatePlanDefinition(name)?.displayName ?? name;
}

export function mergePlanFeatures(
  type: PlanType,
  name: string,
  persisted: unknown,
): Record<string, boolean | number> {
  const stored = (
    persisted && typeof persisted === "object" ? persisted : {}
  ) as Record<string, boolean | number>;
  if (type === PlanType.COMPANY) {
    return { ...stored, ...(companyPlanDefinition(name)?.features ?? {}) };
  }
  // Candidate entitlements are product policy, so the catalogue wins over
  // stale legacy JSON (for example old Pro rows with coach=false).
  return { ...stored, ...(candidatePlanDefinition(name)?.features ?? {}) };
}

/** Commercial company policy: shared by seed, billing, checkout and enforcement.
 * TRIAL is the persisted name of the public Starter plan. Custom plans retain DB policy.
 * Meetings, calendar and interview briefs are role/configuration gated, not paid entitlements.
 */
export type CompanyPlanName = "TRIAL" | "BUSINESS" | "PRO" | "ENTERPRISE";
function companyFeatures(
  jobs: number,
  seats: number,
  analyses: number,
  advancedPermissions = false,
  intelligence = false,
) {
  const paid = analyses > 0;
  return {
    activeJobs: jobs,
    "team.members": seats,
    "ai.analyses.monthly": analyses,
    "ai.enabled": paid,
    "automation.enabled": paid,
    "assessments.enabled": paid,
    "analytics.enabled": paid,
    "interviews.enabled": paid,
    "advanced.search": paid,
    "advanced.permissions": advancedPermissions,
    "audit.logs": intelligence,
    "billing.manage": true,
    recruitment_intelligence: intelligence,
    smart_job_creation: intelligence,
  };
}
export const COMPANY_PLAN_CATALOG = {
  TRIAL: {
    name: "TRIAL",
    displayName: "EasyJob Starter",
    priceCents: 0,
    positioning: "positioning.TRIAL",
    highlights: [],
    features: companyFeatures(3, 5, 0),
  },
  BUSINESS: {
    name: "BUSINESS",
    displayName: "EasyJob Business",
    priceCents: 14900,
    positioning: "positioning.BUSINESS",
    highlights: [],
    features: companyFeatures(20, 20, 100),
  },
  PRO: {
    name: "PRO",
    displayName: "EasyJob Pro",
    priceCents: 29900,
    positioning: "positioning.PRO",
    highlights: [],
    features: companyFeatures(50, 50, 1000, true),
  },
  ENTERPRISE: {
    name: "ENTERPRISE",
    displayName: "EasyJob Enterprise",
    priceCents: 49900,
    positioning: "positioning.ENTERPRISE",
    highlights: [],
    features: companyFeatures(200, 1000, 10000, true, true),
  },
} as const;
export function companyPlanDefinition(name: string) {
  return COMPANY_PLAN_CATALOG[name as CompanyPlanName];
}
export function planDefinition(type: PlanType, name: string) {
  return type === PlanType.COMPANY
    ? companyPlanDefinition(name)
    : candidatePlanDefinition(name);
}
