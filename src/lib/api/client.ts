import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth-store';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  /** Attach the Authorization header. Default true. */
  auth?: boolean;
  headers?: Record<string, string>;
}

/** Endpoints that must never trigger the 401→refresh flow. */
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
];

// --- Single-flight refresh -------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;
let refreshRevision: number | null = null;

/**
 * Exchange the httpOnly refresh cookie for a new access token.
 * Single-flight: concurrent 401s share one refresh request (the backend
 * rotates refresh tokens, so parallel refreshes with the same token fail).
 */
export async function tryRefresh(): Promise<string | null> {
  const revision = useAuthStore.getState().sessionRevision;
  if (refreshPromise && refreshRevision === revision) return refreshPromise;
  refreshRevision = revision;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${env.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken?: string };
      if (useAuthStore.getState().sessionRevision !== revision) return null;
      if (!data.accessToken) return null;
      useAuthStore.getState().setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      if (refreshRevision === revision) refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// --- Core fetch ------------------------------------------------------------

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const rawMsg = (body as { message?: string | string[] } | null)?.message;
    const message = Array.isArray(rawMsg)
      ? rawMsg.join(', ')
      : (rawMsg ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, message, body ?? undefined);
  }
  return body as T;
}

/**
 * Central API client.
 * - prefixes NEXT_PUBLIC_API_URL
 * - attaches Authorization: Bearer <accessToken> (in-memory)
 * - always sends credentials: 'include' (httpOnly refresh cookie)
 * - on 401 (non-auth endpoints): single-flight refresh, then retry once
 * - if refresh fails: clears the auth session (guards redirect to /login)
 */
export async function apiFetch<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { auth = true, headers: extraHeaders, ...rest } = init;
  const revision = useAuthStore.getState().sessionRevision;
  const assertCurrentSession = () => {
    if (auth && useAuthStore.getState().sessionRevision !== revision) throw new ApiError(409, 'Session changed. Please retry.', { code: 'SESSION_CHANGED' });
  };

  const run = (): Promise<Response> => {
    const token = useAuthStore.getState().accessToken;
    const headers = new Headers(extraHeaders);
    if (auth && token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Request-Id', crypto.randomUUID());
    const isFormData = typeof FormData !== 'undefined' && rest.body instanceof FormData;
    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(`${env.apiUrl}${path}`, { ...rest, headers, credentials: 'include' });
  };

  let res: Response;
  try {
    res = await run();
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))) {
      throw new ApiError(
        0,
        `Unable to connect to backend API (${env.apiUrl}). Please make sure the backend server is running.`,
        { code: 'NETWORK_ERROR' },
      );
    }
    throw err;
  }

  assertCurrentSession();
  if (res.status === 401 && auth && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    const token = await tryRefresh();
    assertCurrentSession();
    if (token) {
      try {
        res = await run(); // retry the original request once with the new token
      } catch (err) {
        if (err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))) {
          throw new ApiError(
            0,
            `Unable to connect to backend API (${env.apiUrl}). Please make sure the backend server is running.`,
            { code: 'NETWORK_ERROR' },
          );
        }
        throw err;
      }
    } else {
      const { clearSessionAtomic } = await import('@/lib/auth-session');
      assertCurrentSession();
      clearSessionAtomic();
      return parseResponse<T>(res);
    }
  }

  assertCurrentSession();
  const result = await parseResponse<T>(res);
  assertCurrentSession();
  return result;
}

/** Fetch an authenticated binary response (for interview brief/PDF downloads). */
export async function apiBlob(path: string): Promise<Blob> {
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Request-Id': crypto.randomUUID() },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(response.status, body?.message ?? `Request failed (${response.status})`, body ?? undefined);
  }
  return response.blob();
}

/** Query-string builder for pagination + filters (only defined params). */
export function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

// --- Convenience helpers ----------------------------------------------------

/** FormData must be sent as-is; JSON.stringify would destroy it. */
function serializeBody(body: unknown): BodyInit | undefined {
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body;
  if (body === undefined) return undefined;
  return JSON.stringify(body ?? {});
}

export const api = {
  get: <T>(path: string, init?: RequestOptions) => apiFetch<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    apiFetch<T>(path, {
      ...init,
      method: 'POST',
      body: serializeBody(init?.body instanceof FormData ? init.body : body),
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    apiFetch<T>(path, {
      ...init,
      method: 'PATCH',
      body: serializeBody(init?.body instanceof FormData ? init.body : body),
    }),
  put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    apiFetch<T>(path, {
      ...init,
      method: 'PUT',
      body: serializeBody(init?.body instanceof FormData ? init.body : body),
    }),
  delete: <T>(path: string, init?: RequestOptions) => apiFetch<T>(path, { ...init, method: 'DELETE' }),
};
