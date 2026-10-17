import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PLATFORM_ADMIN_ROLES } from '../common/constants/roles';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller(['admin', 'platform-admin'])
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @Roles(...PLATFORM_ADMIN_ROLES)
  @Permissions('admin.platform_admins')
  async roles() {
    return this.rolesService.listRoles();
  }

  @Get('permissions')
  @Roles(...PLATFORM_ADMIN_ROLES)
  @Permissions('admin.platform_admins')
  async permissions() {
    return this.rolesService.listPermissions();
  }
}
