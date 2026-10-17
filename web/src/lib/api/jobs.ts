import { api } from './client';
import { qs } from './client';
import type { components } from './schema';
import type { Job, Paginated } from '@/types/api';

type ClearableJobFields = { salaryVisible?: boolean; salaryMin?: number | null; salaryMax?: number | null; minimumYearsExperience?: number | null; expiresAt?: string | null };
type CreateJobDto = Omit<components['schemas']['CreateJobDto'], keyof ClearableJobFields> & ClearableJobFields;
type UpdateJobDto = Omit<components['schemas']['UpdateJobDto'], keyof ClearableJobFields> & ClearableJobFields;

export interface JobTitleSuggestion { id: string; label: string; }
export interface JobSuggestionInput {
  roleId: string; seniority: string; workMode: string; location?: string;
  employmentType?: string; contractType?: string; skills?: string[]; locale?: string;
}
export interface JobAutofillDraft {
  title: string; description: string; responsibilities: string[]; requirements: string[];
  preferredSkills: string[]; skills: Array<{ name: string; required: boolean; level: string }>;
  experienceLevel: string; minimumYearsExperience: number; employmentType: string; workMode: string;
  remote: boolean; location: string; currency: string; educationRequirement: string;
  descriptions: Array<{ id: 'professional' | 'concise' | 'technical'; text: string }>;
  skillLabels?: Record<string, string>;
  profileRequirements?: string[];
  workingConditions?: { location: string; workMode: string; employmentType: string; contractType: string; industry: string };
  externalResearch?: { status: 'QUEUED' | 'DISABLED'; label: string };
}

export interface JobSearchParams {
  keyword?: string;
  location?: string;
  remote?: boolean | string;
  employmentType?: string;
  experienceLevel?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string;
  companySlug?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface JobStatusResponse {
  id: string;
  status: string;
  publishedAt?: string | null;
}

export const jobsApi = {
  search: (params: JobSearchParams = {}) => api.get<Paginated<Job>>(`/jobs${qs(params)}`, { auth: false }),
  detail: (id: string) => api.get<Job>(`/jobs/${id}`, { auth: false }),
  managed: (id: string) => api.get<Job>(`/jobs/managed/${id}`),
  pause: (id: string) => api.post<JobStatusResponse>(`/jobs/${id}/pause`),
  duplicate: (id: string) => api.post<Job>(`/jobs/${id}/duplicate`),
  companyJobs: (companyId: string, params: { status?: string; page?: number; limit?: number; search?: string; workMode?: string; employmentType?: string; sort?: string } = {}) =>
    api.get<Paginated<Job>>(`/jobs/company/${companyId}${qs(params)}`),
  create: (dto: CreateJobDto, companyId?: string) =>
    api.post<Job>('/jobs', dto, { headers: companyId ? { 'X-Company-Id': companyId } : undefined }),
  update: (id: string, dto: UpdateJobDto, companyId?: string) =>
    api.patch<Job>(`/jobs/${id}`, dto, { headers: companyId ? { 'X-Company-Id': companyId } : undefined }),
  submit: (id: string, companyId?: string) =>
    api.post<JobStatusResponse>(`/jobs/${id}/submit`, {}, { headers: companyId ? { 'X-Company-Id': companyId } : undefined }),
  publish: (id: string, companyId?: string) =>
    api.post<JobStatusResponse>(`/jobs/${id}/publish`, {}, { headers: companyId ? { 'X-Company-Id': companyId } : undefined }),
  close: (id: string, companyId?: string) =>
    api.post<JobStatusResponse>(`/jobs/${id}/close`, {}, { headers: companyId ? { 'X-Company-Id': companyId } : undefined }),
  remove: (id: string, companyId?: string) =>
    api.delete<{ success: boolean }>(`/jobs/${id}`, { headers: companyId ? { 'X-Company-Id': companyId } : undefined }),
  titleSuggestions: (q: string) => api.get<JobTitleSuggestion[]>(`/jobs/title-suggestions${qs({ q })}`),
  autofill: (body: JobSuggestionInput, companyId: string) =>
    api.post<JobAutofillDraft>('/jobs/autofill', body, { headers: { 'X-Company-Id': companyId } }),
};
