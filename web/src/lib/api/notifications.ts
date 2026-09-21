import { api } from './client';
import { qs } from './client';
import type { Notification, Paginated } from '@/types/api';

export const notificationsApi = {
  mine: (params: { page?: number; limit?: number; unreadOnly?: boolean; companyId?: string } = {}) =>
    api.get<Paginated<Notification>>(`/notifications/me${qs(params)}`),
  read: (id: string) => api.patch<{ success: boolean }>(`/notifications/me/${id}/read`, {}),
  readAll: (companyId?: string) => api.patch<{ count: number }>(`/notifications/me/read-all${qs({ companyId })}`, {}),
  remove: (id: string) => api.delete<{ success: boolean }>(`/notifications/me/${id}`),
};
