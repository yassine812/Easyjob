import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from '../common/constants/queues';
import { ExternalResearchService } from './external-research.service';

@Processor(QUEUES.EXTERNAL_RESEARCH)
export class ExternalResearchProcessor extends WorkerHost {
  constructor(private readonly research: ExternalResearchService) { super(); }
  async process(job: Job): Promise<unknown> {
    if (job.name === 'company') return this.research.researchCompany(job.data);
    if (job.name === 'job_context') return this.research.researchJobContext(job.data);
    if (job.name === 'interview_context') return this.research.researchInterviewContext(job.data);
    if (job.name === 'technology') return this.research.researchTechnology(job.data.technology);
    return null;
  }
}
