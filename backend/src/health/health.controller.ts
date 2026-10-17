import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { AgentReachResearchProvider } from '../external-research/agent-reach-research.provider';
import { EXTERNAL_RESEARCH_WORKER_HEALTH_KEY } from '../external-research/external-research-worker-heartbeat.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redis: RedisService,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly externalResearch: AgentReachResearchProvider,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => {
        const connection = this.redis.getConnection();
        if (!connection) {
          return Promise.reject(new Error('Redis is not connected'));
        }
        return connection.ping().then(
          () => ({ redis: { status: 'up' } }),
          () => Promise.reject(new Error('Redis ping failed')),
        );
      },
      () => this.externalResearchHealth(),
    ]);
  }

  private async externalResearchHealth() {
    const externalConfig = this.config.externalResearch;
    const enabled = externalConfig?.enabled === true && externalConfig.agentReachEnabled === true;
    if (!enabled) return { external_research: { status: 'up' as const, state: 'disabled', worker: 'disabled', agent_reach: 'disabled' } };
    const doctorCheck = Promise.race([
      this.externalResearch.doctor(),
      new Promise<{ ok: false; detail: string }>(resolve => setTimeout(() => resolve({ ok: false, detail: 'doctor timeout' }), 2_000)),
    ]);
    const [doctor, heartbeat] = await Promise.all([
      doctorCheck,
      this.redis.getJson<{ status?: string; updatedAt?: string }>(EXTERNAL_RESEARCH_WORKER_HEALTH_KEY),
    ]);
    const workerUp = Boolean(heartbeat?.status === 'up' && heartbeat.updatedAt && Date.now() - Date.parse(heartbeat.updatedAt) < 30_000);
    const agentReachUp = doctor.ok;
    return {
      external_research: {
        status: 'up' as const,
        state: workerUp && agentReachUp ? 'healthy' : 'degraded',
        worker: workerUp ? 'up' : 'down',
        agent_reach: agentReachUp ? 'up' : 'down',
        detail: workerUp && agentReachUp ? undefined : doctor.detail ?? 'worker heartbeat unavailable',
      },
    };
  }
}
