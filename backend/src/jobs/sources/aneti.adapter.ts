import { Injectable } from '@nestjs/common';
import { JobSourceType } from '@prisma/client';
import type { ExternalJobListing, ExternalJobSearchResult, JobSourceAdapter, JobSourceHealth } from './job-source.types';
import { fetchPublicHtml, htmlText, normalizeSourceUrl, sourceDate } from './public-html';

const HOST = 'www.emploi.nat.tn';
const BASE = `https://${HOST}/fo/Fr2026/`;

/** Parses the public offer table exposed by ANETI's own job-search results page. */
export function normalizeAnetiListings(html: string): ExternalJobListing[] {
  const rows = html.match(/<tr\b[^>]*class\s*=\s*["']emp["'][^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  return rows.flatMap((row): ExternalJobListing[] => {
    const ref = row.match(/href\s*=\s*["']([^"']*page=994[^"']*)["']/i)?.[1];
    const url = ref && normalizeSourceUrl(ref, BASE, HOST);
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    const title = cells[1] ? htmlText(cells[1]) : '';
    const activity = cells[2] ? htmlText(cells[2]) : '';
    const city = cells[3] ? htmlText(cells[3]) : '';
    const publishedAt = cells[5] ? sourceDate(htmlText(cells[5])) : null;
    const offerId = url ? new URL(url).searchParams : null;
    const bureau = offerId?.get('bureau'), year = offerId?.get('annee'), number = offerId?.get('numoffre');
    if (!url || !title || !bureau || !year || !number) return [];
    const education = cells[6] ? htmlText(cells[6]) : '';
    const specialization = cells[7] ? htmlText(cells[7]) : '';
    const requirements = [education, specialization].filter(Boolean);
    return [{
      id: `aneti-${bureau}-${year}-${number}`,
      title,
      companyName: null,
      location: city ? `${city}, Tunisie` : 'Tunisie',
      description: activity,
      salaryText: null,
      employmentType: null,
      sourceLabel: 'ANETI',
      url,
      sourceUpdatedAt: publishedAt,
      publishedAt,
      requirements,
    }];
  });
}

@Injectable()
export class AnetiAdapter implements JobSourceAdapter {
  readonly type = JobSourceType.ANETI;
  readonly name = 'ANETI';
  readonly syncIntervalMs = 24 * 60 * 60 * 1000;

  isConfigured() { return process.env.JOB_SOURCE_ANETI_AUTHORIZED === 'true'; }

  async healthCheck(): Promise<JobSourceHealth> {
    if (!this.isConfigured()) return { status: 'AUTHORIZATION_REQUIRED', detail: 'Public HTML availability does not establish ingestion permission. Explicit source authorization is required.' };
    return { status: 'ACTIVE', detail: 'Public ANETI offer search; read-only HTML listing, refreshed daily.' };
  }

  async fetchJobs(): Promise<ExternalJobSearchResult> {
    if (!this.isConfigured()) throw new Error('SOURCE_NOT_AUTHORIZED');
    const url = new URL('global.php', BASE);
    // The route and its query fields mirror the publicly accessible ANETI search results page.
    for (const [key, value] of Object.entries({
      FormLinks_Sorted: '', FormLinks_Sorting: '7', Submit: '', adragenc_gouv: '',
      flddate: '0', fldsearch: '', menu1: '', n_domaineo_code: '', page: '9', v_nivetud_cdnivetu: '',
    })) url.searchParams.set(key, value);
    const html = await fetchPublicHtml(url, HOST);
    if (!htmlText(html).includes('Résultats de la recherche')) throw new Error('ANETI public offer results were not returned');
    const jobs = normalizeAnetiListings(html);
    const text = htmlText(html);
    const total = Number(text.match(/sur la totalit[eé] de\s+(\d+)\s+offres/i)?.[1]);
    return { jobs, total: Number.isFinite(total) ? total : jobs.length };
  }
}
