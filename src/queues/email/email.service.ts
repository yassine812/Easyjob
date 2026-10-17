import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '../../common/constants/queues';
import { safeJobId } from '../../common/utils/job-ids';
import type { EmailMessage } from './email.provider';

export interface EmailJobData extends EmailMessage {
  /** Dedupe key — identical jobs with the same key are not enqueued twice. */
  dedupeKey?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue) {}

  /**
   * Enqueues an email. BullMQ jobId deduplication prevents duplicate emails when
   * the same logical email is enqueued multiple times (idempotency).
   */
  async enqueue(message: EmailJobData): Promise<void> {
    const jobId = safeJobId(message.dedupeKey ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await this.emailQueue.add(
      'send',
      { to: message.to, subject: message.subject, html: message.html, text: message.text, attachments: message.attachments } satisfies EmailJobData,
      {
        jobId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1000 },
        removeOnFail: { age: 60 * 60 * 24 * 30 },
      },
    );
  }

  async getQueue(): Promise<Queue> {
    return this.emailQueue;
  }
}
