import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { loadConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';
import { CONFIG, type AppConfig } from '../config/configuration';
import type { AccessTokenPayload } from '../common/guards/jwt-auth.guard';

/**
 * Authenticated realtime gateway. Connections must present an access JWT in the
 * handshake (socket.io client: io(url, { auth: { token } })). Each socket joins
 * `user:{userId}` plus one room per active company membership, so a tenant can
 * only ever receive events addressed to its own rooms.
 *
 * CORS is restricted to the configured CORS_ORIGINS (same policy as the REST
 * API); `origin: true` would reflect any origin in production.
 */
@WebSocketGateway({
  cors: {
    origin(origin, cb) {
      const allowed = loadConfig().corsOrigins;
      if (!origin || allowed.includes(origin)) cb(null, true);
      else cb(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  afterInit(): void {
    this.realtime.setServer(this.server);
    this.realtime.onEvent(({ room, event, data }) => {
      if (event === 'auth.sessions_revoked') { this.server.in(room).disconnectSockets(true); return; }
      this.server.to(room).emit(event, data);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth as { token?: string } | undefined)?.token;
      if (!token) throw new UnauthorizedException('Missing token');
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
        algorithms: ['HS256'],
      });
      if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { companyMemberships: true },
      });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Account unavailable');
      if (user.mustChangePassword || (payload.sv ?? 0) !== user.sessionVersion) throw new UnauthorizedException('Session requires reauthentication');

      client.data.userId = user.id;
      if (payload.exp) client.data.expiryTimer = setTimeout(() => client.disconnect(true), Math.max(0, payload.exp * 1000 - Date.now()));
      await client.join(`user:${user.id}`);
      for (const membership of user.companyMemberships.filter((m) => m.status === 'ACTIVE')) {
        // Restricted roles receive their personal notifications. Company-wide
        // broadcasts can contain identifiers of applications outside their scope.
        if (!['HIRING_MANAGER', 'INTERVIEWER'].includes(membership.role)) {
          await client.join(`company:${membership.companyId}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Socket connection rejected: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    clearTimeout(client.data.expiryTimer);
    client.data.userId = undefined;
  }
}
