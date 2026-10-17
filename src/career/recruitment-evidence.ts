/** Evidence coverage v2. Scores describe documented coverage, never hiring probability. */
export type EvidenceStatus = 'EXPLICITLY_SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'TRANSFERABLE' | 'NOT_FOUND' | 'CONFLICTING';
export type EvidenceKind = 'FACT' | 'INFERENCE' | 'RECOMMENDATION' | 'UNKNOWN';
export interface Citation { source: 'JOB' | 'CV' | 'PROFILE' | 'ANSWER'; path: string; quote: string }
export interface RequirementEvidence { id: string; label: string; priority: 'REQUIRED' | 'PREFERRED' | 'UNSPECIFIED'; kind: EvidenceKind; status: EvidenceStatus; cvStatus: EvidenceStatus; source: Citation; evidence: Citation[]; action: string | null }
export interface EvidenceJob { title: string; description?: string; requirements?: string[]; responsibilities?: string[]; niceToHave?: string[]; languages?: string[]; minimumYearsExperience?: number | null; educationRequirement?: string | null; experienceLevel?: string | null; skills: { skill: { name: string }; required: boolean }[] }
const normalize = (s: string) => s.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const evidenceContains = (text: string, term: string) => !!term.trim() && new RegExp(`(^|[^\\p{L}\\p{N}])${escape(normalize(term))}($|[^\\p{L}\\p{N}])`, 'u').test(normalize(text));
const aliases: Record<string, string[]> = {
  'django rest framework': ['DRF'], 'rest api': ['API REST', 'REST APIs', 'APIs REST'],
  postgresql: ['Postgres'], javascript: ['JavaScript', 'JS'], typescript: ['TypeScript', 'TS'],
  'react native': ['React Native (Expo)'], 'ci/cd': ['continuous integration', 'intégration continue'],
  'amazon web services': ['AWS'], kubernetes: ['K8s'], 'node.js': ['NodeJS', 'Node.js'],
};
const related: Record<string, { partial?: string[]; transferable?: string[] }> = {
  'django rest framework': { partial: ['Django', 'REST API'] },
  django: { transferable: ['Flask', 'FastAPI'] }, postgresql: { transferable: ['MySQL', 'SQL Server'] },
  react: { transferable: ['Vue', 'Angular'] }, 'react native': { partial: ['React'], transferable: ['Flutter'] },
};
function variants(term: string) {
  const entry = Object.entries(aliases).find(([key, values]) => normalize(key) === normalize(term) || values.some(value => normalize(value) === normalize(term)));
  return entry ? [term, entry[0], ...entry[1]] : [term];
}
function classify(label: string, citations: Citation[]): { status: EvidenceStatus; evidence: Citation[] } {
  const yearsRequired = label.match(/^(\d+)\+? (?:years|ans)/i);
  if (yearsRequired) {
    const documented = citations.map(c => ({ c, years: c.quote.match(/\b(\d+)\+?\s*(?:years?(?: of)? (?:professional )?experience|ans? d[’']expérience|années? d[’']expérience)/i) })).filter(item => item.years);
    const enough = documented.filter(item => Number(item.years![1]) >= Number(yearsRequired[1]));
    return enough.length ? { status: 'EXPLICITLY_SUPPORTED', evidence: enough.map(item => item.c).slice(0, 3) } : documented.length ? { status: 'PARTIALLY_SUPPORTED', evidence: documented.map(item => item.c).slice(0, 3) } : { status: 'NOT_FOUND', evidence: [] };
  }
  const exact = citations.filter(c => variants(label).some(term => evidenceContains(c.quote, term)));
  const negative = exact.filter(c => /\b(no (?:experience|knowledge)|not (?:used|worked)|sans (?:experience|pratique)|jamais utilis\w*|ne .*pas .*experience)\b/i.test(normalize(c.quote)));
  if (negative.length) return { status: 'CONFLICTING', evidence: negative.slice(0, 3) };
  if (exact.length) return { status: 'EXPLICITLY_SUPPORTED', evidence: exact.slice(0, 3) };
  const relation = related[normalize(label)];
  for (const [key, status] of [['partial', 'PARTIALLY_SUPPORTED'], ['transferable', 'TRANSFERABLE']] as const) {
    const found = citations.filter(c => relation?.[key]?.some(term => evidenceContains(c.quote, term)));
    if (found.length) return { status, evidence: found.slice(0, 3) };
  }
  return { status: 'NOT_FOUND', evidence: [] };
}
export function jobIntelligence(job: EvidenceJob) {
  const requirements: { label: string; priority: RequirementEvidence['priority']; source: Citation }[] = [];
  const add = (label: string, priority: RequirementEvidence['priority'], path: string, quote = label) => {
    // Protected personal attributes are never candidate-fit dimensions.
    if (/\b(age|gender|sexe|religion\w*|marital|matrimonial\w*|ethni\w*|nationalit\w*|pregnan\w*|grossesse|handicap\w*)\b/i.test(normalize(label))) return;
    const existing = requirements.find(r => variants(r.label).some(v => normalize(v) === normalize(label)));
    if (existing) {
      if (existing.priority === 'UNSPECIFIED' || priority === 'REQUIRED') { existing.priority = priority; existing.source = { source: 'JOB', path, quote }; }
    } else if (label.trim()) requirements.push({ label, priority, source: { source: 'JOB', path, quote } });
  };
  job.skills.forEach((s, i) => add(s.skill.name, s.required ? 'REQUIRED' : 'UNSPECIFIED', `skills[${i}]`));
  const fromPhrase = (phrase: string, priority: RequirementEvidence['priority'], path: string) => {
    const names = [...job.skills.map(s => s.skill.name), ...Object.keys(aliases), ...Object.keys(related), 'Python', 'Docker', 'AWS', 'SQL', 'Java', 'Laravel'];
    const matches = [...new Set(names.filter(name => variants(name).some(v => evidenceContains(phrase, v))))];
    // A nested name (Django inside Django REST Framework) is not a second requirement.
    const found = matches.filter(name => !matches.some(other => normalize(other) !== normalize(name) && evidenceContains(other, name)));
    const years = phrase.match(/\b(\d+)\+?\s*(?:years?(?: of)? (?:professional )?experience|ans? d[’']expérience|années? d[’']expérience)/i);
    if (years) add(`${years[1]}+ years experience`, priority, path, phrase);
    if (found.length) found.forEach(name => add(name, priority, path, phrase));
    else if (!years) add(phrase, priority, path);
    // Named skills must not hide an additional qualification in the same clause.
    if (found.length && /\b(degree|dipl[oô]me|bachelor|master|phd|doctorat|licence|certifi\w*|fluent|courant|bilingue)\b/i.test(phrase)) add(phrase, priority, path);
  };
  (job.requirements ?? []).forEach((s, i) => fromPhrase(s, 'REQUIRED', `requirements[${i}]`));
  (job.niceToHave ?? []).forEach((s, i) => fromPhrase(s, 'PREFERRED', `niceToHave[${i}]`));
  (job.languages ?? []).forEach((s, i) => add(s, 'UNSPECIFIED', `languages[${i}]`));
  if (job.minimumYearsExperience != null && job.minimumYearsExperience > 0) add(`${job.minimumYearsExperience}+ years experience`, 'REQUIRED', 'minimumYearsExperience', String(job.minimumYearsExperience));
  if (job.educationRequirement?.trim()) add(job.educationRequirement, 'REQUIRED', 'educationRequirement');
  // Only explicit requirement phrases are extracted from prose; every one retains its quote.
  (job.description ?? '').split(/[\r\n]+|(?<=[.!?])\s+/).forEach((line, i) => {
    const priority = /\b(required|must have|mandatory|requis|exig[ée]|obligatoire|indispensable)\b/i.test(line) ? 'REQUIRED' : /\b(nice.to.have|preferred|un plus|souhait[ée]|appr[ée]ci[ée])\b/i.test(line) ? 'PREFERRED' : null;
    if (!priority) return;
    fromPhrase(line.trim(), priority, `description.line[${i + 1}]`);
  });
  return { method: 'cited_requirements_v1', role: { value: job.title, kind: 'FACT', source: 'title' },
    seniority: { value: job.experienceLevel ?? null, kind: job.experienceLevel ? 'FACT' : 'UNKNOWN', source: 'experienceLevel' },
    minimumYears: { value: job.minimumYearsExperience ?? null, kind: job.minimumYearsExperience == null ? 'UNKNOWN' : 'FACT', source: 'minimumYearsExperience' },
    requirements: requirements.slice(0, 100), responsibilities: (job.responsibilities ?? []).map((quote, i) => ({ source: 'JOB', path: `responsibilities[${i}]`, quote })),
    limitations: ['Priorities come from published fields or explicit wording; unspecified importance is not inferred.'] };
}
export function requirementEvidence(job: EvidenceJob, cvText: string, profileText = '') {
  const citations = (text: string, source: Citation['source']): Citation[] => text.split(/\r?\n/).map((quote, i) => ({ source, path: `line[${i + 1}]`, quote: quote.trim() })).filter(c => !!c.quote);
  const cv = citations(cvText, 'CV'), profile = citations(profileText, 'PROFILE');
  const rows: RequirementEvidence[] = jobIntelligence(job).requirements.map((r, i) => {
    const document = classify(r.label, cv), combined = classify(r.label, [...cv, ...profile]);
    return { ...r, id: `requirement-${i}`, status: combined.status, cvStatus: document.status, evidence: combined.evidence,
      kind: combined.status === 'EXPLICITLY_SUPPORTED' || combined.status === 'CONFLICTING' ? 'FACT' : combined.status === 'NOT_FOUND' ? 'UNKNOWN' : 'INFERENCE',
      action: document.status === 'EXPLICITLY_SUPPORTED' ? null : combined.status === 'EXPLICITLY_SUPPORTED' ? 'REFERENCE_PROFILE_EVIDENCE_IN_CV' : combined.status === 'CONFLICTING' ? 'VERIFY_CONTRADICTION' : 'ADD_EVIDENCE_IF_TRUE' };
  });
  const weights: Record<EvidenceStatus, number> = { EXPLICITLY_SUPPORTED: 1, PARTIALLY_SUPPORTED: .5, TRANSFERABLE: .25, NOT_FOUND: 0, CONFLICTING: 0 };
  const total = rows.reduce((n, r) => n + (r.priority === 'REQUIRED' ? 2 : 1), 0);
  const score = total && (cvText.trim() || profileText.trim()) ? Math.round(100 * rows.reduce((n, r) => n + weights[r.status] * (r.priority === 'REQUIRED' ? 2 : 1), 0) / total) : null;
  const cvCoverage = total && cvText.trim() ? Math.round(100 * rows.reduce((n, r) => n + weights[r.cvStatus] * (r.priority === 'REQUIRED' ? 2 : 1), 0) / total) : null;
  return { method: 'evidence_coverage_v2', score, cvCoverage, requirements: rows,
    counts: Object.fromEntries(Object.keys(weights).map(status => [status, rows.filter(r => r.status === status).length])),
    limitations: ['Text evidence is self-reported, not independently verified.', 'Not found means not documented, not absence of ability.', 'Partial and transferable matches require human review.'] };
}
