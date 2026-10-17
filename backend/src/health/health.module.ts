import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ExternalResearchModule } from '../external-research/external-research.module';

@Module({
  imports: [TerminusModule, ExternalResearchModule],
  controllers: [HealthController],
})
export class HealthModule {}
