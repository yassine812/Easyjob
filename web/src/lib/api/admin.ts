import { api } from './client';
import { qs } from './client';
import type {
  AdminCompany,
  AdminJob,
  AdminSubscription,
  AdminVerification,
  AuditLog,
  Paginated,
} from '@/types/api';

export const adminApi = {
  companies: (params: { page?: number; limit?: number; status?: string; search?: string } = {}) =>
    api.get<Paginated<AdminCompany>>(`/admin/companies${qs(params)}`),
  jobs: (params: { page?: number; limit?: number; status?: string; search?: string } = {}) =>
    api.get<Paginated<AdminJob>>(`/admin/jobs${qs(params)}`),
  approveJob: (id: string) => api.post<{ id: string; status: string }>(`/admin/jobs/${id}/approve`, {}),
  rejectJob: (id: string, reason: string) =>
    api.post<{ id: string; status: string }>(`/admin/jobs/${id}/reject`, { reason }),
  verifications: (params: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<Paginated<AdminVerification>>(`/admin/verifications${qs(params)}`),
  verification: (id: string) => api.get<AdminVerification>(`/admin/verifications/${id}`),
  approveVerification: (id: string) =>
    api.post<{ success: boolean }>(`/admin/verifications/${id}/approve`, {}),
  rejectVerification: (id: string, reason: string) =>
    api.post<{ success: boolean }>(`/admin/verifications/${id}/reject`, { reason }),
  subscriptions: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<AdminSubscription>>(`/admin/subscriptions${qs(params)}`),
  auditLogs: (params: { page?: number; limit?: number; action?: string; entityType?: string; actorId?: string } = {}) =>
    api.get<Paginated<AuditLog>>(`/admin/audit-logs${qs(params)}`),
};
