import { NotFoundException } from '@nestjs/common';
import { SupportService } from '../../src/support/support.service';

describe('SupportService', () => {
  const prisma = {
    supportTicket: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    supportMessage: { create: jest.fn(), updateMany: jest.fn(), groupBy: jest.fn().mockResolvedValue([]), count: jest.fn() },
  } as any;
  const files = { validate: jest.fn() } as any;
  const storage = { put: jest.fn(), delete: jest.fn(), presignedGet: jest.fn() } as any;
  const service = new SupportService(prisma, files, storage);
  const ticket = { id: 't1', ticketNumber: 1042, reference: 'EZ-1042', userId: 'u1', subject: 'Login', category: 'ACCOUNT', message: 'Cannot sign in', status: 'OPEN', priority: 'NORMAL', lastMessageAt: new Date(), attachmentKey: null, attachmentName: null, attachmentMime: null, attachmentSize: null, createdAt: new Date(), updatedAt: new Date(), messages: [] };
  const message = { id: 'm1', ticketId: 't1', senderId: 'u1', senderType: 'USER', message: 'Cannot sign in', isRead: false, attachmentName: null, attachmentMime: null, attachmentSize: null, createdAt: new Date() };

  beforeEach(() => { jest.clearAllMocks(); prisma.supportMessage.groupBy.mockResolvedValue([]); prisma.supportMessage.updateMany.mockResolvedValue({ count: 0 }); prisma.supportTicket.delete.mockResolvedValue(ticket); });

  it('creates a readable reference and persists the initial message', async () => {
    prisma.supportTicket.create.mockResolvedValue({ ...ticket, reference: 'EZ-PENDING-id' });
    prisma.supportTicket.update.mockResolvedValue(ticket);
    prisma.supportMessage.create.mockResolvedValue(message);
    prisma.supportTicket.findFirst.mockResolvedValue({ ...ticket, messages: [message] });
    const result = await service.create('u1', { subject: ' Login ', category: 'ACCOUNT', message: ' Cannot sign in ' });
    expect(prisma.supportTicket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', subject: 'Login', message: 'Cannot sign in' }) }));
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reference: 'EZ-1042' }) }));
    expect(prisma.supportMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ticketId: 't1', senderType: 'USER', message: 'Cannot sign in' }) }));
    expect(result).toEqual(expect.objectContaining({ reference: 'EZ-1042', status: 'OPEN' }));
  });

  it('lists only records returned for the authenticated user with unread counts', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([ticket]);
    await service.list('u1');
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' }, orderBy: { lastMessageAt: 'desc' } }));
  });

  it('reopens a resolved ticket when the user replies', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ ...ticket, status: 'RESOLVED' });
    prisma.supportMessage.create.mockResolvedValue({ ...message, message: 'Any update?' });
    prisma.supportTicket.update.mockResolvedValue({ ...ticket, status: 'OPEN' });
    const result = await service.addUserMessage('u1', 'EZ-1042', { message: 'Any update?' });
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'OPEN' }) }));
    expect(result).toEqual(expect.objectContaining({ message: 'Any update?' }));
  });

  it('does not reveal another user ticket', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null);
    await expect(service.get('u2', 't1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u2', OR: [{ reference: 't1' }, { id: 't1' }] } }));
  });
});
