import { SourceRequestError } from './licensed-feed.adapter';
import { decodeHtml, htmlText, sourceDate } from './public-html';
import type { ExternalJobListing } from './job-source.types';

export function tanitUrl(raw: string, base = 'https://www.tanitjobs.com/jobs/'): URL {
  const url = new URL(decodeHtml(raw), base);
  if (url.origin !== 'https://www.tanitjobs.com' || url.username || url.password) throw new SourceRequestError('TANITJOBS_HOST_NOT_ALLOWED');
  return url;
}
function field(html: string, cls: string): string {
  return html.match(new RegExp(`<([a-z]+)\\b[^>]*class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'))?.[2] || '';
}

/** Public search cards are excerpts, not invented full job descriptions. */
export function parseTanitJobsPage(html: string, page = 1) {
  const count = html.match(/<span[^>]*>([\d\s]+)<\/span>\s*offres disponibles/i);
  if (!count) throw new SourceRequestError('TANITJOBS_INDEX_SCHEMA_CHANGED');
  const total = Number(count[1].replace(/\s/g, ''));
  const jobs: ExternalJobListing[] = [];
  let rejected = 0;
  const cards = [...html.matchAll(/<div\b[^>]*class=["']sj-job-card\b[^"']*["'][^>]*id=["'](\d+)["'][^>]*>/gi)];
  for (let i = 0; i < cards.length; i++) {
    const end = cards[i + 1]?.index ?? html.indexOf('sj-load-more', cards[i].index!);
    const card = html.slice(cards[i].index!, end < 0 ? undefined : end);
    const id = cards[i][1], title = htmlText(field(card, 'sj-card-title'));
    const rawUrl = field(card, 'sj-card-title').match(/href=["']([^"']+)/i)?.[1];
    let url: URL;
    try { url = tanitUrl(rawUrl || ''); } catch { rejected++; continue; }
    const description = htmlText(field(card, 'sj-card-desc'));
    if (!title || !description || !new RegExp(`^/job/${id}/`).test(url.pathname)) { rejected++; continue; }
    const companyName = htmlText(field(card, 'sj-card-company').match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '') || null;
    const location = htmlText(field(card, 'sj-loc')) || null;
    const employmentType = htmlText(field(card, 'sj-type')) || null;
    const publishedAt = sourceDate(htmlText(field(card, 'sj-card-date')));
    jobs.push({ id: `tanitjobs:${id}`, reference: `tanitjobs:${id}`, title, description, companyName, location,
      country: location && /\bTunisi[ae]\b/i.test(location) ? 'TN' : null,
      employmentType, contractType: employmentType, publishedAt, sourceUpdatedAt: null, salaryText: null,
      status: /Offre\s+cl[oô]tur[eé]e/i.test(htmlText(card)) ? 'CLOSED' : 'OPEN',
      workplaceType: /\bHybride\b/i.test(htmlText(field(card, 'sj-card-tags'))) ? 'HYBRID' : null,
      url: url.href, applicationUrl: url.href, sourceLabel: 'Tanitjobs',
      rawMetadata: { method: 'public-search-card', descriptionIsExcerpt: true, originalUrl: url.href } });
  }
  let next: string | null = null;
  for (const link of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*\bsj-page-btn\b[^"']*["'][^>]*>/gi)) {
    const url = tanitUrl(link[1]);
    if (url.pathname === '/jobs/' && url.searchParams.get('page') === String(page + 1)) next = url.href;
  }
  if (total > 0 && !cards.length) throw new SourceRequestError('TANITJOBS_EMPTY_UNVERIFIED_PAGE');
  return { jobs, total, next, rejected };
}

export function parseTanitJobDetail(html: string, expectedId: string): ExternalJobListing {
  const id = expectedId.replace(/^tanitjobs:/, '');
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let raw: any;
    try { raw = JSON.parse(script[1]); } catch { continue; }
    if (raw?.['@type'] !== 'JobPosting') continue;
    const url = tanitUrl(raw.url);
    if (!new RegExp(`^/job/${id}/`).test(url.pathname) || !raw.title || !raw.description) throw new SourceRequestError('TANITJOBS_DETAIL_ID_MISMATCH');
    const address = raw.jobLocation?.address || {};
    const parseDate = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v) : null;
    const closingAt = parseDate(raw.validThrough), publishedAt = parseDate(raw.datePosted);
    const country = typeof address.addressCountry === 'string' ? address.addressCountry : address.addressCountry?.name;
    return { id: `tanitjobs:${id}`, reference: `tanitjobs:${id}`, title: htmlText(raw.title), description: htmlText(raw.description),
      companyName: raw.hiringOrganization?.name || null, location: [address.addressLocality, address.addressRegion, country].filter(Boolean).join(', ') || null,
      country: /^(TN|Tunisie|Tunisia)$/i.test(country || '') ? 'TN' : country || null,
      city: address.addressLocality || null, region: address.addressRegion || null, companyIndustry: raw.occupationalCategory?.trim() || null,
      employmentType: Array.isArray(raw.employmentType) ? raw.employmentType.join(', ') : raw.employmentType || null,
      salaryText: null, publishedAt, closingAt, sourceUpdatedAt: null, sourceLabel: 'Tanitjobs', url: url.href, applicationUrl: url.href,
      status: closingAt && closingAt <= new Date() ? 'EXPIRED' : 'OPEN',
      rawMetadata: { method: 'public-jobposting-jsonld', originalUrl: url.href } };
  }
  throw new SourceRequestError('TANITJOBS_DETAIL_SCHEMA_CHANGED');
}
