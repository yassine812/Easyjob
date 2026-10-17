import { AiClient } from '../../src/ai/ai-client';
import type { AppConfig } from '../../src/config/configuration';

function mockConfig(overrides: Partial<AppConfig> = {}): AppConfig {
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
    storage: { provider: 'local', localDir: 'storage', s3: { endpoint: '', region: '', bucket: '', accessKey: '', secretKey: '', forcePathStyle: true, presignExpiresSec: 900 } },
    email: { provider: 'console', from: '', smtp: { host: '', port: 0, secure: false, user: '', pass: '' } },
    ai: { baseUrl: 'http://ai.test', timeoutMs: 5000 },
    biometric: {
      enabled: true,
      encryptionKey: 'a'.repeat(64),
      matchThreshold: 0.5,
      livenessEnabled: true,
      maxAttempts: 5,
      attemptWindowMs: 600000,
      blockMs: 600000,
      challengeTtlSeconds: 120,
      faceServiceUrl: 'http://ai.test',
      maxImageBytes: 5 * 1024 * 1024,
    },
    payment: { provider: 'dev', devWebhookSecret: 's', stripe: { priceMap: {} } },
    logLevel: 'info',
    runWorkers: false,
    ...overrides,
  };
}

describe('AiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts to the right endpoint and parses the result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ overall_score: 78, strengths: [], weaknesses: [], missing_skills: [], ats_compatibility: 80, improvement_suggestions: [], structure_quality: 'good', keyword_recommendations: [] }),
    }) as unknown as typeof fetch;

    const client = new AiClient(mockConfig());
    const result = await client.analyzeCv({ text: 'CV', filename: 'cv.pdf' });
    expect(result.overall_score).toBe(78);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://ai.test/ai/cv/analyze');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ text: 'CV', filename: 'cv.pdf' });
  });

  it('sends the API key on extractText (FormData upload path)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'extracted' }),
    }) as unknown as typeof fetch;

    const client = new AiClient(mockConfig({ ai: { baseUrl: 'http://ai.test', timeoutMs: 5000, apiKey: 'secret-key' } }));
    const result = await client.extractText('cv.pdf', Buffer.from('%PDF fake'));
    expect(result).toBe('extracted');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
  });

  it('throws a descriptive error on provider failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'upstream broke',
    }) as unknown as typeof fetch;

    const client = new AiClient(mockConfig());
    await expect(client.analyzeCv({ text: 'CV' })).rejects.toThrow('AI service error 502');
  });
});
