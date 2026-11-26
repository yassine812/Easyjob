import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import type { ExternalJobListing, ExternalJobSearchResult, JobSourceAdapter, JobSourceHealth } from './job-source.types';
import { httpsUrl, SourceRequestError } from './licensed-feed.adapter';
import { decodeHtml } from './public-html';

const record = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const strings = (v: unknown) => Array.isArray(v) ? [...new Set(v.map(str).filter((s): s is string => !!s))] : [];
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v) : null;
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 2_147_483_647 ? v : null;
const positive = (v: unknown, fallback: number, max: number) => Number.isInteger(Number(v)) && Number(v) > 0 ? Math.min(Number(v), max) : fallback;
const text = (v: string) => decodeHtml(v.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')).trim();

/** Native FreeHire wire contract. Only an operator-owned instance is supported here.
 * The public freehire.me catalogue is NOT licensed for free commercial redistribution.
 */
export class FreehireAdapter implements JobSourceAdapter {
  readonly type = JobSourceType.FREEHIRE;
  readonly name = 'FreeHire';
  readonly syncIntervalMs = 86_400_000;
  constructor(private readonly config: ConfigService) {}
  private setting(key: string) { return this.config.get<string>(`JOB_SOURCE_FREEHIRE_${key}`)?.trim(); }
  private endpoint(): URL | null {
    try {
      const url = new URL(this.setting('API_URL') || '');
      if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) return null;
      if (/(^|\.)freehire\.(me|dev)$/i.test(url.hostname)) return null;
      // Unencrypted transport is confined to local Docker/loopback installations.
      if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]', 'freehire-api', 'host.docker.internal'].includes(url.hostname)) return null;
      if (url.pathname.replace(/\/$/, '') !== '/api/v1') return null;
      url.pathname = '/api/v1/';
      return url;
    } catch { return null; }
  }
  isConfigured() { return this.setting('ENABLED') === 'true' && this.setting('SELF_HOSTED') === 'true' && !!this.endpoint(); }
  get revalidationBatchSize() { return positive(this.setting('RECHECK_LIMIT'), 100, 1000); }
  async healthCheck(): Promise<JobSourceHealth> {
    if (this.setting('ENABLED') !== 'true') return { status: 'DISABLED', detail: 'FreeHire self-hosted collector is disabled.' };
    return this.isConfigured() ? { status: 'ACTIVE', detail: 'Self-hosted collector configured; synchronization confirms availability.' }
      : { status: 'CONFIGURATION_REQUIRED', detail: 'Configure SELF_HOSTED=true and your own /api/v1 endpoint. The public FreeHire service is not used.' };
  }
  getSourceInfo() { return { evidenceUrl: 'https://github.com/strelov1/freehire', integrationStatus: 'SELF_HOSTED', method: 'Native FreeHire API; operator-owned catalogue, original ATS links, daily synchronization.' }; }
  getApplicationCapabilities() { return { method: 'EXTERNAL_ONLY' as const, verified: true, reason: 'Apply on the original employer/ATS website. No automatic submission.' }; }
  normalizeJob(raw: unknown): ExternalJobListing | null {
    const r = record(raw);
    if (!r) return null;
    const id = str(r.public_slug), title = str(r.title), url = httpsUrl(r.url), source = str(r.source);
    if (!id || !/^[\w-]+$/.test(id) || !title || !url || !source || typeof r.description !== 'string' || !text(r.description)) return null;
    if (r.closed_at != null && !date(r.closed_at)) return null;
    const enrichment = record(r.enrichment) || {};
    const salaryMin = amount(enrichment.salary_min), salaryMax = amount(enrichment.salary_max);
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) return null;
    const country = strings(r.countries), city = strings(r.cities), region = strings(r.regions);
    return {
      id, title, url, applicationUrl: url, companyName: str(r.company), location: str(r.location), description: text(r.description),
      sourceLabel: `FreeHire · ${source}`, sourceUpdatedAt: date(r.updated_at), publishedAt: date(r.posted_at),
      status: r.closed_at ? 'CLOSED' : 'OPEN', salaryText: null,
      salaryMin, salaryMax, currency: str(enrichment.salary_currency), salaryPeriod: str(enrichment.salary_period),
      employmentType: str(enrichment.employment_type), experienceLevel: str(enrichment.seniority),
      workplaceType: str(r.work_mode), skills: strings(r.skills),
      country: country.length === 1 ? country[0].toUpperCase() : null,
      city: city.length === 1 ? city[0] : null, region: region.length === 1 ? region[0] : null,
      // Keep all countries and upstream evidence; do not fabricate compensation or expiry.
      rawMetadata: r,
    };
  }
  private async request(path: string): Promise<unknown> {
    if (!this.isConfigured()) throw new SourceRequestError('SOURCE_NOT_CONFIGURED');
    let response: Response;
    try {
      response = await fetch(new URL(path, this.endpoint()!), { redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json' } });
    } catch { throw new SourceRequestError('FREEHIRE_UNREACHABLE'); }
    if (!response.ok) {
      const retry = response.headers.get('retry-after');
      const wait = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : undefined;
      throw new SourceRequestError('FREEHIRE_HTTP_ERROR', response.status, wait && Number.isFinite(wait) ? Math.max(1000, Math.min(wait, 86_400_000)) : undefined);
    }
    if (!response.body) throw new SourceRequestError('FREEHIRE_INVALID_RESPONSE');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 10_000_000) { await reader.cancel(); throw new SourceRequestError('FREEHIRE_RESPONSE_TOO_LARGE'); }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (error instanceof SourceRequestError) throw error;
      throw new SourceRequestError('FREEHIRE_INVALID_RESPONSE');
    } finally { reader.releaseLock(); }
  }
  async fetchJobs(): Promise<ExternalJobSearchResult> {
    const jobs = new Map<string, ExternalJobListing>();
    let rejected = 0, total = 0;
    const pages = positive(this.setting('MAX_PAGES'), 10, 100);
    for (let page = 0; page < pages; page++) {
      const result = record(await this.request(`jobs?limit=100&offset=${page * 100}`));
      const meta = record(result?.meta);
      if (!result || !Array.isArray(result.data) || !meta || !Number.isInteger(meta.total) || Number(meta.total) < 0
        || meta.offset !== page * 100 || meta.limit !== 100 || result.data.length > 100) throw new SourceRequestError('FREEHIRE_INVALID_RESPONSE');
      total = Number(meta.total);
      for (const raw of result.data) {
        const job = this.normalizeJob(raw);
        if (job) jobs.set(job.id, job); else rejected++;
      }
      if (result.data.length < 100 || (page + 1) * 100 >= total) break;
    }
    // Offset pagination is not an atomic snapshot. Missing rows MUST NOT be mass-closed.
    // Existing records are rechecked using the detail API instead.
    return { jobs: [...jobs.values()], total, complete: false, rejected };
  }
  async fetchJobDetails(id: string): Promise<ExternalJobListing | null> {
    if (!/^[\w-]+$/.test(id)) throw new SourceRequestError('FREEHIRE_INVALID_ID');
    let payload: unknown;
    try { payload = await this.request(`jobs/${encodeURIComponent(id)}`); }
    catch (error) { if (error instanceof SourceRequestError && error.httpStatus === 404) return null; throw error; }
    const job = this.normalizeJob(record(payload)?.data);
    if (!job || job.id !== id) throw new SourceRequestError('FREEHIRE_INVALID_RESPONSE');
    return job;
  }
}
