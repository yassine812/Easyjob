import { api, qs } from './client';

export type SupportCategory = 'ACCOUNT' | 'CV_ATS' | 'JOB_APPLICATION' | 'AUTO_APPLY' | 'INTERVIEW_PREPARATION' | 'SUBSCRIPTION_PAYMENT' | 'BUG' | 'OTHER';
export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED' | string;
export type SupportPriority = 'LOW' | 'NORMAL' | 'HIGH' | string;

export interface SupportMessage {
  id: string; senderId: string | null; senderType: 'USER' | 'SUPPORT' | 'SYSTEM' | string; message: string; isRead: boolean;
  attachment: { name: string; mime: string | null; size: number | null } | null; createdAt: string; sender?: { id: string; name: string | null } | null;
}
export interface SupportTicket {
  id: string; reference: string; ticketNumber: number; subject: string; category: SupportCategory; status: SupportStatus; priority: SupportPriority;
  lastMessageAt: string; createdAt: string; updatedAt: string; unreadCount: number;
  lastMessage: { message: string; senderType: string; createdAt: string } | null; messages?: SupportMessage[];
  user?: { id: string; name: string | null; email: string };
}

export const supportApi = {
  list: (params?: { search?: string; status?: string }) => api.get<SupportTicket[]>(`/support/tickets${qs(params ?? {})}`),
  get: (reference: string) => api.get<SupportTicket>(`/support/tickets/${encodeURIComponent(reference)}`),
  messages: (reference: string) => api.get<SupportTicket>(`/support/tickets/${encodeURIComponent(reference)}/messages`),
  create: (form: FormData) => api.post<SupportTicket>('/support/tickets', form),
  sendMessage: (reference: string, form: FormData) => api.post<SupportMessage>(`/support/tickets/${encodeURIComponent(reference)}/messages`, form),
  update: (reference: string, data: { status?: string; priority?: string }) => api.patch<SupportTicket>(`/support/tickets/${encodeURIComponent(reference)}`, data),
  attachment: (reference: string, messageId?: string) => api.get<{ url: string }>(`/support/tickets/${encodeURIComponent(reference)}/attachment${qs(messageId ? { messageId } : {})}`),
  unreadCount: () => api.get<{ count: number }>('/support/unread-count'),
  adminList: (params?: { search?: string; status?: string }) => api.get<SupportTicket[]>(`/platform-admin/support/tickets${qs(params ?? {})}`),
  adminGet: (reference: string) => api.get<SupportTicket>(`/platform-admin/support/tickets/${encodeURIComponent(reference)}`),
  adminAttachment: (reference: string, messageId?: string) => api.get<{ url: string }>(`/platform-admin/support/tickets/${encodeURIComponent(reference)}/attachment${qs(messageId ? { messageId } : {})}`),
  adminReply: (reference: string, form: FormData) => api.post<SupportMessage>(`/platform-admin/support/tickets/${encodeURIComponent(reference)}/messages`, form),
  adminUpdate: (reference: string, data: { status?: string; priority?: string }) => api.patch<SupportTicket>(`/platform-admin/support/tickets/${encodeURIComponent(reference)}`, data),
};

