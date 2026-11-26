import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { JobSourceType } from '@prisma/client';
import { decodeHtml, htmlText } from './public-html';
import { SourceRequestError } from './licensed-feed.adapter';
import { SOFRECOM_LIST, sofrecomRows, sofrecomJob, extractOfferDocument } from './sofrecom-careers';
import type { ExternalJobListing, ExternalJobSearchResult, JobSourceAdapter, JobSourceHealth } from './job-source.types';

const EY_SEARCH = 'https://careers.ey.com/search/?q=&locationsearch=Tunisia';
const ADP_SEARCH = 'https://jobs.adp.com/en/locations/emea/tunisia/';
const ATS = 'https://api.smartrecruiters.com/v1/companies/';
export const EMPLOYERS = [
  { key: 'Devoteam', name: 'Devoteam', website: 'https://www.devoteam.com' },
  { key: 'SopraSteria1', name: 'Sopra Steria / Sopra HR Software', website: 'https://www.soprasteria.com' },
  { key: 'LEONI1', name: 'LEONI', website: 'https://www.leoni-tunisia.com' },
  { key: 'AccorHotel', name: 'Accor', website: 'https://careers.accor.com' },
  { key: 'Lesaffre', name: 'Lesaffre', website: 'https://www.lesaffre.com' },
  { key: 'BoschGroup', name: 'Bosch', website: 'https://www.bosch.africa' },
] as const;
const HOSTS = new Set(['careers.ey.com', 'jobs.adp.com', 'api.smartrecruiters.com', 'portail-recrutement.sofrecom.tn']);
const date = (value?: string): Date | null => value && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
const positive = (value: unknown, fallback: number, maximum: number) => Number.isInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value), maximum) : fallback;
const countryTN = (value: string) => /^(TN|Tunisia|Tunisie)$/i.test(value.trim());

/** Read a nested element without truncating descriptions at the first nested span. */
function element(html: string, attribute: string, value: string): string {
  const start = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\b${attribute}=["']${value}["'][^>]*>`, 'i').exec(html);
  if (!start) return '';
  const offset = start.index + start[0].length;
  const tags = new RegExp(`<\\/?${start[1]}\\b[^>]*>`, 'gi');
  tags.lastIndex = offset;
  let depth = 1, match: RegExpExecArray | null;
  while ((match = tags.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (!depth) return html.slice(offset, match.index);
  }
  return '';
}
const meta = (html: string, property: string) => decodeHtml(html.match(new RegExp(`<meta\\b[^>]*itemprop=["']${property}["'][^>]*content=["']([^"']*)`, 'i'))?.[1] || '');

export function eyLinks(html: string, base = EY_SEARCH): string[] {
  const links = new Set<string>();
  for (const row of html.match(/<tr\b[^>]*class=["']data-row["'][^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const location = htmlText(element(row, 'class', 'jobLocation'));
    if (!/(^|[\s,])(TN|Tunisia|Tunisie)([\s,]|$)/i.test(location)) continue;
    const raw = row.match(/href=["']([^"']*\/job\/[^"']*)["']/i)?.[1];
    if (!raw) continue;
    const url = new URL(decodeHtml(raw), base);
    if (url.origin === 'https://careers.ey.com' && /^\/ey\/job\/[^/]+\/\d+\/$/.test(url.pathname)) links.add(url.href);
  }
  return [...links];
}

export function normalizeEyJob(html: string, url: string): ExternalJobListing | null {
  const parsed = new URL(url);
  const id = parsed.pathname.match(/^\/ey\/job\/[^/]+\/(\d+)\/$/)?.[1];
  const title = htmlText(element(html, 'itemprop', 'title'));
  const description = htmlText(element(html, 'itemprop', 'description'));
  // Country must be attested by this posting, not inferred from a keyword in its body.
  const address = meta(html, 'streetAddress');
  if (parsed.origin !== 'https://careers.ey.com' || !id || !title || !description || !/(^|[\s,])(TN|Tunisia|Tunisie)([\s,]|$)/i.test(address)) return null;
  const publishedAt = date(meta(html, 'datePosted')), closingAt = date(meta(html, 'validThrough'));
  return { id: `ey:${id}`, title, description, companyName: 'EY', companyWebsite: 'https://www.ey.com',
    companyLocation: 'Tunisie', location: address === 'TN' ? 'Tunisie' : address, country: 'TN',
    url, applicationUrl: url, sourceLabel: 'EY · Carrières officielles', sourceUpdatedAt: publishedAt, publishedAt, closingAt,
    reference: htmlText(element(html, 'data-careersite-propertyid', 'customfield5')) || id,
    salaryText: null, employmentType: null, status: closingAt && closingAt <= new Date() ? 'EXPIRED' : 'OPEN',
    rawMetadata: { employer: 'EY', method: 'public-career-page', fetchedAt: new Date().toISOString(), originalUrl: url } };
}

export function normalizeSmartRecruitersJob(raw: any, employer: typeof EMPLOYERS[number]): ExternalJobListing | null {
  if (!raw || !/^\d+$/.test(String(raw.id)) || typeof raw.name !== 'string' || !countryTN(raw.location?.country || '')
    || raw.visibility !== 'PUBLIC' || typeof raw.active !== 'boolean') return null;
  let url: URL;
  try { url = new URL(raw.postingUrl); } catch { return null; }
  if (url.origin !== 'https://jobs.smartrecruiters.com' || !new RegExp(`^/${employer.key}/${raw.id}(?:-|/|$)`, 'i').test(url.pathname)) return null;
  const sections = raw.jobAd?.sections;
  if (!sections || typeof sections.jobDescription?.text !== 'string') return null;
  const description = ['companyDescription', 'jobDescription', 'qualifications', 'additionalInformation']
    .map(key => typeof sections[key]?.text === 'string' ? htmlText(sections[key].text) : '').filter(Boolean).join('\n\n');
  if (!description.trim()) return null;
  const publishedAt = date(raw.releasedDate);
  return { id: `sr:${employer.key}:${raw.id}`, title: htmlText(raw.name), description,
    companyName: employer.name, companyWebsite: employer.website, companyLocation: 'Tunisie',
    location: [raw.location.city, 'Tunisie'].filter(Boolean).join(', '), city: raw.location.city || null,
    region: raw.location.region || null, country: 'TN', address: raw.location.address || null,
    url: url.href, applicationUrl: url.href, sourceLabel: `${employer.name} · Carrières officielles`,
    sourceUpdatedAt: publishedAt, publishedAt, closingAt: null, salaryText: null, employmentType: raw.typeOfEmployment?.label || null,
    experienceLevel: raw.experienceLevel?.label || null,
    workplaceType: raw.location.hybrid ? 'HYBRID' : raw.location.remote ? 'REMOTE' : 'ONSITE',
    reference: raw.refNumber || String(raw.id), status: raw.active ? 'OPEN' : 'CLOSED',
    requirements: sections.qualifications?.text ? [htmlText(sections.qualifications.text)] : [],
    rawMetadata: { employer: employer.key, method: 'smartrecruiters-public-posting', originalUrl: url.href, fetchedAt: new Date().toISOString() } };
}

export type EmployerCollectionReport = { employer: string; status: 'OK' | 'PARTIAL' | 'BLOCKED' | 'ERROR'; count: number; detail?: string };

/** Official employer pages only. No credentials, paid service, or automatic applications. */
export class CompanyCareersAdapter implements JobSourceAdapter {
  readonly type = JobSourceType.COMPANY_DIRECT;
  readonly name = 'Carrières entreprises · Tunisie';
  readonly syncIntervalMs = 86_400_000;
  readonly reports: EmployerCollectionReport[] = [];
  private readonly logger = new Logger(CompanyCareersAdapter.name);
  constructor(private readonly config: ConfigService) {}
  isConfigured() { return this.config.get<string>('JOB_SOURCE_COMPANY_DIRECT_ENABLED') !== 'false'; }
  async healthCheck(): Promise<JobSourceHealth> {
    return { status: this.isConfigured() ? 'ACTIVE' : 'DISABLED', detail: 'Tunisia, all published specialties: EY, Sofrecom, Devoteam, Sopra Steria, LEONI, Accor, Lesaffre, Bosch. ADP blocks and partial collections are reported separately.' };
  }
  getSourceInfo() { return { evidenceUrl: EY_SEARCH, integrationStatus: 'PUBLIC_EMPLOYER_CAREERS', method: 'Daily bounded employer/ATS collection; Tunisia-only, original application links. ADP HTTP blocks are reported, never bypassed.' }; }
  getApplicationCapabilities() { return { method: 'EXTERNAL_ONLY' as const, verified: true, reason: 'Apply directly on the original employer career page.' }; }

  private async request(url: string): Promise<string> { return (await this.requestBuffer(url)).toString('utf8'); }

  private async requestBuffer(url: string): Promise<Buffer> {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !HOSTS.has(target.hostname) || target.username || target.password) throw new SourceRequestError('COMPANY_HOST_NOT_ALLOWED');
    // A small delay and sequential per-employer requests avoid bursts to career sites.
    await new Promise(resolve => setTimeout(resolve, 300));
    const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'EasyJob/1.0 (public employer jobs index)', Accept: 'text/html, application/json' } });
    if (!response.ok) throw new SourceRequestError(`COMPANY_HTTP_${response.status}`, response.status);
    if (!response.body) throw new SourceRequestError('COMPANY_EMPTY_RESPONSE');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8_000_000) { await reader.cancel(); throw new SourceRequestError('COMPANY_RESPONSE_TOO_LARGE'); }
        chunks.push(value);
      }
      return Buffer.concat(chunks);
    } finally { reader.releaseLock(); }
  }

  private async collectSofrecom(): Promise<ExternalJobSearchResult> {
    // This public page contains all rows; its pagination is performed in the browser.
    const rows = sofrecomRows(await this.request(SOFRECOM_LIST));
    const jobs: ExternalJobListing[] = [];
    let protectedDocuments = 0;
    for (const row of rows) {
      try { jobs.push(sofrecomJob(row, await extractOfferDocument(await this.requestBuffer(row.url)))); }
      catch (error) {
        if (!(error instanceof SourceRequestError) || error.code !== 'SOFRECOM_PROTECTED_DOCUMENT') throw error;
        // The title/reference/location are public, but some attachments require
        // Orange employee access. Index only that public listing, never decrypt.
        const job = sofrecomJob(row, "Offre publiée sur le portail officiel de Sofrecom. La fiche détaillée est protégée par l’employeur et n’est pas accessible publiquement. Consultez le portail Sofrecom pour les modalités de candidature.");
        job.rawMetadata = { ...job.rawMetadata, descriptionStatus: 'PROTECTED_DOCUMENT' };
        jobs.push(job); protectedDocuments++;
      }
    }
    return { jobs, total: jobs.length, complete: true, rejected: 0,
      warnings: protectedDocuments ? [`PROTECTED_DOCUMENTS:${protectedDocuments}`] : [] };
  }

  private async collectEy(): Promise<ExternalJobSearchResult> {
    const jobs: ExternalJobListing[] = [], visited = new Set<string>();
    let page: string | undefined = EY_SEARCH, complete = false, rejected = 0;
    const maxPages = positive(this.config.get('JOB_SOURCE_COMPANY_DIRECT_MAX_PAGES'), 10, 30);
    for (let n = 0; page && n < maxPages; n++) {
      if (visited.has(page)) throw new SourceRequestError('EY_PAGINATION_LOOP');
      visited.add(page);
      const html = await this.request(page);
      if (!/id=["']searchresults["']/.test(html)) throw new SourceRequestError('EY_RESULTS_MISSING');
      const urls = eyLinks(html, page);
      const rows = (html.match(/<tr\b[^>]*class=["']data-row["']/gi) || []).length;
      if (rows && !urls.length) throw new SourceRequestError('EY_LOCATION_FORMAT_CHANGED');
      const advertised = html.match(/aria-label=["']Search results[^"']*Results\s+\d+\s+to\s+\d+\s+of\s+(\d+)/i)?.[1];
      if (!rows && Number(advertised) > 0) throw new SourceRequestError('EY_RESULTS_TRUNCATED');
      for (const url of urls) {
        const listing = normalizeEyJob(await this.request(url), url);
        if (listing) jobs.push(listing); else rejected++;
      }
      const pages: URL[] = [...html.matchAll(/href=["']([^"']*[?&](?:amp;)?startrow=\d+[^"']*)["']/gi)]
        .map(m => new URL(decodeHtml(m[1]), page)).filter(u => u.origin === 'https://careers.ey.com' && u.pathname === '/search/');
      const current: number = Number(new URL(page).searchParams.get('startrow') || 0);
      page = pages.filter(u => Number(u.searchParams.get('startrow')) > current).sort((a, b) => Number(a.searchParams.get('startrow')) - Number(b.searchParams.get('startrow')))[0]?.href;
      if (!page) complete = true;
    }
    return { jobs, total: jobs.length, complete, rejected };
  }

  private async collectSmartRecruiters(employer: typeof EMPLOYERS[number]): Promise<ExternalJobSearchResult> {
    const jobs: ExternalJobListing[] = [], seen = new Set<string>();
    let complete = false, rejected = 0, total = 0;
    const maxPages = positive(this.config.get('JOB_SOURCE_COMPANY_DIRECT_MAX_PAGES'), 10, 30);
    for (let page = 0; page < maxPages; page++) {
      const data = JSON.parse(await this.request(`${ATS}${employer.key}/postings?country=tn&limit=100&offset=${page * 100}`));
      if (!Array.isArray(data.content) || data.content.length > 100 || !Number.isInteger(data.totalFound) || data.totalFound < 0 || data.offset !== page * 100) throw new SourceRequestError('SMARTRECRUITERS_INVALID_PAGE');
      total = data.totalFound;
      if (!data.content.length && page * 100 < total) throw new SourceRequestError('SMARTRECRUITERS_TRUNCATED_PAGE');
      for (const item of data.content) {
        if (!/^\d+$/.test(String(item.id)) || !countryTN(item.location?.country || '')) { rejected++; continue; }
        if (seen.has(item.id)) throw new SourceRequestError('SMARTRECRUITERS_DUPLICATE_PAGE');
        seen.add(item.id);
        const detail = JSON.parse(await this.request(`${ATS}${employer.key}/postings/${item.id}`));
        let job = normalizeSmartRecruitersJob(detail, employer);
        // Some ATS records are aliases of a second public posting (observed at
        // LEONI). Verify that canonical record independently before accepting it.
        if (!job && String(detail.id) === String(item.id) && typeof detail.refNumber === 'string' && detail.refNumber) {
          const canonicalId = typeof detail.postingUrl === 'string'
            ? detail.postingUrl.match(new RegExp(`^https://jobs\\.smartrecruiters\\.com/${employer.key}/(\\d+)(?:-|/|$)`))?.[1] : undefined;
          if (canonicalId && canonicalId !== String(detail.id)) {
            const canonical = JSON.parse(await this.request(`${ATS}${employer.key}/postings/${canonicalId}`));
            const verified = normalizeSmartRecruitersJob(canonical, employer);
            if (verified && String(canonical.id) === canonicalId && detail.active === canonical.active
              && detail.visibility === 'PUBLIC' && countryTN(detail.location?.country || '')
              && detail.refNumber === canonical.refNumber && detail.name === canonical.name
              && detail.location?.city === canonical.location?.city && JSON.stringify(detail.jobAd) === JSON.stringify(canonical.jobAd)) {
              job = { ...verified, id: `sr:${employer.key}:${detail.id}` };
            }
          }
        }
        if (job && String(detail.id) === String(item.id)) jobs.push(job); else rejected++;
      }
      if ((page * 100) + data.content.length >= total) { complete = true; break; }
    }
    return { jobs, total, complete, rejected };
  }

  async fetchJobs(): Promise<ExternalJobSearchResult> {
    if (!this.isConfigured()) throw new SourceRequestError('COMPANY_SOURCE_DISABLED');
    this.reports.length = 0;
    const jobs: ExternalJobListing[] = [], warnings: string[] = [];
    const completedScopes: NonNullable<ExternalJobSearchResult['completedScopes']> = [];
    let complete = true, rejected = 0, successful = 0;
    const collectors = [
      { name: 'EY', prefix: 'ey:', run: () => this.collectEy() },
      { name: 'Sofrecom Tunisie', prefix: 'sofrecom:', run: () => this.collectSofrecom() },
      ...EMPLOYERS.map(employer => ({ name: employer.name, prefix: `sr:${employer.key}:`, run: () => this.collectSmartRecruiters(employer) })),
    ];
    for (const collector of collectors) {
      try {
        const result = await collector.run();
        successful++; jobs.push(...result.jobs); rejected += result.rejected || 0;
        warnings.push(...(result.warnings || []).map(warning => `${collector.name}:${warning}`));
        complete = complete && result.complete === true;
        if (result.complete && !result.rejected) completedScopes.push({ prefix: collector.prefix, presentIds: result.jobs.map(job => job.id) });
        else warnings.push(`${collector.name}:INCOMPLETE_SNAPSHOT`);
        this.reports.push({ employer: collector.name, status: result.complete && !result.rejected && !result.warnings?.length ? 'OK' : 'PARTIAL', count: result.jobs.length,
          ...(result.warnings?.length ? { detail: result.warnings.join('; ') } : {}) });
      } catch (error) {
        complete = false;
        const code = error instanceof SourceRequestError ? error.code : 'COLLECTION_FAILED';
        warnings.push(`${collector.name}:${code}`);
        this.reports.push({ employer: collector.name, status: error instanceof SourceRequestError && [401, 403, 429].includes(error.httpStatus || 0) ? 'BLOCKED' : 'ERROR', count: 0, detail: code });
      }
    }
    // ADP's public portal currently denies automated requests. Check once per run;
    // never use proxy rotation or cached search snippets as fabricated live jobs.
    try {
      await this.request(ADP_SEARCH);
      this.reports.push({ employer: 'ADP', status: 'PARTIAL', count: 0, detail: 'Portal reachable; full listing connector pending verification.' });
      warnings.push('ADP:CONNECTOR_PENDING');
    } catch (error) {
      const code = error instanceof SourceRequestError ? error.code : 'COLLECTION_FAILED';
      this.reports.push({ employer: 'ADP', status: 'BLOCKED', count: 0, detail: code });
      warnings.push(`ADP:${code}`);
    }
    this.logger.log(JSON.stringify({ source: this.type, employers: this.reports }));
    if (!successful) throw new SourceRequestError('COMPANY_ALL_SOURCES_FAILED');
    // Completeness covers implemented collectors only. ADP has never
    // imported records and is reported explicitly as pending/blocked, not active.
    return { jobs: [...new Map(jobs.map(job => [job.id, job])).values()], total: jobs.length, complete, rejected, warnings, completedScopes };
  }
}
