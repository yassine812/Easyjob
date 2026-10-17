import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { PasswordAccess } from '../common/decorators/password-access.decorator';
import {
  ForgotPasswordDto,
  ChangePasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Inject } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';

// Brute-force protection on auth endpoints. The per-route limit is
// config-aware so tests (THROTTLE_ENABLED=false) and other environments can
// disable or tune it without code changes.
const AUTH_RATE_LIMIT = {
  default: {
    limit: process.env.THROTTLE_ENABLED === 'false' ? 1_000_000 : 10,
    ttl: 60_000,
  },
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.authService.register(dto, requestMeta(req));
    return result;
  }

  @Public()
  @Post('login')
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, requestMeta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = dto.refreshToken ?? readRefreshCookie(req);
    const pair = await this.authService.refresh(rawToken, requestMeta(req));
    this.setRefreshCookie(res, pair.refreshToken);
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(dto.refreshToken ?? readRefreshCookie(req), requestMeta(req));
    this.clearRefreshCookie(res);
  }

  @Public()
  @Post('verify-email')
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyEmail(dto.email, dto.code, requestMeta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { verified: true, accessToken: result.accessToken };
  }

  @Public()
  @Post('resend-verification')
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Public()
  @Post('forgot-password')
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto.email, requestMeta(req));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.resetPassword(dto);
    this.clearRefreshCookie(res);
    return result;
  }

  @Get('me')
  @PasswordAccess()
  async me(@CurrentUser('userId') userId: string) {
    return this.authService.me(userId);
  }

  @Post('change-password')
  @PasswordAccess()
  @Throttle(AUTH_RATE_LIMIT)
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.changePassword(userId, dto);
    this.clearRefreshCookie(res);
    return result;
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(this.config.cookie.name, token, {
      httpOnly: true,
      secure: this.config.cookie.secure,
      sameSite: this.config.cookie.sameSite,
      domain: this.config.cookie.domain,
      path: '/',
      maxAge: this.config.jwt.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.config.cookie.name, {
      httpOnly: true,
      secure: this.config.cookie.secure,
      sameSite: this.config.cookie.sameSite,
      domain: this.config.cookie.domain,
      path: '/',
    });
  }
}

function requestMeta(req: Request): { ip?: string; userAgent?: string } {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}

function readRefreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[
    (process.env.COOKIE_NAME ?? 'refresh_token') as string
  ];
}
