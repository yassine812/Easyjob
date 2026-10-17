export type ResearchQueryType = 'company' | 'job_context' | 'technology' | 'interview_context';
export const RESEARCH_PROVIDER = Symbol('EXTERNAL_RESEARCH_PROVIDER');
export type ResearchSourceType = 'web' | 'github' | 'rss';
export type ResearchStatus = 'COMPLETED' | 'DISABLED' | 'UNAVAILABLE' | 'QUEUED' | 'CACHED';

export interface ResearchSource {
  source_url: string;
  type: ResearchSourceType;
  provider: string;
  fetched_at: string;
  title?: string;
  snippet?: string;
  normalized_fact?: string;
}

export interface ExternalResearchResult {
  company_name: string | null;
  website: string | null;
  summary: string | null;
  products: string[];
  technologies: string[];
  public_repositories: Array<{ name: string; url: string; description?: string | null }>;
  sources: ResearchSource[];
  status: ResearchStatus;
  provider: string;
  query_type: ResearchQueryType;
  fetched_at: string;
  error?: string;
}

export interface CompanyResearchInput {
  companyName: string;
  website?: string | null;
  publicDomains?: string[];
  rssUrls?: string[];
}

export interface JobResearchInput {
  companyName: string;
  website?: string | null;
  title: string;
  seniority?: string | null;
  technologies?: string[];
}

export interface ExternalResearchProvider {
  doctor(): Promise<{ ok: boolean; version?: string; detail?: string }>;
  researchCompany(input: CompanyResearchInput): Promise<ExternalResearchResult>;
  researchJobContext(input: JobResearchInput): Promise<ExternalResearchResult>;
  researchTechnology(technology: string): Promise<ExternalResearchResult>;
}

/** Backward-compatible short alias used by the module token wiring. */
export type ResearchProvider = ExternalResearchProvider;
