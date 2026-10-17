'use client';

import { useEffect, useRef, useState } from 'react';
import { initials } from '@/lib/format';
import { useAuthStore } from '@/store/auth-store';
import { authApi } from '@/lib/api/auth';
import { cn } from '@/lib/utils';

export function displayCandidateName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).map(part => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1).toLocaleLowerCase()}`).join(' ');
}

/**
 * /auth/me normalizes the only persisted photo source once. Every candidate
 * avatar then renders that same user.avatarUrl value.
 */
export function CandidateAvatar({ name, className = '', fallbackClassName = '' }: { name: string; className?: string; fallbackClassName?: string }) {
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const attemptedHydration = useRef(false);
  const [imageError, setImageError] = useState(false);
  // Existing in-memory sessions may have been created before the backend
  // serialized avatar_url. Refresh the canonical current-user record once.
  useEffect(() => {
    if (!user?.candidateProfileId || user.avatarUrl || attemptedHydration.current) return;
    attemptedHydration.current = true;
    void authApi.me().then(setUser).catch(() => undefined);
  }, [setUser, user]);
  const source = user?.avatarUrl ?? undefined;
  useEffect(() => { setImageError(false); }, [source]);
  return <div className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}>
    {source && !imageError
      ? <img src={source} alt={name} className="size-full rounded-full object-cover" referrerPolicy="no-referrer" onError={() => setImageError(true)} />
      : <span className={cn('flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground', fallbackClassName)}>{initials(name)}</span>}
  </div>;
}
