'use client';
import { useLinkStatus } from 'next/link';
/** Place inside a Next Link when its own pending navigation needs feedback. */
export function NavigationProgress() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden="true" className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" /> : null;
}
