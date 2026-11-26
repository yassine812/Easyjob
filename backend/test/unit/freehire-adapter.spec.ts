import { ConfigService } from '@nestjs/config';
import { FreehireAdapter } from '../../src/jobs/sources/freehire.adapter';
import { PartnerSourceRegistry } from '../../src/jobs/sources/partner-source.registry';

const vacancy = { public_slug: 'engineer-acme-123', source: 'greenhouse', external_id: 'acme:123',
  title: 'Software Engineer', company: 'Acme', location: 'Tunis', url: 'https://boards.greenhouse.io/acme/jobs/123',
  description: '<p>Build &amp; test.</p><script>malicious()</script><p>Remote team.</p>',
  countries: ['tn'], cities: ['Tunis'], regions: ['mena'], work_mode: 'remote', skills: ['typescript'],
  updated_at: '2026-10-22T08:00:00Z', posted_at: '2026-10-21T08:00:00Z', closed_at: null,
  enrichment: { employment_type: 'full_time', seniority: 'senior' } };
function configured(extra = {}) {
  return new FreehireAdapter(new ConfigService({ JOB_SOURCE_FREEHIRE_ENABLED: 'true', JOB_SOURCE_FREEHIRE_SELF_HOSTED: 'true',
    JOB_SOURCE_FREEHIRE_API_URL: 'http://127.0.0.1:8085/api/v1', ...extra }));
}
const page = (data: unknown[], total = data.length, offset = 0) => new Response(JSON.stringify({ data, meta: { total, offset, limit: 100 } }));
describe('FreeHire native self-hosted connector', () => {
  let mock: jest.SpyInstance;
  beforeEach(() => { mock = jest.spyOn(globalThis, 'fetch'); });
  afterEach(() => jest.restoreAllMocks());
  it('registers with the central source catalogue', () => {
    expect(new PartnerSourceRegistry(new ConfigService({})).adapters.some(a => a.type === 'FREEHIRE')).toBe(true);
  });
  it.each([
    {}, { JOB_SOURCE_FREEHIRE_ENABLED: 'false' }, { JOB_SOURCE_FREEHIRE_SELF_HOSTED: 'false' },
    { JOB_SOURCE_FREEHIRE_API_URL: 'https://freehire.me/api/v1' },
    { JOB_SOURCE_FREEHIRE_API_URL: 'https://api.freehire.dev/api/v1' },
    { JOB_SOURCE_FREEHIRE_API_URL: 'http://untrusted.example/api/v1' },
    { JOB_SOURCE_FREEHIRE_API_URL: 'https://user:secret@collector.example/api/v1' },
  ])('never silently uses a disabled or public commercial catalogue: %j', async settings => {
    const adapter = Object.keys(settings).length ? configured(settings) : new FreehireAdapter(new ConfigService({}));
    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.fetchJobs()).rejects.toThrow('SOURCE_NOT_CONFIGURED');
    expect(mock).not.toHaveBeenCalled();
  });
  it('preserves original ATS attribution and normalizes genuine fields only', () => {
    expect(configured().normalizeJob(vacancy)).toMatchObject({
      id: vacancy.public_slug, url: vacancy.url, applicationUrl: vacancy.url, sourceLabel: 'FreeHire · greenhouse',
      description: 'Build & test.\nRemote team.', country: 'TN', workplaceType: 'remote', skills: ['typescript'],
      status: 'OPEN', salaryText: null, rawMetadata: vacancy,
    });
    expect(configured().normalizeJob(vacancy)?.closingAt).toBeUndefined();
    expect(configured().getApplicationCapabilities().method).toBe('EXTERNAL_ONLY');
    expect(configured().normalizeJob({ ...vacancy, countries: ['tn', 'fr'] })?.country).toBeNull();
  });
  it.each([{ url: 'javascript:alert(1)' }, { description: '' }, { closed_at: 'unknown' }, { public_slug: '../auth' }, { direct_apply: true, url: '' }])('rejects unusable records: %j', extra => {
    expect(configured().normalizeJob({ ...vacancy, ...extra })).toBeNull();
  });
  it('uses stated compensation only and rejects an inverted range', () => {
    expect(configured().normalizeJob({ ...vacancy, enrichment: { salary_min: 2500, salary_max: 4000, salary_currency: 'TND', salary_period: 'month' } }))
      .toMatchObject({ salaryMin: 2500, salaryMax: 4000, currency: 'TND', salaryPeriod: 'month' });
    expect(configured().normalizeJob({ ...vacancy, enrichment: { salary_min: 4000, salary_max: 2500 } })).toBeNull();
    expect(configured().normalizeJob(vacancy)?.salaryMin).toBeNull();
  });
  it('bounds pagination and never claims a paginated list is an authoritative snapshot', async () => {
    mock.mockResolvedValue(page(Array.from({ length: 100 }, (_, i) => ({ ...vacancy, public_slug: `job-${i}` })), 1000));
    const result = await configured({ JOB_SOURCE_FREEHIRE_MAX_PAGES: '1' }).fetchJobs();
    expect(result).toMatchObject({ total: 1000, complete: false, rejected: 0 });
    expect(result.jobs).toHaveLength(100);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
  });
  it('paginates without duplicating a moving result and counts invalid rows', async () => {
    mock.mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, i) => ({ ...vacancy, public_slug: `job-${i}` })), 103))
      .mockResolvedValueOnce(page([{ ...vacancy, public_slug: 'job-99' }, vacancy, {}], 103, 100));
    const result = await configured().fetchJobs();
    expect(result.jobs).toHaveLength(101);
    expect(result.rejected).toBe(1);
    expect(String(mock.mock.calls[1][0])).toContain('offset=100');
  });
  it('reads explicit closures and treats only detail 404 as removal', async () => {
    mock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...vacancy, closed_at: '2026-10-22T10:00:00Z' } })))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    expect((await configured().fetchJobDetails(vacancy.public_slug))?.status).toBe('CLOSED');
    expect(await configured().fetchJobDetails(vacancy.public_slug)).toBeNull();
    await expect(configured().fetchJobDetails(vacancy.public_slug)).rejects.toMatchObject({ httpStatus: 503 });
  });
  it('rejects mismatched detail identities and malformed envelopes', async () => {
    mock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...vacancy, public_slug: 'wrong' } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
      .mockResolvedValueOnce(new Response('<html>error</html>'));
    await expect(configured().fetchJobDetails(vacancy.public_slug)).rejects.toThrow('FREEHIRE_INVALID_RESPONSE');
    await expect(configured().fetchJobs()).rejects.toThrow('FREEHIRE_INVALID_RESPONSE');
    await expect(configured().fetchJobs()).rejects.toThrow('FREEHIRE_INVALID_RESPONSE');
  });
  it('preserves retry-after and hides network exception details', async () => {
    mock.mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '60' } }))
      .mockRejectedValueOnce(new Error('secret internal endpoint'));
    await expect(configured().fetchJobs()).rejects.toMatchObject({ httpStatus: 429, retryAfterMs: 60_000 });
    await expect(configured().fetchJobs()).rejects.toThrow('FREEHIRE_UNREACHABLE');
  });
});
