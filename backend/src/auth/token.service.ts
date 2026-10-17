import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { addDays } from '../common/utils/dates';
import { generateToken, hashToken } from '../common/utils/tokens';
import type { AccessTokenPayload } from '../common/guards/jwt-auth.guard';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async issueAccessToken(user: { id: string; email: string; sessionVersion?: number }): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, type: 'access', sv: user.sessionVersion ?? 0 };
    const duration = this.config.jwt.accessExpiresIn.match(/^(\d+)(s|m|h|d)$/);
    if (!duration) throw new Error('JWT_ACCESS_EXPIRES_IN must use seconds, minutes, hours or days (e.g. 15m)');
    const expiresIn = Number(duration[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[duration[2]]!);
    if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) throw new Error('Invalid access token lifetime');
    return this.jwtService.signAsync(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn,
    });
  }

  /** Creates a refresh token, storing only its SHA-256 hash. */
  async issueRefreshToken(userId: string, ip?: string, userAgent?: string): Promise<string> {
    const raw = generateToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        expiresAt: addDays(new Date(), this.config.jwt.refreshTokenTtlDays),
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
    return raw;
  }

  /**
   * Refresh-token rotation: validates the presented token, revokes it and
   * issues a fresh pair. Old tokens can never be reused.
   */
  async rotateRefreshToken(
    rawToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenPair & { userId: string; email: string }> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });
    if (!token || token.revokedAt || token.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (token.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const newRaw = await this.issueRefreshToken(token.userId, ip, userAgent);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date(), replacedBy: hashToken(newRaw) },
      }),
    ]);

    const accessToken = await this.issueAccessToken(token.user);
    return { accessToken, refreshToken: newRaw, userId: token.userId, email: token.user.email };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
