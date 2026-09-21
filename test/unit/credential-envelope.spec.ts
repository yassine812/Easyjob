import { openCredentials, sealCredentials } from '../../src/queues/email/credential-envelope';
describe('credential envelope', () => {
  it('encrypts using random nonces and authenticates the complete message', () => {
    const secret = 'test-only-secret-32-chars-long-enough', body = 'temporary password';
    const first = sealCredentials(body, secret), second = sealCredentials(body, secret);
    expect(first).not.toContain(body); expect(first).not.toEqual(second);
    expect(openCredentials(first, secret)).toBe(body);
    expect(() => openCredentials(first, 'wrong-key')).toThrow();
    const parts = first.split('.'); const bytes = Buffer.from(parts[2], 'base64'); bytes[0] ^= 1; parts[2] = bytes.toString('base64');
    expect(() => openCredentials(parts.join('.'), secret)).toThrow();
  });
});
