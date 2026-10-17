import { Test, type TestingModule } from '@nestjs/testing';
import { FaceClient, FaceRejectedError, FaceServiceUnavailableError } from '../../src/biometric/face-client';
import { CONFIG, type AppConfig } from '../../src/config/configuration';

/** Minimal AppConfig with only the fields FaceClient reads. */
const mockConfig: AppConfig = {
  env: 'test',
  port: 3000,
  apiPrefix: 'api/v1',
  frontendUrl: 'http://localhost:5173',
  corsOrigins: [],
  cookie: { name: 'refresh_token', secure: false, sameSite: 'lax' },
  jwt: { accessSecret: 'a'.repeat(32), accessExpiresIn: '15m', refreshSecret: 'b'.repeat(32), refreshExpiresIn: '30d', refreshTokenTtlDays: 30 },
  bcryptRounds: 10,
  databaseUrl: '',
  redis: { url: '' },
  throttle: { enabled: false, ttlMs: 60000, limit: 120, authTtlMs: 60000, authLimit: 10 },
  storage: { provider: 'local', localDir: 'storage', s3: { endpoint: '', region: '', bucket: '', accessKey: '', secretKey: '', forcePathStyle: true, presignExpiresSec: 900 } },
  email: { provider: 'console', from: '', smtp: { host: '', port: 1025, secure: false, user: '', pass: '' } },
  ai: { baseUrl: 'http://localhost:8000', timeoutMs: 5000, apiKey: 'test-key' },
  biometric: {
    enabled: true,
    encryptionKey: 'a'.repeat(64),
    matchThreshold: 0.5,
    livenessEnabled: true,
    maxAttempts: 5,
    attemptWindowMs: 600000,
    blockMs: 600000,
    challengeTtlSeconds: 120,
    faceServiceUrl: 'http://localhost:8000',
    maxImageBytes: 5 * 1024 * 1024,
  },
  payment: { provider: 'dev', devWebhookSecret: '', stripe: { secretKey: undefined, webhookSecret: undefined, priceMap: {} } },
  logLevel: 'error',
  runWorkers: false,
};

function fakeFrame(): Buffer {
  // Minimal JPEG header (FF D8 FF E0) followed by padding to make it non-empty.
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(20).fill(0x00)]);
}

describe('FaceClient', () => {
  let faceClient: FaceClient;
  let fetchSpy: jest.Mock;

  beforeEach(async () => {
    fetchSpy = jest.fn();
    (globalThis as Record<string, unknown>).fetch = fetchSpy as unknown as typeof fetch;
    // AbortController needs to exist in the jest node env.
    if (typeof AbortController === 'undefined') {
      (globalThis as Record<string, unknown>).AbortController = class {
        signal = {};
        abort() {}
      } as unknown as typeof AbortController;
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaceClient,
        { provide: CONFIG, useValue: mockConfig },
      ],
    }).compile();
    faceClient = module.get(FaceClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const GOOD_EMBEDDING = Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? 0.1 : 0.9));

  it('returns the embedding on a successful 200 response', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ embedding: GOOD_EMBEDDING, quality: { passed: true, reasons: [] }, liveness: { passed: true, reason: null } })),
    });
    const result = await faceClient.embed([fakeFrame(), fakeFrame()]);
    expect(result.embedding).toEqual(GOOD_EMBEDDING);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain('/ai/face/embed');
  });

  it('throws FaceRejectedError for a 422 quality/liveness failure', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve(JSON.stringify({ detail: { code: 'no_face', detail: 'Face quality check failed' } })),
    });
    await expect(faceClient.embed([fakeFrame(), fakeFrame()])).rejects.toThrow(FaceRejectedError);
    const err = await faceClient.embed([fakeFrame(), fakeFrame()]).catch((e) => e);
    expect(err.code).toBe('no_face');
  });

  it('throws FaceRejectedError for a 422 with liveness failure code', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve(JSON.stringify({ detail: { code: 'no_motion', detail: 'Liveness check failed' } })),
    });
    await expect(faceClient.embed([fakeFrame(), fakeFrame()])).rejects.toThrow(FaceRejectedError);
  });

  it('throws FaceServiceUnavailableError for a 500 response', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    await expect(faceClient.embed([fakeFrame(), fakeFrame()])).rejects.toThrow(FaceServiceUnavailableError);
  });

  it('throws FaceServiceUnavailableError for a 401 auth failure', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    await expect(faceClient.embed([fakeFrame(), fakeFrame()])).rejects.toThrow(FaceServiceUnavailableError);
  });

  it('throws FaceServiceUnavailableError on network timeout', async () => {
    fetchSpy.mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Aborted')), 100);
    }));
    // Override the timeout to 50ms so it fires quickly.
    Object.assign(faceClient, { config: { ...mockConfig, ai: { ...mockConfig.ai, timeoutMs: 50 } } });
    await expect(faceClient.embed([fakeFrame(), fakeFrame()])).rejects.toThrow(FaceServiceUnavailableError);
  }, 10000);

  it('throws FaceRejectedError for 422 even with string detail (not object)', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve(JSON.stringify({ detail: 'Something went wrong' })),
    });
    // Falls back to default code 'low_quality' when detail is not an object with .code
    const err = await faceClient.embed([fakeFrame(), fakeFrame()]).catch((e) => e);
    expect(err).toBeInstanceOf(FaceRejectedError);
    expect(err.code).toBe('low_quality');
  });

  it('checks the third enrollment pose and rejects a failed liveness result', async () => {
    const result = { embedding: GOOD_EMBEDDING, quality: { passed: true, reasons: [] }, liveness: { passed: true } };
    fetchSpy.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify(result) });
    fetchSpy.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ ...result, liveness: { passed: false } }) });
    await expect(faceClient.enroll([fakeFrame(), fakeFrame(), fakeFrame()])).rejects.toMatchObject({ code: 'liveness_failed' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('sends Authorization header when apiKey is configured', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ embedding: GOOD_EMBEDDING, quality: { passed: true, reasons: [] }, liveness: { passed: true, reason: null } })),
    });
    await faceClient.embed([fakeFrame(), fakeFrame()]);
    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers).toHaveProperty('Authorization', 'Bearer test-key');
  });

  it('omits Authorization header when apiKey is not set', async () => {
    const noKeyConfig = { ...mockConfig, ai: { ...mockConfig.ai, apiKey: undefined } };
    const module = await Test.createTestingModule({
      providers: [FaceClient, { provide: CONFIG, useValue: noKeyConfig }],
    }).compile();
    const client = module.get(FaceClient);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ embedding: GOOD_EMBEDDING, quality: { passed: true, reasons: [] }, liveness: { passed: true, reason: null } })),
    });
    await client.embed([fakeFrame(), fakeFrame()]);
    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('Authorization');
  });
});
