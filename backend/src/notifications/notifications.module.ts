import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../common/constants/queues';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { RUN_WORKERS } from '../common/utils/env';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS })],
  controllers: [NotificationsController],
  providers: [NotificationsService, ...(RUN_WORKERS ? [NotificationsProcessor] : [])],
  exports: [NotificationsService, BullModule],
})
export class NotificationsModule {}
