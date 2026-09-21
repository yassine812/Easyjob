import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { resolve } from 'path';
import { CONFIG, type AppConfig } from '../config/configuration';
import { safeEqual } from '../common/utils/tokens';

export abstract class StorageService {
  abstract put(key: string, data: Buffer, contentType: string): Promise<void>;
  abstract getBytes(key: string): Promise<Buffer>;
  abstract presignedGet(key: string): Promise<string>;
  abstract delete(key: string): Promise<void>;
  abstract getSignedKeyBase(key: string): string;
}

/**
 * S3-compatible object storage (AWS S3, MinIO, DigitalOcean Spaces, ...).
 * No S3-specific logic leaks outside this class — other modules only use the
 * StorageService abstraction.
 */
@Injectable()
export class S3StorageService extends StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    super();
    this.client = new S3Client({
      region: this.config.storage.s3.region,
      endpoint: this.config.storage.s3.endpoint || undefined,
      forcePathStyle: this.config.storage.s3.forcePathStyle,
      credentials: {
        accessKeyId: this.config.storage.s3.accessKey,
        secretAccessKey: this.config.storage.s3.secretKey,
      },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.storage.s3.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async getBytes(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.storage.s3.bucket, Key: key }),
    );
    const body = res.Body;
    if (!body) throw new Error('Empty object body');
    return Buffer.from(await body.transformToByteArray());
  }

  async presignedGet(key: string): Promise<string> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.storage.s3.bucket, Key: key }),
      { expiresIn: this.config.storage.s3.presignExpiresSec },
    );
    return url;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.storage.s3.bucket, Key: key }),
    );
  }

  getSignedKeyBase(key: string): string {
    return key;
  }
}

/**
 * Local filesystem provider for development/tests. Generates HMAC-signed URLs
 * that are validated by FilesController (see signed.local controller route).
 */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    super();
    this.root = resolve(process.cwd(), this.config.storage.localDir);
  }

  private pathFor(key: string): string {
    // Guard against path traversal: keys are always provider-generated.
    const normalized = key.replace(/\\/g, '/');
    const target = resolve(this.root, normalized);
    if (!target.startsWith(this.root)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<void> {
    const target = this.pathFor(key);
    await fs.mkdir(resolve(target, '..'), { recursive: true });
    await fs.writeFile(target, data);
  }

  async getBytes(key: string): Promise<Buffer> {
    return fs.readFile(this.pathFor(key));
  }

  async presignedGet(key: string): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + this.config.storage.s3.presignExpiresSec;
    const secret = this.signingSecret();
    const sig = createHmac('sha256', secret)
      .update(`${key}|${expires}`)
      .digest('hex');
    const keyParam = Buffer.from(key).toString('base64url');
    return `/api/v1/files/signed?key=${keyParam}&expires=${expires}&sig=${sig}`;
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.pathFor(key)).catch(() => undefined);
  }

  getSignedKeyBase(key: string): string {
    return key;
  }

  /** Validates a local signed URL (used by the files controller). */
  validateSignedUrl(key: string, expires: number, sig: string): boolean {
    if (expires < Math.floor(Date.now() / 1000)) return false;
    const expected = createHmac('sha256', this.signingSecret())
      .update(`${key}|${expires}`)
      .digest('hex');
    return safeEqual(expected, sig);
  }

  stream(key: string): ReturnType<typeof createReadStream> {
    return createReadStream(this.pathFor(key));
  }

  private signingSecret(): string {
    return process.env.STORAGE_SIGNING_SECRET ?? this.config.jwt.accessSecret;
  }
}
