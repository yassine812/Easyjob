import type { Notification } from '@/types/api';

/** Returns only internal destinations for notification clicks. */
export function notificationHref(notification: Pick<Notification, 'type' | 'data'>) {
  const href = notification.data?.href;
  if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')) return href;

  const interviewId = notification.data?.interviewId;
  if (typeof interviewId === 'string' && notification.type.startsWith('interview.')) {
    return `/meetings/${encodeURIComponent(interviewId)}`;
  }

  return null;
}
