import { api } from './client';
import { qs } from './client';
import type { AiAnalysis, Paginated } from '@/types/api';

export const aiApi = {
  analyzeCv: (resumeId: string) => api.post<{ analysisId: string }>('/ai/cv/analyze', { resumeId }),
  generateCv: () => api.post<{ analysisId: string }>('/ai/cv/generate', {}),
  match: (jobId: string) => api.post<{ analysisId: string }>('/ai/match', { jobId }),
  coverLetter: (jobId: string) => api.post<{ analysisId: string }>('/ai/cover-letter', { jobId }),
  interview: (jobId: string) => api.post<{ analysisId: string }>('/ai/interview', { jobId }),
  analyses: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<AiAnalysis>>(`/ai/analyses${qs(params)}`),
  analysis: (id: string) => api.get<AiAnalysis>(`/ai/analyses/${id}`),
};
