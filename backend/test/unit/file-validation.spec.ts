import { BadRequestException } from '@nestjs/common';
import { FileValidationService } from '../../src/files/file-validation.service';

const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100)]);

describe('FileValidationService', () => {
  const service = new FileValidationService();

  it('accepts valid PDFs', () => {
    const result = service.validate({
      buffer: pdf,
      originalname: 'cv.pdf',
      mimetype: 'application/pdf',
      size: pdf.length,
    });
    expect(result.mimeType).toBe('application/pdf');
  });

  it('rejects disallowed extensions', () => {
    expect(() =>
      service.validate({ buffer: Buffer.from('x'), originalname: 'evil.exe', mimetype: 'application/octet-stream', size: 1 }),
    ).toThrow(BadRequestException);
  });

  it('rejects content that does not match the declared type', () => {
    expect(() =>
      service.validate({ buffer: Buffer.from('plain text'), originalname: 'fake.pdf', mimetype: 'application/pdf', size: 10 }),
    ).toThrow(BadRequestException);
  });

  it('rejects empty and oversized files', () => {
    expect(() =>
      service.validate({ buffer: Buffer.alloc(0), originalname: 'cv.pdf', mimetype: 'application/pdf', size: 0 }),
    ).toThrow(BadRequestException);
    const huge = Buffer.alloc(11 * 1024 * 1024, 0x25);
    expect(() =>
      service.validate({ buffer: huge, originalname: 'cv.pdf', mimetype: 'application/pdf', size: huge.length }),
    ).toThrow(BadRequestException);
  });
});
