import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CONFIG, AppConfig, ExternalResearchConfig } from '../config/configuration';
import { assertAllowedResearchSource, assertPublicUrl } from './external-research.security';
import { normalizeResearchResult } from './external-research.normalizer';
import { CompanyResearchInput, ExternalResearchProvider, ExternalResearchResult, JobResearchInput } from './external-research.types';
import { ReaBrowserResearchService } from './rea-browser-research.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class AgentReachResearchProvider implements ExternalResearchProvider {
  private readonly logger = new Logger(AgentReachResearchProvider.name);
  private readonly settings: ExternalResearchConfig;
  constructor(@Inject(CONFIG) private readonly config: AppConfig, @Optional() private readonly rea?: ReaBrowserResearchService) {
    this.settings = config.externalResearch ?? { enabled: false, agentReachEnabled: false, command: 'agent-reach', reaEnabled: false, reaCommand: 'rea', reaArgs: [], reaTimeoutMs: 30000, timeoutMs: 15000, maxRetries: 2, circuitBreakerFailures: 3, circuitBreakerCooldownMs: 60000, allowedSources: ['web', 'github', 'rss'], ttlDays: { company: 7, technology: 14, github: 3, rssHours: 3 } };
  }

  async doctor() {
    if (!this.settings.enabled || !this.settings.agentReachEnabled) return { ok: false, detail: 'disabled' };
    try {
      const result = await execFileAsync(this.settings.command, ['doctor', '--json'], { timeout: this.settings.timeoutMs, windowsHide: true, maxBuffer: 256 * 1024 });
      const parsed = JSON.parse(result.stdout || '{}') as { version?: string; ok?: boolean };
      return { ok: parsed.ok !== false, version: parsed.version, detail: parsed.ok === false ? 'doctor reported a failure' : undefined };
    } catch (error) {
      this.logger.warn(`Agent Reach doctor unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return { ok: false, detail: 'agent-reach command unavailable' };
    }
  }

  private async readPublicPage(url: string): Promise<{ title?: string; text: string }> {
    const safe = assertPublicUrl(url);
    const response = await fetch(`https://r.jina.ai/http://${safe.replace(/^https?:\/\//, '')}`, { signal: AbortSignal.timeout(this.settings.timeoutMs), headers: { accept: 'text/plain' } });
    if (!response.ok) throw new Error(`public page returned ${response.status}`);
    const text = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 6000);
    return { text };
  }

  private base(query_type: ExternalResearchResult['query_type']) { return { query_type, provider: 'agent-reach', fetched_at: new Date().toISOString() }; }

  async researchCompany(input: CompanyResearchInput): Promise<ExternalResearchResult> {
    const website = input.website ? assertPublicUrl(input.website) : null;
    const sources = [] as ExternalResearchResult['sources'];
    let summary: string | null = null;
    if (website && this.settings.allowedSources.includes('web')) {
      assertAllowedResearchSource('web', this.settings.allowedSources);
      const page = await this.readPublicPage(website);
      summary = page.text.slice(0, 1800);
      sources.push({ source_url: website, type: 'web', provider: 'agent-reach/jina', fetched_at: new Date().toISOString(), title: input.companyName, snippet: page.text.slice(0, 600), normalized_fact: 'Public company website content' });
    }
    const repos = await this.githubRepos(input.companyName);
    for (const repo of repos) sources.push({ source_url: repo.url, type: 'github', provider: 'agent-reach/github', fetched_at: new Date().toISOString(), title: repo.name, snippet: repo.description ?? undefined, normalized_fact: 'Public GitHub repository metadata' });
    if (this.settings.allowedSources.includes('rss')) {
      for (const rssUrl of (input.rssUrls ?? []).slice(0, 3)) {
        assertAllowedResearchSource('rss', this.settings.allowedSources);
        const item = await this.readRss(rssUrl);
        if (item) sources.push(item);
      }
    }
    if (website && this.rea) {
      const deep = await this.rea.inspectPublicPage(website);
      if (deep) {
        if (!summary && deep.text) summary = deep.text;
        sources.push({ source_url: website, type: 'web', provider: 'rea-browser', fetched_at: new Date().toISOString(), title: deep.title ?? input.companyName, snippet: deep.text?.slice(0, 600), normalized_fact: 'Public page structure observed by REA' });
      }
    }
    return normalizeResearchResult({ ...this.base('company'), company_name: input.companyName, website, summary, public_repositories: repos, sources, technologies: repos.length ? ['GitHub public activity'] : [] });
  }

  async researchJobContext(input: JobResearchInput): Promise<ExternalResearchResult> {
    const company = await this.researchCompany({ companyName: input.companyName, website: input.website });
    const techs = [...new Set([...(input.technologies ?? []), ...company.technologies].map(value => value.trim()).filter(Boolean))].slice(0, 20);
    return normalizeResearchResult({ ...this.base('job_context'), company_name: input.companyName, website: company.website, summary: company.summary ?? `Contexte public pour le poste ${input.title}${input.seniority ? ` (${input.seniority})` : ''}.`, products: company.products, technologies: techs, public_repositories: company.public_repositories, sources: company.sources });
  }

  async researchTechnology(technology: string): Promise<ExternalResearchResult> {
    return normalizeResearchResult({ ...this.base('technology'), summary: `Contexte public de la technologie ${technology}.`, technologies: [technology], sources: [] });
  }

  private async githubRepos(companyName: string) {
    if (!this.settings.allowedSources.includes('github')) return [];
    const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(companyName)}&per_page=5`, { signal: AbortSignal.timeout(this.settings.timeoutMs), headers: { accept: 'application/vnd.github+json', 'user-agent': 'EasyJob-AgentReach' } });
    if (!response.ok) return [];
    const data = await response.json() as { items?: Array<{ full_name?: string; html_url?: string; description?: string | null }> };
    return (data.items ?? []).filter(item => item.html_url).map(item => ({ name: item.full_name ?? 'Repository', url: item.html_url!, description: item.description }));
  }

  private async readRss(rssUrl: string) {
    const safe = assertPublicUrl(rssUrl);
    const response = await fetch(safe, { signal: AbortSignal.timeout(this.settings.timeoutMs), headers: { accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!response.ok) return null;
    const xml = (await response.text()).slice(0, 100_000);
    const title = /<title[^>]*>([^<]+)<\/title>/i.exec(xml)?.[1]?.trim();
    const link = /<link[^>]*>([^<]+)<\/link>/i.exec(xml)?.[1]?.trim();
    return { source_url: safe, type: 'rss' as const, provider: 'agent-reach/rss', fetched_at: new Date().toISOString(), ...(title ? { title: title.slice(0, 300) } : {}), ...(link ? { normalized_fact: `Public RSS item: ${link.slice(0, 500)}` } : {}) };
  }
}
