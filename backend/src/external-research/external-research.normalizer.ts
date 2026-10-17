import { ExternalResearchResult, ResearchQueryType, ResearchSource } from './external-research.types';

function clean(value: unknown, max = 1000): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

export function normalizeResearchResult(input: Partial<ExternalResearchResult> & { query_type: ResearchQueryType; provider?: string; status?: ExternalResearchResult['status'] }): ExternalResearchResult {
  const sources = Array.isArray(input.sources) ? input.sources.filter((source): source is ResearchSource => Boolean(source?.source_url && source?.type && source?.provider)).slice(0, 20).map(source => ({
    source_url: String(source.source_url).slice(0, 2000), type: source.type, provider: String(source.provider).slice(0, 100), fetched_at: String(source.fetched_at),
    ...(source.title ? { title: String(source.title).slice(0, 300) } : {}), ...(source.snippet ? { snippet: String(source.snippet).slice(0, 600) } : {}),
    ...(source.normalized_fact ? { normalized_fact: String(source.normalized_fact).slice(0, 600) } : {}),
  })) : [];
  return {
    company_name: clean(input.company_name, 300), website: clean(input.website, 2000), summary: clean(input.summary, 2000),
    products: Array.isArray(input.products) ? input.products.map(value => clean(value, 200)).filter((value): value is string => Boolean(value)).slice(0, 20) : [],
    technologies: Array.isArray(input.technologies) ? input.technologies.map(value => clean(value, 100)).filter((value): value is string => Boolean(value)).slice(0, 30) : [],
    public_repositories: Array.isArray(input.public_repositories) ? input.public_repositories.map(repo => ({ name: clean(repo?.name, 200) ?? 'Repository', url: clean(repo?.url, 2000) ?? '', ...(repo?.description ? { description: clean(repo.description, 500) } : {}) })).filter(repo => repo.url).slice(0, 20) : [],
    sources, status: input.status ?? 'COMPLETED', provider: input.provider ?? 'agent-reach', query_type: input.query_type, fetched_at: input.fetched_at ?? new Date().toISOString(),
    ...(input.error ? { error: String(input.error).slice(0, 500) } : {}),
  };
}

export function emptyResearchResult(queryType: ResearchQueryType, status: ExternalResearchResult['status'], error?: string): ExternalResearchResult {
  return normalizeResearchResult({ query_type: queryType, status, provider: 'agent-reach', ...(error ? { error } : {}) });
}
