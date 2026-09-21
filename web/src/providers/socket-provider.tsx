'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { connectSocket, disconnectSocket } from '@/lib/api/ws';

/**
 * Maintains one Socket.IO connection per authenticated session.
 * Reconnects with a fresh token when the access token rotates;
 * disconnects on logout.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (status === 'authenticated') {
      connectSocket();
      return () => disconnectSocket();
    }
    disconnectSocket();
    return undefined;
  }, [status, accessToken]);

  return <>{children}</>;
}
