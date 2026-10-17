import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../common/constants/queues';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiClient } from './ai-client';
import { AiProcessor } from './ai.processor';
import { CvProcessor } from './cv-processor';
import { RUN_WORKERS } from '../common/utils/env';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.AI }),
    BullModule.registerQueue({ name: QUEUES.CV_PROCESSING }),
  ],
  controllers: [AiController],
  providers: [AiService, AiClient, ...(RUN_WORKERS ? [AiProcessor, CvProcessor] : [])],
  exports: [AiService, AiClient, BullModule],
})
export class AiModule {}
