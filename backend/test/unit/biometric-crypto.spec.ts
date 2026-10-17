import {
  BIOMETRIC_ALGORITHM_VERSION,
  cosineSimilarity,
  decryptEmbedding,
  encryptEmbedding,
} from '../../src/biometric/biometric.crypto';

const KEY = 'a'.repeat(64); // valid 32-byte hex key
const EMBEDDING = Array.from({ length: 128 }, (_, i) => (i % 7) / 10 + 0.01);

describe('biometric crypto (AES-256-GCM)', () => {
  it('encrypts and decrypts an embedding round-trip', () => {
    const encrypted = encryptEmbedding(KEY, EMBEDDING);
    expect(encrypted).not.toContain(JSON.stringify(EMBEDDING.slice(0, 3))); // not plaintext
    const { version, embedding } = decryptEmbedding(KEY, encrypted);
    expect(version).toBe(BIOMETRIC_ALGORITHM_VERSION);
    expect(embedding).toEqual(EMBEDDING);
  });

  it('produces unique ciphertexts for the same input (random IV)', () => {
    const a = encryptEmbedding(KEY, EMBEDDING);
    const b = encryptEmbedding(KEY, EMBEDDING);
    expect(a).not.toBe(b);
  });

  it('rejects a tampered payload (authenticated encryption)', () => {
    const encrypted = encryptEmbedding(KEY, EMBEDDING);
    const [iv, tag, data] = encrypted.split(':');
    const flipped = Buffer.from(data, 'hex');
    flipped[0] ^= 0xff;
    const tampered = `${iv}:${tag}:${flipped.toString('hex')}`;
    expect(() => decryptEmbedding(KEY, tampered)).toThrow();
  });

  it('rejects decryption with the wrong key', () => {
    const encrypted = encryptEmbedding(KEY, EMBEDDING);
    expect(() => decryptEmbedding('b'.repeat(64), encrypted)).toThrow();
  });

  it('rejects malformed payloads', () => {
    expect(() => decryptEmbedding(KEY, 'not-a-payload')).toThrow();
    expect(() => decryptEmbedding(KEY, 'aa:bb')).toThrow();
  });

  it('derives a key from a non-hex secret for dev convenience', () => {
    const encrypted = encryptEmbedding('dev-only-secret', EMBEDDING);
    const { embedding } = decryptEmbedding('dev-only-secret', encrypted);
    expect(embedding).toEqual(EMBEDDING);
  });

  it('refuses to encrypt without a configured key', () => {
    expect(() => encryptEmbedding('', EMBEDDING)).toThrow();
  });
});

describe('cosine similarity', () => {
  it('returns 1 for identical vectors and 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('returns 0 for empty or mismatched vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });
});
