import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from './company-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OfferDto } from './dto/workspace.dto';
import { DEFAULT_THRESHOLDS, recruitmentClassification } from './recruitment-metrics';
@Injectable()
export class RecruitmentOffersService {
  constructor(private readonly prisma: PrismaService, private readonly access: CompanyAccessService, private readonly notifications: NotificationsService, private readonly audit: AuditService, private readonly realtime: RealtimeService) {}
  private async application(userId: string, companyId: string, id: string, permission = 'application.view') {
    const app = await this.prisma.application.findFirst({ where: { id, job: { companyId } }, include: { candidate: { select: { userId: true } }, job: { include: { company: true } } } });
    if (!app) throw new NotFoundException('Application not found');
    await this.access.assertApplicationPermission(userId, companyId, app.id, permission);
    return app;
  }
  async list(userId: string, companyId: string, applicationId: string) { await this.application(userId, companyId, applicationId); await this.expire(applicationId); return this.prisma.recruitmentOffer.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } }); }
  async create(userId: string, companyId: string, applicationId: string, dto: OfferDto) {
    const app = await this.application(userId, companyId, applicationId, 'application.move');
    if (['HIRED', 'REJECTED', 'WITHDRAWN'].includes(app.status) || !dto.title.trim() || !dto.contractType.trim()) throw new BadRequestException('Cannot create this offer');
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) throw new BadRequestException('Offer expiry must be in the future');
    const offer = await this.prisma.recruitmentOffer.create({ data: { applicationId, createdById: userId, ...dto, title: dto.title.trim(), terms: dto.terms ?? '', companyName: app.job.company.commercialName, startDate: dto.startDate ? new Date(dto.startDate) : null, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } });
    await this.prisma.applicationEvent.create({ data: { applicationId, actorId: userId, previousStatus: app.status, newStatus: app.status, metadata: { action: 'offer.prepared', offerId: offer.id } } });
    await this.audit.log({ actorId: userId, action: 'offer.created', entityType: 'RecruitmentOffer', entityId: offer.id, metadata: { companyId, applicationId } });
    return offer;
  }
  async send(userId: string, companyId: string, id: string) {
    const offer = await this.prisma.recruitmentOffer.findFirst({ where: { id, application: { job: { companyId } } } });
    if (!offer) throw new NotFoundException('Offer not found');
    const app = await this.application(userId, companyId, offer.applicationId, 'application.move');
    if (!['DRAFT', 'SENT', 'VIEWED'].includes(offer.status) || ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(app.status) || (offer.expiresAt && offer.expiresAt <= new Date())) throw new BadRequestException('Offer is not available to send');
    const thresholds = (app.job.company.recruitmentSettings as { thresholds?: typeof DEFAULT_THRESHOLDS } | null)?.thresholds ?? DEFAULT_THRESHOLDS;
    if (recruitmentClassification(app.aiMatchScore, app.potentialScore, thresholds) === 'LOW_ALIGNMENT' && !app.alignmentOverrideById) {
      throw new BadRequestException({ code: 'LOW_ALIGNMENT_OVERRIDE_REQUIRED', message: 'Explicit recruiter override is required before sending an offer to a Low Alignment candidate.' });
    }
    if (!offer.contractType || !offer.salaryAmount || !offer.workMode || !offer.expiresAt) throw new BadRequestException('Complete the employment offer before sending');
    if (offer.status === 'DRAFT') await this.prisma.$transaction(async tx => {
      if (await tx.recruitmentOffer.findFirst({ where: { applicationId: app.id, id: { not: id }, status: { in: ['SENT','VIEWED'] } } })) throw new ConflictException('Withdraw the existing employment offer before sending another');
      const changed = await tx.recruitmentOffer.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'SENT', sentAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException('Offer already sent');
      await tx.application.update({ where: { id: app.id, status: app.status }, data: { status: 'OFFER', stageChangedAt: new Date(), stageChangedById: userId, stageChangeSource: 'HR' } });
      await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: userId, previousStatus: app.status, newStatus: 'OFFER', metadata: { offerId: id, source: 'HR', action: 'offer.sent' } } });
      await tx.candidateCommunication.create({ data: { applicationId: app.id, senderId: userId, senderType: 'RECRUITER', subject: offer.title, body: `${app.job.company.commercialName} vous a envoyé une offre d’embauche. /recruitment-offers/${id}`, channel: 'IN_APP', status: 'SENT', requestId: `employment-offer:${id}` } });
    });
    const href = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/recruitment-offers/${id}`;
    await this.notifications.create({ userId: app.candidate.userId, type: 'offer.sent', title: offer.title, message: `${app.job.company.commercialName} vous a envoyé une offre d’embauche.`, email: { subject: 'Vous avez reçu une offre d’embauche', html: `<p>Une offre d’embauche vous attend sur EasyJob.</p><p><a href="${href}">Consulter l’offre</a></p>` }, data: { offerId: id, applicationId: app.id, href: `/recruitment-offers/${id}` }, dedupeKey: `offer.sent:${id}` });
    await this.audit.log({ actorId: userId, action: 'offer.sent', entityType: 'RecruitmentOffer', entityId: id, metadata: { companyId, applicationId: app.id } });
    this.realtime.emitToCompany(companyId, 'application.updated', { id: app.id });
    return { id, status: 'SENT' };
  }
  private async expire(applicationId: string) {
    const expired = await this.prisma.recruitmentOffer.findMany({ where: { applicationId, status: { in: ['SENT', 'VIEWED'] }, expiresAt: { lte: new Date() } } });
    for (const offer of expired) await this.prisma.$transaction(async tx => {
      const changed = await tx.recruitmentOffer.updateMany({ where: { id: offer.id, status: { in: ['SENT', 'VIEWED'] } }, data: { status: 'EXPIRED' } });
      if (changed.count) { const app = await tx.application.findUniqueOrThrow({ where: { id: applicationId } }); await tx.applicationEvent.create({ data: { applicationId, previousStatus: app.status, newStatus: app.status, metadata: { action: 'offer.expired', offerId: offer.id } } }); }
    });
  }
  async defaults(userId: string, companyId: string, applicationId: string) {
    const app = await this.application(userId, companyId, applicationId);
    return { title: app.job.title, companyName: app.job.company.commercialName, contractType: app.job.contractType ?? app.job.employmentType, location: app.job.location, workMode: app.job.workMode ?? (app.job.remote ? 'REMOTE' : 'ONSITE'), salaryCurrency: app.job.currency ?? 'TND', salaryMin: app.job.salaryMin, salaryMax: app.job.salaryMax, benefits: app.job.benefits, applicationStatus: app.status };
  }
  async edit(userId: string, companyId: string, id: string, dto: OfferDto) {
    const offer = await this.prisma.recruitmentOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    await this.application(userId, companyId, offer.applicationId, 'application.move');
    if (offer.status !== 'DRAFT') throw new ConflictException('Only drafts can be edited');
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) throw new BadRequestException('Deadline must be in the future');
    return this.prisma.recruitmentOffer.update({ where: { id, status: 'DRAFT' }, data: { ...dto, terms: dto.terms ?? '', startDate: dto.startDate ? new Date(dto.startDate) : null, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } });
  }
  async withdraw(userId: string, companyId: string, id: string) {
    const offer = await this.prisma.recruitmentOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    const app = await this.application(userId, companyId, offer.applicationId, 'application.move');
    await this.prisma.$transaction(async tx => {
      const result = await tx.recruitmentOffer.updateMany({ where: { id, status: { in: ['DRAFT', 'SENT', 'VIEWED'] } }, data: { status: 'WITHDRAWN' } });
      if (!result.count) throw new ConflictException('Offer cannot be withdrawn');
      await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: userId, previousStatus: app.status, newStatus: app.status, metadata: { action: 'offer.withdrawn', offerId: id } } });
    });
    await this.notifications.create({ userId: app.candidate.userId, type: 'offer.withdrawn', title: 'Offre d’embauche retirée', data: { href: `/recruitment-offers/${id}` }, dedupeKey: `offer.withdrawn:${id}` });
    return { id, status: 'WITHDRAWN' };
  }
  async viewed(userId: string, id: string) {
    const offer = await this.candidate(userId, id);
    await this.prisma.$transaction(async tx => {
      const changed = await tx.recruitmentOffer.updateMany({ where: { id, status: 'SENT' }, data: { status: 'VIEWED', viewedAt: new Date() } });
      if (changed.count) { const app = await tx.application.findUniqueOrThrow({ where: { id: offer.applicationId } }); await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: userId, previousStatus: app.status, newStatus: app.status, metadata: { action: 'offer.viewed', offerId: id } } }); }
    });
    return this.candidate(userId, id);
  }
  async forCandidateApplication(userId: string, applicationId: string) {
    if (!await this.prisma.application.findFirst({ where: { id: applicationId, candidate: { userId } } })) throw new NotFoundException('Application not found');
    await this.expire(applicationId);
    return this.prisma.recruitmentOffer.findMany({ where: { applicationId, status: { not: 'DRAFT' } }, orderBy: { createdAt: 'desc' } });
  }
  async candidate(userId: string, id: string) {
    const offer = await this.prisma.recruitmentOffer.findFirst({ where: { id, status: { not: 'DRAFT' }, application: { candidate: { userId } } }, include: { application: { select: { job: { select: { title: true, company: { select: { commercialName: true } } } } } } } });
    if (!offer) throw new NotFoundException('Offer not found');
    await this.expire(offer.applicationId);
    return this.prisma.recruitmentOffer.findUniqueOrThrow({ where: { id } });
  }
  async respond(userId: string, id: string, response: 'ACCEPTED' | 'DECLINED', reason?: string) {
    const offer = await this.candidate(userId, id);
    if (!['SENT', 'VIEWED'].includes(offer.status) || (offer.expiresAt && offer.expiresAt <= new Date())) throw new BadRequestException('Offer can no longer be answered');
    const app = await this.prisma.application.findUniqueOrThrow({ where: { id: offer.applicationId }, include: { job: true } });
    await this.prisma.$transaction(async tx => {
      const count = await tx.recruitmentOffer.updateMany({ where: { id, status: { in: ['SENT', 'VIEWED'] }, expiresAt: { gt: new Date() } }, data: { status: response, respondedAt: new Date(), responseReason: reason ?? null } });
      if (count.count !== 1) throw new ConflictException('Offer already answered');
      await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: userId, previousStatus: app.status, newStatus: app.status, metadata: { offerId: id, action: `offer.${response.toLowerCase()}`, reason } } });
      if (response === 'ACCEPTED') {
        if (app.status !== 'OFFER') throw new ConflictException('Application is no longer at the offer stage');
        await tx.application.update({ where: { id: app.id, status: 'OFFER' }, data: { status: 'HIRED', stageChangedAt: new Date(), stageChangedById: userId, stageChangeSource: 'CANDIDATE_ACCEPTED_HR_OFFER' } });
        await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: userId, previousStatus: 'OFFER', newStatus: 'HIRED', metadata: { offerId: id, source: 'CANDIDATE_ACCEPTED_HR_OFFER' } } });
      }
    });
    await this.notifications.create({ userId: offer.createdById, type: `offer.${response.toLowerCase()}`, title: offer.title, message: response, data: { companyId: app.job.companyId, applicationId: app.id }, dedupeKey: `offer.response:${id}` });
    await this.audit.log({ actorId: userId, action: 'offer.responded', entityType: 'RecruitmentOffer', entityId: id, metadata: { companyId: app.job.companyId, response } });
    this.realtime.emitToCompany(app.job.companyId, 'application.updated', { id: app.id });
    return { id, status: response };
  }
}
