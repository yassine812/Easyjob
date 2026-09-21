import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyAccessService } from './company-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OfferDto } from './dto/workspace.dto';
@Injectable()
export class RecruitmentOffersService {
  constructor(private readonly prisma: PrismaService, private readonly access: CompanyAccessService, private readonly notifications: NotificationsService, private readonly audit: AuditService, private readonly realtime: RealtimeService) {}
  private async application(userId: string, companyId: string, id: string, permission = 'application.view') {
    const app = await this.prisma.application.findFirst({ where: { id, job: { companyId } }, include: { candidate: { select: { userId: true } } } });
    if (!app) throw new NotFoundException('Application not found');
    await this.access.assertApplicationPermission(userId, companyId, app.id, permission);
    return app;
  }
  async list(userId: string, companyId: string, applicationId: string) { await this.application(userId, companyId, applicationId); return this.prisma.recruitmentOffer.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } }); }
  async create(userId: string, companyId: string, applicationId: string, dto: OfferDto) {
    const app = await this.application(userId, companyId, applicationId, 'application.move');
    if (['HIRED', 'REJECTED', 'WITHDRAWN'].includes(app.status) || !dto.title.trim() || !dto.terms.trim()) throw new BadRequestException('Cannot create this offer');
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) throw new BadRequestException('Offer expiry must be in the future');
    const offer = await this.prisma.recruitmentOffer.create({ data: { applicationId, createdById: userId, title: dto.title, terms: dto.terms, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } });
    await this.audit.log({ actorId: userId, action: 'offer.created', entityType: 'RecruitmentOffer', entityId: offer.id, metadata: { companyId, applicationId } });
    return offer;
  }
  async send(userId: string, companyId: string, id: string) {
    const offer = await this.prisma.recruitmentOffer.findFirst({ where: { id, application: { job: { companyId } } } });
    if (!offer) throw new NotFoundException('Offer not found');
    const app = await this.application(userId, companyId, offer.applicationId, 'application.move');
    if (offer.status !== 'DRAFT' || ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(app.status) || (offer.expiresAt && offer.expiresAt <= new Date())) throw new BadRequestException('Offer is not available to send');
    await this.prisma.$transaction(async tx => {
      const changed = await tx.recruitmentOffer.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'SENT' } });
      if (changed.count !== 1) throw new ConflictException('Offer already sent');
      await tx.application.update({ where: { id: app.id, status: app.status }, data: { status: 'OFFER', stageChangedAt: new Date(), stageChangedById: userId, stageChangeSource: 'HR' } });
      await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: userId, previousStatus: app.status, newStatus: 'OFFER', metadata: { offerId: id, source: 'HR' } } });
    });
    await this.notifications.create({ userId: app.candidate.userId, type: 'offer.sent', title: offer.title, message: 'A recruitment offer is ready for your review.', data: { offerId: id, applicationId: app.id, href: `/recruitment-offers/${id}` }, dedupeKey: `offer.sent:${id}` });
    await this.audit.log({ actorId: userId, action: 'offer.sent', entityType: 'RecruitmentOffer', entityId: id, metadata: { companyId, applicationId: app.id } });
    this.realtime.emitToCompany(companyId, 'application.updated', { id: app.id });
    return { id, status: 'SENT' };
  }
  async candidate(userId: string, id: string) {
    const offer = await this.prisma.recruitmentOffer.findFirst({ where: { id, status: { not: 'DRAFT' }, application: { candidate: { userId } } }, include: { application: { select: { job: { select: { title: true, company: { select: { commercialName: true } } } } } } } });
    if (!offer) throw new NotFoundException('Offer not found'); return offer;
  }
  async respond(userId: string, id: string, response: 'ACCEPTED' | 'DECLINED') {
    const offer = await this.candidate(userId, id);
    if (offer.status !== 'SENT' || (offer.expiresAt && offer.expiresAt <= new Date())) throw new BadRequestException('Offer can no longer be answered');
    const app = await this.prisma.application.findUniqueOrThrow({ where: { id: offer.applicationId }, include: { job: true } });
    await this.prisma.$transaction(async tx => {
      const count = await tx.recruitmentOffer.updateMany({ where: { id, status: 'SENT' }, data: { status: response, respondedAt: new Date() } });
      if (count.count !== 1) throw new ConflictException('Offer already answered');
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
