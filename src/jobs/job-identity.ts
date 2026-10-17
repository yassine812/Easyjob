import type { ExternalJobListing } from './sources/job-source.types';

const normalized = (value: string | null | undefined) => (value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = (value: string) => new Set(normalized(value).split(' ').filter(word => word.length > 2));
/** Conservative duplicate evidence. Similar titles alone never identify a vacancy. */
export function sameVacancy(a: Pick<ExternalJobListing, 'title' | 'companyName' | 'location' | 'description' | 'publishedAt' | 'salaryMin' | 'salaryMax' | 'currency' | 'reference'>, b: typeof a) {
  if (!a.companyName || !b.companyName || !a.location || !b.location || normalized(a.companyName) !== normalized(b.companyName)
    || normalized(a.title) !== normalized(b.title) || normalized(a.location) !== normalized(b.location)) return false;
  if (a.reference && b.reference && a.reference !== b.reference) return false;
  if (a.currency && b.currency && a.currency !== b.currency) return false;
  if (a.salaryMin != null && b.salaryMin != null && a.salaryMin !== b.salaryMin) return false;
  if (a.salaryMax != null && b.salaryMax != null && a.salaryMax !== b.salaryMax) return false;
  if (a.publishedAt && b.publishedAt && Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime()) > 7 * 86400000) return false;
  const left = words(a.description), right = words(b.description);
  if (left.size < 25 || right.size < 25) return false;
  const intersection = [...left].filter(word => right.has(word)).length;
  return intersection / (left.size + right.size - intersection) >= 0.88;
}
