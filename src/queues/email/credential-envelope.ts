import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

function key(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'easyjob-outbox-v1', 'company-access-email', 32));
}
export function sealCredentials(body: string, secret: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const data = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function openCredentials(envelope: string, secret: string): string {
  const parts = envelope.split('.');
  if (parts.length !== 3) throw new Error('Invalid credential envelope');
  const [iv, tag, data] = parts.map(p => Buffer.from(p, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
