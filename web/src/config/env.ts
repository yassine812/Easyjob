/**
 * Frontend environment configuration.
 * Only NEXT_PUBLIC_* values are safe to ship to the browser — never add
 * backend secrets here (JWT secrets, S3 keys, AI keys, webhook secrets...).
 */
/** Keep local API cookies on the same hostname when opening a loopback alias. */
export function localServiceUrl(value: string, hostname = typeof window === 'undefined' ? '' : window.location.hostname): string {
  if (!['localhost', '127.0.0.1'].includes(hostname)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.hostname === hostname) return value;
    url.hostname = hostname;
    return url.toString();
  } catch { return value; }
}

export const env = {
  get apiUrl() { return localServiceUrl(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'); },
  get wsUrl() { return localServiceUrl(process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000'); },
  get frontendUrl() { return localServiceUrl(process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:5173'); },
} as const;

export const IS_PROD = process.env.NODE_ENV === 'production';
