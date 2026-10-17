import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import type { Server } from 'socket.io';
import { CONFIG, type AppConfig } from '../config/configuration';

const CHANNEL = 'realtime:events';

export interface RealtimeEvent {
  room: string;
  event: string;
  data: unknown;
}

type EventListener = (event: RealtimeEvent) => void;

/**
 * Cross-process realtime bus. Emitters (API or worker processes) publish JSON
 * events on a Redis channel; the Socket.IO gateway in the API process subscribes
 * and forwards each event only to its target room (user:{id} / company:{id}).
 * Rooms are assigned from authenticated memberships, so events never leak
 * between tenants.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private listeners = new Set<EventListener>();
  private server: Server | null = null;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    try {
      this.publisher = new Redis(this.config.redis.url, { lazyConnect: true });
      this.subscriber = new Redis(this.config.redis.url, { lazyConnect: true });
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      await this.subscriber.subscribe(CHANNEL);
      this.subscriber.on('message', (_channel, message) => {
        try {
          const event = JSON.parse(message) as RealtimeEvent;
          for (const listener of this.listeners) listener(event);
        } catch (err) {
          this.logger.error(`Failed to parse realtime event: ${(err as Error).message}`);
        }
      });
    } catch (err) {
      this.logger.warn(`Realtime bus unavailable (${(err as Error).message}); events will be dropped`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.publisher?.quit().catch(() => undefined),
      this.subscriber?.quit().catch(() => undefined),
    ]);
  }

  /** Registered by the gateway to forward events to socket rooms. */
  onEvent(listener: EventListener): void {
    this.listeners.add(listener);
  }

  /** Registered by the gateway so the service can emit directly in-process. */
  setServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.publish({ room: `user:${userId}`, event, data });
  }

  disconnectUser(userId: string): void {
    const room = `user:${userId}`;
    this.server?.in(room).disconnectSockets(true);
    this.publish({ room, event: 'auth.sessions_revoked', data: null });
  }

  emitToCompany(companyId: string, event: string, data: unknown): void {
    this.publish({ room: `company:${companyId}`, event, data });
  }

  private publish(ev: RealtimeEvent): void {
    if (this.publisher) {
      // Publish once and let the local subscriber relay it too — emitting here
      // as well would deliver every event twice to this process's clients.
      this.publisher
        .publish(CHANNEL, JSON.stringify(ev))
        .catch((err) => this.logger.error(`Realtime publish failed: ${(err as Error).message}`));
      return;
    }
    // Redis unavailable — single-process fallback (dev / tests).
    this.server?.to(ev.room).emit(ev.event, ev.data);
  }
}
