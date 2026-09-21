import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InterviewRemindersService {
  private readonly logger = new Logger(InterviewRemindersService.name);
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  @Cron('*/10 * * * *')
  async remind() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const interviews = await this.prisma.interview.findMany({ where: { status: { in: ['SCHEDULED', 'CONFIRMED'] }, reminderSentAt: null, startAt: { gt: now, lte: new Date(now.getTime() + 86400000) }, job: { company: { status: { not: 'SUSPENDED' } } } }, take: 200,
        include: { job: { select: { companyId: true, title: true } }, application: { select: { candidate: { select: { userId: true } } } }, participants: { include: { member: { select: { userId: true, status: true } } } } } });
      for (const item of interviews) {
        if (!item.job) continue;
        const recipients = new Set([item.application.candidate.userId, item.scheduledById, ...item.participants.filter(p => p.member.status === 'ACTIVE').map(p => p.member.userId)]);
        for (const userId of recipients) await this.notifications.create({ userId, type: 'interview.reminder', title: item.job.title,
          message: `Interview: ${item.startAt.toISOString()}`, data: { companyId: item.job.companyId, interviewId: item.id, applicationId: item.applicationId,
            href: userId === item.application.candidate.userId ? (item.type === 'AI' ? `/recruitment-interviews/${item.id}` : `/candidate/applications/${item.applicationId}`) : `/company/${item.job.companyId}/interviews` },
          dedupeKey: `interview.reminder:${item.id}:${item.startAt.toISOString()}:${userId}` });
        await this.prisma.interview.updateMany({ where: { id: item.id, startAt: item.startAt }, data: { reminderSentAt: now } });
      }
    } catch { this.logger.warn('Interview reminders will be retried on the next run'); }
    finally { this.running = false; }
  }
}
