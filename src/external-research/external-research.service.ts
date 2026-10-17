import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { CONFIG, AppConfig, ExternalResearchConfig } from '../config/configuration';
import { QUEUES } from '../common/constants/queues';
import { ExternalResearchCacheService } from './external-research-cache.service';
import { normalizeResearchQuery } from './external-research.security';
import { emptyResearchResult } from './external-research.normalizer';
import { CompanyResearchInput, ExternalResearchResult, JobResearchInput, RESEARCH_PROVIDER, ResearchProvider, ResearchQueryType } from './external-research.types';

@Injectable()
export class ExternalResearchService {
  private readonly logger = new Logger(ExternalResearchService.name);
  private failures = 0;
  private circuitOpenedAt = 0;
  private readonly settings: ExternalResearchConfig;
  constructor(@Inject(CONFIG) private readonly config: AppConfig, @Inject(RESEARCH_PROVIDER) private readonly provider: ResearchProvider, private readonly cache: ExternalResearchCacheService, @InjectQueue(QUEUES.EXTERNAL_RESEARCH) private readonly queue: Queue) {
    this.settings = config.externalResearch ?? { enabled: false, agentReachEnabled: false, command: 'agent-reach', reaEnabled: false, reaCommand: 'rea', reaArgs: [], reaTimeoutMs: 30000, timeoutMs: 15000, maxRetries: 2, circuitBreakerFailures: 3, circuitBreakerCooldownMs: 60000, allowedSources: ['web', 'github', 'rss'], ttlDays: { company: 7, technology: 14, github: 3, rssHours: 3 } };
  }

  isEnabled() { return this.settings.enabled && this.settings.agentReachEnabled; }
  private key(type: ResearchQueryType, query: unknown) { return createHash('sha256').update(`${type}:${JSON.stringify(query)}`).digest('hex'); }
  private ttl(type: ResearchQueryType) { const days = type === 'company' || type === 'interview_context' ? this.settings.ttlDays.company : type === 'technology' ? this.settings.ttlDays.technology : this.settings.ttlDays.github; return days * 86400000; }
  private circuitOpen() { return this.failures >= this.settings.circuitBreakerFailures && Date.now() - this.circuitOpenedAt < this.settings.circuitBreakerCooldownMs; }
  private recordFailure() { this.failures += 1; if (this.failures >= this.settings.circuitBreakerFailures) this.circuitOpenedAt = Date.now(); }
  private recordSuccess() { this.failures = 0; this.circuitOpenedAt = 0; }

  private async run(type: ResearchQueryType, query: unknown, execute: () => Promise<ExternalResearchResult>): Promise<ExternalResearchResult> {
    const startedAt = Date.now();
    if (!this.isEnabled()) { this.logger.debug(`research type=${type} status=disabled durationMs=${Date.now() - startedAt}`); return emptyResearchResult(type, 'DISABLED'); }
    if (this.circuitOpen()) { this.logger.warn(`research type=${type} status=circuit-open`); return emptyResearchResult(type, 'UNAVAILABLE', 'external research circuit is open'); }
    const normalized = normalizeResearchQuery(JSON.stringify(query));
    const key = this.key(type, query);
    const cached = await this.cache.getFresh(key);
    if (cached) { this.logger.debug(`research type=${type} status=cache-hit durationMs=${Date.now() - startedAt}`); return { ...cached, status: 'CACHED' }; }
    let lastError = 'research unavailable';
    for (let attempt = 0; attempt <= this.settings.maxRetries; attempt += 1) {
      try {
        const result = await Promise.race([execute(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('research timeout')), this.settings.timeoutMs))]);
        this.recordSuccess();
        await this.cache.writeSuccess(key, 'agent-reach', type, normalized, result, new Date(Date.now() + this.ttl(type)));
        this.logger.debug(`research type=${type} status=completed durationMs=${Date.now() - startedAt}`);
        return result;
      } catch (error) { lastError = error instanceof Error ? error.message : 'research unavailable'; }
    }
    this.recordFailure();
    const fallback = emptyResearchResult(type, 'UNAVAILABLE', lastError);
    await this.cache.writeFailure(key, 'agent-reach', type, normalized, fallback, new Date(Date.now() + 60_000), lastError);
    this.logger.warn(`external research failed type=${type} durationMs=${Date.now() - startedAt}`);
    return fallback;
  }

  researchCompany(input: CompanyResearchInput) { return this.run('company', input, () => this.provider.researchCompany(input)); }
  researchJobContext(input: JobResearchInput) { return this.run('job_context', input, () => this.provider.researchJobContext(input)); }
  researchInterviewContext(input: JobResearchInput) { return this.run('interview_context', input, async () => ({ ...await this.provider.researchJobContext(input), query_type: 'interview_context' as const })); }
  researchTechnology(technology: string) { return this.run('technology', { technology }, () => this.provider.researchTechnology(technology)); }
  async enqueueCompany(input: CompanyResearchInput) { if (!this.isEnabled()) return { status: 'DISABLED' as const }; const job = await this.queue.add('company', input, { jobId: `company:${this.key('company', input)}` }); return { status: 'QUEUED' as const, jobId: job.id }; }
  async enqueueJobContext(input: JobResearchInput) { if (!this.isEnabled()) return { status: 'DISABLED' as const }; const job = await this.queue.add('job_context', input, { jobId: `job:${this.key('job_context', input)}` }); return { status: 'QUEUED' as const, jobId: job.id }; }
  async enqueueInterviewContext(input: JobResearchInput & { interviewId: string }) { if (!this.isEnabled()) return { status: 'DISABLED' as const }; const { interviewId: _interviewId, ...query } = input; const job = await this.queue.add('interview_context', query, { jobId: `interview:${this.key('interview_context', input)}` }); return { status: 'QUEUED' as const, jobId: job.id }; }
  private async cachedOrQueued(type: ResearchQueryType, query: unknown, jobId: string) {
    if (!this.isEnabled()) return emptyResearchResult(type, 'DISABLED');
    const cached = await this.cache.getFresh(this.key(type, query));
    if (cached) return { ...cached, status: 'CACHED' as const };
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') {
          const completed = await this.cache.getFresh(this.key(type, query));
          if (completed) return { ...completed, status: 'CACHED' as const };
        }
        if (state === 'failed') return emptyResearchResult(type, 'UNAVAILABLE', 'public context unavailable');
      }
    } catch { return emptyResearchResult(type, 'UNAVAILABLE', 'public context unavailable'); }
    return emptyResearchResult(type, 'QUEUED');
  }
  getCachedCompany(input: CompanyResearchInput) { return this.cachedOrQueued('company', input, `company:${this.key('company', input)}`); }
  getCachedJobContext(input: JobResearchInput) { return this.cachedOrQueued('job_context', input, `job:${this.key('job_context', input)}`); }
  getCachedInterviewContext(input: JobResearchInput & { interviewId: string }) {
    const { interviewId: _interviewId, ...query } = input;
    return this.cachedOrQueued('interview_context', query, `interview:${this.key('interview_context', input)}`);
  }
  doctor() { return this.provider.doctor(); }
}
