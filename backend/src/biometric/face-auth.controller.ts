import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CONFIG, type AppConfig } from '../config/configuration';
import { BiometricService, type RequestMeta } from './biometric.service';
import { FaceLoginStartDto, FaceLoginVerifyDto } from './dto/biometric.dto';
import { Inject } from '@nestjs/common';

function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined };
}

/** Stricter throttling for auth endpoints (mirrors the login endpoints). */
const AUTH_RATE_LIMIT = {
  default: {
    limit: process.env.THROTTLE_ENABLED === 'false' ? 1_000_000 : 10,
    ttl: 60_000,
  },
};

@ApiTags('auth')
@Controller('auth/face')
export class FaceAuthController {
  constructor(
    private readonly biometric: BiometricService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('start')
  @Throttle(AUTH_RATE_LIMIT)
  faceStart(@Body() dto: FaceLoginStartDto, @Req() req: Request) {
    return this.biometric.faceStart(dto.email, requestMeta(req));
  }

  @Public()
  @Post('verify')
  @Throttle(AUTH_RATE_LIMIT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'frame_a', maxCount: 1 },
        { name: 'frame_b', maxCount: 1 },
      ],
      { limits: { fileSize: 6 * 1024 * 1024 } },
    ),
  )
  async faceVerify(
    @Body() dto: FaceLoginVerifyDto,
    @UploadedFiles() files: { frame_a?: Express.Multer.File[]; frame_b?: Express.Multer.File[] },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const frames = [files?.frame_a?.[0]?.buffer, files?.frame_b?.[0]?.buffer].filter(Boolean) as Buffer[];
    const result = await this.biometric.faceVerify(dto.email, dto.challengeId, frames, requestMeta(req));
    // Same httpOnly refresh cookie as the password login.
    res.cookie(this.config.cookie.name, result.refreshToken, {
      httpOnly: true,
      secure: this.config.cookie.secure,
      sameSite: this.config.cookie.sameSite,
      domain: this.config.cookie.domain,
      path: '/',
      maxAge: this.config.jwt.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    });
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }
}
