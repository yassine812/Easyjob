import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';
import type { JobAutofillDtoShape } from './job-creation.service';

export interface GeneratedJobDraft {
  title: string;
  description: string;
  descriptions: Array<{ id: 'professional' | 'concise' | 'technical'; text: string }>;
  responsibilities: string[];
  requirements: string[];
  skills: Array<{ name: string; required: boolean; level: string }>;
  preferredSkills: string[];
  profileRequirements: string[];
  workingConditions: { location: string; workMode: string; employmentType: string; contractType: string; industry: string };
  provenance: { engine: string; dataset: string };
}

/** Shares the existing Python host, but never calls an AI provider or a model endpoint. */
@Injectable()
export class JobDraftingClient {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  private async request(path: string, body?: unknown): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.ai.baseUrl}/drafting${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.config.ai.apiKey ? { Authorization: `Bearer ${this.config.ai.apiKey}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(this.config.ai.timeoutMs, 10_000)),
      });
      if (!response.ok) throw new Error('Drafting unavailable');
      return await response.json();
    } catch {
      // No degraded string-template fallback; preserve the recruiter's current text.
      throw new ServiceUnavailableException('Job drafting is temporarily unavailable. Please retry.');
    }
  }

  async suggest(query: string): Promise<Array<{ id: string; label: string }>> {
    if (query.trim().length < 2) return [];
    const result = await this.request(`/jobs/titles?q=${encodeURIComponent(query.slice(0, 150))}`);
    if (!Array.isArray(result) || result.some(item => typeof item?.id !== 'string' || typeof item?.label !== 'string')) throw new ServiceUnavailableException('Invalid title suggestions');
    return result.slice(0, 6).map(item => ({ id: item.id, label: item.label }));
  }

  async generate(input: JobAutofillDtoShape, company: { commercialName: string; industry: string | null }): Promise<GeneratedJobDraft> {
    const result = await this.request('/jobs', { ...input, company }) as GeneratedJobDraft | null;
    if (!result || typeof result.description !== 'string' || result.description.length < 100 || !Array.isArray(result.descriptions) || result.descriptions.length !== 3 || !Array.isArray(result.responsibilities) || result.responsibilities.length < 6 || !Array.isArray(result.skills) || result.provenance?.engine !== 'easyjob-deterministic-v2') {
      throw new ServiceUnavailableException('Invalid generated job draft');
    }
    return result;
  }
}
