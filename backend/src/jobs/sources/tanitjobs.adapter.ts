import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter, SourceRequestError } from './licensed-feed.adapter';
import { parseTanitJobsPage, parseTanitJobDetail, tanitUrl } from './tanitjobs-public';
import type { ExternalJobSearchResult, JobSourceHealth } from './job-source.types';

const INDEX = 'https://www.tanitjobs.com/jobs/';
const bound = (value: string | undefined, fallback: number, max: number) => /^\d+$/.test(value || '') && Number(value) > 0 ? Math.min(max, Number(value)) : fallback;

@Injectable()
export class TanitJobsAdapter extends LicensedFeedAdapter {
  get revalidationBatchSize() { return this.licensed() ? 0 : 75; }
  private lastRequest = 0;
  constructor(config: ConfigService) {
    super(config, JobSourceType.TANITJOBS, 'Tanitjobs', INDEX, 'PUBLIC_JOB_PAGES', 'Public catalogue, daily refresh and original application links.');
  }
  private licensed() { return !!this.setting('FEED_URL'); }
  isConfigured() { return this.licensed() ? super.isConfigured() : this.setting('ENABLED') !== 'false'; }
  getSourceInfo() { return this.licensed() ? super.getSourceInfo() : { evidenceUrl: INDEX, integrationStatus: 'PUBLIC_JOB_PAGES', method: 'Daily public search-card excerpts across all sectors; source links, closed-offer detection and bounded missing-offer verification.' }; }
  async healthCheck(): Promise<JobSourceHealth> {
    return this.licensed() ? super.healthCheck() : { status: this.isConfigured() ? 'ACTIVE' : 'DISABLED', detail: 'Public Tanitjobs catalogue; availability is confirmed by the last synchronization.' };
  }
  private async request(raw: string): Promise<string | null> {
    let url = tanitUrl(raw);
    const delay = bound(this.setting('REQUEST_INTERVAL_MS'), 1000, 60000);
    for (let redirect = 0; redirect < 4; redirect++) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, this.lastRequest + Math.max(500, delay) - Date.now())));
      this.lastRequest = Date.now();
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { Accept: 'text/html', 'User-Agent': 'EasyJob/1.0 (public job catalogue)' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        url = tanitUrl(response.headers.get('location') || '', url.href); continue;
      }
      if ([404, 410].includes(response.status)) { await response.body?.cancel(); return null; }
      if (!response.ok) { await response.body?.cancel(); throw new SourceRequestError(`TANITJOBS_HTTP_${response.status}`, response.status); }
      if (!response.body) throw new SourceRequestError('TANITJOBS_EMPTY_RESPONSE');
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.length;
          if (size > 8_000_000) { await reader.cancel(); throw new SourceRequestError('TANITJOBS_RESPONSE_TOO_LARGE'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      return Buffer.concat(chunks).toString('utf8');
    }
    throw new SourceRequestError('TANITJOBS_REDIRECT_LIMIT');
  }
  async fetchJobDetails(externalId: string) {
    if (this.licensed()) return super.fetchJobDetails(externalId);
    if (!/^tanitjobs:\d+$/.test(externalId)) throw new SourceRequestError('TANITJOBS_INVALID_ID');
    const body = await this.request(`https://www.tanitjobs.com/job/${externalId.split(':')[1]}/`);
    return body === null ? null : parseTanitJobDetail(body, externalId);
  }
  async fetchJobs(): Promise<ExternalJobSearchResult> {
    if (this.licensed()) return super.fetchJobs();
    if (!this.isConfigured()) throw new SourceRequestError('SOURCE_NOT_CONFIGURED');
    const jobs = new Map<string, ExternalJobSearchResult['jobs'][number]>(), warnings: string[] = [];
    let next: string | null = INDEX, total = 0, rejected = 0, terminal = false;
    const maxPages = bound(this.setting('MAX_PAGES'), 250, 1000);
    for (let page = 1; next && page <= maxPages; page++) {
      try {
        const body = await this.request(next);
        if (body === null) throw new SourceRequestError('TANITJOBS_INDEX_NOT_FOUND');
        const result = parseTanitJobsPage(body, page);
        total = Math.max(total, result.total); rejected += result.rejected;
        const previous = jobs.size;
        for (const job of result.jobs) jobs.set(job.id, job);
        if (result.next && jobs.size === previous && page > 1) throw new SourceRequestError('TANITJOBS_REPEATED_PAGE');
        next = result.next; terminal = !next;
      } catch (error) {
        if (!jobs.size) throw error;
        warnings.push(`Page ${page}: ${error instanceof Error ? error.message : 'fetch failed'}`); break;
      }
    }
    const complete = terminal && !rejected && !warnings.length && jobs.size >= total;
    if (!complete) warnings.push('Incomplete or changing catalogue: missing offers are not removed from this snapshot.');
    return { jobs: [...jobs.values()], total, rejected, complete, warnings,
      ...(complete ? { completedScopes: [{ prefix: 'tanitjobs:', presentIds: [...jobs.keys()] }] } : {}) };
  }
}
