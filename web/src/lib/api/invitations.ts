import { api } from './client';
import type { CompanyInvitation, MemberRole } from '@/types/api';

export interface CreateInvitationInput {
  email: string;
  role: MemberRole;
}

export const invitationsApi = {
  create: (companyId: string, dto: CreateInvitationInput) =>
    api.post<CompanyInvitation>(`/companies/${companyId}/invitations`, dto),
  list: (companyId: string) => api.get<CompanyInvitation[]>(`/companies/${companyId}/invitations`),
  revoke: (companyId: string, invitationId: string) =>
    api.delete<{ success: boolean }>(`/companies/${companyId}/invitations/${invitationId}`),
  accept: (token: string) =>
    api.post<{ success: boolean; companyId: string; companyName: string; role: string }>(
      '/company-invitations/accept',
      { token },
    ),
};
