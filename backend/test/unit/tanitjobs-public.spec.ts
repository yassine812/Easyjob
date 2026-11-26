import { ConfigService } from '@nestjs/config';
import { TanitJobsAdapter } from '../../src/jobs/sources/tanitjobs.adapter';
import { parseTanitJobsPage, parseTanitJobDetail, tanitUrl } from '../../src/jobs/sources/tanitjobs-public';

const card = (id = '42', status = '') => `<div class="sj-job-card" id="${id}">
  <div class="sj-card-title"><a href="https://www.tanitjobs.com/job/${id}/comptable/">Comptable &amp; gestion</a></div>
  <div class="sj-card-company"><a href="/job/${id}/comptable/">Entreprise</a><span>·</span>Tunis</div>
  <div class="sj-card-desc">Tenue de la comptabilité et suivi des comptes...</div>
  <div class="sj-card-tags">${status}<span class="sj-card-tag sj-loc">Tunis, Tunis, Tunisie</span><span class="sj-card-tag sj-type">CDI</span></div>
  <span class="sj-card-date">25/10/2026</span></div>`;
const page = (cards: string, total = 1, next = '') => `<span>${total}</span> offres disponibles${cards}<div class="sj-load-more"></div>${next ? `<a href="?page=${next}" class="sj-page-btn">Next</a>` : ''}`;
const adapter = (settings = {}) => new TanitJobsAdapter(new ConfigService({ JOB_SOURCE_TANITJOBS_ENABLED: 'true', JOB_SOURCE_TANITJOBS_REQUEST_INTERVAL_MS: '1', ...settings }));
const jsonld = (raw = {}) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Comptable', description: 'Description publiée', url: 'https://www.tanitjobs.com/job/42/comptable/', validThrough: '2099-01-01', hiringOrganization: { name: 'Entreprise' }, jobLocation: { address: { addressCountry: { name: 'Tunisie' }, addressLocality: 'Tunis' } }, ...raw })}</script>`;

afterEach(() => jest.restoreAllMocks());
describe('public Tanitjobs daily collection', () => {
  it('extracts the public excerpt without inventing a salary or deadline', () => {
    const result = parseTanitJobsPage(page(card()));
    expect(result.jobs[0]).toMatchObject({ id: 'tanitjobs:42', title: 'Comptable & gestion', companyName: 'Entreprise', country: 'TN', contractType: 'CDI', status: 'OPEN', publishedAt: new Date('2026-10-25T00:00:00Z'), rawMetadata: { descriptionIsExcerpt: true } });
    expect(result.jobs[0].closingAt).toBeUndefined();
    expect(result.jobs[0].salaryText).toBeNull();
  });
  it('marks explicitly closed offers and keeps separate references', () => {
    const result = parseTanitJobsPage(page(card('42', 'Offre clôturée') + card('43'), 2));
    expect(result.jobs.map(j => j.status)).toEqual(['CLOSED', 'OPEN']);
    expect(new Set(result.jobs.map(j => j.reference)).size).toBe(2);
  });
  it('does not mistake a challenge, login or changed template for an empty catalogue', () => {
    expect(() => parseTanitJobsPage('<h1>Access denied</h1>')).toThrow('SCHEMA_CHANGED');
    expect(() => parseTanitJobsPage(page('', 30))).toThrow('EMPTY_UNVERIFIED_PAGE');
  });
  it('rejects external URLs and does not infer Tunisia for unknown locations', () => {
    expect(() => tanitUrl('https://evil.example/jobs')).toThrow('HOST_NOT_ALLOWED');
    expect(() => tanitUrl('https://user:pass@www.tanitjobs.com/')).toThrow('HOST_NOT_ALLOWED');
    expect(parseTanitJobsPage(page(card().replace('Tunis, Tunis, Tunisie', 'Paris, France'))).jobs[0].country).toBeNull();
    expect(parseTanitJobsPage(page(card().replace('https://www.tanitjobs.com/job/', 'https://evil.example/job/'))).rejected).toBe(1);
  });
  it('uses only matching JobPosting details and its published expiration', () => {
    expect(parseTanitJobDetail(jsonld({ validThrough: '2000-01-01' }), 'tanitjobs:42')).toMatchObject({ status: 'EXPIRED', country: 'TN' });
    expect(() => parseTanitJobDetail(jsonld(), 'tanitjobs:43')).toThrow('ID_MISMATCH');
    expect(() => parseTanitJobDetail('<h1>Temporary outage</h1>', 'tanitjobs:42')).toThrow('SCHEMA_CHANGED');
  });
  it('collects all observed pages, deduplicates featured cards and enables reconciliation only on completion', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(page(card(), 2, '2')))
      .mockResolvedValueOnce(new Response(page(card() + card('43'), 2)));
    const result = await adapter().fetchJobs();
    expect(result.jobs).toHaveLength(2);
    expect(result.complete).toBe(true);
    expect(result.completedScopes?.[0].presentIds).toEqual(['tanitjobs:42', 'tanitjobs:43']);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
  it('keeps partial results on a later outage without authorizing missing-offer removal', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(page(card(), 2, '2'))).mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
    const result = await adapter().fetchJobs();
    expect(result.jobs).toHaveLength(1);
    expect(result.complete).toBe(false);
    expect(result.completedScopes).toBeUndefined();
    expect(result.warnings?.join(' ')).toContain('503');
  });
  it('does not reconcile a page cap, repeated pagination, or changing count', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(page(card(), 2, '2')));
    expect((await adapter({ JOB_SOURCE_TANITJOBS_MAX_PAGES: '1' }).fetchJobs()).complete).toBe(false);
    fetch.mockImplementation(async () => new Response(page(card(), 2)));
    expect((await adapter().fetchJobs()).complete).toBe(false);
    fetch.mockResolvedValueOnce(new Response(page(card(), 2, '2'))).mockResolvedValueOnce(new Response(page(card(), 2, '3')));
    expect((await adapter().fetchJobs()).warnings?.join(' ')).toContain('REPEATED_PAGE');
  });
  it('supports confirmed 404 removal but treats 403 as a source error', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(adapter().fetchJobDetails('tanitjobs:42')).resolves.toBeNull();
    await expect(adapter().fetchJobDetails('tanitjobs:43')).rejects.toThrow('HTTP_403');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects redirects outside Tanitjobs before following them', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://evil.example/' } }));
    await expect(adapter().fetchJobs()).rejects.toThrow('HOST_NOT_ALLOWED');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('is daily, configurable and retains opt-in licensed feed compatibility', async () => {
    expect(adapter().syncIntervalMs).toBe(86400000);
    expect(adapter().isConfigured()).toBe(true);
    expect(adapter({ JOB_SOURCE_TANITJOBS_ENABLED: 'false' }).isConfigured()).toBe(false);
    expect(adapter({ JOB_SOURCE_TANITJOBS_FEED_URL: 'https://feed.example/jobs' }).isConfigured()).toBe(false);
    await expect(adapter({ JOB_SOURCE_TANITJOBS_ENABLED: 'false' }).fetchJobs()).rejects.toThrow('SOURCE_NOT_CONFIGURED');
  });
});
