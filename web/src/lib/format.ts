export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** EasyJob's legacy *Cents fields store hundredths, including TND.
 * Konnect's millime conversion happens only in its backend adapter. */
export function formatMoney(cents: number | null | undefined, currency = 'TND', locale?: string): string {
  if (cents === null || cents === undefined) return '—';
  try {
    // EasyJob stores plan amounts in hundredths. TND is normally rendered
    // with three millime digits by Intl. The catalogue prices are stored in hundredths and rendered as whole dinar amounts when applicable.
    // Keep the product's prices readable and consistent with French pricing:
    // Keep the commercial TND reference prices readable and consistent.
    const tndPrecision = currency.toUpperCase() === 'TND'
      ? cents === 0
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 0, maximumFractionDigits: 2 }
      : {};
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      ...tndPrecision,
    }).format(cents / 100);
  } catch {
    return `${cents / 100} ${currency}`;
  }
}

export function formatSalary(min: number | null | undefined, max: number | null | undefined, currency = 'USD'): string {
  if (min == null && max == null) return 'Not specified';
  if (min != null && max != null && min === max) return formatMoney(min, currency);
  if (min != null && max != null) return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  if (min != null) return `From ${formatMoney(min, currency)}`;
  return `Up to ${formatMoney(max, currency)}`;
}

/** Job salaries are stored as whole units, unlike billing amounts which use cents. */
export function formatSalaryRange(min: number | null | undefined, max: number | null | undefined, currency = 'TND', locale?: string): string {
  if (min == null && max == null) return 'Not specified';
  const code = currency.toUpperCase();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const format = (value: number) => number.format(value);
  if (min != null && max != null && min === max) return `${format(min)} ${code}`;
  if (min != null && max != null) return `${format(min)} – ${format(max)} ${code}`;
  if (min != null) return `From ${format(min)} ${code}`;
  return `Up to ${format(max as number)} ${code}`;
}

export function formatJobSalary(min: number | null | undefined, max: number | null | undefined, currency = 'TND', locale?: string): string {
  return formatSalaryRange(min, max, currency, locale);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
