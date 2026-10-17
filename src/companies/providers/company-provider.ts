export interface CompanyResult {
  id: string;
  name: string;
  countryCode?: string | null;
  countryName?: string | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  domain?: string | null;
  logoUrl?: string | null;
  provider: string;
  aliases?: string[];
  source?: 'local' | 'external';
}

export interface CompanyProvider {
  search(query: string, countryCode?: string, limit?: number): Promise<CompanyResult[]>;
}

export function providerUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
}
