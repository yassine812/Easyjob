import { api } from './client';
import type { components } from './schema';
import type { Interview } from '@/types/api';

type CreateInterviewDto = Omit<components['schemas']['CreateInterviewDto'], 'type'> & { type: Interview['type']; memberIds?: string[] };
type UpdateInterviewDto = Omit<components['schemas']['UpdateInterviewDto'], 'type' | 'status'> & { type?: Interview['type']; status?: Interview['status']; memberIds?: string[] };

export const interviewsApi = {
  create: (dto: CreateInterviewDto, companyId?: string) =>
    api.post<Interview>('/interviews', dto, { headers: companyId ? { 'X-Company-Id': companyId } : undefined }),
  detail: (id: string) => api.get<Interview>(`/interviews/${id}`),
  listForApplication: (applicationId: string) =>
    api.get<Interview[]>(`/interviews/applications/${applicationId}`),
  update: (id: string, dto: UpdateInterviewDto, companyId?: string) =>
    api.patch<Interview>(`/interviews/${id}`, dto, { headers: companyId ? { 'X-Company-Id': companyId } : undefined }),
};
