import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { QUEUES } from '../common/constants/queues';
import { safeJobId } from '../common/utils/job-ids';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, resolvePagination } from '../common/utils/pagination';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  email?: { subject: string; html: string; to?: string };
  /** Dedupe key to avoid duplicate notifications (idempotency). */
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Asynchronously creates a database notification, emits a realtime event and
   * (optionally) enqueues an email. Duplicate notifications are prevented by the
   * BullMQ jobId deduplication.
   */
  async create(input: CreateNotificationInput): Promise<{ id: string }> {
    const jobId = safeJobId(input.dedupeKey ?? `${input.type}:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`);
    await this.queue.add('process', input, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 60 * 60 * 24 * 7 },
      removeOnFail: { age: 60 * 60 * 24 * 30 },
    });
    return { id: jobId };
  }

  async listForUser(
    userId: string,
    query: { page?: number; limit?: number; unreadOnly?: boolean; companyId?: string },
  ) {
    const { page, limit, skip, take } = resolvePagination(query);
    const where: Prisma.NotificationWhereInput = { userId, ...(query.unreadOnly ? { readAt: null } : {}), ...await this.companyFilter(userId, query.companyId) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new Error('Notification not found');
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string, companyId?: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...await this.companyFilter(userId, companyId) },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }

  async remove(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new Error('Notification not found');
    }
    await this.prisma.notification.delete({ where: { id: notificationId } });
  }

  private async companyFilter(userId: string, companyId?: string): Promise<Prisma.NotificationWhereInput> {
    if (!companyId) return {};
    if (!await this.prisma.companyMember.findFirst({ where: { userId, companyId, status: 'ACTIVE' }, select: { id: true } })) throw new ForbiddenException('Company access denied');
    return { data: { path: ['companyId'], equals: companyId } };
  }
}
