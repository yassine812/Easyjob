import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CompanyResult } from './providers/company-provider';
import { GleifProvider } from './providers/gleif.provider';
import { OpenCorporatesProvider } from './providers/opencorporates.provider';
import { LocalCompanyIndexProvider, computeTextRelevance, normalizeCompanyName } from './providers/local-company.provider';
import { CompanyLogoProvider } from './providers/company-logo.provider';

type CachedSearch = { expiresAt: number; results: CompanyResult[]; providerAvailable: boolean };

@Injectable()
export class CompanyDirectoryService {
  private readonly logger = new Logger(CompanyDirectoryService.name);
  private readonly cache = new Map<string, CachedSearch>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly openCorporates: OpenCorporatesProvider,
    private readonly gleif: GleifProvider,
    private readonly localIndex: LocalCompanyIndexProvider,
    private readonly logos: CompanyLogoProvider,
  ) {}

  async search(query: string, countryCode?: string): Promise<{ results: CompanyResult[]; providerAvailable: boolean }> {
    const normalized = query.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (normalized.length < 2) return { results: [], providerAvailable: true };
    // Version the cache key whenever ranking/filter semantics change so stale
    // broad result sets cannot survive a deployment.
    const key = `company-search:v2:${(countryCode ?? '').toUpperCase()}:${normalized.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return { results: cached.results, providerAvailable: cached.providerAvailable };

    const [localResults, openCorporatesResults, gleifResults] = await Promise.all([
      this.localIndex.search(normalized, countryCode, 12),
      this.openCorporates.search(normalized, countryCode, 10),
      this.gleif.search(normalized, countryCode, 10),
    ]);
    const providerAvailable = localResults.length > 0 || openCorporatesResults.length > 0 || gleifResults.length > 0;
    this.logger.debug(`Company search: query=${normalized} country=${countryCode ?? '-'} Local candidates: ${localResults.length} OpenCorporates candidates: ${openCorporatesResults.length} GLEIF candidates: ${gleifResults.length}`);
    const merged = [...localResults, ...openCorporatesResults, ...gleifResults]
      // Country is a ranking signal only. It must never rescue an unrelated
      // company into the query results.
      .filter((company) => computeTextRelevance(normalized, company) >= 55);
    const deduped = new Map<string, CompanyResult>();
    for (const company of merged) {
      const domain = company.domain?.toLowerCase().replace(/^www\./, '');
      const key = domain ? `domain:${domain}` : `name:${normalizeCompanyName(company.name)}:${(company.countryCode ?? '').toUpperCase()}`;
      const previous = deduped.get(key);
      if (!previous || (company.source === 'local' && previous.source !== 'local')) deduped.set(key, company);
    }
    const results = [...deduped.values()].slice(0, 10).map((company) => ({ ...company, logoUrl: this.logos.resolve(company) }));
    this.logger.debug(`Company search: Merged candidates: ${deduped.size} Returned: ${results.length}`);
    if (!results.length) this.logger.debug(`No company results for query "${normalized}".`);
    this.cache.set(key, { expiresAt: Date.now() + 15 * 60_000, results, providerAvailable });
    return { results, providerAvailable };
  }

  /** Persist a user-entered company as a pending local directory record. */
  async rememberManualCompany(name: string, countryCode?: string, location?: string, website?: string) {
    const displayName = name.trim().replace(/\s+/g, ' ').slice(0, 255);
    if (!displayName) return null;
    const normalized = normalizeCompanyName(displayName);
    const existing = await this.prisma.company.findFirst({
      where: { OR: [{ commercialName: { equals: displayName, mode: 'insensitive' } }, { legalName: { equals: displayName, mode: 'insensitive' } }] },
      select: { id: true },
    });
    if (existing) return existing.id;
    const slugBase = `${normalized.replace(/\s+/g, '-') || 'company'}${countryCode ? `-${countryCode.toLowerCase()}` : ''}`.slice(0, 180);
    const slug = `${slugBase}-${Date.now().toString(36).slice(-6)}`;
    const created = await this.prisma.company.create({
      data: { legalName: displayName, commercialName: displayName, slug, website: website?.trim() || null, city: location?.trim() || null, country: countryCode?.toUpperCase() || null, status: 'PENDING_VERIFICATION' },
      select: { id: true },
    });
    return created.id;
  }
}
