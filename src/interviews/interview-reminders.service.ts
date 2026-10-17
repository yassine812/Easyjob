import { InterviewInvitationsService } from './interview-invitations.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InterviewRemindersService {
  private readonly logger = new Logger(InterviewRemindersService.name);
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService, private readonly invitations: InterviewInvitationsService) {}

  @Cron('*/10 * * * *')
  async remind() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const interviews = await this.prisma.interview.findMany({ where: { status: { in: ['SCHEDULED', 'CONFIRMED'] }, OR: [{ reminderSentAt: null }, { reminderHourSentAt: null, startAt: { lte: new Date(now.getTime() + 3600000) } }], startAt: { gt: now, lte: new Date(now.getTime() + 86400000) }, job: { company: { status: { not: 'SUSPENDED' } } } }, take: 200,
        include: { job: { select: { companyId: true, title: true } }, application: { select: { candidate: { select: { userId: true } } } }, participants: { include: { member: { select: { userId: true, status: true } } } } } });
      for (const item of interviews) {
        if (!item.job) continue;
        if (!item.reminderSentAt && item.startAt.getTime() > now.getTime() + 3600000) {
          await this.invitations.send(item.id, 'reminder24h');
          await this.prisma.interview.updateMany({ where: { id: item.id, startAt: item.startAt, status: { in: ['SCHEDULED','CONFIRMED'] } }, data: { reminderSentAt: now } });
        }
        if (!item.reminderHourSentAt && item.startAt.getTime() <= now.getTime() + 3600000) {
          await this.invitations.send(item.id, 'reminder1h');
          await this.prisma.interview.updateMany({ where: { id: item.id, startAt: item.startAt, status: { in: ['SCHEDULED','CONFIRMED'] } }, data: { reminderSentAt: now, reminderHourSentAt: now } });
        }
      }
    } catch { this.logger.warn('Interview reminders will be retried on the next run'); }
    finally { this.running = false; }
  }
}
