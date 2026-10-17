import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UploadedFiles,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BiometricService, type RequestMeta } from './biometric.service';
import { EnrollStartDto, EnrollVerifyDto } from './dto/biometric.dto';

export interface FrameFiles {
  frame_c?: Express.Multer.File[];
  frame_a?: Express.Multer.File[];
  frame_b?: Express.Multer.File[];
}

function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined };
}

@ApiTags('biometric')
@ApiBearerAuth()
@Controller('biometric')
export class BiometricController {
  constructor(private readonly biometric: BiometricService) {}

  @Get('status')
  status(@CurrentUser('userId') userId: string) {
    return this.biometric.getStatus(userId);
  }

  /** Step 1: explicit consent + a single-use enrollment session. */
  @Post('enroll/start')
  async enrollStart(@CurrentUser('userId') userId: string, @Body() dto: EnrollStartDto, @Req() req: Request) {
    if (dto.consent !== true) {
      throw new BadRequestException('Explicit consent is required to enable face login');
    }
    return this.biometric.enrollStart(userId, requestMeta(req));
  }

  /** Step 2: two camera frames → AI quality/liveness/embedding → encrypted template. */
  @Post('enroll/verify')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'frame_a', maxCount: 1 },
        { name: 'frame_b', maxCount: 1 },
        { name: 'frame_c', maxCount: 1 },
      ],
      { limits: { fileSize: 6 * 1024 * 1024 } },
    ),
  )
  async enrollVerify(
    @CurrentUser('userId') userId: string,
    @Body() dto: EnrollVerifyDto,
    @UploadedFiles() files: FrameFiles,
    @Req() req: Request,
  ) {
    const frames = [files?.frame_a?.[0]?.buffer, files?.frame_b?.[0]?.buffer, files?.frame_c?.[0]?.buffer].filter(Boolean) as Buffer[];
    return this.biometric.enrollVerify(userId, dto.enrollmentId, frames, requestMeta(req));
  }

  /** Creates the encrypted face template from the candidate's profile photo. */
  @Post('enroll/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 6 * 1024 * 1024, files: 1 } }))
  async enrollPhoto(
    @CurrentUser('userId') userId: string,
    @Body() dto: EnrollVerifyDto,
    @UploadedFile() photo: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.biometric.enrollReferencePhoto(userId, dto.enrollmentId, photo?.buffer, requestMeta(req));
  }

  /** Permanently disables face login and deletes the stored template. */
  @Delete()
  async disable(@CurrentUser('userId') userId: string, @Req() req: Request) {
    return this.biometric.disable(userId, requestMeta(req));
  }
}
