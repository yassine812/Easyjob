import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../common/constants/queues';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AutomationProcessor } from './automation.processor';
import { ApplicationsModule } from '../applications/applications.module';
import { RUN_WORKERS } from '../common/utils/env';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.AUTOMATION }), ApplicationsModule],
  controllers: [AutomationController],
  providers: [AutomationService, ...(RUN_WORKERS ? [AutomationProcessor] : [])],
  exports: [AutomationService, BullModule],
})
export class AutomationModule {}
