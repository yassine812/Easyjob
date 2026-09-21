import { describe, expect, it } from 'vitest';
import { localServiceUrl } from './env';

describe('Local service addresses', () => {
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
