import { Injectable } from '@nestjs/common';
import { JobSourceType } from '@prisma/client';
import type { ExternalJobListing, ExternalJobSearchResult, JobSourceAdapter, JobSourceHealth } from './job-source.types';
import { fetchPublicHtml, htmlText, normalizeSourceUrl, sourceDate } from './public-html';

const HOST = 'www.aneti-international.tn';
const LIST_URL = `https://${HOST}/index.php/offres`;

/** Normalizes only offer rows displayed on ANETI International's public listing. */
export function normalizeAnetiInternationalListings(html: string): ExternalJobListing[] {
  const starts = [...html.matchAll(/<div\b[^>]*class\s*=\s*["']views-row["'][^>]*>/gi)];
  return starts.flatMap((start, index): ExternalJobListing[] => {
    const from = start.index ?? 0;
    const to = starts[index + 1]?.index ?? html.length;
    const row = html.slice(from, to);
    const titleLink = row.match(/class\s*=\s*["'][^"']*\bviews-field-title\b[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!titleLink) return [];
    const url = normalizeSourceUrl(titleLink[1], LIST_URL, HOST);
    const title = htmlText(titleLink[2]);
    if (!url || !title) return [];
    const dateLabel = row.match(/Publié\s*:\s*([^<]+)/i)?.[1] ?? '';
    const publishedAt = sourceDate(dateLabel);
    const closingLabel = row.match(/Date\s+Fin\s*:\s*([^<]*)/i)?.[1] ?? '';
    const closingAt = sourceDate(closingLabel);
    const country = row.match(/Date\s+Fin\s*:[\s\S]*?<\/div>\s*<div\b[^>]*>\s*([^<]+)\s*<\/div>/i)?.[1];
    const companyRaw = row.match(/class\s*=\s*["'][^"']*\bviews-field-company-name\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
    const companyName = htmlText(companyRaw) || null;
    return [{
      id: `aneti-international-${url.split('/').pop()}`,
      title,
      companyName,
      location: country ? htmlText(country) : null,
      description: '',
      salaryText: null,
      employmentType: null,
      sourceLabel: 'ANETI International',
      url,
      sourceUpdatedAt: publishedAt,
      publishedAt,
      closingAt,
    }];
  });
}

@Injectable()
export class AnetiInternationalAdapter implements JobSourceAdapter {
  readonly type = JobSourceType.ANETI_INTERNATIONAL;
  readonly name = 'ANETI International';
  readonly syncIntervalMs = 24 * 60 * 60 * 1000;

  isConfigured() { return process.env.JOB_SOURCE_ANETI_INTERNATIONAL_AUTHORIZED === 'true'; }

  async healthCheck(): Promise<JobSourceHealth> {
    if (!this.isConfigured()) return { status: 'AUTHORIZATION_REQUIRED', detail: 'Public HTML availability does not establish ingestion permission. Explicit source authorization is required.' };
    return { status: 'ACTIVE', detail: 'Public ANETI International offer listings; read-only HTML listing, refreshed daily.' };
  }

  async fetchJobs(): Promise<ExternalJobSearchResult> {
    if (!this.isConfigured()) throw new Error('SOURCE_NOT_AUTHORIZED');
    const html = await fetchPublicHtml(new URL(LIST_URL), HOST);
    const jobs = normalizeAnetiInternationalListings(html);
    if (!jobs.length && !htmlText(html).match(/Affichage de\s+0\s+[àa]\s+0\s+sur\s+0/i)) {
      throw new Error('ANETI International public offer listing could not be parsed');
    }
    const total = Number(htmlText(html).match(/Affichage de\s+\d+\s+[àa]\s+\d+\s+sur\s+(\d+)/i)?.[1]);
    return { jobs, total: Number.isFinite(total) ? total : jobs.length };
  }
}
