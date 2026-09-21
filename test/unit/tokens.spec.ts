import { generateToken, hashToken, safeEqual } from '../../src/common/utils/tokens';

describe('tokens', () => {
  it('generates unique, hex tokens of expected length', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[a-f0-9]{96}$/);
    expect(a).not.toBe(b);
  });

  it('hashes tokens deterministically (sha256)', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
    expect(hashToken('abc')).toHaveLength(64);
  });

  it('never stores raw tokens — hash differs from input', () => {
    const raw = generateToken();
    expect(hashToken(raw)).not.toBe(raw);
  });

  it('compares secrets in constant time', () => {
    expect(safeEqual('same', 'same')).toBe(true);
    expect(safeEqual('same', 'diff')).toBe(false);
    expect(safeEqual('a', 'ab')).toBe(false);
  });
});
