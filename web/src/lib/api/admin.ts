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

export interface AdminJobSource {
  info?: { evidenceUrl: string; integrationStatus: string; method: string } | null;
  application?: { method: string; verified: boolean; reason: string };
  lastFailureAt?: string | null; lastErrorCode?: string | null; lastHttpStatus?: number | null; lastDurationMs?: number | null;
  lastImported?: number; lastUpdated?: number; lastExpired?: number; lastRejected?: number; lastDuplicates?: number;

  type: string;
  name: string;
  status: string;
  detail: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  listingCount: number;
  activeJobs: number;
  closedJobs: number;
}

export interface PlatformAdminInvoice {
  id: string;
  provider: string;
  providerPaymentId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  invoiceUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  invoice: { number: string; status: string; pdfUrl: string | null; docxUrl: string | null } | null;
  subscription: { ownerType: 'COMPANY' | 'CANDIDATE'; company: { id: string; commercialName: string } | null; candidate: { user: { name: string; email: string } } | null; plan: { name: string } | null };
}

export interface PlatformAdminPlan {
  id: string;
  name: string;
  type: 'COMPANY' | 'CANDIDATE';
  priceCents: number;
  priceTndCents: number | null;
  currency: string;
  billingInterval: string;
  active: boolean;
  features: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: { subscriptions: number };
}

export interface PlatformAdminNotification { id: string; type: string; title: string; message: string | null; readAt: string | null; createdAt: string; user: { id: string; name: string; email: string }; data?: unknown; }

export interface PlatformAdminDashboard {
  metrics: { activeCompanies: number; newCompanies: number; previousNewCompanies?: number; activeUsers?: number; activeCandidates: number; activeJobs: number; paidSubscriptions: number; openTickets: number; pendingCompanies: number; failedPayments: number; failedJobs?: number; expiringUnder7Days?: number; expiringUnder30Days?: number };
  financial: { available: boolean; message?: string; mrrByCurrencyCents?: Record<string, number>; periodRevenueByCurrencyCents?: Record<string, number>; mode?: string };
  actionCenter: { failedPayments: number; pendingCompanies: number; urgentTickets: number; failedJobs?: number; expiringUnder7Days?: number };
  growth?: Array<{ period: string; companies: number; candidates: number; jobs: number }>;
  planDistribution?: Array<{ name: string; count: number; percentage: number }>;
  candidatePlanDistribution?: Array<{ name: string; count: number; percentage: number }>;
  recentCompanies: Array<{ id: string; commercialName: string; status: string; createdAt: string; members?: number; jobs?: number; plan?: string | null }>;
  recentActivity?: Array<{ id: string; action: string; entityType: string; entityId: string | null; createdAt: string; actorName: string | null }>;
}

export interface AdminCompanyDetail {
  id: string; legalName: string; commercialName: string; status: string; createdAt: string;
  _count?: { members: number; jobs: number };
  applications?: number; interviews?: number;
  members: Array<{ id: string; isOwner: boolean; role: string; user: { name: string; email: string } }>;
  subscriptions: Array<{ id: string; provider: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; canceledAt: string | null; remainingDays: number | null; autoRenew: boolean; plan: { id: string; name: string; priceCents: number; currency: string; billingInterval: string } | null; payments: Array<{ id: string; provider: string; providerPaymentId: string | null; amountCents: number; currency: string; status: string; createdAt: string; paidAt: string | null; invoiceUrl: string | null; docxUrl: string | null; invoiceNumber: string | null }> }>;
}

export interface PlatformAdminCandidate {
  id: string; name: string; email: string; plan: { id: string; name: string; type: 'CANDIDATE'; priceCents: number; currency: string; billingInterval: string } | null;
  subscriptionStatus: string | null; renewalAt: string | null; expiresAt: string | null; daysRemaining: number | null;
  accountStatus: string; createdAt: string; lastActivityAt: string | null;
  subscription?: { id: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; canceledAt: string | null; plan: PlatformAdminCandidate['plan'] } | null;
}

export interface PlatformAdminCandidateDetail extends PlatformAdminCandidate {
  phone: string | null;
  candidateProfile: { headline: string | null; bio: string | null; location: string | null; yearsExperience: number | null; applications: number; resumes: number } | null;
  subscriptions: Array<{ id: string; provider: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; canceledAt: string | null; createdAt: string; remainingDays: number | null; autoRenew: boolean; plan: PlatformAdminCandidate['plan']; payments: Array<{ id: string; providerPaymentId: string | null; amountCents: number; currency: string; status: string; createdAt: string; paidAt: string | null; invoiceUrl: string | null }> }>;
  activity: { createdAt: string; action: string } | null;
}

export const adminApi = {
  candidates: (params: { page?: number; limit?: number; status?: string; search?: string } = {}) =>
    api.get<Paginated<PlatformAdminCandidate>>(`/platform-admin/candidates${qs(params)}`),
  candidate: (id: string) => api.get<PlatformAdminCandidateDetail>(`/platform-admin/candidates/${id}`),
  companies: (params: { page?: number; limit?: number; status?: string; search?: string } = {}) =>
    api.get<Paginated<AdminCompany>>(`/platform-admin/companies${qs(params)}`),
  jobs: (params: { page?: number; limit?: number; status?: string; search?: string } = {}) =>
    api.get<Paginated<AdminJob>>(`/platform-admin/jobs${qs(params)}`),
  jobSources: () => api.get<AdminJobSource[]>('/platform-admin/job-sources'),
  approveJob: (id: string) => api.post<{ id: string; status: string }>(`/platform-admin/jobs/${id}/approve`, {}),
  rejectJob: (id: string, reason: string) =>
    api.post<{ id: string; status: string }>(`/platform-admin/jobs/${id}/reject`, { reason }),
  verifications: (params: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<Paginated<AdminVerification>>(`/platform-admin/verifications${qs(params)}`),
  verification: (id: string) => api.get<AdminVerification>(`/platform-admin/verifications/${id}`),
  approveVerification: (id: string) =>
    api.post<{ success: boolean }>(`/platform-admin/verifications/${id}/approve`, {}),
  rejectVerification: (id: string, reason: string) =>
    api.post<{ success: boolean }>(`/platform-admin/verifications/${id}/reject`, { reason }),
  subscriptions: (params: { page?: number; limit?: number; ownerType?: 'COMPANY' | 'CANDIDATE'; status?: string; expiring?: '7' | '30' } = {}) =>
    api.get<Paginated<AdminSubscription>>(`/platform-admin/subscriptions${qs(params)}`),
  extendSubscription: (id: string, days: number, reason: string) => api.post(`/platform-admin/subscriptions/${id}/extend`, { days, reason }),
  updateSubscription: (id: string, input: { planId?: string; action?: 'cancel' | 'reactivate' }) => api.patch(`/platform-admin/subscriptions/${id}`, input),
  auditLogs: (params: { page?: number; limit?: number; action?: string; entityType?: string; actorId?: string } = {}) =>
    api.get<Paginated<AuditLog>>(`/platform-admin/audit-logs${qs(params)}`),
  dashboard: () => api.get<PlatformAdminDashboard>('/platform-admin/dashboard'),
  company: (id: string) => api.get<AdminCompanyDetail>(`/platform-admin/companies/${id}`),
  updateCompanyStatus: (id: string, status: string) => api.patch(`/platform-admin/companies/${id}/status`, { status }),
  invoices: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<PlatformAdminInvoice>>(`/platform-admin/invoices${qs(params)}`),
  plans: (type?: 'COMPANY' | 'CANDIDATE') => api.get<PlatformAdminPlan[]>(`/platform-admin/plans${qs(type ? { type } : {})}`),
  updatePlanStatus: (id: string, active: boolean) => api.patch(`/platform-admin/plans/${id}/status`, { active }),
  notifications: (params: { page?: number; limit?: number; type?: string; unreadOnly?: boolean } = {}) => api.get<Paginated<PlatformAdminNotification>>(`/platform-admin/notifications${qs(params)}`),
  systemHealth: () => api.get<{ status: string; services: Record<string, unknown> }>('/platform-admin/system/health'),
};
