import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FileValidationService } from '../files/file-validation.service';
import { StorageService } from '../files/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../queues/email/email.service';
import { AuditService } from '../audit/audit.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import { CreateSupportMessageDto, CreateSupportTicketDto, SupportTicketQueryDto, UpdateSupportTicketDto } from './support.dto';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileValidationService,
    private readonly storage: StorageService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly email?: EmailService,
    @Optional() private readonly audit?: AuditService,
    @Optional() @Inject(CONFIG) private readonly config?: AppConfig,
  ) {}

  async create(userId: string, dto: CreateSupportTicketDto, file?: Express.Multer.File) {
    const attachment = file ? this.files.validate(file) : null;
    const ticket = await this.prisma.supportTicket.create({ data: { reference: `EZ-PENDING-${randomUUID()}`, userId, subject: dto.subject.trim(), category: dto.category, message: dto.message.trim(), priority: dto.priority ?? 'NORMAL' } });
    const reference = `EZ-${String(ticket.ticketNumber).padStart(4, '0')}`;
    let attachmentKey: string | undefined;
    try {
      if (attachment) { const safeName = attachment.originalName.replace(/[^a-zA-Z0-9._-]/g, '_'); attachmentKey = `support/${userId}/${ticket.id}/${randomUUID()}-${safeName}`; await this.storage.put(attachmentKey, attachment.buffer, attachment.mimeType); }
      const saved = await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { reference, ...(attachment ? { attachmentKey, attachmentName: attachment.originalName, attachmentMime: attachment.mimeType, attachmentSize: attachment.size } : {}) } });
      await this.prisma.supportMessage.create({ data: { ticketId: ticket.id, senderId: userId, senderType: 'USER', message: dto.message.trim(), isRead: false, ...(attachment ? { attachmentKey, attachmentName: attachment.originalName, attachmentMime: attachment.mimeType, attachmentSize: attachment.size } : {}) } });
      void this.audit?.log({ actorId: userId, action: 'support.ticket_created', entityType: 'SupportTicket', entityId: ticket.id, metadata: { reference, category: dto.category } });
      void this.notifyTicketCreated(userId, reference, saved.subject);
      return this.get(userId, saved.reference);
    } catch (error) { if (attachmentKey) await this.storage.delete(attachmentKey).catch(() => undefined); await this.prisma.supportTicket.delete({ where: { id: ticket.id } }).catch(() => undefined); throw error; }
  }

  async list(userId: string, query: SupportTicketQueryDto = {}) {
    const tickets = await this.prisma.supportTicket.findMany({ where: { userId, ...(query.status ? { status: query.status } : {}), ...(query.category ? { category: query.category } : {}), ...(query.search ? { OR: [{ reference: { contains: query.search, mode: 'insensitive' } }, { subject: { contains: query.search, mode: 'insensitive' } }, { category: { contains: query.search, mode: 'insensitive' } }] } : {}) }, orderBy: { lastMessageAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { message: true, senderType: true, createdAt: true } } } });
    const unread = await this.unreadCounts(tickets.map(ticket => ticket.id), 'SUPPORT');
    return tickets.map(ticket => this.toTicketDto(ticket, unread.get(ticket.id) ?? 0));
  }

  async unreadCount(userId: string) {
    const result = await this.prisma.supportMessage.count({
      where: { ticket: { userId }, senderType: 'SUPPORT', isRead: false },
    });
    return { count: result };
  }

  async closeUserTicket(userId: string, referenceOrId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { userId, OR: [{ reference: referenceOrId }, { id: referenceOrId }] } });
    if (!ticket) throw new NotFoundException('Support request not found');
    const updated = ticket.status === 'CLOSED' ? ticket : await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });
    void this.audit?.log({ actorId: userId, action: 'support.ticket_closed', entityType: 'SupportTicket', entityId: ticket.id, metadata: { reference: ticket.reference } });
    return this.toTicketDto(updated, 0);
  }

  async get(userId: string, referenceOrId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { userId, OR: [{ reference: referenceOrId }, { id: referenceOrId }] }, include: { messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, name: true } } } } } });
    if (!ticket) throw new NotFoundException('Support request not found');
    await this.prisma.supportMessage.updateMany({ where: { ticketId: ticket.id, senderType: 'SUPPORT', isRead: false }, data: { isRead: true } });
    return this.toConversationDto(ticket);
  }

  async addUserMessage(userId: string, referenceOrId: string, dto: CreateSupportMessageDto, file?: Express.Multer.File) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { userId, OR: [{ reference: referenceOrId }, { id: referenceOrId }] } });
    if (!ticket) throw new NotFoundException('Support request not found');
    if (ticket.status === 'CLOSED') throw new BadRequestException('Closed tickets cannot receive new messages');
    const attachment = file ? this.files.validate(file) : null;
    const attachmentKey = attachment ? `support/${userId}/${ticket.id}/${randomUUID()}-${attachment.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}` : undefined;
    try {
      if (attachment && attachmentKey) await this.storage.put(attachmentKey, attachment.buffer, attachment.mimeType);
      const message = await this.prisma.supportMessage.create({ data: { ticketId: ticket.id, senderId: userId, senderType: 'USER', message: dto.message.trim(), isRead: false, ...(attachment ? { attachmentKey, attachmentName: attachment.originalName, attachmentMime: attachment.mimeType, attachmentSize: attachment.size } : {}) } });
      await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { lastMessageAt: new Date(), status: ticket.status === 'RESOLVED' ? 'OPEN' : ticket.status } });
      void this.audit?.log({ actorId: userId, action: 'support.message_sent', entityType: 'SupportTicket', entityId: ticket.id, metadata: { reference: ticket.reference, senderType: 'USER' } });
      void this.notifySupport(`New reply on ${ticket.reference}`, ticket.subject, ticket.reference);
      return this.toMessageDto(message);
    } catch (error) { if (attachmentKey) await this.storage.delete(attachmentKey).catch(() => undefined); throw error; }
  }

  async attachmentUrl(userId: string, referenceOrId: string, messageId?: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { userId, OR: [{ reference: referenceOrId }, { id: referenceOrId }] }, include: { messages: true } });
    if (!ticket) throw new NotFoundException('Support request not found');
    const item = messageId ? ticket.messages.find(message => message.id === messageId) : ticket.messages.find(message => message.attachmentKey);
    if (!item?.attachmentKey) throw new NotFoundException('No attachment for this support request');
    return { url: await this.storage.presignedGet(item.attachmentKey) };
  }

  async adminAttachmentUrl(referenceOrId: string, messageId?: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { OR: [{ reference: referenceOrId }, { id: referenceOrId }] }, include: { messages: true } });
    if (!ticket) throw new NotFoundException('Support request not found');
    const item = messageId ? ticket.messages.find(message => message.id === messageId) : ticket.messages.find(message => message.attachmentKey);
    if (!item?.attachmentKey) throw new NotFoundException('No attachment for this support request');
    return { url: await this.storage.presignedGet(item.attachmentKey) };
  }

  async adminList(query: SupportTicketQueryDto = {}) {
    const tickets = await this.prisma.supportTicket.findMany({ where: { ...(query.status ? { status: query.status } : {}), ...(query.category ? { category: query.category } : {}), ...(query.search ? { OR: [{ reference: { contains: query.search, mode: 'insensitive' } }, { subject: { contains: query.search, mode: 'insensitive' } }, { category: { contains: query.search, mode: 'insensitive' } }, { user: { email: { contains: query.search, mode: 'insensitive' } } }] } : {}) }, orderBy: { lastMessageAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { message: true, senderType: true, createdAt: true } } } });
    const unread = await this.unreadCounts(tickets.map(ticket => ticket.id), 'USER');
    return tickets.map(ticket => ({ ...this.toTicketDto(ticket, unread.get(ticket.id) ?? 0), user: ticket.user }));
  }

  async adminGet(referenceOrId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { OR: [{ reference: referenceOrId }, { id: referenceOrId }] }, include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, name: true } } } } } });
    if (!ticket) throw new NotFoundException('Support request not found');
    await this.prisma.supportMessage.updateMany({ where: { ticketId: ticket.id, senderType: 'USER', isRead: false }, data: { isRead: true } });
    return { ...this.toConversationDto(ticket), user: ticket.user };
  }

  async adminReply(adminId: string, referenceOrId: string, dto: CreateSupportMessageDto, file?: Express.Multer.File) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { OR: [{ reference: referenceOrId }, { id: referenceOrId }] } });
    if (!ticket) throw new NotFoundException('Support request not found');
    if (ticket.status === 'CLOSED') throw new BadRequestException('Closed tickets cannot receive new messages');
    const attachment = file ? this.files.validate(file) : null;
    const attachmentKey = attachment ? `support/admin/${ticket.id}/${randomUUID()}-${attachment.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}` : undefined;
    try {
      if (attachment && attachmentKey) await this.storage.put(attachmentKey, attachment.buffer, attachment.mimeType);
      const message = await this.prisma.supportMessage.create({ data: { ticketId: ticket.id, senderId: adminId, senderType: 'SUPPORT', message: dto.message.trim(), isRead: false, ...(attachment ? { attachmentKey, attachmentName: attachment.originalName, attachmentMime: attachment.mimeType, attachmentSize: attachment.size } : {}) } });
      await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { lastMessageAt: new Date(), status: 'WAITING_USER', assignedToId: adminId } });
      void this.audit?.log({ actorId: adminId, action: 'support.message_sent', entityType: 'SupportTicket', entityId: ticket.id, metadata: { reference: ticket.reference, senderType: 'SUPPORT' } });
      void this.notifyUserReply(ticket.userId, ticket.reference, ticket.subject);
      return this.toMessageDto(message);
    } catch (error) { if (attachmentKey) await this.storage.delete(attachmentKey).catch(() => undefined); throw error; }
  }

  async adminUpdate(adminId: string, referenceOrId: string, dto: UpdateSupportTicketDto) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { OR: [{ reference: referenceOrId }, { id: referenceOrId }] } });
    if (!ticket) throw new NotFoundException('Support request not found');
    const updated = await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { ...(dto.status ? { status: dto.status } : {}), ...(dto.priority ? { priority: dto.priority } : {}), ...(dto.status === 'RESOLVED' ? { lastMessageAt: new Date() } : {}) } });
    void this.audit?.log({ actorId: adminId, action: `support.status_${(dto.status ?? 'updated').toLowerCase()}`, entityType: 'SupportTicket', entityId: ticket.id, metadata: { reference: ticket.reference, status: dto.status } });
    return this.toTicketDto(updated, 0);
  }

  private async unreadCounts(ticketIds: string[], senderType: 'USER' | 'SUPPORT') {
    if (!ticketIds.length) return new Map<string, number>();
    const rows = await this.prisma.supportMessage.groupBy({ by: ['ticketId'], where: { ticketId: { in: ticketIds }, senderType, isRead: false }, _count: { _all: true } });
    return new Map(rows.map(row => [row.ticketId, row._count._all]));
  }

  private toTicketDto(ticket: any, unreadCount: number) {
    const latest = ticket.messages?.[0];
    return { id: ticket.id, reference: ticket.reference, ticketNumber: ticket.ticketNumber, subject: ticket.subject, category: ticket.category, status: ticket.status, priority: ticket.priority, lastMessageAt: ticket.lastMessageAt, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, unreadCount, lastMessage: latest ? { message: latest.message, senderType: latest.senderType, createdAt: latest.createdAt } : null };
  }

  private toMessageDto(message: any) {
    return { id: message.id, senderId: message.senderId, senderType: message.senderType, message: message.message, isRead: message.isRead, attachment: message.attachmentName ? { name: message.attachmentName, mime: message.attachmentMime, size: message.attachmentSize } : null, createdAt: message.createdAt };
  }

  private toConversationDto(ticket: any) {
    return { ...this.toTicketDto(ticket, 0), messages: ticket.messages.map((message: any) => ({ ...this.toMessageDto(message), sender: message.sender ? { id: message.sender.id, name: message.sender.name } : null })) };
  }

  private async notifyTicketCreated(userId: string, reference: string, subject: string) {
    const link = `${this.config?.frontendUrl ?? ''}/support?ticket=${encodeURIComponent(reference)}`;
    void this.notifications?.create({ userId, type: 'SUPPORT_TICKET_CREATED', title: `Ticket ${reference} created`, message: 'We received your support request.', data: { href: `/support?ticket=${reference}` }, email: { subject: `EasyJob Support — Ticket ${reference} received`, html: `<p>We received your support request.</p><p><strong>Ticket:</strong> ${reference}<br><strong>Subject:</strong> ${escapeHtml(subject)}</p><p><a href="${link}">View conversation</a></p>` }, dedupeKey: `support-created:${reference}` }).catch(() => undefined);
    void this.notifySupport(`New support ticket ${reference}`, subject, reference);
  }

  private async notifyUserReply(userId: string, reference: string, subject: string) {
    const link = `${this.config?.frontendUrl ?? ''}/support?ticket=${encodeURIComponent(reference)}`;
    void this.notifications?.create({ userId, type: 'SUPPORT_REPLY', title: `EasyJob Support replied to ${reference}`, message: 'You received a new response.', data: { href: `/support?ticket=${reference}` }, email: { subject: `EasyJob Support replied to ticket ${reference}`, html: `<p>You received a new response about <strong>${escapeHtml(subject)}</strong>.</p><p><a href="${link}">View conversation</a></p>` }, dedupeKey: `support-reply:${reference}:${Date.now()}` }).catch(() => undefined);
  }

  private async notifySupport(subject: string, ticketSubject: string, reference: string) {
    const to = this.config?.support?.email;
    if (!to || !this.email) return;
    await this.email.enqueue({ to, subject: `EasyJob Support — ${subject}`, text: `New support activity on ${reference}: ${ticketSubject}`, html: `<p><strong>${escapeHtml(reference)}</strong></p><p>${escapeHtml(ticketSubject)}</p><p>Open the Support Inbox to review the conversation.</p>`, dedupeKey: `support-team:${reference}:${subject}` }).catch(() => undefined);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
}
