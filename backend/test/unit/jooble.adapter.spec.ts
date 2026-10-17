import { BadGatewayException } from '@nestjs/common';
import { JoobleAdapter } from '../../src/jobs/sources/jooble.adapter';

describe('JoobleAdapter', () => {
  const originalKey = process.env.JOOBLE_API_KEY;
  const originalBaseUrl = process.env.JOOBLE_API_BASE_URL;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.JOOBLE_API_KEY;
    else process.env.JOOBLE_API_KEY = originalKey;
    if (originalBaseUrl === undefined) delete process.env.JOOBLE_API_BASE_URL;
    else process.env.JOOBLE_API_BASE_URL = originalBaseUrl;
    jest.restoreAllMocks();
  });

  it('does not make source requests without an API key', async () => {
    delete process.env.JOOBLE_API_KEY;
    const fetch = jest.spyOn(globalThis, 'fetch');
    const adapter = new JoobleAdapter();

    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.search({ keyword: 'Django', location: 'Tunis' })).resolves.toEqual({ jobs: [], total: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps only valid HTTPS listings and sends the documented numeric pagination fields', async () => {
    process.env.JOOBLE_API_KEY = 'test-key';
    process.env.JOOBLE_API_BASE_URL = 'https://tn.jooble.org/api/';
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      totalCount: 2,
      jobs: [
        { id: 7, title: 'Backend developer', company: 'A company', location: 'Tunis', snippet: 'Build APIs', link: 'https://employer.tn/jobs/7', updated: '2026-09-20' },
        { id: 8, title: 'Not secure', link: 'http://employer.tn/jobs/8' },
        { title: 'Missing source id', link: 'https://employer.tn/jobs/9' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const adapter = new JoobleAdapter();

    const result = await adapter.search({ keyword: 'Django', location: 'Tunis', page: 2, limit: 10 });
    const [endpoint, init] = fetch.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(endpoint).toBeInstanceOf(URL);
    expect((endpoint as URL).pathname).toBe('/api/test-key');
    expect(body).toEqual(expect.objectContaining({ keywords: 'Django', location: 'Tunis', page: 2, ResultOnPage: 10 }));
    expect(result.total).toBe(2);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toEqual(expect.objectContaining({ id: '7', title: 'Backend developer', url: 'https://employer.tn/jobs/7' }));
  });

  it('rejects API URLs outside HTTPS Jooble domains', async () => {
    process.env.JOOBLE_API_KEY = 'test-key';
    process.env.JOOBLE_API_BASE_URL = 'https://jobs.example.com/api/';
    const fetch = jest.spyOn(globalThis, 'fetch');
    const adapter = new JoobleAdapter();

    await expect(adapter.search({ keyword: 'Django', location: 'Tunis' })).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetch).not.toHaveBeenCalled();
  });
});
