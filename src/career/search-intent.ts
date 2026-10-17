import type { CareerSearchDto } from './career.dto';
/** Deterministic query interpretation; explicit filters always take precedence. */
export function searchIntent(input: CareerSearchDto) {
  let text = (input.keyword ?? '').trim();
  const query = { ...input };
  const inferred: { field: string; value: string; evidence: string }[] = [];
  const take = (re: RegExp, field: 'workMode' | 'experienceLevel' | 'location', value: string) => {
    const match = text.match(re); if (!match) return;
    if (!query[field]) { (query as Record<string, unknown>)[field] = value; inferred.push({ field, value, evidence: match[0] }); }
    text = text.replace(re, ' ');
  };
  take(/\b(remote|télétravail|à distance)\b/i, 'workMode', 'REMOTE');
  take(/\b(hybride?)\b/i, 'workMode', 'HYBRID');
  take(/\b(junior|débutant)\b/i, 'experienceLevel', 'JUNIOR');
  take(/\b(senior|sénior)\b/i, 'experienceLevel', 'SENIOR');
  for (const city of ['Tunis', 'Sousse', 'Sfax', 'Bizerte', 'Paris', 'Lyon']) take(new RegExp(`\\b${city}\\b`, 'i'), 'location', city);
  const matchingCv = /matching my cv|match.*mon cv|selon mon cv/i.test(text);
  if (matchingCv) { query.sort = 'match'; text = text.replace(/jobs matching my cv|matching my cv|offres.*mon cv|selon mon cv/gi, ''); }
  query.keyword = text.replace(/\b(jobs?|offres?|emplois?|with|avec|for|pour|les|des)\b/gi, ' ').replace(/\s+/g, ' ').trim() || undefined;
  return { query, inferred, matchingCv };
}
