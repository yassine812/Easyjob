import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import type { ExternalJobListing, ExternalJobSearchResult, JobSourceAdapter, JobSourceHealth } from './job-source.types';
import { SourceRequestError, httpsUrl } from './licensed-feed.adapter';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
const string = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
const strings = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(string).filter((item): item is string => !!item))] : [];
const cleanText = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

/**
 * Read-only JobOps OJCP connector.
 *
 * JobOps is deliberately kept as a sidecar/provider. EasyJob owns the
 * canonical catalogue, matching, tailoring and applications; JobOps only
 * supplies live, attributable listings from its supported boards.
 */
export class JobOpsAdapter implements JobSourceAdapter {
  readonly type = JobSourceType.JOBOPS;
  readonly name = 'JobOps';
  readonly syncIntervalMs = 6 * 60 * 60 * 1000;
  private requestId = 0;

  constructor(private readonly config: ConfigService) {}

  private setting(key: string) { return this.config.get<string>(`JOB_SOURCE_JOBOPS_${key}`)?.trim(); }

  private endpoint(path = '/ojcp/mcp'): URL | null {
    try {
      const raw = this.setting('URL') || '';
      const base = new URL(raw);
      if (base.username || base.password || base.search || base.hash || !['http:', 'https:'].includes(base.protocol)) return null;
      const local = ['localhost', '127.0.0.1', '[::1]', 'jobops', 'host.docker.internal'].includes(base.hostname);
      if (base.protocol === 'http:' && !local) return null;
      return new URL(path, `${base.toString().replace(/\/$/, '')}/`);
    } catch { return null; }
  }

  isConfigured() { return this.setting('ENABLED') === 'true' && !!this.endpoint(); }

  async healthCheck(): Promise<JobSourceHealth> {
    if (this.setting('ENABLED') !== 'true') return { status: 'DISABLED', detail: 'JobOps connector is disabled.' };
    if (!this.endpoint()) return { status: 'CONFIGURATION_REQUIRED', detail: 'Set JOB_SOURCE_JOBOPS_URL to an HTTPS JobOps URL or the internal jobops service.' };
    try {
      const response = await fetch(this.endpoint('/.well-known/ojcp.json')!, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(this.timeout()) });
      if (!response.ok) return { status: 'TEMPORARILY_UNAVAILABLE', detail: `JobOps manifest returned HTTP ${response.status}.` };
      const manifest = record(await response.json());
      const provider = record(manifest?.provider);
      if (provider?.name !== 'JobOps' || !Array.isArray(manifest?.tools) || !manifest.tools.includes('search_jobs')) {
        return { status: 'ERROR', detail: 'The endpoint is not a compatible JobOps OJCP provider.' };
      }
      return { status: 'ACTIVE', detail: 'JobOps OJCP search is available; listings remain external-only.' };
    } catch { return { status: 'TEMPORARILY_UNAVAILABLE', detail: 'JobOps did not respond.' }; }
  }

  getSourceInfo() { return { evidenceUrl: 'https://github.com/DaKheera47/job-ops', integrationStatus: 'OJCP_READ_ONLY', method: 'JobOps OJCP sidecar; multi-board discovery is normalized into EasyJob with original application links.' }; }
  getApplicationCapabilities() { return { method: 'EXTERNAL_ONLY' as const, verified: true, reason: 'JobOps listings always open the original employer or ATS page. EasyJob never auto-applies.' }; }
  private timeout() { return Math.min(60_000, Math.max(2_000, Number(this.setting('TIMEOUT_MS')) || 15_000)); }
  private pages() { return Math.min(20, Math.max(1, Number(this.setting('MAX_PAGES')) || 3)); }
  private limit() { return Math.min(50, Math.max(1, Number(this.setting('PAGE_SIZE')) || 50)); }
  private queries() { return (this.setting('SEARCH_TERMS') || this.setting('QUERY') || 'software engineer').split(',').map(item => item.trim()).filter(Boolean).slice(0, 20); }

  private async rpc(method: string, params?: JsonRecord): Promise<JsonRecord> {
    if (!this.isConfigured()) throw new SourceRequestError('JOBOPS_NOT_CONFIGURED');
    const response = await fetch(this.endpoint()!, {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.requestId, method, ...(params ? { params } : {}) }),
      signal: AbortSignal.timeout(this.timeout()),
    }).catch(() => { throw new SourceRequestError('JOBOPS_UNREACHABLE'); });
    if (!response.ok) throw new SourceRequestError('JOBOPS_HTTP_ERROR', response.status);
    const payload = record(await response.json().catch(() => null));
    if (!payload || payload.error || !record(payload.result)) throw new SourceRequestError('JOBOPS_INVALID_RESPONSE');
    return payload.result as JsonRecord;
  }

  private async callTool(name: string, args: JsonRecord) {
    await this.rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'easyjob', version: '1.0' } });
    const result = await this.rpc('tools/call', { name, arguments: args });
    return record(result.structuredContent) || this.parseTextResult(result.content);
  }

  private parseTextResult(content: unknown): JsonRecord {
    if (!Array.isArray(content)) throw new SourceRequestError('JOBOPS_INVALID_RESPONSE');
    const textBlock = content.map(record).find(item => item?.type === 'text' && string(item.text));
    const parsed = textBlock ? (() => { try { return JSON.parse(string(textBlock.text) || '{}'); } catch { return null; } })() : null;
    const result = record(parsed);
    if (!result) throw new SourceRequestError('JOBOPS_INVALID_RESPONSE');
    return result;
  }

  private mapJob(raw: unknown): ExternalJobListing | null {
    const job = record(raw);
    const employer = record(job?.employer);
    const salary = record(job?.baseSalary);
    const location = record(job?.jobLocation);
    const address = record(location?.address);
    const url = httpsUrl(job?.url);
    const id = string(job?.ojcp_id), title = string(job?.title);
    if (!id || !title || !url) return null;
    const description = cleanText(job?.description) || title;
    const locationText = string(location?.name) || [string(address?.addressLocality), string(address?.addressCountry)].filter(Boolean).join(', ') || (job?.remote_policy === 'remote' ? 'Remote' : null);
    const skills = strings(job?.skills_required);
    const employerName = string(employer?.name);
    const min = number(salary?.minValue), max = number(salary?.maxValue);
    return {
      id, title, companyName: employerName, companyLogoUrl: httpsUrl(employer?.logo), companyWebsite: httpsUrl(employer?.url),
      location: locationText, description, salaryText: string(job?.salary_text), employmentType: string(job?.employmentType),
      sourceLabel: `JobOps${string(job?.requisition_id) ? ` · ${string(job?.requisition_id)}` : ''}`, url,
      applicationUrl: httpsUrl(record(Array.isArray(job?.apply_paths) ? job.apply_paths[0] : null)?.url) || url,
      sourceUpdatedAt: date(job?.datePosted), publishedAt: date(job?.datePosted), closingAt: date(job?.validThrough),
      skills, workplaceType: string(job?.remote_policy), experienceLevel: string(job?.experienceLevel), salaryMin: min, salaryMax: max,
      currency: string(salary?.currency), salaryPeriod: string(salary?.unitText), country: string(address?.addressCountry), city: string(address?.addressLocality),
      status: 'OPEN', rawMetadata: job ?? undefined,
    };
  }

  async fetchJobs(): Promise<ExternalJobSearchResult> {
    const jobs = new Map<string, ExternalJobListing>();
    let total = 0, rejected = 0;
    for (const query of this.queries()) {
      for (let page = 0; page < this.pages(); page++) {
        const result = await this.callTool('search_jobs', { query, pagination: { limit: this.limit(), offset: page * this.limit() } });
        total = Math.max(total, Number(result.total_results) || 0);
        for (const raw of Array.isArray(result.jobs) ? result.jobs : []) {
          const job = this.mapJob(raw); if (job) jobs.set(job.id, job); else rejected++;
        }
        const returned = Number(result.returned) || 0;
        if (!returned || returned < this.limit() || (page + 1) * this.limit() >= (Number(result.total_results) || 0)) break;
      }
    }
    return { jobs: [...jobs.values()], total: Math.max(total, jobs.size), complete: false, rejected };
  }

  async fetchJobDetails(externalId: string): Promise<ExternalJobListing | null> {
    const result = await this.callTool('get_job_detail', { job_id: externalId, include_employer_context: true });
    const job = this.mapJob(result.job);
    return job && job.id === externalId ? job : null;
  }
}
