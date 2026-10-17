import type { JobSourceType } from '@prisma/client';

export type JobSourceStatus =
  | 'ACTIVE'
  | 'AUTHORIZATION_REQUIRED'
  | 'PARTNER_REQUIRED'
  | 'CONFIGURATION_REQUIRED'
  | 'UNAUTHORIZED'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'ERROR'
  | 'DISABLED'
  | 'INTEGRATION_REQUIRED';

export interface JobSourceHealth {
  status: JobSourceStatus;
  detail: string | null;
}

export interface ExternalJobSearchInput {
  keyword?: string;
  location?: string;
  company?: string;
  domain?: string;
  contractType?: string;
  workMode?: string;
  employmentType?: string;
  experienceLevel?: string;
  publishedWithin?: number;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  skills?: string;
  sourceType?: JobSourceType;
  sort?: string;
  page?: number;
  limit?: number;
  companySearch?: boolean;
}

export interface ExternalJobListing {
  id: string;
  title: string;
  companyName: string | null;
  companyLogoUrl?: string | null;
  location: string | null;
  description: string;
  salaryText: string | null;
  employmentType: string | null;
  sourceLabel: string;
  url: string;
  sourceUpdatedAt: Date | null;
  publishedAt?: Date | null;
  closingAt?: Date | null;
  requirements?: string[];
  skills?: string[];
  experienceLevel?: string | null;
  workplaceType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  reference?: string | null;
  companyWebsite?: string | null;
  companyIndustry?: string | null;
  companyLocation?: string | null;
  responsibilities?: string[];
  niceToHave?: string[];
  benefits?: string[];
  languages?: string[];
  education?: string[];
  experienceMin?: number | null;
  experienceMax?: number | null;
  contractType?: string | null;
  contractDuration?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  salaryPeriod?: string | null;
  positions?: number | null;
  status?: 'OPEN' | 'CLOSED' | 'EXPIRED' | 'PAUSED' | 'REMOVED';
  applicationUrl?: string | null;
  applicationFields?: ApplicationField[];
  rawMetadata?: Record<string, unknown>;
}

export interface ApplicationField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'url' | 'boolean' | 'select' | 'multiselect' | 'number' | 'date' | 'file';
  required: boolean;
  options?: string[];
}

export type ApplicationCapability = 'NATIVE_EASY_APPLY' | 'SOURCE_API_APPLY' | 'EMAIL_APPLY' | 'EXTERNAL_ONLY' | 'UNAVAILABLE';

export interface ExternalJobSearchResult {
  jobs: ExternalJobListing[];
  total: number;
  /** Only an explicit complete snapshot may reconcile missing records. */
  complete?: boolean;
  rejected?: number;
}

export interface JobSourceAdapter {
  readonly type: JobSourceType;
  readonly name: string;
  readonly syncIntervalMs: number;
  isConfigured(): boolean;
  healthCheck(): Promise<JobSourceHealth>;
  fetchJobs(): Promise<ExternalJobSearchResult>;
  getSourceInfo?(): { evidenceUrl: string; integrationStatus: string; method: string };
  authenticate?(): Promise<JobSourceHealth>;
  fetchJobDetails?(externalId: string): Promise<ExternalJobListing | null>;
  normalizeJob?(raw: unknown): ExternalJobListing | null;
  getCompany?(job: ExternalJobListing): { name: string | null; website: string | null };
  getCompanyLogo?(job: ExternalJobListing): string | null;
  getApplicationCapabilities?(job?: ExternalJobListing): { method: ApplicationCapability; verified: boolean; reason: string };
  submitApplication?(): Promise<never>;
}
