import { ConfigService } from '@nestjs/config';
import { PARTNER_ADAPTERS } from '../../src/jobs/sources/partner-source.registry';
import { OptioncarriereAdapter } from '../../src/jobs/sources/optioncarriere.adapter';

const vacancy = { id: 'partner-42', title: 'Développeur React', description: 'Description originale', url: 'https://employer.example/jobs/42',
  companyName: 'Employer', companyLogoUrl: 'https://employer.example/logo.png', salaryMin: 2000, salaryMax: 3000, currency: 'TND', salaryPeriod: 'MONTH',
  responsibilities: ['Construire'], benefits: ['Formation'], languages: ['Français'], status: 'OPEN' };
const response = (jobs: unknown[] = [vacancy], extra = {}) => new Response(JSON.stringify({ version: 'easyjob-v1', jobs, total: jobs.length, complete: true, next: null, ...extra }));

describe.each(PARTNER_ADAPTERS.map(Adapter => [Adapter.name, Adapter] as const))('%s licensed feed contract (not live provider access)', (_name, Adapter) => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => { fetchMock = jest.spyOn(globalThis, 'fetch'); });
  afterEach(() => jest.restoreAllMocks());
  function configured() {
    const source = new Adapter(new ConfigService({}));
    const config = new ConfigService({ [`JOB_SOURCE_${source.type}_AUTHORIZED`]: 'true', [`JOB_SOURCE_${source.type}_ENABLED`]: 'true',
      [`JOB_SOURCE_${source.type}_FORMAT`]: 'easyjob-v1', [`JOB_SOURCE_${source.type}_FEED_URL`]: 'https://licensed.example/jobs', [`JOB_SOURCE_${source.type}_TOKEN`]: 'test-token' });
    return new Adapter(config);
  }
  it('fails closed without a contract and credentials', async () => {
    const adapter = new Adapter(new ConfigService({}));
    expect(adapter.isConfigured()).toBe(false);
    expect((await adapter.healthCheck()).status).not.toBe('ACTIVE');
    await expect(adapter.fetchJobs()).rejects.toThrow('SOURCE_NOT_CONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('preserves employer fields, actual salary, raw data and logo without inventing submission', async () => {
    fetchMock.mockResolvedValue(response());
    const adapter = configured(), result = await adapter.fetchJobs();
    expect(result.complete).toBe(true);
    expect(result.jobs[0]).toMatchObject({ ...vacancy, rawMetadata: vacancy });
    expect(adapter.getApplicationCapabilities().method).toBe('EXTERNAL_ONLY');
    await expect(adapter.submitApplication()).rejects.toThrow('SUBMISSION_NOT_AUTHORIZED');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });
  it('accepts missing optional logo and preserves explicit expiry', () => {
    const job = configured().normalizeJob({ ...vacancy, companyLogoUrl: undefined, status: 'EXPIRED' });
    expect(job?.companyLogoUrl).toBeNull();
    expect(job?.status).toBe('EXPIRED');
  });
  it('rejects malformed rows and prevents a partial feed from closing missing jobs', async () => {
    fetchMock.mockResolvedValue(response([vacancy, { title: 'Missing id' }, { ...vacancy, id: 'bad', salaryMin: 4000 }]));
    const result = await configured().fetchJobs();
    expect(result.jobs).toHaveLength(1); expect(result.rejected).toBe(2); expect(result.complete).toBe(false);
  });
  it('follows same-origin pages and detects duplicate identifiers', async () => {
    fetchMock.mockResolvedValueOnce(response([vacancy], { total: 2, next: 'https://licensed.example/jobs?page=2' }))
      .mockResolvedValueOnce(response([vacancy], { total: 2 }));
    const result = await configured().fetchJobs();
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(result.jobs).toHaveLength(1); expect(result.complete).toBe(false);
  });
  it('does not forward authentication to a pagination host supplied by the response', async () => {
    fetchMock.mockResolvedValue(response([vacancy], { total: 2, next: 'https://other.example/jobs' }));
    await expect(configured().fetchJobs()).rejects.toThrow('INVALID_PAGINATION');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404, 429, 500])('reports HTTP %i without logging response bodies', async status => {
    fetchMock.mockResolvedValue(new Response('upstream sensitive details', { status }));
    await expect(configured().fetchJobs()).rejects.toMatchObject({ code: `HTTP_${status}`, httpStatus: status });
  });
  it('handles timeout and invalid JSON', async () => {
    fetchMock.mockRejectedValueOnce(new Error('secret url')); await expect(configured().fetchJobs()).rejects.toThrow('NETWORK_OR_TIMEOUT');
    fetchMock.mockResolvedValueOnce(new Response('<html>')); await expect(configured().fetchJobs()).rejects.toThrow('INVALID_JSON');
  });
});

describe('Careerjet documented user-triggered publisher search', () => {
  afterEach(() => jest.restoreAllMocks());
  it('requires real request context and uses v4 Basic authentication and official response fields', async () => {
    const adapter = new OptioncarriereAdapter(new ConfigService({ CAREERJET_API_KEY: 'fixture-key', CAREERJET_PUBLISHER_AUTHORIZED: 'true' }));
    const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ type: 'JOBS', hits: 1, jobs: [{ title: 'Engineer', company: 'Example', description: 'Excerpt', locations: 'Tunis', date: '2026-09-23', salary_min: 2000, salary_max: 3000, salary_currency_code: 'TND', salary_type: 'M', url: 'https://jobviewtrack.com/v2/fixture' }] })));
    await expect(adapter.searchPublisher({ userIp: '', userAgent: '', locale: 'fr_FR' })).rejects.toThrow('REAL_USER_CONTEXT_REQUIRED');
    const result = await adapter.searchPublisher({ userIp: '203.0.113.1', userAgent: 'Test agent', locale: 'fr_FR' });
    expect(result.jobs[0]).toMatchObject({ salaryMin: 2000, currency: 'TND', salaryPeriod: 'MONTH' });
    expect(result.complete).toBe(false);
    expect(String(mock.mock.calls[0][0])).toContain('https://search.api.careerjet.net/v4/query?');
  });
});
