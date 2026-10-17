import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MeetingService } from '../../src/interviews/meeting.service';

function setup() {
  const item: any = { id: 'i', scheduledById: 'hr', status: 'SCHEDULED', meetingRoomId: 'ej-int-test', locationType: 'EASYJOB', startAt: new Date(Date.now() - 60000), endAt: new Date(Date.now() + 60000), participants: [], consents: [], application: { candidate: { userId: 'candidate' }, job: { companyId: 'co' } } };
  const prisma: any = { interview: { findUnique: jest.fn().mockResolvedValue(item), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([item]) } };
  const provider: any = { configured: () => true, activeRooms: jest.fn().mockResolvedValue(['ej-int-test']), assertConnected: jest.fn(), closeRoom: jest.fn(), receiveWebhook: jest.fn().mockResolvedValue({ event: 'participant_joined', room: { name: item.meetingRoomId } }) };
  const access: any = { assertInterviewPermission: jest.fn(), assertMembership: jest.fn().mockResolvedValue({ role: 'RECRUITER' }) };
  return { item, prisma, provider, service: new MeetingService(prisma, access, {} as never, provider) };
}
describe('native meeting lifecycle', () => {
  it('records start only after the assigned recruiter is connected to the SFU', async () => {
    const { service, provider, prisma } = setup(); await service.started('hr', 'i');
    expect(provider.assertConnected).toHaveBeenCalledWith('ej-int-test', 'hr');
    expect(prisma.interview.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'IN_PROGRESS', startedAt: expect.any(Date) } }));
  });
  it('does not allow a candidate to start the recruitment workflow', async () => { const { service } = setup(); await expect(service.started('candidate', 'i')).rejects.toThrow(ForbiddenException); });
  it('does not record a failed SFU connection', async () => { const { service, provider, prisma } = setup(); provider.assertConnected.mockRejectedValue(new Error('offline')); await expect(service.started('hr','i')).rejects.toThrow(); expect(prisma.interview.updateMany).not.toHaveBeenCalled(); });
  it.each(['COMPLETED','CANCELLED','NO_SHOW'])('rejects starting %s and evicts replayed tokens', async status => {
    const { service, provider, item } = setup(); item.status = status;
    await expect(service.started('hr','i')).rejects.toThrow(BadRequestException);
    await service.webhook('signed-body', 'signature'); expect(provider.closeRoom).toHaveBeenCalledWith('ej-int-test');
  });
  it('does not evict an authorized active room', async () => { const { service, provider } = setup(); await service.webhook('body', 'sig'); expect(provider.closeRoom).not.toHaveBeenCalled(); });
  it('rejects a forged webhook before reading or closing a room', async () => { const { service, provider, prisma } = setup(); provider.receiveWebhook.mockRejectedValue(new Error('bad signature')); await expect(service.webhook('body','forged')).rejects.toThrow(); expect(prisma.interview.findUnique).not.toHaveBeenCalled(); expect(provider.closeRoom).not.toHaveBeenCalled(); });
  it('retries eviction of a completed room after a media outage', async () => { const { service, provider, item } = setup(); item.status = 'COMPLETED'; await service.closeExpiredRooms(); expect(provider.closeRoom).toHaveBeenCalledWith('ej-int-test'); });
  it('keeps active rooms during the scheduled window', async () => { const { service, provider } = setup(); await service.closeExpiredRooms(); expect(provider.closeRoom).not.toHaveBeenCalled(); });
});
