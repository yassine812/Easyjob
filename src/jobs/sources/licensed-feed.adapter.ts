import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import type { ExternalJobListing, ExternalJobSearchResult, JobSourceAdapter, JobSourceHealth, JobSourceStatus } from './job-source.types';

export class SourceRequestError extends Error {
  constructor(readonly code: string, readonly httpStatus?: number, readonly retryAfterMs?: number) { super(code); }
}

export function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}

const string = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const strings = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && !!v.trim()).map(v => v.trim()))] : [];
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value) : null;

/** EasyJob's explicit interchange contract, NOT an invented vendor API schema.
 * A partner must supply/license this feed (or a reviewed gateway transforming its API).
 */
export class LicensedFeedAdapter implements JobSourceAdapter {
  readonly syncIntervalMs = 86_400_000;
  constructor(protected readonly config: ConfigService, readonly type: JobSourceType, readonly name: string,
    readonly evidenceUrl: string, readonly integrationStatus: string, readonly limitation: string,
    readonly pendingStatus: JobSourceStatus = 'PARTNER_REQUIRED') {}

  protected setting(key: string) { return this.config.get<string>(`JOB_SOURCE_${this.type}_${key}`)?.trim(); }
  isConfigured() {
    return this.setting('ENABLED') === 'true' && this.setting('AUTHORIZED') === 'true'
      && this.setting('FORMAT') === 'easyjob-v1' && !!httpsUrl(this.setting('FEED_URL'));
  }
  getSourceInfo() { return { evidenceUrl: this.evidenceUrl, integrationStatus: this.integrationStatus, method: 'Licensed EasyJob v1 interchange feed; vendor-native catalogue access is not implied.' }; }
  async healthCheck(): Promise<JobSourceHealth> {
    if (this.setting('ENABLED') === 'false') return { status: 'DISABLED', detail: this.limitation };
    if (this.setting('AUTHORIZED') !== 'true') return { status: this.pendingStatus, detail: this.limitation };
    return this.isConfigured() ? { status: 'ACTIVE', detail: 'Authorized feed configured. Last synchronization confirms availability.' }
      : { status: 'CONFIGURATION_REQUIRED', detail: 'Set ENABLED, HTTPS FEED_URL and FORMAT=easyjob-v1 after obtaining feed redistribution permission.' };
  }
  authenticate() { return this.healthCheck(); }
  normalizeJob(raw: unknown): ExternalJobListing | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const id = string(r.id), title = string(r.title), url = httpsUrl(r.url);
    if (!id || !title || !url || typeof r.description !== 'string') return null;
    if (r.status && !['OPEN', 'CLOSED', 'EXPIRED', 'PAUSED', 'REMOVED'].includes(String(r.status))) return null;
    const job: ExternalJobListing = {
      id, title, url, companyName: string(r.companyName), companyLogoUrl: httpsUrl(r.companyLogoUrl),
      companyWebsite: httpsUrl(r.companyWebsite), location: string(r.location), description: r.description,
      salaryText: string(r.salaryText), employmentType: string(r.employmentType), sourceLabel: this.name,
      sourceUpdatedAt: date(r.sourceUpdatedAt), publishedAt: date(r.publishedAt), closingAt: date(r.closingAt),
      status: (r.status || 'OPEN') as ExternalJobListing['status'], applicationUrl: httpsUrl(r.applicationUrl) || url,
      rawMetadata: r,
    };
    for (const key of ['reference', 'companyIndustry', 'companyLocation', 'experienceLevel', 'workplaceType', 'currency', 'contractType', 'contractDuration', 'country', 'region', 'city', 'address', 'salaryPeriod'] as const) job[key] = string(r[key]);
    for (const key of ['requirements', 'responsibilities', 'skills', 'niceToHave', 'benefits', 'languages', 'education'] as const) job[key] = strings(r[key]);
    for (const key of ['experienceMin', 'experienceMax', 'salaryMin', 'salaryMax', 'positions'] as const) job[key] = number(r[key]);
    if ((job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax)
      || (job.experienceMin != null && job.experienceMax != null && job.experienceMin > job.experienceMax)) return null;
    // Unverified application instructions cannot turn a feed into submission authority.
    job.applicationFields = [];
    if (r.applicationFields != null) {
      if (!Array.isArray(r.applicationFields) || r.applicationFields.length > 40) return null;
      const ids = new Set<string>();
      for (const field of r.applicationFields) {
        if (!field || typeof field !== 'object' || !string(field.id) || !string(field.label) || ids.has(field.id)
          || !['text', 'textarea', 'email', 'phone', 'url', 'boolean', 'select', 'multiselect', 'number', 'date', 'file'].includes(field.type) || typeof field.required !== 'boolean') return null;
        const options = strings(field.options);
        if (['select', 'multiselect'].includes(field.type) && !options.length) return null;
        ids.add(field.id);
        job.applicationFields.push({ id: field.id, label: field.label, type: field.type, required: field.required, ...(options.length ? { options } : {}) });
      }
    }
    return job;
  }
  getCompany(job: ExternalJobListing) { return { name: job.companyName, website: job.companyWebsite || null }; }
  getCompanyLogo(job: ExternalJobListing) { return httpsUrl(job.companyLogoUrl); }
  getApplicationCapabilities() { return { method: 'EXTERNAL_ONLY' as const, verified: true, reason: 'Only navigation to the published employer application URL is supported. No provider submission contract has been verified.' }; }
  async submitApplication(): Promise<never> { throw new SourceRequestError('SUBMISSION_NOT_AUTHORIZED'); }
  async fetchJobDetails(_externalId: string): Promise<ExternalJobListing | null> {
    // Do not guess a vendor detail endpoint or scrape the public offer.
    throw new SourceRequestError('DETAIL_ENDPOINT_NOT_VERIFIED');
  }
  async fetchJobs(): Promise<ExternalJobSearchResult> {
    if (!this.isConfigured()) throw new SourceRequestError('SOURCE_NOT_CONFIGURED');
    const first = httpsUrl(this.setting('FEED_URL'))!;
    let next: string | null = first;
    const seen = new Set<string>(), jobs: ExternalJobListing[] = [];
    let total: number | undefined, rejected = 0;
    const maxPages = Math.min(1000, Math.max(1, Number(this.setting('MAX_PAGES')) || 100));
    for (let page = 0; next && page < maxPages; page++) {
      if (seen.has(next) || new URL(next).origin !== new URL(first).origin) throw new SourceRequestError('INVALID_PAGINATION');
      seen.add(next);
      if (page) await new Promise(resolve => setTimeout(resolve, Math.max(250, Math.min(60000, Number(this.setting('REQUEST_INTERVAL_MS')) || 250))));
      let response: Response;
      try {
        response = await fetch(next, { headers: { Accept: 'application/json', ...(this.setting('TOKEN') ? { Authorization: `Bearer ${this.setting('TOKEN')}` } : {}) }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
      } catch { throw new SourceRequestError('NETWORK_OR_TIMEOUT'); }
      if (!response.ok) {
        const retry = response.headers.get('retry-after');
        const retryAfterMs = retry ? Math.max(0, /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : undefined;
        throw new SourceRequestError(`HTTP_${response.status}`, response.status, Number.isFinite(retryAfterMs) ? retryAfterMs : undefined);
      }
      let payload: { version?: string; jobs?: unknown[]; total?: number; next?: string | null; complete?: boolean };
      try {
        const body = await response.text();
        if (Buffer.byteLength(body) > 10_000_000) throw new Error();
        payload = JSON.parse(body);
      } catch { throw new SourceRequestError('INVALID_JSON'); }
      if (!payload || payload.version !== 'easyjob-v1' || !Array.isArray(payload.jobs) || !Number.isSafeInteger(payload.total) || payload.total! < 0) throw new SourceRequestError('INVALID_FEED_SCHEMA');
      if (total != null && total !== payload.total) throw new SourceRequestError('SNAPSHOT_CHANGED');
      total = payload.total;
      for (const raw of payload.jobs) {
        const normalized = this.normalizeJob(raw);
        if (normalized) jobs.push(normalized); else rejected++;
      }
      next = payload.next ? httpsUrl(payload.next) : null;
      if (payload.next && !next) throw new SourceRequestError('INVALID_PAGINATION');
      if (!next) {
        const unique = [...new Map(jobs.map(job => [job.id, job])).values()];
        return { jobs: unique, total: total!, rejected, complete: payload.complete === true && rejected === 0 && unique.length === total };
      }
    }
    // Partial snapshot may update seen jobs but must never remove missing ones.
    return { jobs: [...new Map(jobs.map(job => [job.id, job])).values()], total: total || 0, rejected, complete: false };
  }
}
