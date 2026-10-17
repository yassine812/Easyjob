import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AutomationExecutionStatus } from '@prisma/client';
import { QUEUES } from '../common/constants/queues';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { ApplicationsService } from '../applications/applications.service';

interface Action {
  type: string;
  config: Record<string, unknown>;
}

@Processor(QUEUES.AUTOMATION)
@Injectable()
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
    private readonly applicationsService: ApplicationsService,
  ) {
    super();
  }

  async process(job: Job<{ executionId: string }>): Promise<void> {
    const { executionId } = job.data;
    const execution = await this.prisma.automationExecution.findUnique({
      where: { id: executionId },
      include: { rule: true },
    });
    if (!execution) {
      this.logger.warn(`Automation execution ${executionId} not found`);
      return;
    }

    await this.prisma.automationExecution.update({
      where: { id: executionId },
      data: { status: AutomationExecutionStatus.PROCESSING, attempt: { increment: 1 } },
    });

    const actions = (execution.rule.actions as unknown as Action[]) ?? [];
    const log: string[] = [];
    try {
      for (const action of actions) {
        await this.executeAction(execution.rule.companyId, execution.rule.createdById, action);
        log.push(`executed ${action.type}`);
        await this.prisma.automationLog.create({
          data: { executionId, level: 'info', message: `Executed action ${action.type}` },
        });
      }
      await this.prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          status: AutomationExecutionStatus.COMPLETED,
          executedAt: new Date(),
          result: { actions: log, ok: true },
        },
      });
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Automation ${executionId} failed: ${message}`);
      await this.prisma.automationLog.create({
        data: { executionId, level: 'error', message },
      });
      await this.prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: AutomationExecutionStatus.FAILED, error: message },
      });
    }
  }

  private async executeAction(companyId: string, actorUserId: string, action: Action): Promise<void> {
    const cfg = action.config ?? {};
    switch (action.type) {
      case 'send_notification': {
        const userId = cfg.userId as string | undefined;
        const role = cfg.role as string | undefined;
        const title = String(cfg.title ?? 'Notification');
        const message = String(cfg.message ?? '');
        if (userId) {
          await this.notifications.create({ userId, type: 'automation', title, message, data: { companyId } });
        } else if (role) {
          const members = await this.prisma.companyMember.findMany({
            where: { companyId, role: role as never, status: 'ACTIVE' },
            select: { userId: true },
          });
          for (const member of members) {
            await this.notifications.create({
              userId: member.userId,
              type: 'automation',
              title,
              message,
              data: { companyId },
              dedupeKey: `automation:${companyId}:${role}:${title}`,
            });
          }
        }
        break;
      }
      case 'send_email': {
        const to = String(cfg.to ?? '');
        if (to) {
          await this.emailService.enqueue({
            to,
            subject: String(cfg.subject ?? 'Startup Starter notification'),
            html: String(cfg.body ?? ''),
            dedupeKey: `automation-email:${companyId}:${to}:${String(cfg.subject ?? '')}`,
          });
        }
        break;
      }
      case 'move_application': {
        const applicationId = cfg.applicationId as string | undefined;
        const toStatus = cfg.toStatus as string | undefined;
        if (applicationId && toStatus) {
          if (['REJECTED', 'HIRED', 'OFFER', 'WITHDRAWN'].includes(toStatus)) throw new Error('This decision requires human review');
          const application = await this.prisma.application.findFirst({ where: { id: applicationId, job: { companyId } }, select: { id: true } });
          if (!application) throw new Error('Application does not belong to this company');
          await this.applicationsService.moveStatus(actorUserId, applicationId, {
            newStatus: toStatus as never,
            source: 'SYSTEM',
            note: 'Moved by automation rule',
          }, {});
        }
        break;
      }
      case 'notify_recruiter': {
        const jobId = cfg.jobId as string | undefined;
        if (jobId) {
          // Tenant guard: a rule may only reference jobs of its own company.
          const job = await this.prisma.job.findUnique({ where: { id: jobId } });
          if (job && job.companyId === companyId) {
            await this.notifications.create({
              userId: job.createdById,
              type: 'automation',
              title: String(cfg.title ?? 'Recruiter notification'),
              message: String(cfg.message ?? ''),
              data: { companyId, jobId },
            });
          }
        }
        break;
      }
      default:
        throw new Error(`Unknown automation action type: ${action.type}`);
    }
  }
}
