import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: { select: { id: true, name: true, description: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { name: 'asc' } });
  }
}
