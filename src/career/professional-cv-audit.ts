import type { AtsCriterion } from './career-engine';
export interface AuditDimension { key: string; score: number | null; passed: number; total: number; method: string }
export function professionalCvAudit(text: string, parsed: { headline: string | null; sections: Record<string, string[]> }, criteria: AtsCriterion[], keywords: string[], matched: string[]) {
  const lines = text.split(/\r?\n/).map((quote, i) => ({ quote: quote.trim(), line: i + 1 })).filter(l => l.quote);
  const bullets = lines.filter(l => /^\s*[-*•●▪◦‣∙]\s*/u.test(l.quote));
  const weak = bullets.filter(l => /^(?:[-*•●▪◦‣∙]\s*)?(worked on|helped with|responsible for|travail sur|participation|aide à|tâches diverses)/i.test(l.quote));
  const long = lines.filter(l => l.quote.split(/\s+/).length > 70);
  const duplicates = lines.filter((l, i) => l.quote.length > 35 && lines.slice(0, i).some(p => p.quote.toLowerCase() === l.quote.toLowerCase()));
  const dates = lines.filter(l => /\b(?:19|20)\d{2}\b/.test(l.quote));
  const reversed = dates.filter(l => { const years = l.quote.match(/\b(?:19|20)\d{2}\b/g); return years?.length === 2 && Number(years[0]) > Number(years[1]); });
  const dimensions: AuditDimension[] = [];
  const add = (key: string, checks: boolean[], method: string) => dimensions.push({ key, score: text.trim() && checks.length ? Math.round(100 * checks.filter(Boolean).length / checks.length) : null, passed: checks.filter(Boolean).length, total: checks.length, method });
  const passed = (key: string) => criteria.find(c => c.key === key)?.passed ?? false;
  add('content_quality', [!!parsed.headline, passed('summary'), passed('experience'), passed('skills'), passed('education')], 'Recognized title, summary, experience, skills and education; presence does not certify quality.');
  add('recruiter_readability', [long.length === 0, duplicates.length === 0, weak.length === 0, passed('readable_length')], 'Four text checks: paragraph length, repetition, vague bullet openings, readable length.');
  add('experience_clarity', [passed('experience'), bullets.length > 0, weak.length === 0 && bullets.length > 0, dates.length > 0, reversed.length === 0], 'Experience section, bullets, specific openings, dated text and chronological range consistency.');
  add('achievement_strength', [passed('quantified_evidence')], 'Measured outcomes from experience/projects; scope counts alone do not pass.');
  add('structure_quality', [passed('readable_text'), passed('experience'), passed('skills'), passed('education'), !text.includes('\ufffd')], 'Extracted-text structure only; visual document properties are inspected separately.');
  add('contact_completeness', [passed('email'), passed('phone')], 'Email and phone detected; not ownership verification.');
  add('keyword_coverage', keywords.map(k => matched.includes(k)), 'Exact published keyword coverage; no target yields unknown.');
  add('job_relevance', keywords.map(k => matched.includes(k)), 'Documented target keywords only; responsibilities and seniority remain in the separate cited fit analysis.');
  add('ats_compatibility', [passed('readable_text'), passed('email'), passed('experience'), passed('education'), passed('skills'), !text.includes('\ufffd')], 'Six reproducible text checks, not an ATS vendor certification; PDF geometry must be reviewed separately.');
  const findings: { key: string; kind: 'FACT' | 'RECOMMENDATION'; priority: 'high' | 'medium' | 'low'; evidence: { quote: string; line: number }[]; action: string }[] = [];
  if (weak.length) findings.push({ key: 'weak_bullets', kind: 'RECOMMENDATION', priority: 'medium', evidence: weak, action: 'Describe your specific action, technology and purpose using facts already present. Add a measured result only if you can substantiate it.' });
  if (duplicates.length) findings.push({ key: 'duplicate_content', kind: 'FACT', priority: 'low', evidence: duplicates, action: 'Review repeated passages and retain the most relevant occurrence.' });
  if (long.length) findings.push({ key: 'long_paragraphs', kind: 'FACT', priority: 'low', evidence: long, action: 'Split this passage into short responsibility or achievement bullets without removing evidence.' });
  if (reversed.length) findings.push({ key: 'date_order', kind: 'RECOMMENDATION', priority: 'medium', evidence: reversed, action: 'Check whether this date range is reversed. No dates have been changed.' });
  return { method: 'professional_cv_audit_v1', dimensions, findings,
    inventory: ['title', 'summary', 'experience', 'education', 'skills', 'certifications', 'languages', 'projects', 'links', 'dates'].map(key => ({ key, status: (key === 'title' ? !!parsed.headline : key === 'links' ? /(?:https?:\/\/|linkedin\.com|github\.com)/i.test(text) : key === 'dates' ? dates.length > 0 : !!parsed.sections[key]?.length) ? 'DETECTED' : 'NOT_FOUND', required: ['title', 'experience', 'skills'].includes(key) })),
    documentChecks: ['columns', 'tables', 'headers', 'footers', 'image_text', 'reading_order'].map(key => ({ key, status: 'UNKNOWN', reason: 'Requires inspection of the actual document.' })),
    limitations: ['No single ATS standard is simulated. These reproducible checks do not predict recruiter decisions.', 'Optional sections are inventoried, not required for every candidate.'] };
}
