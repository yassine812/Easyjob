import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, apiFetch, qs, tryRefresh } from './client';
import { useAuthStore } from '@/store/auth-store';

const apiUrl = 'http://localhost:3000/api/v1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  useAuthStore.getState().clearSession();
  vi.restoreAllMocks();
});

describe('qs', () => {
  it('serializes only defined, non-empty params', () => {
    expect(qs({ page: 2, limit: 10, status: '', q: undefined, tag: null })).toBe('?page=2&limit=10');
    expect(qs({})).toBe('');
  });
});

describe('api client', () => {
  it('ignores a refresh result from a logged-out account', async () => {
    let complete!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const refresh = tryRefresh();
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession('new-account-token', {} as never);
    complete(jsonResponse({ accessToken: 'old-account-token' }));
    expect(await refresh).toBeNull();
    expect(useAuthStore.getState().accessToken).toBe('new-account-token');
  });
  it('does not return a previous account’s delayed private response', async () => {
    let complete!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const request = api.get('/candidates/me');
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession('new-account-token', {} as never);
    complete(jsonResponse({ name: 'Previous account' }));
    await expect(request).rejects.toMatchObject({ status: 409 });
  });
  it('attaches the Authorization header and credentials', async () => {
    useAuthStore.getState().setSession('token-1', {} as never);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));

    await api.get('/jobs');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${apiUrl}/jobs`);
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer token-1');
    expect((init as RequestInit).credentials).toBe('include');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('throws ApiError with the backend message on error responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ message: 'Job not found' }, 404),
    );

    await expect(api.get('/jobs/123')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Job not found',
    });
  });

  it('on 401: refreshes once, retries the original request, and keeps the session', async () => {
    useAuthStore.getState().setSession('expired-token', {} as never);

    let call = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse({ accessToken: 'fresh-token' });
      }
      call += 1;
      if (call === 1) return jsonResponse({ message: 'Unauthorized' }, 401);
      // The retry must carry the NEW token.
      const auth = (init?.headers as Headers)?.get('Authorization');
      if (auth !== 'Bearer fresh-token') return jsonResponse({ message: 'wrong token' }, 500);
      return jsonResponse({ id: 'job-1' });
    });

    const result = await api.get('/jobs/123');

    expect(result).toEqual({ id: 'job-1' });
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
    // Exactly one refresh attempt, exactly two attempts of the original request.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('single-flights concurrent 401s into one refresh request', async () => {
    useAuthStore.getState().setSession('expired-token', {} as never);

    let refreshCalls = 0;
    let attempts = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse({ accessToken: 'fresh-token' });
      }
      attempts += 1;
      // First attempt per request is 401; retries after refresh succeed.
      return attempts <= 2
        ? jsonResponse({ message: 'Unauthorized' }, 401)
        : jsonResponse({ ok: true });
    });

    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });

    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });

  it('when refresh fails: clears the session so guards redirect to login', async () => {
    useAuthStore.getState().setSession('expired-token', {} as never);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return jsonResponse({ message: 'Invalid refresh token' }, 401);
      return jsonResponse({ message: 'Unauthorized' }, 401);
    });

    await expect(api.get('/jobs')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('never triggers the refresh flow for auth endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ message: 'Invalid credentials' }, 401),
    );

    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
      status: 401,
    });

    // Only the login call itself — no refresh attempt.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not attach Authorization when auth: false', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));
    useAuthStore.getState().setSession('token-1', {} as never);

    await apiFetch('/health', { auth: false });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).has('Authorization')).toBe(false);
  });

  it('tryRefresh single-flights: concurrent calls share one request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ accessToken: 'fresh-token' }),
    );

    const [first, second] = await Promise.all([tryRefresh(), tryRefresh()]);
    expect(first).toBe('fresh-token');
    expect(second).toBe('fresh-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });
});
