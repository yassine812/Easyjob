import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobSourceType } from '@prisma/client';
import { LicensedFeedAdapter, SourceRequestError, httpsUrl } from './licensed-feed.adapter';
import { isIP } from 'node:net';
import type { ExternalJobListing, ExternalJobSearchResult } from './job-source.types';

@Injectable()
export class OptioncarriereAdapter extends LicensedFeedAdapter {
  constructor(config: ConfigService) {
    super(config, JobSourceType.OPTIONCARRIERE, 'Optioncarriere / Careerjet', 'https://www.careerjet.com/partners/api', 'REQUIRES_API_CREDENTIALS', 'Publisher search API is documented, but requires the real searching user IP and user agent. Background caching and redistribution require separate permission; use an authorized feed for daily synchronization.');
  }

  /** Verified Careerjet publisher API. Caller must pass the real triggering user's
   * network context; the background catalogue worker must not manufacture it. */
  async searchPublisher(input: { userIp: string; userAgent: string; locale: string; keywords?: string; location?: string; page?: number }): Promise<ExternalJobSearchResult> {
    if (!isIP(input.userIp) || !input.userAgent.trim()) throw new SourceRequestError('REAL_USER_CONTEXT_REQUIRED');
    const key = this.config.get<string>('CAREERJET_API_KEY');
    if (!key || this.config.get<string>('CAREERJET_PUBLISHER_AUTHORIZED') !== 'true') throw new SourceRequestError('SOURCE_NOT_CONFIGURED');
    const url = new URL('https://search.api.careerjet.net/v4/query');
    Object.entries({ locale_code: input.locale, user_ip: input.userIp, user_agent: input.userAgent,
      keywords: input.keywords || '', location: input.location || '', page: String(Math.min(10, Math.max(1, input.page || 1))), page_size: '100' })
      .forEach(([key, value]) => url.searchParams.set(key, value));
    let response: Response;
    try { response = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
    catch { throw new SourceRequestError('NETWORK_OR_TIMEOUT'); }
    if (!response.ok) throw new SourceRequestError(`HTTP_${response.status}`, response.status);
    let payload: { type: string; hits: number; jobs?: Record<string, unknown>[] };
    try { payload = await response.json() as typeof payload; } catch { throw new SourceRequestError('INVALID_JSON'); }
    if (payload.type === 'LOCATIONS') throw new SourceRequestError('LOCATION_REFINEMENT_REQUIRED');
    if (payload.type !== 'JOBS' || !Array.isArray(payload.jobs) || !Number.isSafeInteger(payload.hits)) throw new SourceRequestError('INVALID_FEED_SCHEMA');
    const jobs: ExternalJobListing[] = [];
    for (const raw of payload.jobs) {
      const link = httpsUrl(raw.url);
      if (!link) continue;
      const job = this.normalizeJob({ id: link, title: raw.title, url: link, description: raw.description,
        companyName: raw.company, location: raw.locations, publishedAt: raw.date, salaryText: raw.salary,
        salaryMin: raw.salary_min, salaryMax: raw.salary_max, currency: raw.salary_currency_code,
        salaryPeriod: ({ Y: 'YEAR', M: 'MONTH', W: 'WEEK', D: 'DAY', H: 'HOUR' } as Record<string, string>)[String(raw.salary_type)] });
      if (job) jobs.push({ ...job, rawMetadata: raw });
    }
    return { jobs, total: payload.hits, complete: false, rejected: payload.jobs.length - jobs.length };
  }
}
