import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth-store';

/**
 * Socket.IO client.
 * - Handshake auth carries the in-memory access token (the gateway rejects
 *   sockets without a valid JWT).
 * - Rooms are assigned server-side (user:{id}, company:{id}) — the client
 *   never joins or emits.
 * - On access-token rotation the socket reconnects with the new token.
 */
let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket | null {
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;

  if (socket) {
    // Token rotated — refresh the handshake and reconnect.
    if ((socket.auth as { token?: string } | undefined)?.token !== token) {
      socket.auth = { token };
      socket.disconnect();
      socket.connect();
    }
    return socket;
  }

  socket = io(env.wsUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
}

export interface SocketEvents {
  'notification.created': { id: string; [key: string]: unknown };
  'application.created': { id: string; jobId: string };
  'application.updated': { id: string; status: string };
  'candidate.moved': { id: string; status: string };
  'application.status_changed': { id: string; jobId: string; status: string };
  'interview.scheduled': { id: string };
  'interview.updated': { id: string; status?: string };
}
