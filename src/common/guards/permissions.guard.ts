import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { COMPANY_PERMISSIONS_KEY } from '../decorators/company-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthRequest, AuthenticatedUser, CompanyContext } from '../types/auth';

/**
 * Authorization guard handling three layers:
 *  1. @Roles(...)          — platform roles
 *  2. @Permissions(...)    — platform permissions (resolved from roles)
 *  3. @CompanyPermissions(— tenant permissions: resolves the company context
 *                            from the authenticated membership (route param
 *                            :companyId → X-Company-Id header → single membership)
 *                            and verifies the member's role grants the permission.
 *
 * The company is NEVER taken from a request body — it is always derived from
 * authenticated membership, which prevents cross-tenant access.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;
    if (!user) {
      // Guarded by JwtAuthGuard which runs first; defensive only.
      throw new ForbiddenException('Unauthenticated');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) => user.roles.includes(role));
      if (!hasRole) {
        throw new ForbiddenException(`Requires one of roles: ${requiredRoles.join(', ')}`);
      }
    }

    const platformPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (platformPermissions && platformPermissions.length > 0) {
      const allowed = await this.userHasAnyPermission(user.userId, platformPermissions);
      if (!allowed) {
        throw new ForbiddenException(`Requires one of permissions: ${platformPermissions.join(', ')}`);
      }
    }

    const companyPermissions = this.reflector.getAllAndOverride<string[]>(COMPANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (companyPermissions && companyPermissions.length > 0) {
      const companyContext = await this.resolveCompanyContext(request, user, companyPermissions);
      request.companyContext = companyContext;
    }

    return true;
  }

  private async userHasAnyPermission(userId: string, required: string[]): Promise<boolean> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const granted = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        granted.add(rp.permission.name);
      }
    }
    return required.some((perm) => granted.has(perm) || (perm === 'admin.dashboard' && granted.has('admin.analytics')) || (perm === 'admin.notifications' && granted.has('admin.audit')));
  }

  private async resolveCompanyContext(
    request: AuthRequest,
    user: AuthenticatedUser,
    required: string[],
  ): Promise<CompanyContext> {
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId: user.userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });

    if (memberships.length === 0) {
      throw new ForbiddenException('User is not a member of any company');
    }

    let companyId: string | undefined;

    // 1. Route param :companyId (validated against membership below)
    const paramCompanyId = request.params?.['companyId'] as string | undefined;
    if (paramCompanyId) {
      companyId = paramCompanyId;
    }
    // 2. X-Company-Id header (validated against membership below)
    if (!companyId) {
      const headerCompanyId = request.headers?.['x-company-id'] as string | undefined;
      if (headerCompanyId) {
        companyId = headerCompanyId;
      }
    }
    // 3. Single active membership
    if (!companyId && memberships.length === 1) {
      companyId = memberships[0].companyId;
    }

    if (!companyId) {
      throw new ForbiddenException(
        'Company context required: pass :companyId route param, X-Company-Id header, or belong to a single company',
      );
    }

    const membership = memberships.find((m) => m.companyId === companyId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this company');
    }

    const memberRole = await this.prisma.role.findUnique({
      where: { name: membership.role },
      include: { permissions: { include: { permission: true } } },
    });
    const granted = new Set(memberRole?.permissions.map((rp) => rp.permission.name) ?? []);
    const allowed = required.some((perm) => granted.has(perm));
    if (!allowed) {
      throw new ForbiddenException(`Requires one of permissions: ${required.join(', ')}`);
    }

    return { companyId: membership.companyId, role: membership.role, memberId: membership.id };
  }
}
