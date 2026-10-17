import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '../config/config.module';
import { CONFIG, AppConfig } from '../config/configuration';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { QUEUES } from '../common/constants/queues';
import { AgentReachResearchProvider } from './agent-reach-research.provider';
import { ExternalResearchCacheService } from './external-research-cache.service';
import { ExternalResearchProcessor } from './external-research.processor';
import { ExternalResearchService } from './external-research.service';
import { ExternalResearchWorkerHeartbeatService } from './external-research-worker-heartbeat.service';
import { RESEARCH_PROVIDER } from './external-research.types';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({ connection: { url: config.redis.url } }),
    }),
    BullModule.registerQueue({ name: QUEUES.EXTERNAL_RESEARCH }),
  ],
  providers: [
    AgentReachResearchProvider,
    ExternalResearchCacheService,
    ExternalResearchService,
    ExternalResearchProcessor,
    ExternalResearchWorkerHeartbeatService,
    { provide: RESEARCH_PROVIDER, useExisting: AgentReachResearchProvider },
  ],
})
export class ExternalResearchWorkerModule {}
