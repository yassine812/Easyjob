import { BadRequestException } from '@nestjs/common';

const PRIVATE_HOST = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|169\.254(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|::1|fc[0-9a-f]*:|fe80:)/i;

export function assertPublicUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new BadRequestException('Only valid public URLs are accepted'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || PRIVATE_HOST.test(parsed.hostname)) {
    throw new BadRequestException('The research URL must be a public http(s) URL');
  }
  return parsed.toString();
}

export function normalizeResearchQuery(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500);
}

export function assertAllowedResearchSource(type: string, allowed: string[]): asserts type is 'web' | 'github' | 'rss' {
  if (!['web', 'github', 'rss'].includes(type) || !allowed.includes(type)) throw new BadRequestException('Research source is not allowed');
}
