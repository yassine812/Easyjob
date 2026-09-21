import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../../common/constants/queues';
import { EmailProvider, type EmailMessage } from './email.provider';

@Processor(QUEUES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailProvider: EmailProvider) {
    super();
  }

  async process(job: Job<EmailMessage>): Promise<void> {
    try {
      await this.emailProvider.send(job.data);
      this.logger.log(`Email sent to ${job.data.to} (job ${job.id})`);
    } catch (err) {
      this.logger.error(`Email to ${job.data.to} failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
