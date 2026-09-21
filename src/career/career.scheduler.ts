import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApplicationsService } from '../applications/applications.service';
import { CareerService, availableJobWhere, careerJobInclude } from './career.service';
import { matchCandidate, matchesPreferences } from './career-engine';

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

@Injectable()
export class CareerScheduler {
  private readonly logger = new Logger(CareerScheduler.name);
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService,
    private readonly career: CareerService, private readonly notifications: NotificationsService,
    private readonly applications: ApplicationsService) {}

  @Cron('*/10 * * * *')
  async tick() {
    // No Redis means no distributed exclusion: fail closed for all outbound work.
    const redis = this.redis.getConnection();
    if (!redis) return;
    const token = randomUUID();
    if (!await redis.set('career:scheduler:lock', token, 'EX', 550, 'NX')) return;
    try {
      let cursor: string | undefined;
      for (;;) {
        const batch = await this.prisma.careerSettings.findMany({ where: { OR: [{ autoApply: true }, { emailAlerts: true }] },
          orderBy: { candidateId: 'asc' }, take: 50, ...(cursor ? { cursor: { candidateId: cursor }, skip: 1 } : {}), include: { candidate: { select: { userId: true } } } });
        if (!batch.length) break;
        for (const item of batch) {
          // Renew only while we own the lease; another worker must never share it.
          if (await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('expire',KEYS[1],550) else return 0 end", 1, 'career:scheduler:lock', token) !== 1) return;
          try { await this.processCandidate(item.candidate.userId); } catch (e) { this.logger.warn(`Career processing failed for ${item.candidateId}: ${(e as Error).message}`); }
        }
        cursor = batch[batch.length - 1].candidateId;
      }
    } finally {
      await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, 'career:scheduler:lock', token);
    }
  }

  async processCandidate(userId: string) {
    const p = await this.career.profile(userId);
    if (p.user.status !== 'ACTIVE' || !p.user.emailVerifiedAt) return;
    let settings = await this.career.settings(userId);
    const since = settings.lastAlertAt?.getTime() || 0;
    const interval = settings.frequency === 'WEEKLY' ? 7 * 86400000 : settings.frequency === 'DAILY' ? 86400000 : 0;
    let alerts = settings.emailAlerts && Date.now() - since >= interval;
    if (alerts) { try { await this.career.requireFeature(p.id, 'career.alerts'); } catch { alerts = false; } }
    let auto = settings.autoApply && !!settings.autoConsentAt;
    if (auto) { try { await this.career.requireFeature(p.id, 'career.auto_apply'); } catch { auto = false; } }
    if (!alerts && !auto) return;
    const draft = auto && settings.approvedDraftId ? await this.prisma.cvDraft.findFirst({ where: { id: settings.approvedDraftId, candidateId: p.id, approvedAt: { not: null } } }) : null;
    const jobs = await this.prisma.job.findMany({ where: { AND: [availableJobWhere(), { applications: { none: { candidateId: p.id } } }] }, include: careerJobInclude, orderBy: { publishedAt: 'desc' } });
    const ranked = jobs.map(job => ({ job, match: matchCandidate({ ...p, resumes: draft ? [{ parsedText: draft.content }] : p.resumes }, job) })).sort((a, b) => (b.match.score ?? -1) - (a.match.score ?? -1));
    for (const { job, match } of ranked) {
      settings = await this.career.settings(userId);
      const skippedReason = !matchesPreferences(job, settings) ? 'outsidePreferences' : match.score === null ? 'insufficientEvidence' : !draft ? 'approvedCvRequired' : match.score < settings.autoMinimumScore || !match.matchedSkills.length ? 'belowThreshold' : null;
      if (auto && settings.autoApply && settings.autoConsentAt && skippedReason) {
        const key = { candidateId: p.id, jobId: job.id, kind: 'AUTO_APPLY' };
        const delivery = await this.prisma.careerDelivery.upsert({ where: { candidateId_jobId_kind: key }, create: { ...key, matchScore: match.score, status: 'SKIPPED', reason: skippedReason }, update: {} });
        await this.prisma.careerDelivery.updateMany({ where: { id: delivery.id, status: { not: 'APPLIED' } }, data: { status: 'SKIPPED', reason: skippedReason, matchScore: match.score } });
      }
      if (!matchesPreferences(job, settings) || match.score === null) continue;
      if (alerts && settings.emailAlerts && match.score >= settings.minimumScore) {
        await this.career.requireFeature(p.id, 'career.alerts');
        const key = { candidateId: p.id, jobId: job.id, kind: 'ALERT' };
        const delivery = await this.prisma.careerDelivery.upsert({ where: { candidateId_jobId_kind: key }, create: { ...key, matchScore: match.score }, update: {} });
        if (delivery.status !== 'SENT') {
          const message = `${job.title} — ${job.company.commercialName}. ${match.score}% estimated match. ${match.summary}`;
          await this.notifications.create({ userId, type: 'career.recommendation', title: job.title, message,
            data: { jobId: job.id, score: match.score }, dedupeKey: `career-alert-${delivery.id}`,
            email: { to: p.user.email, subject: `EasyJob — ${job.title}`, html: `<p>${escape(message)}</p>` } });
          await this.prisma.careerDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT' } });
        }
      }
      // Threshold, consent, preference version, approved draft and quota are checked again
      // inside the application transaction. A score based only on location is insufficient.
      if (auto && draft && settings.autoApply && settings.autoConsentAt && settings.approvedDraftId === draft.id && match.score >= settings.autoMinimumScore && match.matchedSkills.length > 0) {
        const key = { candidateId: p.id, jobId: job.id, kind: 'AUTO_APPLY' };
        const delivery = await this.prisma.careerDelivery.upsert({ where: { candidateId_jobId_kind: key }, create: { ...key, matchScore: match.score }, update: {} });
        if (delivery.status === 'APPLIED') continue;
        try {
          await this.career.requireFeature(p.id, 'career.auto_apply');
          // Reorder reviewed paragraphs only; never generate unchecked candidate claims.
          const blocks = draft.content.split(/\n\s*\n/);
          const content = [blocks[0], ...blocks.slice(1).sort((a, b) => match.matchedSkills.filter(s => b.toLowerCase().includes(s.toLowerCase())).length - match.matchedSkills.filter(s => a.toLowerCase().includes(s.toLowerCase())).length)].join('\n\n');
          const motivation = `I am applying for ${job.title}. My profile includes ${match.matchedSkills.join(', ')}. I would welcome the opportunity to discuss this position.`;
          await this.applications.apply(userId, job.id, { motivation }, {}, { draftId: draft.id, settingsVersion: settings.updatedAt, cvText: content });
          await this.prisma.careerDelivery.update({ where: { id: delivery.id }, data: { status: 'APPLIED', reason: null } });
        } catch (e) {
          // A notification failure after the commit must not label a submitted application as skipped.
          const applied = await this.prisma.application.findUnique({ where: { jobId_candidateId: { jobId: job.id, candidateId: p.id } }, select: { id: true } });
          await this.prisma.careerDelivery.update({ where: { id: delivery.id }, data: { status: applied ? 'APPLIED' : 'SKIPPED', reason: applied ? null : (e as Error).message.slice(0, 500) } });
        }
      }
    }
    if (alerts) await this.prisma.careerSettings.update({ where: { candidateId: p.id }, data: { lastAlertAt: new Date() } });
  }
}
