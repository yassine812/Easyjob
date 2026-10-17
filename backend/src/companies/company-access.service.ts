import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface MembershipInfo {
  memberId: string;
  companyId: string;
  role: MemberRole;
}

/**
 * The single source of truth for tenant context. Company IDs are NEVER taken
 * from request bodies — every tenant-scoped operation flows through this service
 * which derives the tenant from the authenticated user's memberships.
 */
@Injectable()
export class CompanyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async applicationScope(userId: string, companyId: string): Promise<Prisma.ApplicationWhereInput> {
    const member = await this.assertMembership(userId, companyId);
    return { job: await this.jobScope(userId, companyId), ...(member.role === 'INTERVIEWER'
      ? { interviews: { some: { participants: { some: { memberId: member.memberId } } } } } : {}) };
  }

  async assertApplicationPermission(userId: string, companyId: string, applicationId: string, permission: string) {
    await this.assertPermission(userId, companyId, permission);
    const scope = await this.applicationScope(userId, companyId);
    if (!await this.prisma.application.findFirst({ where: { AND: [scope, { id: applicationId }] }, select: { id: true } })) {
      throw new ForbiddenException('This application is not assigned to you');
    }
  }

  async interviewScope(userId: string, companyId: string): Promise<Prisma.InterviewWhereInput> {
    const member = await this.assertMembership(userId, companyId);
    return { job: await this.jobScope(userId, companyId), ...(member.role === 'INTERVIEWER'
      ? { participants: { some: { memberId: member.memberId } } } : {}) };
  }

  async assertInterviewPermission(userId: string, companyId: string, interviewId: string, permission: string) {
    await this.assertPermission(userId, companyId, permission);
    const scope = await this.interviewScope(userId, companyId);
    if (!await this.prisma.interview.findFirst({ where: { AND: [scope, { id: interviewId }] }, select: { id: true } })) {
      throw new ForbiddenException('This interview is not assigned to you');
    }
  }

  async jobScope(userId: string, companyId: string): Promise<Prisma.JobWhereInput> {
    const member = await this.assertMembership(userId, companyId);
    if (member.role === 'HIRING_MANAGER') return { companyId, assignments: { some: { memberId: member.memberId } } };
    if (member.role === 'INTERVIEWER') return { companyId, interviews: { some: { participants: { some: { memberId: member.memberId } } } } };
    return { companyId };
  }

  async assertJobPermission(userId: string, companyId: string, jobId: string, permission: string) {
    await this.assertPermission(userId, companyId, permission);
    const scope = await this.jobScope(userId, companyId);
    if (!await this.prisma.job.findFirst({ where: { AND: [scope, { id: jobId }] }, select: { id: true } })) {
      throw new ForbiddenException('This job is not assigned to you');
    }
  }

  async getActiveMemberships(userId: string): Promise<MembershipInfo[]> {
    const members = await this.prisma.companyMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { id: true, companyId: true, role: true },
    });
    return members.map((m) => ({ memberId: m.id, companyId: m.companyId, role: m.role }));
  }

  async getCompanyIds(userId: string): Promise<string[]> {
    const members = await this.getActiveMemberships(userId);
    return members.map((m) => m.companyId);
  }

  /**
   * Verifies the user is an active member of the company. Throws otherwise.
   */
  async assertMembership(userId: string, companyId: string): Promise<MembershipInfo> {
    const member = await this.prisma.companyMember.findFirst({
      where: { userId, companyId, status: 'ACTIVE' },
      select: { id: true, companyId: true, role: true },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this company');
    }
    return { memberId: member.id, companyId: member.companyId, role: member.role };
  }

  /**
   * Verifies the user is an active member whose tenant role grants the required
   * permission for this company. This is the core cross-tenant guard: an
   * attacker cannot act on a company they do not belong to.
   */
  async assertPermission(userId: string, companyId: string, permission: string): Promise<MembershipInfo> {
    const membership = await this.assertMembership(userId, companyId);
    if (!permission.endsWith('.view')) {
      const company = await this.getCompanyOrThrow(companyId);
      if (company.status === 'SUSPENDED') throw new ForbiddenException('This company is suspended');
    }
    await this.assertRoleHasPermission(membership.role, permission, companyId);
    return membership;
  }

  async assertRoleHasPermission(role: MemberRole, permission: string, companyId: string): Promise<void> {
    const roleRow = await this.prisma.role.findUnique({
      where: { name: role },
      include: { permissions: { include: { permission: true } } },
    });
    const granted = roleRow?.permissions.map((rp) => rp.permission.name) ?? [];
    if (!granted.includes(permission)) {
      throw new ForbiddenException(`Permission "${permission}" required for company ${companyId}`);
    }
  }

  /**
   * Loads a company or throws 404 (without leaking the company's existence).
   */
  async getCompanyOrThrow(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }
}
