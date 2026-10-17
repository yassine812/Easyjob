import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyProvider, CompanyResult } from './company-provider';
import seedCompanies from '../data/company-index.json';

type LocalRecord = {
  id: string; name: string; aliases: string[]; countryCode?: string; countryName?: string;
  city?: string; website?: string; domain?: string; logoUrl?: string | null;
};

export function normalizeCompanyName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/\b(ltd|llc|sarl|sa|sas|inc|plc|gmbh)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function editSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]; previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = saved;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

/** Returns a textual score before country/popularity bonuses are applied. */
export function computeTextRelevance(query: string, company: Pick<CompanyResult, 'name' | 'aliases' | 'domain'>): number {
  const normalizedQuery = normalizeCompanyName(query);
  if (!normalizedQuery) return 0;
  const domainName = company.domain ? company.domain.replace(/^www\./i, '').split('.')[0] : '';
  const names = [company.name, ...(company.aliases ?? []), domainName].filter(Boolean).map(normalizeCompanyName);
  let best = 0;
  const shortQuery = normalizedQuery.length <= 3;
  names.forEach((name, index) => {
    if (name === normalizedQuery) best = Math.max(best, index ? 100 : 100);
    else if (name.startsWith(normalizedQuery)) best = Math.max(best, 95);
    else if (name.split(' ').some((token) => token.startsWith(normalizedQuery))) best = Math.max(best, 90);
    else if (!shortQuery && name.includes(normalizedQuery)) best = Math.max(best, 80);
    // Short acronyms are intentionally strict; fuzzy matching only applies to
    // longer queries where a typo such as "vermg" is meaningful.
    else if (!shortQuery) {
      const similarity = editSimilarity(normalizedQuery, name);
      if (similarity >= 0.72) best = Math.max(best, Math.round(similarity * 70));
    }
  });
  return best;
}

function score(query: string, record: LocalRecord, countryCode?: string): number {
  const textScore = computeTextRelevance(query, record);
  if (textScore < 55) return 0;
  return textScore + (countryCode && record.countryCode?.toUpperCase() === countryCode.toUpperCase() ? 40 : 0);
}

@Injectable()
export class LocalCompanyIndexProvider implements CompanyProvider {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, countryCode?: string, limit = 10): Promise<CompanyResult[]> {
    const normalizedQuery = normalizeCompanyName(query);
    const seeded = seedCompanies as LocalRecord[];
    const records: LocalRecord[] = [...seeded];
    const local = await this.prisma.company.findMany({
      where: { OR: [{ commercialName: { contains: query, mode: 'insensitive' } }, { legalName: { contains: query, mode: 'insensitive' } }] },
      select: { id: true, commercialName: true, legalName: true, website: true, logoKey: true, city: true, country: true }, take: 100,
    });
    local.forEach((company) => {
      let domain: string | undefined;
      try { domain = company.website ? new URL(company.website).hostname : undefined; } catch { domain = undefined; }
      records.push({ id: `easyjob:${company.id}`, name: company.commercialName || company.legalName, aliases: [company.legalName], countryName: company.country ?? undefined, city: company.city ?? undefined, website: company.website ?? undefined, domain, logoUrl: company.logoKey ? `/companies/${company.id}/logo` : null });
    });
    return records.map((record) => ({ record, value: score(normalizedQuery, record, countryCode) }))
      .filter(({ value }) => value > 0)
      .sort((a, b) => b.value - a.value || a.record.name.localeCompare(b.record.name))
      .slice(0, limit)
      .map(({ record }) => ({ id: record.id, name: record.name, aliases: record.aliases, countryCode: record.countryCode ?? null, countryName: record.countryName ?? null, city: record.city ?? null, address: null, website: record.website ?? null, domain: record.domain ?? null, logoUrl: record.logoUrl ?? null, provider: 'local', source: 'local' }));
  }
}
