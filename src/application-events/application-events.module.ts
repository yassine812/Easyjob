import { Module } from '@nestjs/common';
import { ApplicationEventsService } from './application-events.service';

@Module({
  providers: [ApplicationEventsService],
  exports: [ApplicationEventsService],
})
export class ApplicationEventsModule {}
