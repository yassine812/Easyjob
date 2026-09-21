import { Controller, Get, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyPermissions } from '../common/decorators/company-permissions.decorator';
import { CompanyVerificationService } from './company-verification.service';
import type { AuthRequest } from '../common/types/auth';
import type { RequestMeta } from '../companies/companies.service';

@ApiTags('company-verification')
@ApiBearerAuth()
@Controller('companies/:companyId/verification')
export class CompanyVerificationController {
  constructor(private readonly verificationService: CompanyVerificationService) {}

  @Get()
  @CompanyPermissions('team.manage')
  async get(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string) {
    return this.verificationService.getForCompany(userId, companyId);
  }

  @Post('documents')
  @CompanyPermissions('team.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadDocument(
    @CurrentUser('userId') userId: string,
    @Param('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    if (!file) {
      return { error: 'A file is required (field "file")' };
    }
    return this.verificationService.uploadDocument(userId, companyId, file, requestMeta(req));
  }

  @Post('submit')
  @CompanyPermissions('team.manage')
  async submit(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string, @Req() req: AuthRequest) {
    return this.verificationService.submit(userId, companyId, requestMeta(req));
  }
}

function requestMeta(req: AuthRequest): RequestMeta {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 512),
  };
}
