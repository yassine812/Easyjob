import { Module } from '@nestjs/common';
import { InterviewRemindersService } from './interview-reminders.service';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewRemindersService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
