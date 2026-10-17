import { Injectable, Logger } from '@nestjs/common';
import type { CompanyProvider, CompanyResult } from './company-provider';

@Injectable()
export class GleifProvider implements CompanyProvider {
  private readonly logger = new Logger(GleifProvider.name);

  async search(query: string, countryCode?: string, limit = 8): Promise<CompanyResult[]> {
    const params = new URLSearchParams({ 'filter[entity.legalName]': query, 'page[size]': String(Math.min(limit, 20)) });
    if (countryCode) params.set('filter[entity.legalAddress.country]', countryCode.toUpperCase());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`https://api.gleif.org/api/v1/lei-records?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/vnd.api+json' } });
      if (!response.ok) throw new Error(`GLEIF returned HTTP ${response.status}`);
      const payload = await response.json() as { data?: Array<{ id?: string; attributes?: Record<string, any> }> };
      return (payload.data ?? []).slice(0, limit).map((entry) => {
        const attrs = entry.attributes ?? {};
        const entity = attrs.entity ?? {};
        const legalAddress = entity.legalAddress ?? {};
        return {
          id: `gleif:${entry.id ?? crypto.randomUUID()}`,
          name: String(entity.legalName?.name ?? 'Unnamed company'),
          countryCode: typeof legalAddress.country === 'string' ? legalAddress.country : null,
          countryName: null,
          city: typeof legalAddress.city === 'string' ? legalAddress.city : null,
          address: typeof legalAddress.addressLines?.[0] === 'string' ? legalAddress.addressLines[0] : null,
          website: null,
          domain: null,
          logoUrl: null,
          provider: 'gleif',
          source: 'external',
        } satisfies CompanyResult;
      });
    } catch (error) {
      this.logger.warn(`GLEIF search failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
