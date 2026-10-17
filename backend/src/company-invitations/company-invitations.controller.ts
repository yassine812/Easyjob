import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { MemberRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { CompanyInvitationsService } from './company-invitations.service';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}

class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

@ApiTags('company-invitations')
@ApiBearerAuth()
@Controller()
export class CompanyInvitationsController {
  constructor(private readonly invitationsService: CompanyInvitationsService) {}

  @Post('companies/:companyId/invitations')
  @CompanyPermissions('team.invite')
  async invite(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: AuthRequest,
  ) {
    return this.invitationsService.invite(userId, companyId, dto, requestMeta(req));
  }

  @Get('companies/:companyId/invitations')
  @CompanyPermissions('team.invite')
  async list(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string) {
    return this.invitationsService.list(userId, companyId);
  }

  @Delete('companies/:companyId/invitations/:invitationId')
  @CompanyPermissions('team.manage')
  async revoke(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @Param('invitationId') invitationId: string,
    @Req() req: AuthRequest,
  ) {
    return this.invitationsService.revoke(userId, companyId, invitationId, requestMeta(req));
  }

  @Post('company-invitations/accept')
  async accept(@CurrentUser('userId') userId: string, @Body() dto: AcceptInvitationDto, @Req() req: AuthRequest) {
    return this.invitationsService.accept(userId, dto.token, requestMeta(req));
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
