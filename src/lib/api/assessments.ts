import { api } from './client';
import { qs } from './client';
import type {
  Assessment,
  AssessmentAttempt,
  AssessmentInvitation,
  Paginated,
  QuestionType,
} from '@/types/api';

export interface AssessmentQuestionInput {
  prompt: string;
  type: QuestionType;
  options?: Array<{ label: string; value: string }>;
  correctAnswer?: string;
  points?: number;
  order?: number;
}

export interface CreateAssessmentInput {
  jobId?: string;
  title: string;
  description?: string;
  type: 'SKILL' | 'BEHAVIORAL' | 'TECHNICAL';
  durationMinutes?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  questions?: AssessmentQuestionInput[];
}

export interface UpdateAssessmentInput {
  jobId?: string;
  title?: string;
  description?: string;
  type?: 'SKILL' | 'BEHAVIORAL' | 'TECHNICAL';
  durationMinutes?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export interface InviteCandidateInput {
  candidateId: string;
  expiresAt?: string;
}

export interface AnswerInput {
  questionId: string;
  answer: string;
}

export interface AssessmentReview {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  answers: Array<{ questionId: string; answer: string; score: number | null; question: { prompt: string; points: number; type: QuestionType } }>;
}

export const assessmentsApi = {
  review: (id: string) => api.get<AssessmentReview>(`/assessments/attempts/${id}`),
  grade: (companyId: string, id: string, answers: Array<{ questionId: string; score: number }>) =>
    api.post<AssessmentReview>(`/companies/${companyId}/assessment-attempts/${id}/grade`, { answers }),
  // company side
  list: (companyId: string, params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Assessment>>(`/companies/${companyId}/assessments${qs(params)}`),
  detail: (companyId: string, assessmentId: string) =>
    api.get<Assessment>(`/companies/${companyId}/assessments/${assessmentId}`),
  create: (companyId: string, dto: CreateAssessmentInput) =>
    api.post<Assessment>(`/companies/${companyId}/assessments`, dto),
  update: (companyId: string, assessmentId: string, dto: UpdateAssessmentInput) =>
    api.patch<Assessment>(`/companies/${companyId}/assessments/${assessmentId}`, dto),
  remove: (companyId: string, assessmentId: string) =>
    api.delete<{ success: boolean }>(`/companies/${companyId}/assessments/${assessmentId}`),
  invitations: (companyId: string, assessmentId: string) =>
    api.get<AssessmentInvitation[]>(`/companies/${companyId}/assessments/${assessmentId}/invitations`),
  invite: (companyId: string, assessmentId: string, dto: InviteCandidateInput) =>
    api.post<AssessmentInvitation>(
      `/companies/${companyId}/assessments/${assessmentId}/invitations`,
      dto,
    ),
  // candidate side
  startAttempt: (dto: { token: string }) =>
    api.post<AssessmentAttempt>('/assessments/attempts/start', dto),
  submitAttempt: (attemptId: string, dto: { answers: AnswerInput[] }) =>
    api.post<{ attemptId: string; score: number; maxScore: number; status: string }>(
      `/assessments/attempts/${attemptId}/submit`,
      dto,
    ),
  attempt: (attemptId: string) => api.get<AssessmentAttempt>(`/assessments/attempts/${attemptId}`),
};
