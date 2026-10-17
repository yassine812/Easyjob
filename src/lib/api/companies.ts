import { api } from './client';
import type { components } from './schema';
import type {
  Company,
  CompanyMember,
  CompanyVerification,
  MemberRole,
  VerificationDocument,
} from '@/types/api';

type CreateCompanyDto = components['schemas']['CreateCompanyDto'];
type UpdateCompanyDto = components['schemas']['UpdateCompanyDto'];

export interface CompanyWithRole extends Company {
  myRole?: MemberRole;
}

export const companiesApi = {
  create: (dto: CreateCompanyDto) => api.post<Company>('/companies', dto),
  privateProfile: (id: string) => api.get<Company>(`/companies/${id}/private`, { headers: { 'X-Company-Id': id } }),
  get: (id: string) => api.get<Company>(`/companies/${id}`, { auth: false }),
  update: (id: string, dto: UpdateCompanyDto) => api.patch<Company>(`/companies/${id}`, dto, { headers: { 'X-Company-Id': id } }),
  listMine: () => api.get<CompanyWithRole[]>('/companies/me/list'),
  members: (companyId: string) => api.get<CompanyMember[]>(`/companies/${companyId}/members`, { headers: { 'X-Company-Id': companyId } }),
  updateMember: (companyId: string, memberId: string, role: string) =>
    api.patch<CompanyMember>(`/companies/${companyId}/members/${memberId}`, { role }),
  removeMember: (companyId: string, memberId: string) =>
    api.delete<{ success: boolean }>(`/companies/${companyId}/members/${memberId}`),
  verification: (companyId: string) =>
    api.get<CompanyVerification>(`/companies/${companyId}/verification`),
  uploadVerificationDocument: (companyId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<VerificationDocument>(`/companies/${companyId}/verification/documents`, undefined, {
      body: form,
    });
  },
  submitVerification: (companyId: string) =>
    api.post<{ status: string; submittedAt: string }>(`/companies/${companyId}/verification/submit`, {}),
};
