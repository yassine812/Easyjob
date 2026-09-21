import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../constants/permissions';

export const COMPANY_PERMISSIONS_KEY = 'companyPermissions';
export const CompanyPermissions = (...permissions: Permission[]) =>
  SetMetadata(COMPANY_PERMISSIONS_KEY, permissions);
