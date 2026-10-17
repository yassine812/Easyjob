import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../common/constants/queues';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { EmailService } from '../queues/email/email.service';
import type { CreateNotificationInput } from './notifications.service';

@Processor(QUEUES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<CreateNotificationInput>): Promise<void> {
    const input = job.data;
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        data: (input.data as object) ?? undefined,
      },
    });

    this.realtime.emitToUser(input.userId, 'notification.created', notification);

    if (input.email) {
      await this.emailService.enqueue({
        to: input.email.to ?? (await this.userEmail(input.userId)),
        subject: input.email.subject,
        html: input.email.html,
        attachments: input.email.attachments,
        dedupeKey: `email:${input.dedupeKey ?? `${input.type}:${input.userId}:${notification.id}`}`,
      });
    }

    this.logger.log(`Notification ${notification.id} created for user ${input.userId}`);
  }

  private async userEmail(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.email ?? '';
  }
}
