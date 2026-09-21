import { api } from './client';
import { qs } from './client';
import type { components } from './schema';
import type { Job, Paginated } from '@/types/api';

type CreateJobDto = components['schemas']['CreateJobDto'];
type UpdateJobDto = components['schemas']['UpdateJobDto'];

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
  companyJobs: (companyId: string, params: { status?: string; page?: number; limit?: number } = {}) =>
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
};
