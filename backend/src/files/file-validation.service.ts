import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'path';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp']);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ValidatedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
}

@Injectable()
export class FileValidationService {
  validate(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }): ValidatedFile {
    const originalName = file.originalname;
    const extension = extname(originalName).toLowerCase();
    const mimeType = file.mimetype;

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException(`File extension "${extension}" is not allowed`);
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(`File type "${mimeType}" is not allowed`);
    }
    if (file.size <= 0) {
      throw new BadRequestException('Empty file');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit`);
    }
    // Basic magic-byte sanity check for common types.
    const buf = file.buffer;
    const head = buf.subarray(0, 8);
    const isPdf = head.subarray(0, 4).equals(Buffer.from('%PDF'));
    const isPng = head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = head.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]));
    if (mimeType === 'application/pdf' && !isPdf) {
      throw new BadRequestException('File content does not match its declared type');
    }
    if (mimeType === 'image/png' && !isPng) {
      throw new BadRequestException('File content does not match its declared type');
    }
    if (mimeType === 'image/jpeg' && !isJpeg) {
      throw new BadRequestException('File content does not match its declared type');
    }

    return {
      buffer: file.buffer,
      originalName,
      mimeType,
      extension,
      size: file.size,
    };
  }
}
