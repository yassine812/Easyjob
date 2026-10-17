import { BadGatewayException, Injectable } from '@nestjs/common';
import type { ExternalJobListing, ExternalJobSearchInput, ExternalJobSearchResult, JobSourceAdapter, JobSourceHealth } from './job-source.types';

interface JoobleResponse {
  totalCount?: number;
  jobs?: Array<{
    id?: string | number;
    title?: string;
    company?: string;
    location?: string;
    snippet?: string;
    salary?: string;
    type?: string;
    source?: string;
    link?: string;
    updated?: string;
  }>;
}

@Injectable()
export class JoobleAdapter implements JobSourceAdapter {
  readonly type = 'JOOBLE' as const;
  readonly name = 'Jooble';
  readonly syncIntervalMs = 24 * 60 * 60 * 1000;

  private readonly apiKey = process.env.JOOBLE_API_KEY?.trim() || '';
  private readonly apiBaseUrl = process.env.JOOBLE_API_BASE_URL?.trim() || 'https://tn.jooble.org/api/';

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async healthCheck(): Promise<JobSourceHealth> {
    return this.isConfigured()
      ? { status: 'ACTIVE', detail: null }
      : { status: 'CONFIGURATION_REQUIRED', detail: 'Add JOOBLE_API_KEY on the server to enable Jooble search.' };
  }

  async fetchJobs(): Promise<ExternalJobSearchResult> {
    if (!this.isConfigured()) return { jobs: [], total: 0 };
    return this.search({ keyword: process.env.JOOBLE_SYNC_KEYWORD?.trim() || 'emploi', location: 'Tunisia', page: 1, limit: 50 });
  }

  async search(input: ExternalJobSearchInput): Promise<ExternalJobSearchResult> {
    if (!this.isConfigured()) return { jobs: [], total: 0 };

    let endpoint: URL;
    try {
      endpoint = new URL(this.apiBaseUrl);
    } catch {
      throw new BadGatewayException('Jooble API base URL is invalid');
    }
    if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.jooble.org')) {
      throw new BadGatewayException('Jooble API must use an HTTPS Jooble country domain');
    }
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${encodeURIComponent(this.apiKey)}`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          keywords: input.keyword,
          location: input.location,
          page: input.page ?? 1,
          ResultOnPage: input.limit ?? 20,
          companysearch: input.companySearch ?? false,
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new BadGatewayException('Job source did not respond');
    }
    if (!response.ok) throw new BadGatewayException(`Jooble search failed (${response.status})`);

    let payload: JoobleResponse;
    try {
      payload = await response.json() as JoobleResponse;
    } catch {
      throw new BadGatewayException('Job source returned invalid JSON');
    }

    const jobs = (Array.isArray(payload.jobs) ? payload.jobs : []).flatMap((item): ExternalJobListing[] => {
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const rawLink = typeof item.link === 'string' ? item.link.trim() : '';
      if (!title || item.id == null || !rawLink) return [];
      let url: URL;
      try {
        url = new URL(rawLink);
      } catch {
        return [];
      }
      if (url.protocol !== 'https:') return [];

      const updated = typeof item.updated === 'string' ? new Date(item.updated) : null;
      return [{
        id: String(item.id),
        title,
        companyName: typeof item.company === 'string' && item.company.trim() ? item.company.trim() : null,
        location: typeof item.location === 'string' && item.location.trim() ? item.location.trim() : null,
        description: typeof item.snippet === 'string' ? item.snippet.trim() : '',
        salaryText: typeof item.salary === 'string' && item.salary.trim() ? item.salary.trim() : null,
        employmentType: typeof item.type === 'string' && item.type.trim() ? item.type.trim() : null,
        sourceLabel: typeof item.source === 'string' && item.source.trim() ? item.source.trim() : this.name,
        url: url.toString(),
        sourceUpdatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : null,
      }];
    });

    return { jobs, total: Number.isFinite(payload.totalCount) ? Number(payload.totalCount) : jobs.length };
  }
}
