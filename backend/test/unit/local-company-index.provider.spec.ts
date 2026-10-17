import { LocalCompanyIndexProvider } from '../../src/companies/providers/local-company.provider';
import { CompanyDirectoryService } from '../../src/companies/company-directory.service';

describe('LocalCompanyIndexProvider', () => {
  const provider = new LocalCompanyIndexProvider({ company: { findMany: async () => [] } } as any);

  it('ranks the EY alias for a short Tunisia query', async () => {
    const results = await provider.search('ey', 'TN');
    expect(results[0]).toMatchObject({ name: 'Ernst & Young', countryCode: 'TN', source: 'local' });
    expect(results[0].aliases).toContain('EY');
  });

  it('does not fill a Vermeg query with unrelated Tunisian companies', async () => {
    const results = await provider.search('vermeg', 'TN');
    expect(results.map((result) => result.name)).toEqual(['Vermeg']);
    expect(results.map((result) => result.name)).not.toEqual(expect.arrayContaining(['AB Serve Tunisia', 'Ernst & Young', 'Orange']));
  });

  it.each([
    ['ver', 'Vermeg'], ['vermg', 'Vermeg'], ['kpmg', 'KPMG'], ['deloitte', 'Deloitte'],
    ['orange', 'Orange'], ['ab serve', 'AB Serve Tunisia'], ['sofrec', 'Sofrecom Tunisia'],
  ])('supports %s without live providers', async (query, expected) => {
    const results = await provider.search(query, 'TN');
    expect(results.some((result) => result.name === expected)).toBe(true);
  });

  it('filters unrelated external candidates before country ranking', async () => {
    const company = (id: string, name: string, domain?: string) => ({ id, name, domain: domain ?? null, aliases: [], countryCode: 'TN', countryName: 'Tunisia', city: 'Tunis', logoUrl: null, provider: 'mock', source: 'external' as const });
    const directory = new CompanyDirectoryService(
      { company: { findFirst: async () => null } } as any,
      { search: async () => [company('v', 'Vermeg', 'vermeg.com'), company('a', 'AB Serve Tunisia'), company('e', 'Ernst & Young', 'ey.com'), company('o', 'Orange', 'orange.tn')] } as any,
      { search: async () => [] } as any,
      { search: async () => [] } as any,
      { resolve: (value: any) => value.domain ? `https://logo.clearbit.com/${value.domain}` : null } as any,
    );
    const response = await directory.search('vermeg', 'TN');
    expect(response.results.map((result) => result.name)).toEqual(['Vermeg']);
    expect(response.results[0].logoUrl).toBe('https://logo.clearbit.com/vermeg.com');
  });
});
