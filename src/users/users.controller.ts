import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles';
import { UsersService } from './users.service';
import { AdminUpdateUserDto, AssignRolesDto, UpdateProfileDto } from './dto/user.dto';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

class ListUsersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  async getMe(@CurrentUser('userId') userId: string) {
    return this.usersService.adminGet(userId);
  }

  @Patch('users/me')
  async updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateProfileDto, @Req() req: AuthRequest) {
    return this.usersService.updateMe(userId, dto, requestMeta(req));
  }

  // ---------------- admin ----------------

  @Get('admin/users')
  @Roles(ROLES.PLATFORM_ADMIN)
  @Permissions('admin.users')
  async adminList(@Query() query: ListUsersQuery) {
    return this.usersService.adminList(query);
  }

  @Get('admin/users/:id')
  @Roles(ROLES.PLATFORM_ADMIN)
  @Permissions('admin.users')
  async adminGet(@Param('id') id: string) {
    return this.usersService.adminGet(id);
  }

  @Patch('admin/users/:id')
  @Roles(ROLES.PLATFORM_ADMIN)
  @Permissions('admin.users')
  async adminUpdate(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.usersService.adminUpdate(adminId, id, dto, requestMeta(req));
  }

  @Patch('admin/users/:id/roles')
  @Roles(ROLES.PLATFORM_ADMIN)
  @Permissions('admin.users')
  async adminAssignRoles(
    @CurrentUser('userId') adminId: string,
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
    @Req() req: AuthRequest,
  ) {
    return this.usersService.adminAssignRoles(adminId, id, dto.roleNames ?? [], requestMeta(req));
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
