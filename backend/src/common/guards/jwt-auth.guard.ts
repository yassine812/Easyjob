import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PASSWORD_ACCESS } from '../decorators/password-access.decorator';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CONFIG, type AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../types/auth';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
  sv?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthenticatedUser }>();
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: AccessTokenPayload;
    try {
      // Tokens are signed with the access secret — verify explicitly rather
      // than relying on the module-level JwtModule options.
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    if ((payload.sv ?? 0) !== (user.sessionVersion ?? 0)) throw new UnauthorizedException('Session expired');
    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(PASSWORD_ACCESS, [context.getHandler(), context.getClass()])) {
      throw new ForbiddenException({ message: 'Change your temporary password before continuing', code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    request.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      roles: user.roles.map((ur) => ur.role.name),
    } satisfies AuthenticatedUser;

    return true;
  }
}
