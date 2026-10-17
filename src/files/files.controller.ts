import { Controller, Get, Query, Res, ForbiddenException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { LocalStorageService, StorageService } from './storage.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { Inject } from '@nestjs/common';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: StorageService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Validates HMAC-signed download URLs issued by the local storage provider.
   * S3-backed deployments use native presigned URLs instead and never hit this
   * route (the route returns 403 unless the storage provider is local).
   */
  @Public()
  @Get('signed')
  async signedDownload(
    @Query('key') keyParam: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): Promise<void> {
    if (this.config.storage.provider !== 'local' || !(this.storage instanceof LocalStorageService)) {
      throw new ForbiddenException('Signed local downloads are disabled');
    }
    if (!keyParam || !expires || !sig) {
      throw new ForbiddenException('Missing signed URL parameters');
    }
    let key: string;
    try {
      key = Buffer.from(keyParam, 'base64url').toString('utf8');
    } catch {
      throw new ForbiddenException('Invalid key');
    }
    const expiresNum = parseInt(expires, 10);
    if (!this.storage.validateSignedUrl(key, expiresNum, sig)) {
      throw new ForbiddenException('Invalid or expired signed URL');
    }
    const stream = this.storage.stream(key);
    const contentType = contentTypeFor(key);
    // Signed images are embedded by the frontend, which may use another origin.
    // Override Helmet's same-origin default only after signature validation.
    if (contentType.startsWith('image/')) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${key.split('/').pop() ?? 'file'}"`);
    stream.on('error', () => { if (!res.headersSent) res.status(404); res.end(); });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}

function contentTypeFor(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.md')) return 'text/markdown';
  return 'text/plain';
}
