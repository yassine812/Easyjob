import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';
import { RedisService } from '../redis/redis.service';

export const EXTERNAL_RESEARCH_WORKER_HEALTH_KEY = 'health:external-research-worker';

@Injectable()
export class ExternalResearchWorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(@Inject(CONFIG) private readonly config: AppConfig, private readonly redis: RedisService) {}

  async onModuleInit() {
    await this.writeHeartbeat();
    this.timer = setInterval(() => void this.writeHeartbeat(), 10_000);
    this.timer.unref?.();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.redis.del(EXTERNAL_RESEARCH_WORKER_HEALTH_KEY);
  }

  private async writeHeartbeat() {
    await this.redis.setJson(EXTERNAL_RESEARCH_WORKER_HEALTH_KEY, {
      status: 'up',
      enabled: this.config.externalResearch?.enabled === true,
      updatedAt: new Date().toISOString(),
    }, 30);
  }
}
