import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const DAY = 24 * 60 * 60 * 1000;
const THRESHOLDS = [7, 3, 1];

@Injectable()
export class SubscriptionNotificationService {
  private readonly logger = new Logger(SubscriptionNotificationService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  /** Runs in UTC once per day. Dedupe keys make retries and overlapping workers safe. */
  @Cron('15 7 * * *')
  async checkExpiringSubscriptions() {
    if (this.running) return { checked: 0, sent: 0 };
    this.running = true;
    try {
      const now = new Date();
      const subscriptions = await this.prisma.subscription.findMany({
        where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] }, currentPeriodEnd: { not: null } },
        include: { plan: { select: { name: true } }, candidate: { select: { userId: true, user: { select: { email: true, name: true } } } }, company: { select: { id: true, commercialName: true, members: { where: { status: 'ACTIVE', role: 'COMPANY_ADMIN' }, select: { userId: true, user: { select: { email: true, name: true } } } } } } },
        take: 2000,
      });
      let sent = 0;
      for (const subscription of subscriptions) {
        const end = subscription.currentPeriodEnd;
        if (!end) continue;
        const days = Math.ceil((end.getTime() - now.getTime()) / DAY);
        if (days <= 0) {
          if (subscription.status !== SubscriptionStatus.EXPIRED) await this.prisma.subscription.update({ where: { id: subscription.id }, data: { status: SubscriptionStatus.EXPIRED } });
          sent += await this.notifyRecipients(subscription, 'subscription_expired', 0, end);
          continue;
        }
        if (subscription.status === SubscriptionStatus.PAST_DUE) {
          sent += await this.notifyRecipients(subscription, 'payment_failed', days, end);
          continue;
        }
        // Provider-backed subscriptions are expected to renew; warn only when cancellation is scheduled.
        if (subscription.providerSubscriptionId && !subscription.canceledAt) continue;
        if (THRESHOLDS.includes(days)) sent += await this.notifyRecipients(subscription, 'subscription_expiring', days, end);
      }
      return { checked: subscriptions.length, sent };
    } catch (error) {
      this.logger.warn(`Subscription notification check failed: ${(error as Error).message}`);
      return { checked: 0, sent: 0 };
    } finally { this.running = false; }
  }

  private async notifyRecipients(subscription: any, type: string, days: number, end: Date): Promise<number> {
    const recipients = subscription.candidate ? [{ userId: subscription.candidate.userId, email: subscription.candidate.user.email, name: subscription.candidate.user.name }] : (subscription.company?.members ?? []).map((member: any) => ({ userId: member.userId, email: member.user.email, name: member.user.name }));
    let sent = 0;
    for (const recipient of recipients) {
      const key = `subscription:${subscription.id}:${type}:${days || 'expired'}:${recipient.userId}`;
      const title = type === 'payment_failed' ? 'Paiement échoué' : type === 'subscription_expired' ? 'Votre abonnement a expiré' : 'Votre abonnement expire bientôt';
      const message = type === 'payment_failed' ? 'Mettez à jour votre moyen de paiement pour conserver vos fonctionnalités.' : type === 'subscription_expired' ? `La formule ${subscription.plan.name} a expiré.` : `Votre formule ${subscription.plan.name} expire dans ${days} jour${days > 1 ? 's' : ''}, le ${end.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.`;
      await this.notifications.create({ userId: recipient.userId, type, title, message, data: { subscriptionId: subscription.id, threshold: days, actionUrl: '/billing' }, dedupeKey: key, email: { to: recipient.email, subject: title, html: `<p>Bonjour ${recipient.name},</p><p>${message}</p><p><a href="/billing">Gérer mon abonnement</a></p>` } });
      sent += 1;
    }
    return sent;
  }
}
