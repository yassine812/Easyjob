import { MeetingService } from './meeting.service';
import { MeetingController } from './meeting.controller';
import { EasyJobMeetingProvider } from './meeting-provider';
import { InterviewInvitationsService } from './interview-invitations.service';
import { Module } from '@nestjs/common';
import { InterviewRemindersService } from './interview-reminders.service';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { InterviewBriefController } from './interview-brief.controller';
import { InterviewBriefService } from './interview-brief.service';
import { ExternalResearchModule } from '../external-research/external-research.module';

@Module({
  imports: [ExternalResearchModule],
  controllers: [MeetingController, InterviewsController, InterviewBriefController],
  providers: [MeetingService, EasyJobMeetingProvider, InterviewInvitationsService, InterviewsService, InterviewRemindersService, InterviewBriefService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
