'use client';

import { useEffect, useRef } from 'react';
import { getSocket, type SocketEvents } from '@/lib/api/ws';

/** Subscribe to a typed Socket.IO event; cleans up on unmount. */
export function useSocketEvent<K extends keyof SocketEvents>(
  event: K,
  handler: (data: SocketEvents[K]) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const wrapped = (data: SocketEvents[K]) => handlerRef.current(data);
    socket.on(event, wrapped as never);
    return () => {
      socket.off(event, wrapped as never);
    };
  }, [event]);
}

/** Returns the current socket (null when disconnected). */
export function useSocket() {
  return getSocket();
}
