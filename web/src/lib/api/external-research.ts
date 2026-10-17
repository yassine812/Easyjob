import { api, qs } from './client';

export type PublicResearchStatus = 'COMPLETED' | 'CACHED' | 'QUEUED' | 'DISABLED' | 'UNAVAILABLE';
export interface PublicResearchSource { source_url: string; type: 'web' | 'github' | 'rss'; provider?: string; fetched_at?: string; title?: string; snippet?: string; normalized_fact?: string; }
export interface PublicResearchResult {
  company_name?: string | null;
  website?: string | null;
  summary?: string | null;
  products?: string[];
  technologies?: string[];
  public_repositories?: Array<{ name: string; url: string; description?: string | null }>;
  sources?: PublicResearchSource[];
  status: PublicResearchStatus;
  fetched_at?: string;
  error?: string;
}

const root = (companyId: string) => `/companies/${companyId}/research`;

export const externalResearchApi = {
  company: (companyId: string) => api.get<PublicResearchResult>(root(companyId)),
  enqueueCompany: (companyId: string) => api.post<{ status: 'QUEUED' | 'DISABLED'; jobId?: string }>(root(companyId)),
  jobContext: (companyId: string, input: { title: string; seniority?: string; technologies?: string[] }) => api.get<PublicResearchResult>(`${root(companyId)}/job-context${qs({ title: input.title, seniority: input.seniority, technologies: input.technologies?.join(',') })}`),
  enqueueJobContext: (companyId: string, input: { title: string; seniority?: string; technologies?: string[] }) => api.post<{ status: 'QUEUED' | 'DISABLED'; jobId?: string }>(`${root(companyId)}/job-context`, input),
  interview: (interviewId: string) => api.get<PublicResearchResult>(`/interviews/${interviewId}/brief/research`),
};
