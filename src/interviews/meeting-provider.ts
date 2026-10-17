import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';

@Injectable()
export class EasyJobMeetingProvider {
  configured() {
    if (process.env.EASYJOB_MEETING_ENABLED !== 'true' || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) return false;
    try { const url = new URL(process.env.LIVEKIT_URL ?? ''); return url.protocol === 'wss:' || (url.protocol === 'ws:' && ['localhost', '127.0.0.1'].includes(url.hostname)); } catch { return false; }
  }
  private assertConfigured() { if (!this.configured()) throw new ServiceUnavailableException({ code: 'MEETING_NOT_CONFIGURED', message: 'EasyJob Meeting is unavailable.' }); }
  private client() {
    this.assertConfigured();
    return new RoomServiceClient(process.env.LIVEKIT_INTERNAL_URL ?? process.env.LIVEKIT_URL!.replace(/^ws/, 'http'), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  }
  createRoom() { this.assertConfigured(); return `ej-int-${randomUUID()}`; }
  async getJoinAccess(room: string, user: { id: string; name: string }, interviewer: boolean) {
    this.assertConfigured();
    await this.client().createRoom({ name: room, emptyTimeout: 120, departureTimeout: 30, maxParticipants: 12 });
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: user.id, name: user.name, ttl: '60s', metadata: JSON.stringify({ role: interviewer ? 'interviewer' : 'candidate' }) });
    token.addGrant({ room, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: false, canUpdateOwnMetadata: false });
    return { url: process.env.LIVEKIT_URL!, roomName: room, token: await token.toJwt() };
  }
  async assertConnected(room: string, identity: string) { await this.client().getParticipant(room, identity); }
  async activeRooms() { return (await this.client().listRooms()).map(room => room.name); }
  async closeRoom(room: string) {
    try { await this.client().deleteRoom(room); }
    catch (error) { if ((error as { code?: string }).code !== 'not_found') throw error; }
  }
  async receiveWebhook(body: string, authorization: string) {
    this.assertConfigured();
    try { return await new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!).receive(body, authorization); }
    catch { throw new UnauthorizedException('Invalid meeting event signature'); }
  }
}
