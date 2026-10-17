import { api } from './client';
import type { components } from './schema';
import type { AdminUser, MeUser, Paginated, Role } from '@/types/api';
import { qs } from './client';

type UpdateProfileDto = components['schemas']['UpdateProfileDto'];
type AdminUpdateUserDto = components['schemas']['AdminUpdateUserDto'];
type AssignRolesDto = components['schemas']['AssignRolesDto'];

export interface AdminUserDetail extends AdminUser {
  memberships?: Array<{ companyId: string; companyName: string; role: string; status: string }>;
}

export const usersApi = {
  updateMe: (dto: UpdateProfileDto) => api.patch<MeUser>('/users/me', dto),
  adminList: (params: { page?: number; limit?: number; search?: string; status?: string } = {}) =>
    api.get<Paginated<AdminUser>>(`/platform-admin/users${qs(params)}`),
  adminGet: (id: string) => api.get<AdminUserDetail>(`/platform-admin/users/${id}`),
  adminUpdate: (id: string, dto: AdminUpdateUserDto) => api.patch<AdminUser>(`/platform-admin/users/${id}`, dto),
  adminAssignRoles: (id: string, dto: AssignRolesDto) =>
    api.patch<{ success: boolean }>(`/platform-admin/users/${id}/roles`, dto),
  adminRoles: () => api.get<Array<{ id: string; name: Role; permissions: string[] }>>('/platform-admin/roles'),
  adminPermissions: () => api.get<string[]>('/platform-admin/permissions'),
};

