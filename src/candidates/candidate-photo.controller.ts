import { BadRequestException, Controller, Delete, Get, NotFoundException, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('candidates/me/photo')
export class CandidatePhotoController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}
  private async profile(userId: string) {
    const p = await this.prisma.candidateProfile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException('Candidate profile not found');
    return p;
  }
  @Get()
  async read(@CurrentUser('userId') userId: string) {
    const p = await this.profile(userId);
    if (!p.photoKey) return { avatar_url: null };
    // A database pointer can outlive a local storage file after a reset or
    // manual cleanup. Do not hand the browser a signed URL for a missing file.
    try {
      await this.storage.getBytes(p.photoKey);
      return { avatar_url: await this.storage.presignedGet(p.photoKey) };
    } catch {
      await this.prisma.candidateProfile.updateMany({ where: { id: p.id, photoKey: p.photoKey }, data: { photoKey: null } });
      return { avatar_url: null };
    }
  }
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async upload(@CurrentUser('userId') userId: string, @UploadedFile() file?: Express.Multer.File) {
    const p = await this.profile(userId), b = file?.buffer;
    const png = b && b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = b && b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
    const webp = b && b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    if (!b || b.length > 5 * 1024 * 1024 || !(png || jpeg || webp)) throw new BadRequestException('Choose a PNG, JPEG or WebP photo, up to 5 MB');
    let image: Buffer;
    try { image = await sharp(b, { limitInputPixels: 25_000_000 }).rotate().resize(512, 512, { fit: 'cover', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(); }
    catch { throw new BadRequestException('Image is unreadable or too large. Choose another photo.'); }
    const key = `candidates/${p.id}/photos/${randomUUID()}.jpg`;
    await this.storage.put(key, image, 'image/jpeg');
    try {
      const saved = await this.prisma.candidateProfile.updateMany({ where: { id: p.id, photoKey: p.photoKey }, data: { photoKey: key } });
      if (!saved.count) throw new BadRequestException('Photo was changed on another device. Try again.');
    }
    catch (err) { await this.storage.delete(key); throw err; }
    if (p.photoKey) await this.storage.delete(p.photoKey);
    return { avatar_url: await this.storage.presignedGet(key) };
  }
  @Delete()
  async remove(@CurrentUser('userId') userId: string) {
    const p = await this.profile(userId);
    const removed = await this.prisma.candidateProfile.updateMany({ where: { id: p.id, photoKey: p.photoKey }, data: { photoKey: null } });
    if (!removed.count) throw new BadRequestException('Photo was changed on another device. Try again.');
    if (p.photoKey) await this.storage.delete(p.photoKey);
    return { removed: true };
  }
}
