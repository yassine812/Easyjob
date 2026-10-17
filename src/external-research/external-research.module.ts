import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../common/constants/queues';
import { RUN_WORKERS } from '../common/utils/env';
import { AgentReachResearchProvider } from './agent-reach-research.provider';
import { ExternalResearchCacheService } from './external-research-cache.service';
import { ExternalResearchController } from './external-research.controller';
import { ExternalResearchProcessor } from './external-research.processor';
import { ExternalResearchService } from './external-research.service';
import { ReaBrowserResearchService } from './rea-browser-research.service';
import { RESEARCH_PROVIDER } from './external-research.types';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.EXTERNAL_RESEARCH })],
  controllers: [ExternalResearchController],
  providers: [ReaBrowserResearchService, AgentReachResearchProvider, ExternalResearchCacheService, ExternalResearchService, { provide: RESEARCH_PROVIDER, useExisting: AgentReachResearchProvider }, ...(RUN_WORKERS ? [ExternalResearchProcessor] : [])],
  exports: [ExternalResearchService, AgentReachResearchProvider, ReaBrowserResearchService],
})
export class ExternalResearchModule {}
