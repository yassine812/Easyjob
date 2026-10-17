import { Injectable, Logger } from '@nestjs/common';
import type { CompanyProvider, CompanyResult } from './company-provider';
import { providerUrl } from './company-provider';

const JURISDICTION_BY_COUNTRY: Record<string, string> = {
  TN: 'tn', FR: 'fr', DE: 'de', GB: 'gb', IE: 'ie', NL: 'nl', ES: 'es', IT: 'it',
};

@Injectable()
export class OpenCorporatesProvider implements CompanyProvider {
  private readonly logger = new Logger(OpenCorporatesProvider.name);
  private warnedMissingToken = false;

  async search(query: string, countryCode?: string, limit = 8): Promise<CompanyResult[]> {
    const token = process.env.OPENCORPORATES_API_TOKEN?.trim();
    if (!token) {
      if (!this.warnedMissingToken) {
        this.warnedMissingToken = true;
        this.logger.warn('OPENCORPORATES_API_TOKEN is not configured; using the GLEIF/local fallback.');
      }
      return [];
    }
    const params = new URLSearchParams({ q: query, order: 'score', per_page: String(Math.min(limit, 30)), api_token: token });
    const jurisdiction = countryCode ? JURISDICTION_BY_COUNTRY[countryCode.toUpperCase()] : undefined;
    if (jurisdiction) params.set('jurisdiction_code', jurisdiction);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`https://api.opencorporates.com/v0.4/companies/search?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`OpenCorporates returned HTTP ${response.status}`);
      const payload = await response.json() as { companies?: { companies?: Array<Record<string, unknown>> } };
      return (payload.companies?.companies ?? []).slice(0, limit).map((item) => this.normalize(item));
    } catch (error) {
      this.logger.warn(`OpenCorporates search failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalize(item: Record<string, unknown>): CompanyResult {
    const address = item.registered_address as Record<string, unknown> | undefined;
    const countryCode = typeof item.jurisdiction_code === 'string' ? item.jurisdiction_code.slice(0, 2).toUpperCase() : null;
    const website = providerUrl(item.homepage_url);
    return {
      id: `opencorporates:${String(item.company_number ?? item.opencorporates_url ?? item.name ?? crypto.randomUUID())}`,
      name: String(item.name ?? 'Unnamed company'),
      countryCode,
      countryName: typeof address?.country === 'string' ? address.country : null,
      city: typeof address?.city === 'string' ? address.city : null,
      address: typeof item.registered_address_in_full === 'string' ? item.registered_address_in_full : null,
      website,
      domain: website ? new URL(website).hostname : null,
      logoUrl: null,
      provider: 'opencorporates',
      source: 'external',
    };
  }
}
