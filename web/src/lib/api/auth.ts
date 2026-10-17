import { api, apiFetch } from './client';
import { env } from '@/config/env';
import type { components } from './schema';
import type { MeUser } from '@/types/api';

type RegisterDto = components['schemas']['RegisterDto'];
type LoginDto = components['schemas']['LoginDto'];
type VerifyEmailDto = { email: string; code: string };
type ResetPasswordDto = components['schemas']['ResetPasswordDto'];

/** The login endpoint returns a *partial* user (no memberships); call /auth/me for the full profile. */
export type LoginUser = Pick<MeUser, 'id' | 'name' | 'email' | 'emailVerified' | 'roles'>;

export interface LoginResponse {
  accessToken: string;
  user: LoginUser;
}

export interface RegisterResponse {
  id: string;
  name: string;
  email: string;
}

type MeUserResponse = Omit<MeUser, 'avatarUrl'> & { avatar_url: string | null };

function toAbsoluteAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  return avatarUrl.startsWith('http') ? avatarUrl : new URL(avatarUrl, env.apiUrl).toString();
}

export const authApi = {
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ success: boolean }>('/auth/change-password', { currentPassword, newPassword }),
  register: (dto: RegisterDto) => api.post<RegisterResponse>('/auth/register', dto, { auth: false }),
  login: (dto: LoginDto) => api.post<LoginResponse>('/auth/login', dto, { auth: false }),
  /** Revokes the refresh token (cookie or body). Public — safe to call after session loss. */
  logout: (refreshToken?: string) =>
    apiFetch<void>('/auth/logout', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    }),
  refresh: () => api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {}, { auth: false }),
  verifyEmail: (dto: VerifyEmailDto) =>
    api.post<{ verified: boolean; accessToken: string }>('/auth/verify-email', dto, { auth: false }),
  resendVerification: (email: string) =>
    api.post<{ sent: boolean }>('/auth/resend-verification', { email }, { auth: false }),
  forgotPassword: (email: string) =>
    api.post<{ sent: boolean }>('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (dto: ResetPasswordDto) =>
    api.post<{ success: boolean }>('/auth/reset-password', dto, { auth: false }),
  me: async (): Promise<MeUser> => {
    const user = await api.get<MeUserResponse>('/auth/me');
    const { avatar_url, ...rest } = user;
    return { ...rest, avatarUrl: toAbsoluteAvatarUrl(avatar_url) };
  },
};
