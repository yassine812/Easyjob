import { BadRequestException, Controller, Get, NotFoundException, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CompanyAccessService } from './company-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { AuditService } from '../audit/audit.service';

@Controller('companies/:companyId/logo')
export class CompanyLogoController {
  constructor(private readonly access: CompanyAccessService, private readonly prisma: PrismaService,
    private readonly storage: StorageService, private readonly audit: AuditService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  async upload(@CurrentUser('userId') userId: string, @Param('companyId') companyId: string, @UploadedFile() file?: Express.Multer.File) {
    await this.access.assertPermission(userId, companyId, 'team.manage');
    const b = file?.buffer;
    const png = b && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = b && b[0] === 255 && b[1] === 216 && b[2] === 255;
    const webp = b && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    if (!b || !(png || jpeg || webp)) throw new BadRequestException('Upload a PNG, JPEG or WebP image, up to 2 MB');
    const ext = png ? 'png' : jpeg ? 'jpg' : 'webp';
    const key = `companies/${companyId}/logos/${randomUUID()}.${ext}`;
    await this.storage.put(key, b, `image/${jpeg ? 'jpeg' : ext}`);
    try { await this.prisma.company.update({ where: { id: companyId }, data: { logoKey: key } }); }
    catch (error) { await this.storage.delete(key); throw error; }
    await this.audit.log({ actorId: userId, action: 'company.logo_updated', entityType: 'Company', entityId: companyId, metadata: { companyId } });
    return { url: await this.storage.presignedGet(key) };
  }

  @Public() @Get()
  async read(@Param('companyId') companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { logoKey: true, status: true } });
    if (!company || company.status === 'SUSPENDED' || !company.logoKey) throw new NotFoundException('Logo not found');
    return { url: await this.storage.presignedGet(company.logoKey) };
  }
}
