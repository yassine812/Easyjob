import { useAuthStore } from '@/store/auth-store';
import { useCompanyStore } from '@/store/company-store';
import { queryClient } from '@/providers/query-provider';
import { authApi } from '@/lib/api/auth';
import { connectSocket, disconnectSocket } from '@/lib/api/ws';
import type { MeUser } from '@/types/api';

export class AuthIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthIdentityError';
  }
}

/**
 * Centralized, atomic session transition mechanism.
 * Password login, face login, and session restoration ALL use this.
 *
 * 1. Purges all previous session state, company context, web sockets, and query cache.
 * 2. Immediately sets the NEW access token in memory so /auth/me uses it.
 * 3. Fetches /auth/me using the NEW token.
 * 4. Validates identity (if expectedEmail is provided).
 * 5. Establishes the new Zustand auth session and active company context.
 * 6. Reconnects Socket.IO with the new token.
 */
export async function establishSession(
  accessToken: string,
  expectedEmail?: string,
): Promise<MeUser> {
  // Step 1: Atomic cleanup of previous session & caches
  disconnectSocket();
  // Keep protected routes waiting while /auth/me validates the new identity.
  useAuthStore.getState().beginSessionTransition();
  useCompanyStore.getState().clearCompanyState();
  queryClient.clear();

  const revision = useAuthStore.getState().sessionRevision;

  try {
    // Step 2: Install NEW access token immediately in memory
    useAuthStore.getState().setAccessToken(accessToken);

    // Step 3: Fetch /auth/me with the NEW access token
    const user = await authApi.me();
    if (useAuthStore.getState().sessionRevision !== revision) throw new AuthIdentityError('Session transition superseded');

    // Step 4: Identity validation safeguard
    if (!user || (expectedEmail && user.email.toLowerCase() !== expectedEmail.toLowerCase())) {
      throw new AuthIdentityError(
        `Session identity mismatch: expected ${expectedEmail}, got ${user?.email}`,
      );
    }

    // Step 5: Establish new session and active company
    useAuthStore.getState().setSession(accessToken, user);

    const firstCompanyId = user.memberships[0]?.companyId ?? null;
    useCompanyStore.getState().setActiveCompanyId(firstCompanyId);

    // Step 6: Clear query cache again for clean state & reconnect socket
    queryClient.clear();
    if (!user.mustChangePassword) connectSocket();

    return user;
  } catch (err) {
    if (useAuthStore.getState().sessionRevision !== revision) throw err;
    // On failure, ensure total teardown
    disconnectSocket();
    useCompanyStore.getState().clearCompanyState();
    useAuthStore.getState().clearSession();
    queryClient.clear();
    throw err;
  }
}

export function clearSessionAtomic(): void {
  disconnectSocket();
  useCompanyStore.getState().clearCompanyState();
  useAuthStore.getState().clearSession();
  queryClient.clear();
}
