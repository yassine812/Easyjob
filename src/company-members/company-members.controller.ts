import { Body, Controller, Delete, Param, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { MemberRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { CompanyMembersService } from './company-members.service';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

class UpdateMemberRoleDto {
  @IsEnum(MemberRole)
  role!: MemberRole;
}

@ApiTags('company-members')
@ApiBearerAuth()
@Controller()
export class CompanyMembersController {
  constructor(private readonly membersService: CompanyMembersService) {}

  @Patch('companies/:companyId/members/:memberId')
  @CompanyPermissions('team.manage')
  async changeRole(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: AuthRequest,
  ) {
    return this.membersService.changeRole(userId, companyId, memberId, dto.role, requestMeta(req));
  }

  @Delete('companies/:companyId/members/:memberId')
  @CompanyPermissions('team.manage')
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @Req() req: AuthRequest,
  ) {
    return this.membersService.removeMember(userId, companyId, memberId, requestMeta(req));
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
