import { Injectable } from '@nestjs/common';
import type { CompanyResult } from './company-provider';

/**
 * Resolves branding separately from company matching. It never blocks search:
 * a trusted domain becomes a cacheable logo URL and the UI still has initials
 * when the image is unavailable.
 */
@Injectable()
export class CompanyLogoProvider {
  private readonly cache = new Map<string, string | null>();

  resolve(company: CompanyResult): string | null {
    if (company.logoUrl) return company.logoUrl;
    const domain = company.domain?.toLowerCase().replace(/^www\./, '').trim();
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return null;
    if (!this.cache.has(domain)) this.cache.set(domain, `https://logo.clearbit.com/${domain}`);
    return this.cache.get(domain) ?? null;
  }
}
