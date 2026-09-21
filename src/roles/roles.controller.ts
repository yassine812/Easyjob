import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('admin')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @Roles(ROLES.PLATFORM_ADMIN)
  @Permissions('admin.users')
  async roles() {
    return this.rolesService.listRoles();
  }

  @Get('permissions')
  @Roles(ROLES.PLATFORM_ADMIN)
  @Permissions('admin.users')
  async permissions() {
    return this.rolesService.listPermissions();
  }
}
