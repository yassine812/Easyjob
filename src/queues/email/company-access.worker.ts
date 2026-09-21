import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CONFIG, type AppConfig } from '../../config/configuration';
import { EmailProvider } from './email.provider';
import { openCredentials } from './credential-envelope';

/** Durable outbox. Only the worker sends credentials, after the account transaction commits. */
@Injectable()
export class CompanyAccessWorker {
  private busy = false;
  private readonly logger = new Logger(CompanyAccessWorker.name);
  constructor(private readonly prisma: PrismaService, private readonly email: EmailProvider,
    @Inject(CONFIG) private readonly config: AppConfig) {}

  @Interval(15_000)
  async deliver() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.prisma.companyAccessDelivery.updateMany({ where: { expiresAt: { lte: new Date() }, encryptedBody: { not: null } }, data: { status: 'EXPIRED', encryptedBody: null } });
      const deliveries = await this.prisma.companyAccessDelivery.findMany({ where: { expiresAt: { gt: new Date() }, encryptedBody: { not: null }, OR: [
        { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
      ] }, take: 5, orderBy: { createdAt: 'asc' } });
      for (const row of deliveries) {
        const claim = await this.prisma.companyAccessDelivery.updateMany({ where: { id: row.id, status: row.status, updatedAt: row.updatedAt }, data: { status: 'SENDING', attempts: { increment: 1 } } });
        if (!claim.count) continue;
        try {
          const owner = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { mustChangePassword: true } });
          if (!owner?.mustChangePassword) {
            await this.prisma.companyAccessDelivery.update({ where: { id: row.id }, data: { status: 'CANCELLED', encryptedBody: null } });
            continue;
          }
          await this.email.send({ to: row.email, subject: 'Votre accès entreprise EasyJob', html: openCredentials(row.encryptedBody!, this.config.jwt.refreshSecret) });
          await this.prisma.companyAccessDelivery.update({ where: { id: row.id }, data: { status: this.config.email.provider === 'smtp' ? 'SENT' : 'SIMULATED', encryptedBody: null, deliveredAt: this.config.email.provider === 'smtp' ? new Date() : null } });
        } catch {
          this.logger.warn(`Company access delivery ${row.id} failed; credentials omitted`);
          await this.prisma.companyAccessDelivery.update({ where: { id: row.id }, data: { status: row.attempts >= 4 ? 'FAILED' : 'PENDING', nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 30_000 * 2 ** row.attempts)) } });
        }
      }
    } finally { this.busy = false; }
  }
}
