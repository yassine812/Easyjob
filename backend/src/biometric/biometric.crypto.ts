import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { InternalServerErrorException } from '@nestjs/common';

/** Embedding/encryption scheme version stored with every credential. */
export const BIOMETRIC_ALGORITHM_VERSION = 1;

/**
 * Resolves the AES-256-GCM key from BIOMETRIC_ENCRYPTION_KEY.
 * Preferred format: 64 hex chars (32 bytes). Any other non-empty value is
 * SHA-256-derived for development convenience (documented — production should
 * use a full 64-hex random key).
 */
function keyBytes(keyHex: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(keyHex)) return Buffer.from(keyHex, 'hex');
  return createHash('sha256').update(keyHex).digest();
}

/**
 * Encrypts a face embedding with AES-256-GCM (authenticated encryption).
 * Output format: "<iv hex>:<auth tag hex>:<ciphertext hex>" (v1).
 * The raw embedding is never stored or returned.
 */
export function encryptEmbedding(keyHex: string, embedding: number[]): string {
  if (!keyHex) {
    throw new InternalServerErrorException('Biometric encryption is not configured');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(keyHex), iv);
  const plaintext = Buffer.from(JSON.stringify({ v: BIOMETRIC_ALGORITHM_VERSION, e: embedding }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/** Decrypts an embedding stored by {@link encryptEmbedding}. Throws on tampering. */
export function decryptEmbedding(keyHex: string, payload: string): { version: number; embedding: number[] } {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Malformed biometric credential');
  const [ivHex, tagHex, dataHex] = parts;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyBytes(keyHex), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    const parsed = JSON.parse(plain.toString('utf8')) as { v?: number; e?: number[] };
    const embedding = parsed.e;
    if (!Number.isInteger(parsed.v) || !Array.isArray(embedding)) {
      throw new Error('Malformed biometric payload');
    }
    for (const n of embedding) {
      if (typeof n !== 'number' || !Number.isFinite(n)) {
        throw new Error('Malformed biometric payload');
      }
    }
    return { version: parsed.v as number, embedding };
  } catch (err) {
    if (err instanceof Error && err.message === 'Malformed biometric payload') throw err;
    throw new Error('Biometric credential could not be decrypted (tampered or wrong key)');
  }
}

/**
 * Cosine similarity in [0, 1] for non-negative normalized descriptors.
 * 1 = identical direction; 0 = orthogonal. Matching uses
 * `similarity >= FACE_MATCH_THRESHOLD`.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}
