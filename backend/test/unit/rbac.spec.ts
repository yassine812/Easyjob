import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS, isPermission } from '../../src/common/constants/permissions';
import { ROLES, ROLE_PERMISSIONS } from '../../src/common/constants/roles';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';

describe('RBAC permission model', () => {
  it('defines unique permission names', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    for (const permission of PERMISSIONS) {
      expect(isPermission(permission)).toBe(true);
    }
  });

  it('maps every role to known permissions only', () => {
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      expect(Object.keys(ROLES)).toContain(role);
      for (const permission of perms) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it('gives the platform admin every permission', () => {
    const admin = new Set(ROLE_PERMISSIONS.PLATFORM_ADMIN);
    for (const permission of PERMISSIONS) {
      expect(admin.has(permission)).toBe(true);
    }
  });

  it('candidates get no elevated permissions', () => {
    expect(ROLE_PERMISSIONS.CANDIDATE).toHaveLength(0);
  });
});

describe('PermissionsGuard', () => {
  const makeGuard = (prisma: unknown, reflector: { getAllAndOverride: jest.Mock }) =>
    new PermissionsGuard(reflector as never, prisma as never);

  it('allows public routes without a user', async () => {
    const guard = makeGuard({}, { getAllAndOverride: jest.fn().mockReturnValue(true) });
    const ctx = { getHandler: jest.fn(), getClass: jest.fn() } as never;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('denies when the user lacks platform permissions', async () => {
    const prisma = {
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      companyMember: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'permissions') return ['admin.users'];
        return undefined;
      }),
    };
    const guard = makeGuard(prisma, reflector);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'u1', roles: ['CANDIDATE'] } }) }),
    } as never;
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('resolves the tenant from membership for company routes', async () => {
    const prisma = {
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      companyMember: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'm1', companyId: 'companyA', role: 'RECRUITER', status: 'ACTIVE' },
        ]),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({
          permissions: [{ permission: { name: 'job.create' } }],
        }),
      },
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'companyPermissions') return ['job.create'];
        return undefined;
      }),
    };
    const guard = makeGuard(prisma, reflector);
    const request: { user: { userId: string; roles: string[] }; params: Record<string, string>; companyContext?: unknown } = {
      user: { userId: 'u1', roles: [] },
      params: {},
    };
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.companyContext).toEqual({ companyId: 'companyA', role: 'RECRUITER', memberId: 'm1' });
  });

  it('denies cross-company access (no membership for the target company)', async () => {
    const prisma = {
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      companyMember: {
        findMany: jest.fn().mockResolvedValue([{ id: 'm1', companyId: 'companyA', role: 'RECRUITER' }]),
      },
      role: { findUnique: jest.fn() },
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'companyPermissions') return ['job.create'];
        return undefined;
      }),
    };
    const guard = makeGuard(prisma, reflector);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'u1', roles: [] }, params: { companyId: 'companyB' } }),
      }),
    } as never;
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
