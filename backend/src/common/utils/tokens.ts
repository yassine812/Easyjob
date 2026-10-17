import { createHash, randomBytes } from 'crypto';

/** Generates a URL-safe opaque token (48 random bytes → 64 hex chars). */
export function generateToken(bytes = 48): string {
  return randomBytes(bytes).toString('hex');
}

/** Hashes a token so the raw value is never stored. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison for signatures/secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return createHash('sha256').update(ab).digest().equals(createHash('sha256').update(bb).digest());
}
