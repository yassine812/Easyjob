'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from './use-socket';

/** Socket updates are immediate; visible-page polling covers missed/reconnected events. */
export function useApplicationTracking() {
  const client = useQueryClient();
  const refresh = () => {
    for (const key of ['my-applications', 'application', 'application-events', 'application-interviews', 'career-overview']) {
      void client.invalidateQueries({ queryKey: [key] });
    }
  };
  useSocketEvent('application.status_changed', refresh);
  useSocketEvent('interview.scheduled', refresh);
  useSocketEvent('interview.updated', refresh);
}
