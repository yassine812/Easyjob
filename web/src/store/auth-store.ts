import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MeUser } from '@/types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  sessionRevision: number;
  status: AuthStatus;
  user: MeUser | null;
  accessToken: string | null;
  /** Non-sensitive convenience value persisted for "remember my email". */
  lastEmail: string | null;
  setSession: (accessToken: string, user: MeUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: MeUser) => void;
  beginSessionTransition: () => void;
  clearSession: () => void;
  setStatus: (status: AuthStatus) => void;
  setLastEmail: (email: string) => void;
}

/**
 * Authentication state.
 * - The ACCESS token lives in memory only (mitigates XSS token theft).
 * - The REFRESH token is an httpOnly cookie managed by the backend — it
 *   never reaches JavaScript.
 * - Only `lastEmail` is persisted (localStorage).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessionRevision: 0,
      status: 'loading',
      user: null,
      accessToken: null,
      lastEmail: null,
      setSession: (accessToken, user) => set({ status: 'authenticated', accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      beginSessionTransition: () => set(s => ({ status: 'loading', user: null, accessToken: null, sessionRevision: s.sessionRevision + 1 })),
      clearSession: () => set(s => ({ status: 'unauthenticated', user: null, accessToken: null, sessionRevision: s.sessionRevision + 1 })),
      setStatus: (status) => set({ status }),
      setLastEmail: (email) => set({ lastEmail: email }),
    }),
    {
      name: 'startup-starter-auth',
      partialize: (s) => ({ lastEmail: s.lastEmail }),
    },
  ),
);
