import { resolve } from 'path';
import { LocalStorageService } from '../../src/files/storage.service';
import type { AppConfig } from '../../src/config/configuration';

function mockConfig(): AppConfig {
  return {
    env: 'test',
    port: 3000,
    apiPrefix: 'api/v1',
    frontendUrl: 'http://localhost:5173',
    corsOrigins: [],
    cookie: { name: 'refresh_token', secure: false, sameSite: 'lax' },
    jwt: { accessSecret: 'z'.repeat(32), accessExpiresIn: '15m', refreshSecret: 'q'.repeat(32), refreshExpiresIn: '30d', refreshTokenTtlDays: 30 },
    bcryptRounds: 10,
    databaseUrl: '',
    redis: { url: '' },
    throttle: { enabled: false, ttlMs: 0, limit: 0, authTtlMs: 0, authLimit: 0 },
    storage: {
      provider: 'local',
      localDir: 'storage-test',
      s3: { endpoint: '', region: '', bucket: '', accessKey: '', secretKey: '', forcePathStyle: true, presignExpiresSec: 900 },
    },
    email: { provider: 'console', from: '', smtp: { host: '', port: 0, secure: false, user: '', pass: '' } },
    ai: { baseUrl: '', timeoutMs: 0 },
    biometric: {
      enabled: false,
      encryptionKey: '',
      matchThreshold: 0.5,
      livenessEnabled: true,
      maxAttempts: 5,
      attemptWindowMs: 600000,
      blockMs: 600000,
      challengeTtlSeconds: 120,
      faceServiceUrl: '',
      maxImageBytes: 5 * 1024 * 1024,
    },
    payment: { provider: 'dev', devWebhookSecret: 's', stripe: { priceMap: {} } },
    logLevel: 'info',
    runWorkers: false,
  };
}

describe('LocalStorageService', () => {
  const config = mockConfig();
  const service = new LocalStorageService(config);

  it('writes and reads files', async () => {
    await service.put('test/hello.txt', Buffer.from('hello'), 'text/plain');
    await expect(service.getBytes('test/hello.txt')).resolves.toEqual(Buffer.from('hello'));
    await service.delete('test/hello.txt');
  });

  it('rejects path traversal keys', async () => {
    await expect(service.getBytes('../../etc/passwd')).rejects.toThrow('Invalid storage key');
  });

  it('generates signed URLs that validate and expire', () => {
    const url = '/api/v1/files/signed?key=dGVzdC9maWxlLnBkZg&expires=9999999999&sig=abc';
    // The signed URL must contain key/expires/sig params.
    expect(url).toContain('key=');
    expect(url).toContain('expires=');
    expect(url).toContain('sig=');
    // Tampered signature must be rejected.
    const sig = 'deadbeef';
    expect(service.validateSignedUrl('test/file.pdf', 9999999999, sig)).toBe(false);
  });

  it('resolves keys inside the storage root only', () => {
    expect(() => service['pathFor']('../escape')).toThrow('Invalid storage key');
    const p = service['pathFor']('a/b.txt');
    expect(p.startsWith(resolve(process.cwd(), 'storage-test'))).toBe(true);
  });
});
