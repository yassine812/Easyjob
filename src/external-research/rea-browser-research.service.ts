import { Inject, Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CONFIG, AppConfig, ExternalResearchConfig } from '../config/configuration';
import { assertPublicUrl } from './external-research.security';

const execFileAsync = promisify(execFile);

type ReaCapture = {
  evidence_id?: string;
  normalized_result?: {
    duration_ms?: number;
    steps?: Array<{ artifacts?: { dom?: { state?: string; value?: { text?: string } } }; status?: string }>;
    limitations?: string[];
  };
};

export type ReaPublicPageResult = {
  evidenceId?: string;
  title?: string;
  text?: string;
  durationMs?: number;
  limitations: string[];
};

/**
 * Optional REA enrichment for a public page already discovered by Agent Reach.
 * REA is deliberately invoked only through configured commands and only for a
 * validated public URL. It never accepts arbitrary shell text or credentials.
 */
@Injectable()
export class ReaBrowserResearchService {
  private readonly logger = new Logger(ReaBrowserResearchService.name);
  private readonly settings: ExternalResearchConfig;

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.settings = config.externalResearch ?? {
      enabled: false,
      agentReachEnabled: false,
      command: 'agent-reach',
      reaEnabled: false,
      reaCommand: 'rea',
      reaArgs: [],
      reaTimeoutMs: 30000,
      timeoutMs: 15000,
      maxRetries: 2,
      circuitBreakerFailures: 3,
      circuitBreakerCooldownMs: 60000,
      allowedSources: ['web', 'github', 'rss'],
      ttlDays: { company: 7, technology: 14, github: 3, rssHours: 3 },
    };
  }

  isEnabled() {
    return this.settings.enabled && this.settings.agentReachEnabled && this.settings.reaEnabled && Boolean(this.settings.reaBrowserExecutable);
  }

  async inspectPublicPage(url: string): Promise<ReaPublicPageResult | null> {
    if (!this.isEnabled()) return null;
    const safeUrl = assertPublicUrl(url);
    const scenario = {
      browser: { mode: 'launch', executable_path: this.settings.reaBrowserExecutable, headless: true },
      start_url: { url: safeUrl, query: [] },
      environment: {
        viewport: { width: 1280, height: 720, device_scale_factor: 1 },
        locale: 'en-US', timezone: 'UTC', color_scheme: 'light', reduced_motion: 'reduce', service_workers: 'block',
      },
      actions: [{ step_id: 'settle', action: 'wait_for_timeout', duration_ms: 500 }],
      storage: { cookies: [], local_storage: [], session_storage: [] },
      secrets: [],
      capture: {
        after_each_step: [], at_end: ['url', 'dom'], events: [],
        network: { request_body: false, response_body: false, header_values: false },
      },
    };
    try {
      const args = [...this.settings.reaArgs, 'capture-browser-scenario', '--format', 'json', JSON.stringify(scenario)];
      const result = await execFileAsync(this.settings.reaCommand, args, {
        timeout: this.settings.reaTimeoutMs,
        windowsHide: true,
        maxBuffer: 2 * 1024 * 1024,
      });
      const capture = JSON.parse(result.stdout || '{}') as ReaCapture;
      const steps = capture.normalized_result?.steps ?? [];
      const dom = [...steps].reverse().find(step => step.artifacts?.dom?.state === 'captured')?.artifacts?.dom?.value?.text;
      const text = dom ? dom.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1800) : undefined;
      const title = dom?.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 300);
      return { evidenceId: capture.evidence_id, title, text, durationMs: capture.normalized_result?.duration_ms, limitations: capture.normalized_result?.limitations ?? [] };
    } catch (error) {
      this.logger.warn(`REA browser enrichment unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }
}
