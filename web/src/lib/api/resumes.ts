import { api } from './client';
import type { Resume } from '@/types/api';
import { env } from '@/config/env';

export function resolveResumeUrl(url: string) {
  // Local storage signs an API-root-relative path; resolve it on the API host.
  return new URL(url, env.apiUrl).href;
}

export const resumesApi = {
  rename: (id: string, name: string) => api.patch<Resume>(`/candidates/me/resumes/${id}`, { name }),
  uploadPolicy: () => api.get<{ maxBytes: number }>('/candidates/me/resumes/upload-policy'),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Resume>('/candidates/me/resumes', undefined, { body: form });
  },
  list: () => api.get<Resume[]>('/candidates/me/resumes'),
  versions: (id: string) => api.get<{ id: string; logicalCvId: string; version: number; current: boolean; createdAt: string; filename: string; score: number | null }[]>(`/candidates/me/resumes/${id}/versions`),
  duplicate: (id: string) => api.post<Resume>(`/candidates/me/resumes/${id}/duplicate`, {}),
  restore: (id: string, versionId: string) => api.post<Resume>(`/candidates/me/resumes/${id}/versions/${versionId}/restore`, {}),
  setPrimary: (id: string) =>
    api.post<{ success: boolean }>(`/candidates/me/resumes/${id}/primary`, {}),
  remove: (id: string) => api.delete<{ success: boolean }>(`/candidates/me/resumes/${id}`),
  /** Returns a signed URL — treat it as a bearer token, never log/cache it. */
  downloadUrl: async (id: string) => {
    const file = await api.get<{ url: string; filename: string }>(`/candidates/me/resumes/${id}/download`);
    return { ...file, url: resolveResumeUrl(file.url) };
  },
};
