import { api } from './client';
import { qs } from './client';
import type { components } from './schema';
import type { Application, ApplicationEvent, ApplicationNote, Job, Paginated } from '@/types/api';

export interface ApplicationJobSummary extends Pick<Job, 'id' | 'title' | 'domain' | 'location' | 'employmentType' | 'status' | 'publishedAt' | 'createdAt'> {
  applications: number; newApplications: number; shortlisted: number; strongMatches: number;
  averageMatch: number | null; averageAts: number | null;
}

type ApplyDto = components['schemas']['ApplyDto'];
type UpdateApplicationStatusDto = components['schemas']['UpdateApplicationStatusDto'];
type AddApplicationNoteDto = components['schemas']['AddApplicationNoteDto'];

export const applicationsApi = {
  jobSummaries: (companyId: string, params: { page?: number; limit?: number; search?: string } = {}) => api.get<Paginated<ApplicationJobSummary>>(`/companies/${companyId}/application-jobs${qs(params)}`),
  apply: (jobId: string, dto: ApplyDto) => api.post<Application>(`/jobs/${jobId}/apply`, dto),
  mine: (params: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<Paginated<Application>>(`/applications/me${qs(params)}`),
  companyList: (
    companyId: string,
    params: { page?: number; limit?: number; status?: string; jobId?: string; search?: string; minimumMatch?: number; sort?: string } = {},
  ) => api.get<Paginated<Application>>(`/companies/${companyId}/applications${qs(params)}`),
  detail: (id: string) => api.get<Application>(`/applications/${id}`),
  updateStatus: (id: string, dto: Omit<UpdateApplicationStatusDto, 'newStatus'> & { newStatus: import('@/types/api').ApplicationStatus; source?: string }) =>
    api.patch<{ id: string; status: string }>(`/applications/${id}/status`, dto),
  events: (id: string) => api.get<ApplicationEvent[]>(`/applications/${id}/events`),
  notes: (id: string) => api.get<ApplicationNote[]>(`/applications/${id}/notes`),
  addNote: (id: string, dto: AddApplicationNoteDto) =>
    api.post<ApplicationNote>(`/applications/${id}/notes`, dto),
  /** Company-side CV download (signed URL; every access is audit-logged). */
  cvUrl: (id: string) => api.get<{ url: string; filename: string }>(`/applications/${id}/cv`),
  rankCandidates: (companyId: string, jobId: string) =>
    api.get<
      Array<{
        rank: number;
        applicationId: string;
        candidateName: string;
        candidateEmail: string;
        aiMatchScore: number;
        atsScore: number;
        aiRecommendation: string;
        potentialScore: string;
        potentialReason: string;
        summary: string;
        status: string;
      }>
    >(`/companies/${companyId}/jobs/${jobId}/ai-rank`),
};
