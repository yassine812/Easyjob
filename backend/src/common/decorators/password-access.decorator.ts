import { SetMetadata } from '@nestjs/common';
export const PASSWORD_ACCESS = 'password-change-access';
/** Authenticated access while a provisioned account must choose its own password. */
export const PasswordAccess = () => SetMetadata(PASSWORD_ACCESS, true);
