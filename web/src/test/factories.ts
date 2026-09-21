import type { CompanyMembership, MeUser, Role } from '@/types/api';

export interface MakeUserOptions {
  id?: string;
  name?: string;
  email?: string;
  roles?: Role[];
  memberships?: Partial<CompanyMembership>[];
  phone?: string | null;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
}

export function makeUser(options: MakeUserOptions = {}): MeUser {
  return {
    id: options.id ?? 'u1',
    name: options.name ?? 'Test User',
    email: options.email ?? 'test@test.dev',
    phone: options.phone ?? null,
    status: 'ACTIVE',
    emailVerified: options.emailVerified ?? true,
    mustChangePassword: options.mustChangePassword ?? false,
    lastLoginAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    roles: options.roles ?? ['CANDIDATE'],
    candidateProfileId: null,
    memberships: (options.memberships ?? []).map((m) => ({
      companyId: m.companyId ?? 'c1',
      companyName: m.companyName ?? 'Test Company',
      companySlug: m.companySlug ?? 'test-company',
      companyStatus: m.companyStatus ?? 'ACTIVE',
      role: m.role ?? 'HR',
    })),
  };
}
