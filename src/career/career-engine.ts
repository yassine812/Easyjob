import { cvSkillItems, splitCvCertifications, splitCvEducations, splitCvExperiences, splitCvLanguages } from './cv-experience';
import { cvEmails, cvExcerpts, cvPhones, cvWordCount, quantifiedCvEvidence } from './cv-diagnostics';
/** Auditable, evidence-based estimates. Missing evidence is never invented. */
export const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim();
export const unique = (values: string[]) => [...new Set(values.map(v => v.trim()).filter(Boolean))];
export function containsFact(text: string, fact: string): boolean {
  const escaped = normalize(fact).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !!escaped && new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(normalize(text));
}
const headings: Record<string, RegExp> = {
  summary: /^(summary|profile|about me|professional summary|profil(?: professionnel)?|résumé|à propos|نبذة|الملخص)\s*[:：]?$/i,
  skills: /^(technical skills|skills|compétences(?: techniques)?|المهارات)\s*[:：]?$/i,
  experience: /^(work experience|professional experience|experience|expérience(?:s)?(?: professionnelle(?:s)?)?|employment|الخبرات|الخبرة المهنية)\s*[:：]?$/i,
  education: /^(education|formation(?:s)?|études|التعليم|التكوين)\s*[:：]?$/i,
  languages: /^(languages|langues|اللغات)\s*[:：]?$/i,
  certifications: /^(certifications?|certificats?|الشهادات)(?:\s*(?:&|et|and|و|\/)\s*(?:langues|languages|اللغات))?\s*[:：]?$/i,
  projects: /^(projects?|projets?|المشاريع)\s*[:：]?$/i,
};
export function extractProfile(text: string) {
  const sections: Record<string, string[]> = Object.fromEntries(Object.keys(headings).map(k => [k, []]));
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^#{1,6}\s+/, '');
    const inline = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    const inlineHeader = inline && Object.entries(headings).find(([, re]) => re.test(inline[1]));
    if (inlineHeader && inline) { section = inlineHeader[0]; sections[section].push(inline[2].trim()); continue; }
    const header = Object.entries(headings).find(([, re]) => re.test(line));
    if (header) { section = header[0]; continue; }
    if (section && line) sections[section].push(raw.trim());
  }
  const combined = sections.certifications;
  const certificationLines = combined.filter(line => /^Certifications?\s*[:：]/i.test(line));
  const languageLines = combined.filter(line => /^Langues?\s*[:：]/i.test(line));
  if (certificationLines.length) sections.certifications = certificationLines;
  if (languageLines.length) sections.languages = [...sections.languages, ...languageLines];
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const firstHeading = lines.findIndex(line => Object.values(headings).some(re => re.test(line)));
  const top = firstHeading < 0 ? lines : lines.slice(0, firstHeading);
  const labelled = (labels: string) => text.match(new RegExp(`^(?:${labels})\\s*[:：]\\s*(.+)$`, 'im'))?.[1]?.trim() ?? null;
  const years = text.match(/\b(\d{1,2})\+?\s*(?:years?(?: of)?|ans?|années?)\s*(?:d['’]\s*|of\s*)?(?:expérience|experience)\b/i)?.[1];
  const contactLine = top.find(line => cvEmails(line).length > 0 || cvPhones(line).length > 0 || /linkedin|github|portfolio/i.test(line)) || '';
  const inferredLocation = contactLine.split(/[|•·]/).map(part => part.trim()).find(part => /(?:,\s*(?:tunisie|tunisia|france|maroc|alg[ée]rie|canada|uk|usa)\b|\b(?:tunis|sfax|sousse|bizerte|zaghouan)\b)/i.test(part)) || null;
  const explicitHeadline = labelled('headline|job title|title|poste|titre|intitulé|المسمى الوظيفي');
  const inferredHeadline = top.slice(1, 4).find(line => line.length <= 120 && !cvEmails(line).length && !cvPhones(line).length && /développeur|developer|engineer|designer|technicien|manager|analyste|architect|devops|full[- ]stack/i.test(line)) || null;
  const explicitLocation = labelled('location|address|localisation|adresse|ville|city|العنوان|المدينة');
  return {
    headline: explicitHeadline || inferredHeadline,
    location: explicitLocation || inferredLocation,
    yearsExperience: years && Number(years) <= 60 ? Number(years) : null,
    email: cvEmails(text)[0] ?? null,
    phone: cvPhones(text)[0] ?? null,
    skills: cvSkillItems(sections.skills).filter(s => s.length <= 80),
    experiences: splitCvExperiences(sections.experience),
    educations: splitCvEducations(sections.education),
    languages: splitCvLanguages(sections.languages),
    certifications: splitCvCertifications(sections.certifications),
    summary: sections.summary.join('\n').trim() || null,
    sections,
    method: 'verbatim_sections_v1',
    needsReview: true,
  };
}export interface AtsCriterion {
  key: string; weight: number; passed: boolean; evidence: string[];
  metrics: Record<string, number | string>; priority: 'high' | 'medium' | 'low';
}
export function atsReport(text: string, keywords: string[] = [], selectedTarget?: { selected: boolean; title?: string; company?: string }) {
  const parsed = extractProfile(text);
  const count = cvWordCount(text);
  const emails = cvEmails(text), phones = cvPhones(text);
  // Training durations and contact details are not evidence of professional results.
  const quantitative = quantifiedCvEvidence([parsed.sections.experience.join('\n'), parsed.sections.projects.join('\n')].filter(Boolean).join('\n\n'), text);
  const sectionWords = (key: string) => cvWordCount(parsed.sections[key].join(' '));
  const criteria: AtsCriterion[] = [
    { key: 'readable_text', weight: 20, passed: count >= 80, priority: 'high', metrics: { count, minimum: 80 }, evidence: cvExcerpts(text.split(/\r?\n/).filter(line => cvWordCount(line) >= 8)) },
    { key: 'email', weight: 10, passed: emails.length > 0, priority: 'high', metrics: { count: emails.length }, evidence: cvExcerpts(emails) },
    { key: 'phone', weight: 5, passed: phones.length > 0, priority: 'low', metrics: { count: phones.length }, evidence: cvExcerpts(phones) },
    { key: 'summary', weight: 10, passed: sectionWords('summary') > 0, priority: 'medium', metrics: { count: sectionWords('summary') }, evidence: cvExcerpts(parsed.sections.summary) },
    { key: 'skills', weight: 15, passed: parsed.skills.length > 0, priority: 'medium', metrics: { count: parsed.skills.length }, evidence: cvExcerpts(parsed.sections.skills) },
    { key: 'experience', weight: 15, passed: sectionWords('experience') > 0, priority: 'high', metrics: { count: parsed.experiences.length }, evidence: cvExcerpts(parsed.experiences.map(entry => parsed.sections.experience.find(line => entry.title && line.includes(entry.title)) || entry.description[0] || '').filter(Boolean)) },
    { key: 'education', weight: 15, passed: sectionWords('education') > 0, priority: 'medium', metrics: { count: parsed.sections.education.filter(line => cvWordCount(line) > 0).length }, evidence: cvExcerpts(parsed.sections.education) },
    { key: 'readable_length', weight: 5, passed: count >= 150 && count <= 1200, priority: 'low', metrics: { count, minimum: 150, maximum: 1200 }, evidence: [] },
    { key: 'quantified_evidence', weight: 5, passed: quantitative.metrics.outcomeCount > 0, priority: 'medium', ...quantitative },
  ];
  const targetKeywords = [...new Map(keywords.map(keyword => [normalize(keyword), keyword.trim()])).values()].filter(Boolean);
  const missingKeywords = targetKeywords.filter(k => !containsFact(text, k));
  const matchedKeywords = targetKeywords.filter(k => containsFact(text, k));
  const baseScore = criteria.reduce((n, c) => n + (c.passed ? c.weight : 0), 0);
  // This is a text-only estimate, so keep a small headroom for human and employer review.
  const rawScore = targetKeywords.length ? Math.round(baseScore * .8 + 20 * (1 - missingKeywords.length / targetKeywords.length)) : baseScore;
  const failed = criteria.filter(criterion => !criterion.passed);
  const qualityCap = failed.some(criterion => criterion.priority === 'high') ? 59
    : failed.some(criterion => criterion.priority === 'medium') ? 79
      : failed.some(criterion => criterion.priority === 'low') ? 89
        : 95;
  return {
    score: count ? Math.min(qualityCap, rawScore) : null,
    criteria,
    strengths: criteria.filter(c => c.passed).map(c => c.key),
    suggestions: criteria.filter(c => !c.passed).map(c => c.key),
    missingKeywords, missingSkills: missingKeywords,
    target: { selected: selectedTarget?.selected ?? targetKeywords.length > 0, ...(selectedTarget?.title ? { title: selectedTarget.title } : {}), ...(selectedTarget?.company ? { company: selectedTarget.company } : {}), keywords: targetKeywords, matched: matchedKeywords, missing: missingKeywords },
    formattingProblems: [...(count < 80 ? ['insufficient_text'] : []), ...(text.includes('\ufffd') ? ['unreadable_characters'] : [])],
    wordCount: count, method: 'text_readiness_v1', estimated: true,
    limitations: ['text_only_layout_not_verified', ...((selectedTarget?.selected ?? targetKeywords.length > 0) ? [] : ['select_job_for_keywords'])],
  };
}
export interface CareerCandidate {
  headline?: string | null; bio?: string | null; location?: string | null; yearsExperience?: number | null;
  skills: { skill?: { name: string }; name?: string }[];
  experiences?: { title: string; companyName: string; description?: string | null; startDate: Date; endDate: Date | null; current: boolean }[];
  educations?: { institution: string; degree?: string | null; field?: string | null }[];
  professionalData?: unknown;
  resumes?: { parsedText: string | null }[];
}
export interface CareerJob {
  contractType?: string | null; languages?: string[];
  id: string; companyId: string; title: string; description: string; location: string | null;
  remote: boolean; workMode?: string | null; domain?: string | null; employmentType: string; experienceLevel: string;
  minimumYearsExperience?: number | null; educationRequirement?: string | null; requirements: string[];
  skills: { skill: { name: string }; required: boolean }[];
  company?: { industry?: string | null };
}
export function candidateText(candidate: CareerCandidate) {
  return [candidate.headline, candidate.bio, ...candidate.skills.map(s => s.skill?.name ?? s.name),
    ...(candidate.experiences ?? []).map(e => `${e.title} ${e.description ?? ''}`),
    ...(candidate.educations ?? []).map(e => `${e.degree ?? ''} ${e.field ?? ''}`),
    typeof candidate.professionalData === 'string' ? candidate.professionalData : JSON.stringify(candidate.professionalData ?? {}),
    ...(candidate.resumes ?? []).map(r => r.parsedText)].filter(Boolean).join('\n');
}
export function matchCandidate(candidate: CareerCandidate, job: CareerJob) {
  const evidence = candidateText(candidate);
  const sections = (candidate.professionalData as { sections?: Record<string, string[]> } | null)?.sections;
  const defined = candidate.skills.length > 0 || (candidate.resumes ?? []).some(r => !!r.parsedText?.trim()) || !!candidate.bio?.trim() || !!candidate.headline?.trim() || !!candidate.experiences?.length || !!candidate.educations?.length || Object.values(sections ?? {}).some(lines => lines.some(line => !!line.trim()));
  const matchedSkills = job.skills.filter(s => containsFact(evidence, s.skill.name)).map(s => s.skill.name);
  const missingSkills = job.skills.filter(s => !containsFact(evidence, s.skill.name)).map(s => s.skill.name);
  const dimensions: { key: string; score: number | null; weight: number; evidence: string[] }[] = [];
  const add = (key: string, score: number | null, weight: number, facts: string[]) => dimensions.push({ key, score, weight, evidence: facts });
  const skillWeight = job.skills.reduce((n, s) => n + (s.required ? 2 : 1), 0);
  add('skills', skillWeight ? Math.round(100 * job.skills.reduce((n, s) => n + (matchedSkills.includes(s.skill.name) ? s.required ? 2 : 1 : 0), 0) / skillWeight) : null, 40, matchedSkills);
  const requiredYears = job.minimumYearsExperience ?? null;
  // Explicit experience only: dates are not summed because concurrent jobs can overlap.
  const years = candidate.yearsExperience;
  add('experience', requiredYears !== null ? (years == null ? 0 : requiredYears === 0 ? 100 : Math.min(100, Math.round(years / requiredYears * 100))) : null, 15, years == null ? [] : [String(years)]);
  const edu = job.educationRequirement;
  const educationText = [...(candidate.educations ?? []).map(e => `${e.degree ?? ''} ${e.field ?? ''}`), ...(sections?.education ?? []), (candidate.resumes ?? []).map(r => r.parsedText).join('\n')].join('\n');
  add('education', edu ? (containsFact(educationText, edu) ? 100 : 0) : null, 10, edu && containsFact(educationText, edu) ? [edu] : []);
  const domain = job.domain || job.company?.industry;
  add('domain', domain ? (containsFact(evidence, domain) ? 100 : 0) : null, 5, domain && containsFact(evidence, domain) ? [domain] : []);
  const isRemote = job.workMode === 'REMOTE' || (!job.workMode && job.remote);
  const sameLocation = !!candidate.location && !!job.location && (normalize(candidate.location).includes(normalize(job.location)) || normalize(job.location).includes(normalize(candidate.location)));
  add('location', isRemote ? 100 : job.location ? sameLocation ? 100 : 0 : null, 10, isRemote ? ['REMOTE'] : sameLocation ? [job.location!] : []);
  const seniorityWords: Record<string, string[]> = { JUNIOR: ['junior', 'entry level', 'débutant'], MID: ['mid', 'intermediate', 'intermédiaire'], SENIOR: ['senior', 'sénior'], LEAD: ['lead', 'principal', 'responsable'], EXECUTIVE: ['director', 'directeur', 'executive'] };
  const titles = [candidate.headline, ...(candidate.experiences ?? []).map(e => e.title)].filter(Boolean).join(' ');
  const levels = Object.keys(seniorityWords);
  const knownLevels = levels.filter(level => seniorityWords[level].some(w => containsFact(titles, w)));
  const rank = knownLevels.length ? Math.max(...knownLevels.map(level => levels.indexOf(level) + 1)) : null;
  const requestedRank = levels.indexOf(job.experienceLevel) + 1;
  add('seniority', rank && requestedRank ? Math.min(100, Math.round(rank / requestedRank * 100)) : null, 5, knownLevels);
  // Requirement coverage is explicitly lexical; no inference that a licence/qualification is held.
  const requirements = [...job.requirements, ...(job.languages || [])].filter(r => r.trim());
  const covered = requirements.filter(r => containsFact(evidence, r));
  add('requirements', requirements.length ? Math.round(covered.length / requirements.length * 100) : null, 15, covered);
  const active = dimensions.filter(d => d.score !== null);
  const score = !defined || !active.length ? null : Math.round(active.reduce((n, d) => n + d.score! * d.weight, 0) / active.reduce((n, d) => n + d.weight, 0));
  const classification = score === null ? 'NOT_ANALYZED' : score >= 85 ? 'STRONG' : score >= 70 ? 'GOOD' : score >= 45 || matchedSkills.length > 0 && score >= 30 ? 'POTENTIAL' : 'WEAK';
  return { score, classification, matchedSkills, missingSkills, dimensions,
    unverifiedRequirements: requirements.filter(r => !covered.includes(r)),
    method: 'evidence_coverage_v1', estimated: true,
    potentialEvidence: classification === 'POTENTIAL' ? matchedSkills : [],
    summary: matchedSkills.length ? `Verified skill overlap: ${matchedSkills.join(', ')}. ${missingSkills.length} listed skills not evidenced.` : 'No listed skill overlap verified. Review the requirements and add evidence to your profile.',
  };
}
export interface CareerPreferences {
  contractTypes?: string[];
  domains: string[]; locations: string[]; workModes: string[]; excludedCompanies: string[]; excludedJobTypes: string[];
  employmentTypes?: string[]; excludedJobs?: string[]; minimumSalary?: number | null; salaryCurrency?: string;
}
export function matchesPreferences(job: CareerJob & { id?: string; salaryMin?: number | null; salaryMax?: number | null; currency?: string | null }, settings: CareerPreferences): boolean {
  return (!settings.domains.length || settings.domains.some(d => normalize(d) === normalize(job.domain || job.company?.industry || '')))
    && (!settings.locations.length || settings.locations.some(l => normalize(job.location || '').includes(normalize(l))))
    && (!settings.workModes.length || settings.workModes.includes(job.workMode || (job.remote ? 'REMOTE' : 'ONSITE')))
    && !settings.excludedCompanies.includes(job.companyId) && !settings.excludedJobTypes.includes(job.employmentType)
      && (!settings.employmentTypes?.length || settings.employmentTypes.includes(job.employmentType))
      && (!settings.contractTypes?.length || settings.contractTypes.includes(job.contractType || ''))
    && (!job.id || !settings.excludedJobs?.includes(job.id))
    && (settings.minimumSalary == null || ((job.salaryMax ?? job.salaryMin) != null
      && (job.salaryMax ?? job.salaryMin)! >= settings.minimumSalary
      && job.currency?.toUpperCase() === (settings.salaryCurrency || 'USD').toUpperCase()));
}
export function renderProfile(candidate: CareerCandidate & { user: { name: string; email: string }; phone?: string | null }) {
  const extra = candidate.professionalData as { sections?: Record<string, string[]> } | null;
  const lines = [`# ${candidate.user.name}`, candidate.user.email, candidate.phone || '', candidate.location || ''];
  const section = (title: string, content: string[]) => { if (content.filter(Boolean).length) lines.push('', `## ${title}`, ...content.filter(Boolean)); };
  section('Summary', [candidate.headline || '', candidate.bio || '', ...(extra?.sections?.summary ?? [])]);
  section('Skills', [unique(candidate.skills.map(s => s.skill?.name || s.name || '')).join(', '), ...(extra?.sections?.skills ?? [])]);
  section('Experience', [...(candidate.experiences ?? []).flatMap(e => [`${e.title} — ${e.companyName}`, `${e.startDate.toISOString().slice(0, 10)} — ${e.current ? 'Present' : e.endDate?.toISOString().slice(0, 10) || ''}`, e.description || '']), ...(extra?.sections?.experience ?? [])]);
  section('Education', [...(candidate.educations ?? []).map(e => [e.degree, e.field, e.institution].filter(Boolean).join(' — ')), ...(extra?.sections?.education ?? [])]);
  for (const k of ['languages', 'certifications', 'projects']) section(k[0].toUpperCase() + k.slice(1), extra?.sections?.[k] ?? []);
  return lines.filter((l, i) => l || i > 3).join('\n');
}

