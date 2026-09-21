import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatFileSize,
  formatMoney,
  formatSalary,
  initials,
  pluralize,
} from './format';

describe('formatMoney', () => {
  it('formats cents as currency', () => {
    expect(formatMoney(9900, 'USD')).toContain('99');
  });

  it('formats the Tunisian catalogue without a factor-of-ten error or rounding', () => {
    expect(formatMoney(2499, 'TND', 'fr-TN')).toMatch(/24,99\s+TND/);
    expect(formatMoney(4999, 'TND', 'en')).toMatch(/TND\s+49\.99/);
    expect(formatMoney(0, 'TND', 'fr')).toMatch(/0\s+TND/);
  });

  it('keeps historical USD invoices in their original currency and precision', () => {
    expect(formatMoney(999, 'USD', 'en')).toMatch(/USD\s+9\.99/);
    expect(formatMoney(1999, 'EUR', 'fr')).toMatch(/19,99\s+EUR/);
  });

  it('returns em dash for null/undefined', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
  });

  it('falls back gracefully for unknown currencies', () => {
    expect(formatMoney(5000, 'ZZZ')).toContain('50');
  });
});

describe('formatSalary', () => {
  it('shows a range with the separator', () => {
    const out = formatSalary(50000, 80000, 'USD');
    expect(out).toContain('–');
    expect(out).toContain('50');
    expect(out).toContain('80');
  });

  it('shows a single value when min === max', () => {
    expect(formatSalary(60000, 60000, 'USD')).not.toContain('–');
  });

  it('handles one-sided and unspecified ranges', () => {
    expect(formatSalary(50000, null, 'USD')).toContain('From');
    expect(formatSalary(null, 80000, 'USD')).toContain('Up to');
    expect(formatSalary(null, null)).toBe('Not specified');
  });
});

describe('formatDate', () => {
  it('formats ISO dates and returns em dash for falsy input', () => {
    expect(formatDate('2025-01-15T00:00:00Z')).toMatch(/Jan/i);
    expect(formatDate(null)).toBe('—');
  });
});

describe('formatFileSize', () => {
  it('formats bytes, KB and MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toContain('KB');
    expect(formatFileSize(5 * 1024 * 1024)).toContain('MB');
  });
});

describe('initials', () => {
  it('builds 2-letter initials and handles empty names', () => {
    expect(initials('Jane Doe')).toBe('JD');
    expect(initials('Ada')).toBe('A');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });
});

describe('pluralize', () => {
  it('pluralizes correctly', () => {
    expect(pluralize(1, 'application')).toBe('1 application');
    expect(pluralize(3, 'application')).toBe('3 applications');
    expect(pluralize(2, 'company', 'companies')).toBe('2 companies');
  });
});
