import type { Request } from 'express';
import type { MemberRole, UserStatus } from '@prisma/client';

/** User attached to the request by the JWT guard (freshly loaded from DB). */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  status: UserStatus;
  roles: string[];
}

/** Tenant context resolved from the authenticated membership. */
export interface CompanyContext {
  companyId: string;
  role: MemberRole;
  memberId: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  companyContext?: CompanyContext;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}
