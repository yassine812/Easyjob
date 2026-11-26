import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, localServiceUrl } from './env';

afterEach(() => vi.unstubAllEnvs());

describe('Local service addresses', () => {
  it('keeps Parlor separate from the CV and face service on port 8000', () => {
    vi.stubEnv('NEXT_PUBLIC_PARLOR_URL', undefined);
    expect(new URL(env.parlorUrl).port).toBe('8001');
    vi.stubEnv('NEXT_PUBLIC_PARLOR_URL', 'https://practice.example.test');
    expect(env.parlorUrl).toBe('https://practice.example.test');
  });
  it('keeps the API port and path when using the numeric loopback address', () => {
    expect(localServiceUrl('http://localhost:3002/api/v1', '127.0.0.1')).toBe('http://127.0.0.1:3002/api/v1');
  });
  it('keeps local websocket requests on the same hostname', () => {
    expect(localServiceUrl('http://127.0.0.1:3002', 'localhost')).toBe('http://localhost:3002/');
  });
  it('does not rewrite external, secure, relative or server-rendered URLs', () => {
    expect(localServiceUrl('https://api.example.com/api/v1', 'localhost')).toBe('https://api.example.com/api/v1');
    expect(localServiceUrl('https://localhost:3002', '127.0.0.1')).toBe('https://localhost:3002');
    expect(localServiceUrl('/api/v1', 'localhost')).toBe('/api/v1');
    expect(localServiceUrl('http://localhost:3002/api/v1', '')).toBe('http://localhost:3002/api/v1');
    expect(localServiceUrl('http://localhost:3002/api/v1', 'app.example.com')).toBe('http://localhost:3002/api/v1');
  });
});
