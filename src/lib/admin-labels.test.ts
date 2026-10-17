import { describe, expect, it } from 'vitest';
import { adminStatusLabel } from './admin-labels';

describe('adminStatusLabel', () => {
  it.each([
    [null, '—'],
    [undefined, '—'],
    ['', '—'],
    ['ACTIVE', 'Actif'],
    ['PENDING', 'En attente'],
    ['UNKNOWN_STATE', 'unknown state'],
    [{ value: 'SUSPENDED' }, 'Suspendu'],
    [{ status: 'PENDING' }, 'En attente'],
    [{ state: 'ACTIVE' }, 'Actif'],
    [{ value: 42 }, '—'],
    [[], '—'],
    [42, '—'],
    [true, '—'],
  ])('handles %j without a runtime crash', (input, expected) => {
    expect(adminStatusLabel(input)).toBe(expected);
  });
});
