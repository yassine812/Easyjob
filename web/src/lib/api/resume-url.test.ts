import { describe, expect, it, vi } from 'vitest';
vi.mock('@/config/env', () => ({ env: { apiUrl: 'http://localhost:3002/api/v1' } }));
import { resolveResumeUrl } from './resumes';
describe('private resume URL resolution', () => {
  it('resolves a local signature on the API host without losing parameters', () => {
    expect(resolveResumeUrl('/api/v1/files/signed?key=test&expires=123&sig=abc')).toBe('http://localhost:3002/api/v1/files/signed?key=test&expires=123&sig=abc');
  });
  it('preserves a signed S3 URL', () => {
    expect(resolveResumeUrl('https://storage.example.test/cv.pdf?signature=abc')).toBe('https://storage.example.test/cv.pdf?signature=abc');
  });
});
