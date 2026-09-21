'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';
import { queryClient } from '@/providers/query-provider';
import { tryRefresh } from '@/lib/api/client';
import { authApi } from '@/lib/api/auth';
import { disconnectSocket } from '@/lib/api/ws';

/**
 * Hydrates the auth session on first mount:
 * 1. Try to refresh (httpOnly cookie → new access token).
 * 2. If a token exists, load /auth/me via establishSession.
 * 3. Otherwise mark the session as unauthenticated.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname(), router = useRouter();
  const mustChangePassword = useAuthStore(s => s.user?.mustChangePassword);
  const passwordBlocked = !!mustChangePassword && /^\/(admin|candidate|company|settings)(\/|$)/.test(pathname) && pathname !== '/company/register';
  useEffect(() => {
    if (!passwordBlocked) return;
    const frame = window.requestAnimationFrame(() => router.replace('/change-password'));
    return () => window.cancelAnimationFrame(frame);
  }, [passwordBlocked, router]);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setStatus = useAuthStore((s) => s.setStatus);

  useEffect(() => {
    let cancelled = false;
    const revision = useAuthStore.getState().sessionRevision;
    (async () => {
      const token = await tryRefresh();
      if (cancelled || useAuthStore.getState().sessionRevision !== revision) return;
      if (!token) {
        disconnectSocket();
        useCompanyStore.getState().clearCompanyState();
        queryClient.clear();
        setStatus('unauthenticated');
        return;
      }
      try {
        const { establishSession } = await import('@/lib/auth-session');
        if (cancelled || useAuthStore.getState().sessionRevision !== revision) return;
        await establishSession(token);
      } catch {
        // establishSession handles teardown only if its transition is still current.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession, setStatus]);

  // Public pages can render immediately. Protected routes own their loading guards.
  return passwordBlocked ? null : <>{children}</>;
}

/** Logs out through the API and completely purges local session state and caches. */
export async function logoutFlow(): Promise<void> {
  try {
    await authApi.logout(); // cookie and token revoked by backend
  } catch {
    // continue local cleanup even if the network call failed
  } finally {
    const { clearSessionAtomic } = await import('@/lib/auth-session');
    clearSessionAtomic();
  }
}
