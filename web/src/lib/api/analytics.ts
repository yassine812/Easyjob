import { api } from './client';
import type { CompanyAnalytics, PlatformAnalytics } from '@/types/api';

export const analyticsApi = {
  company: (companyId: string) => api.get<CompanyAnalytics>(`/analytics/company/${companyId}`),
  platform: () => api.get<PlatformAnalytics>('/platform-admin/analytics'),
};

