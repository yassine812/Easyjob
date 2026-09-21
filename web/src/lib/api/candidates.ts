import { api } from './client';
import type { components } from './schema';
import type {
  CandidateProfile,
  Education,
  Experience,
  JobPreference,
  SavedJob,
  SkillLevel,
} from '@/types/api';

type UpdateCandidateProfileDto = components['schemas']['UpdateCandidateProfileDto'];
type AddSkillDto = components['schemas']['AddSkillDto'];
type ExperienceDto = components['schemas']['ExperienceDto'];
type EducationDto = components['schemas']['EducationDto'];
type SaveJobDto = components['schemas']['SaveJobDto'];
type JobPreferenceDto = components['schemas']['JobPreferenceDto'];

export interface AddSkillResult {
  skillId: string;
  name: string;
  level: SkillLevel;
}

export const candidatesApi = {
  me: () => api.get<CandidateProfile>('/candidates/me'),
  updateMe: (dto: UpdateCandidateProfileDto) => api.patch<CandidateProfile>('/candidates/me', dto),
  /** Saves a JPEG/PNG/WebP profile photo for the current candidate. */
  uploadPhoto: (file: Blob) => {
    const body = new FormData();
    body.append('file', file, 'profile-photo.jpg');
    return api.post<{ url: string }>('/candidates/me/photo', undefined, { body });
  },
  addSkill: (dto: AddSkillDto) => api.post<AddSkillResult>('/candidates/me/skills', dto),
  removeSkill: (skillId: string) => api.delete<{ success: boolean }>(`/candidates/me/skills/${skillId}`),
  addExperience: (dto: ExperienceDto) => api.post<Experience>('/candidates/me/experiences', dto),
  updateExperience: (id: string, dto: ExperienceDto) =>
    api.patch<Experience>(`/candidates/me/experiences/${id}`, dto),
  deleteExperience: (id: string) =>
    api.delete<{ success: boolean }>(`/candidates/me/experiences/${id}`),
  addEducation: (dto: EducationDto) => api.post<Education>('/candidates/me/education', dto),
  updateEducation: (id: string, dto: EducationDto) =>
    api.patch<Education>(`/candidates/me/education/${id}`, dto),
  deleteEducation: (id: string) => api.delete<{ success: boolean }>(`/candidates/me/education/${id}`),
  saveJob: (dto: SaveJobDto) => api.post<{ success: boolean }>('/candidates/me/saved-jobs', dto),
  savedJobs: () => api.get<SavedJob[]>('/candidates/me/saved-jobs'),
  removeSavedJob: (jobId: string) =>
    api.delete<{ success: boolean }>(`/candidates/me/saved-jobs/${jobId}`),
  jobPreferences: () => api.get<JobPreference | null>('/candidates/me/job-preferences'),
  updateJobPreferences: (dto: JobPreferenceDto) =>
    api.put<JobPreference>('/candidates/me/job-preferences', dto),
  /** Company-side candidate profile view (requires X-Company-Id context). */
  viewAsCompany: (profileId: string, companyId: string) =>
    api.get<CandidateProfile>(`/candidates/${profileId}`, {
      headers: { 'X-Company-Id': companyId },
    }),
};
