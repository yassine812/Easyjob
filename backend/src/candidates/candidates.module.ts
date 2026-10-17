import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../common/constants/queues';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { ResumesService } from './resumes.service';
import { CandidatePhotoController } from './candidate-photo.controller';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.CV_PROCESSING })],
  controllers: [CandidatesController, CandidatePhotoController],
  providers: [CandidatesService, ResumesService],
  exports: [CandidatesService, ResumesService],
})
export class CandidatesModule {}
