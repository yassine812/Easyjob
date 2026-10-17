import { SetMetadata } from '@nestjs/common';
import type { RoleName } from '../constants/roles';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (RoleName | string)[]) => SetMetadata(ROLES_KEY, roles);
