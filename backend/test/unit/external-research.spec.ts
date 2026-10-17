import { ExternalResearchService } from '../../src/external-research/external-research.service';
import { assertPublicUrl } from '../../src/external-research/external-research.security';

const config = (overrides: any = {}) => ({ externalResearch: { enabled: true, agentReachEnabled: true, maxRetries: 2, timeoutMs: 100, circuitBreakerFailures: 3, circuitBreakerCooldownMs: 1000, ttlDays: { company: 7, technology: 14, github: 3, rssHours: 3 }, ...overrides } });
const result = { company_name: 'Acme', website: null, summary: 'public', products: [], technologies: [], public_repositories: [], sources: [], status: 'COMPLETED', provider: 'agent-reach', query_type: 'company', fetched_at: new Date().toISOString() } as any;

describe('ExternalResearchService', () => {
  it('falls back without calling the provider when disabled', async () => {
    const provider = { researchCompany: jest.fn(), doctor: jest.fn() } as any;
    const service = new ExternalResearchService(config({ enabled: false }) as any, provider, { getFresh: jest.fn(), writeSuccess: jest.fn(), writeFailure: jest.fn() } as any, { add: jest.fn() } as any);
    await expect(service.researchCompany({ companyName: 'Acme' })).resolves.toMatchObject({ status: 'DISABLED', sources: [] });
    expect(provider.researchCompany).not.toHaveBeenCalled();
  });

  it('returns a fresh cache hit and normalizes its status', async () => {
    const provider = { researchCompany: jest.fn(), doctor: jest.fn() } as any;
    const service = new ExternalResearchService(config() as any, provider, { getFresh: jest.fn().mockResolvedValue(result), writeSuccess: jest.fn(), writeFailure: jest.fn() } as any, { add: jest.fn() } as any);
    await expect(service.researchCompany({ companyName: 'Acme' })).resolves.toMatchObject({ status: 'CACHED', company_name: 'Acme' });
    expect(provider.researchCompany).not.toHaveBeenCalled();
  });

  it('refreshes an expired cache entry and writes the new TTL', async () => {
    const provider = { researchCompany: jest.fn().mockResolvedValue(result), doctor: jest.fn() } as any;
    const cache = { getFresh: jest.fn().mockResolvedValue(null), writeSuccess: jest.fn(), writeFailure: jest.fn() } as any;
    const service = new ExternalResearchService(config() as any, provider, cache, { add: jest.fn() } as any);
    await expect(service.researchCompany({ companyName: 'Acme' })).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(provider.researchCompany).toHaveBeenCalledTimes(1);
    expect(cache.writeSuccess).toHaveBeenCalledWith(expect.any(String), 'agent-reach', 'company', expect.any(String), result, expect.any(Date));
  });

  it('retries and returns a safe unavailable result after provider failures', async () => {
    const provider = { researchCompany: jest.fn().mockRejectedValue(new Error('offline')), doctor: jest.fn() } as any;
    const cache = { getFresh: jest.fn().mockResolvedValue(null), writeSuccess: jest.fn(), writeFailure: jest.fn() } as any;
    const service = new ExternalResearchService(config() as any, provider, cache, { add: jest.fn() } as any);
    await expect(service.researchCompany({ companyName: 'Acme' })).resolves.toMatchObject({ status: 'UNAVAILABLE', sources: [] });
    expect(provider.researchCompany).toHaveBeenCalledTimes(3);
    expect(cache.writeFailure).toHaveBeenCalled();
  });

  it('rejects SSRF and non-public URLs', () => {
    for (const blocked of ['http://127.0.0.1/admin', 'http://localhost', 'http://169.254.169.254/latest/meta-data', 'http://192.168.1.10/private', 'http://10.0.0.2/private', 'file:///etc/passwd']) expect(() => assertPublicUrl(blocked)).toThrow();
    expect(() => assertPublicUrl('https://user:pass@example.com')).toThrow();
    expect(assertPublicUrl('https://example.com')).toContain('example.com');
  });
});
