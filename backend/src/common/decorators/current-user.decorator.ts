import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/auth';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    // Protected routes always have a user (JwtAuthGuard). Public routes that
    // optionally read the user receive undefined.
    if (!request.user) return undefined;
    return data ? request.user[data] : request.user;
  },
);
