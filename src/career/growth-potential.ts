import { containsFact, normalize, type CareerCandidate, type CareerJob } from './career-engine';

export type GrowthEvidenceSource = 'WORK_EXPERIENCE' | 'PROJECT' | 'CERTIFICATION' | 'SKILLS' | 'CV' | 'COVER_LETTER';
export type GrowthEvidence = {
  id?: string;
  concept: string;
  source: GrowthEvidenceSource;
  sourceLabel?: string;
  sourceId?: string;
  section?: string;
  evidence: string;
  strength?: 'strong' | 'moderate' | 'supporting' | 'context';
  recency?: string | null;
  relevance: number;
  confidence: number;
  relatedSkill?: string;
};
export type GrowthComponent = {
  type: string;
  label: string;
  contribution: number;
  evidenceIds: string[];
};
export type GrowthProgression = {
  steps: { title: string; companyName: string; startDate: string; endDate: string | null; current: boolean }[];
  summary: string | null;
};
export type GrowthGap = {
  skill: string;
  currentEvidence: string;
  gap: string;
  effort: 'reasonable' | 'moderate' | 'substantial';
  critical?: boolean;
  evidence?: GrowthEvidence;
};
export type CoverLetterAnalysis = {
  provided: boolean;
  relevance: 'high' | 'medium' | 'low' | 'not_provided';
  score: number | null;
  evidence: string[];
  checks: { jobSpecificReferences: boolean; concreteExperience: boolean; relevantAchievements: boolean; technologiesWithExamples: boolean };
};
export type GrowthAnalysis = {
  score: number | null;
  category: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNDETERMINED';
  summary: string;
  why: string[];
  strengths: string[];
  evidence: GrowthEvidence[];
  transferableEvidence: GrowthEvidence[];
  gaps: GrowthGap[];
  coverLetter: CoverLetterAnalysis;
  components: Record<string, number>;
  componentBreakdown: GrowthComponent[];
  progression: GrowthProgression;
  method: 'deterministic_growth_evidence_v1';
};

const adjacentSkills: Record<string, string[]> = {
  django: ['flask', 'fastapi', 'python'], flask: ['django', 'fastapi'], 'django rest framework': ['rest api', 'flask'],
  docker: ['kubernetes', 'linux', 'ci/cd', 'continuous integration'], kubernetes: ['docker', 'linux'],
  postgresql: ['mysql', 'sql', 'sql server'], mysql: ['postgresql', 'sql'], react: ['vue', 'angular'],
  'react native': ['react', 'flutter'], typescript: ['javascript'], javascript: ['typescript'],
  aws: ['azure', 'gcp', 'docker', 'linux'],
};

const sourceLabel = (source: GrowthEvidenceSource) => source === 'WORK_EXPERIENCE' ? 'Work experience' : source === 'COVER_LETTER' ? 'Cover letter' : source === 'PROJECT' ? 'Project' : source === 'CERTIFICATION' ? 'Certification' : source === 'CV' ? 'CV' : source === 'SKILLS' ? 'Skills' : source;
const textSections = (candidate: CareerCandidate, key: string) => {
  const data = candidate.professionalData;
  if (!data || typeof data !== 'object') return [];
  const typed = data as { sections?: Record<string, string[]>; projects?: unknown[]; certifications?: unknown[] };
  const sections = typed.sections?.[key] ?? [];
  if (sections.length) return sections;
  const structured = typed[key as 'projects' | 'certifications'];
  return Array.isArray(structured) ? structured.map(value => typeof value === 'string' ? value : value && typeof value === 'object' ? Object.values(value).filter(item => typeof item === 'string').join(' · ') : '').filter(Boolean) : [];
};

function evidenceForSkill(skill: string, candidate: CareerCandidate, coverLetter: string): GrowthEvidence | null {
  const work = (candidate.experiences ?? []).map(e => ({ text: `${e.title}: ${e.description ?? ''}`, label: `${e.title} · ${e.companyName}`, id: (e as { id?: string }).id, date: e.endDate ?? e.startDate })).filter(e => e.text.trim());
  const projects = textSections(candidate, 'projects');
  const certifications = textSections(candidate, 'certifications');
  const profileSkills = candidate.skills.map(s => s.skill?.name ?? s.name ?? '').filter(Boolean);
  const cv = (candidate.resumes ?? []).flatMap(resume => (resume.parsedText ?? '').split(/\r?\n/)).filter(Boolean);
  const sources: Array<{ source: GrowthEvidenceSource; lines: { text: string; label?: string; id?: string; date?: Date | null }[]; section: string }> = [
    { source: 'WORK_EXPERIENCE', lines: work, section: 'professional_experience' },
    { source: 'PROJECT', lines: projects.map(text => ({ text, label: 'Project' })), section: 'projects' },
    { source: 'CERTIFICATION', lines: certifications.map(text => ({ text, label: 'Certification' })), section: 'certifications' },
    { source: 'SKILLS', lines: profileSkills.map(text => ({ text, label: 'Skills' })), section: 'skills' },
    { source: 'CV', lines: cv.map(text => ({ text, label: 'CV' })), section: 'cv' },
    { source: 'COVER_LETTER', lines: coverLetter ? [{ text: coverLetter, label: 'Cover letter' }] : [], section: 'cover_letter' },
  ];
  const adjacent = adjacentSkills[normalize(skill)] ?? [];
  for (const item of sources) {
    const direct = item.lines.find(line => containsFact(line.text, skill));
    if (direct) return { concept: 'relevant_skill_evidence', source: item.source, sourceLabel: direct.label ?? sourceLabel(item.source), sourceId: direct.id, section: item.section, evidence: direct.text, strength: item.source === 'COVER_LETTER' ? 'supporting' : item.source === 'SKILLS' ? 'moderate' : 'strong', recency: direct.date?.toISOString() ?? null, relevance: item.source === 'COVER_LETTER' ? .65 : item.source === 'CV' ? .8 : 1, confidence: item.source === 'WORK_EXPERIENCE' ? .95 : item.source === 'PROJECT' ? .8 : item.source === 'COVER_LETTER' ? .65 : .7, relatedSkill: skill };
    for (const related of adjacent) {
      const line = item.lines.find(value => containsFact(value.text, related));
      if (line) return { concept: 'skill_transferability', source: item.source, sourceLabel: line.label ?? sourceLabel(item.source), sourceId: line.id, section: item.section, evidence: line.text, strength: item.source === 'COVER_LETTER' ? 'supporting' : 'moderate', recency: line.date?.toISOString() ?? null, relevance: item.source === 'COVER_LETTER' ? .6 : item.source === 'CV' ? .7 : .85, confidence: item.source === 'WORK_EXPERIENCE' ? .85 : item.source === 'COVER_LETTER' ? .6 : .7, relatedSkill: `${related} -> ${skill}` };
    }
  }
  return null;
}

function coverLetterAnalysis(letter: string, job: CareerJob): CoverLetterAnalysis {
  const text = letter.trim();
  if (!text) return { provided: false, relevance: 'not_provided', score: null, evidence: [], checks: { jobSpecificReferences: false, concreteExperience: false, relevantAchievements: false, technologiesWithExamples: false } };
  const terms = [...job.skills.map(s => s.skill.name), ...job.requirements, job.title].filter(Boolean);
  const references = terms.filter(term => containsFact(text, term));
  const concreteExperience = /\b(?:built|developed|created|implemented|delivered|managed|automated|migrated|développ|conçu|mis en place|livr[ée])\w*/i.test(text);
  const relevantAchievements = /\b\d+(?:%|\+)?\b|\b(?:improv|reduc|increas|optim|amélior|réduit|augment)\w*/i.test(text);
  const technologiesWithExamples = references.length > 0 && concreteExperience;
  const score = Math.min(100, references.length * 20 + (concreteExperience ? 30 : 0) + (relevantAchievements ? 20 : 0) + (technologiesWithExamples ? 20 : 0));
  const snippets = text.split(/(?<=[.!?])\s+/u);
  return { provided: true, relevance: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low', score, evidence: references.slice(0, 5).map(term => `${term}: "${snippets.find(sentence => containsFact(sentence, term)) ?? text.slice(0, 180)}"`), checks: { jobSpecificReferences: references.length > 0, concreteExperience, relevantAchievements, technologiesWithExamples } };
}

export function analyzeGrowthPotential(candidate: CareerCandidate, job: CareerJob, match: { evidenceAnalysis?: { requirements?: Array<{ label: string; status: string; priority?: string }> }; matchedSkills?: string[]; growthPotentialScore?: number | null }, letter = ''): GrowthAnalysis {
  const requiredSkills = job.skills.filter(skill => skill.required).map(skill => skill.skill.name);
  const allSkills = [...new Set([...requiredSkills, ...job.skills.map(skill => skill.skill.name)])];
  const transferableEvidence = allSkills.map(skill => evidenceForSkill(skill, candidate, letter)).filter((value): value is GrowthEvidence => !!value);
  const projects = textSections(candidate, 'projects');
  const certifications = textSections(candidate, 'certifications');
  const titles = (candidate.experiences ?? []).map(e => e.title).filter(Boolean);
  const seniority = (title: string) => /director|directeur|executive/i.test(title) ? 5 : /lead|principal|responsable/i.test(title) ? 4 : /senior|sénior/i.test(title) ? 3 : /mid|intermediate|confirm/i.test(title) ? 2 : /junior|stage|intern/i.test(title) ? 1 : 0;
  const progression = titles.length > 1 && seniority(titles[titles.length - 1]) > seniority(titles[0]) ? 90 : titles.length > 1 ? 45 : 0;
  const transferable = allSkills.length ? Math.round(100 * transferableEvidence.reduce((sum, evidence) => sum + evidence.relevance, 0) / allSkills.length) : 0;
  const adjacent = transferableEvidence.some(e => e.concept === 'skill_transferability') ? 80 : match.growthPotentialScore ?? 0;
  const projectScore = projects.length ? 80 : transferableEvidence.some(evidence => evidence.source === 'WORK_EXPERIENCE') ? 30 : 0;
  const learningScore = certifications.length ? 80 : candidate.skills.length ? 60 : 0;
  const letterAnalysis = coverLetterAnalysis(letter, job);
  const coverScore = letterAnalysis.score ?? 0;
  const gaps: GrowthGap[] = requiredSkills.filter(skill => !transferableEvidence.some(e => e.relatedSkill === skill || e.relatedSkill?.endsWith(`-> ${skill}`))).slice(0, 6).map(skill => {
    const requirement = match.evidenceAnalysis?.requirements?.find(item => normalize(item.label).includes(normalize(skill)));
    const critical = requirement?.status === 'NOT_FOUND' && requirement.priority === 'REQUIRED';
    return { skill, currentEvidence: 'No adjacent evidence found in the submitted materials.', gap: 'Production or role-specific evidence is still needed.', effort: critical ? 'substantial' : 'moderate', critical };
  });
  const criticalGapPenalty = Math.min(30, gaps.filter(gap => gap.critical).length * 10);
  const weightedComponents = [
    [transferable, allSkills.length > 0, .3],
    [progression, (candidate.experiences?.length ?? 0) > 1, .2],
    [adjacent, transferableEvidence.length > 0, .2],
    [projectScore, projects.length > 0, .15],
    [learningScore, candidate.skills.length > 0 || certifications.length > 0, .1],
    [coverScore, letter.trim().length > 0, .05],
  ] as const;
  const availableWeight = weightedComponents.reduce((sum, [, available, weight]) => sum + (available ? weight : 0), 0);
  const weightedScore = weightedComponents.reduce((sum, [value, available, weight]) => sum + (available ? value * weight : 0), 0);
  const hasProfessionalEvidence = (candidate.experiences?.length ?? 0) > 0 || candidate.skills.length > 0 || projects.length > 0 || certifications.length > 0 || (candidate.resumes ?? []).some(resume => !!resume.parsedText?.trim()) || letter.trim().length > 0;
  const score = hasProfessionalEvidence && availableWeight > 0 ? Math.min(100, Math.max(0, Math.round(weightedScore / availableWeight) - criticalGapPenalty)) : null;
  const category = score == null ? 'UNDETERMINED' : score >= 80 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  const genericEvidence: GrowthEvidence[] = [];
  const work = (candidate.experiences ?? []).map(e => ({ text: `${e.title}: ${e.description ?? ''}`, label: `${e.title} · ${e.companyName}`, id: (e as { id?: string }).id, date: e.endDate ?? e.startDate })).filter(e => e.text.trim());
  const cv = (candidate.resumes ?? []).map(resume => resume.parsedText ?? '').filter(Boolean);
  const genericSources: Array<[GrowthEvidenceSource, { text: string; label?: string; id?: string; date?: Date | null }[], string]> = [
    ['WORK_EXPERIENCE', work, 'documented_work_history'],
    ['PROJECT', projects.map(text => ({ text, label: 'Project' })), 'documented_project'],
    ['CERTIFICATION', certifications.map(text => ({ text, label: 'Certification' })), 'documented_certification'],
    ['SKILLS', candidate.skills.map(s => s.skill?.name ?? s.name ?? '').filter(Boolean).map(text => ({ text, label: 'Skills' })), 'documented_skill'],
    ['CV', cv.map(text => ({ text, label: 'CV' })), 'cv_profile'],
  ];
  for (const [source, lines, concept] of genericSources) {
    const line = lines.find(value => value.text.trim());
    if (line && !transferableEvidence.some(evidence => evidence.source === source && evidence.evidence === line.text)) {
      genericEvidence.push({ concept, source, sourceLabel: line.label ?? sourceLabel(source), sourceId: line.id, section: source.toLowerCase(), evidence: line.text, strength: source === 'SKILLS' ? 'moderate' : 'supporting', recency: line.date?.toISOString() ?? null, relevance: source === 'WORK_EXPERIENCE' ? .9 : source === 'PROJECT' ? .8 : source === 'CERTIFICATION' ? .75 : source === 'CV' ? .7 : .65, confidence: source === 'WORK_EXPERIENCE' ? .95 : .7 });
    }
  }
  const evidence = [...transferableEvidence, ...genericEvidence].slice(0, 12).map((item, index) => ({ ...item, id: `growth-evidence-${index + 1}` }));
  const strengths = transferableEvidence.filter(e => e.concept === 'relevant_skill_evidence' || e.concept === 'skill_transferability').slice(0, 6).map(e => e.relatedSkill ?? e.evidence);
  if (!strengths.length) strengths.push(...genericEvidence.slice(0, 3).map(e => e.evidence));
  const countEvidence = (skill: string, source: GrowthEvidenceSource) => {
    const lines = source === 'WORK_EXPERIENCE' ? work.map(item => item.text) : source === 'PROJECT' ? projects : source === 'CV' ? cv : source === 'SKILLS' ? candidate.skills.map(item => item.skill?.name ?? item.name ?? '') : [];
    return lines.filter(line => containsFact(line, skill)).length;
  };
  const why = evidence.filter(item => item.relatedSkill).slice(0, 6).map(item => {
    const skill = item.relatedSkill?.split(' -> ').at(-1) ?? item.relatedSkill ?? item.evidence;
    if (item.concept === 'skill_transferability') return `${item.relatedSkill} is supported by adjacent evidence in ${item.sourceLabel ?? sourceLabel(item.source)}.`;
    const count = countEvidence(skill, item.source);
    if (item.source === 'WORK_EXPERIENCE') return `${skill} appears in ${count || 1} professional experience${count > 1 ? 's' : ''}; the evidence is tied to ${item.sourceLabel ?? 'the documented role'}.`;
    if (item.source === 'PROJECT') return `${skill} is documented in a project, giving the recruiter a concrete context to verify.`;
    if (item.source === 'SKILLS') return `${skill} is listed in the profile skills; depth of delivery should be confirmed against the CV or interview.`;
    if (item.source === 'COVER_LETTER') return `${skill} is mentioned in the cover letter as supporting context, not as independent proof of mastery.`;
    return `${skill} is explicitly present in the submitted CV evidence.`;
  });
  if (progression > 0) why.push('The documented roles show increasing responsibility over time.');
  if (projects.length) why.push('A documented project adds practical context to the development path.');
  if (certifications.length) why.push('Completed certification evidence supports continued development.');
  if (letterAnalysis.relevance === 'high') why.push('The cover letter connects concrete experience to this role.');
  const progressionData: GrowthProgression = {
    steps: (candidate.experiences ?? []).map(experience => ({ title: experience.title, companyName: experience.companyName, startDate: experience.startDate.toISOString(), endDate: experience.endDate?.toISOString() ?? null, current: experience.current })),
    summary: progression > 0 ? 'The documented roles show increasing responsibility over time.' : titles.length > 1 ? 'Multiple roles are documented; the responsibility progression should be reviewed with the recruiter.' : null,
  };
  const componentBreakdown: GrowthComponent[] = weightedComponents.filter(([, available]) => available).map(([value, , weight], index) => {
    const labels = ['Transferable skills', 'Career progression', 'Adjacent skills', 'Projects', 'Learning evidence', 'Cover letter context'];
    const types = ['transferable_skill', 'progression', 'adjacent_skill', 'project', 'learning', 'cover_letter'];
    return { type: types[index], label: labels[index], contribution: Math.round(value * weight / availableWeight), evidenceIds: evidence.filter(item => index === 0 ? !!item.relatedSkill : index === 2 ? item.concept === 'skill_transferability' : index === 3 ? item.source === 'PROJECT' : index === 5 ? item.source === 'COVER_LETTER' : item.source === 'WORK_EXPERIENCE').map(item => item.id ?? '') };
  });
  if (criticalGapPenalty > 0) componentBreakdown.push({ type: 'critical_gap_penalty', label: 'Critical requirement gaps', contribution: -criticalGapPenalty, evidenceIds: [] });
  return { score, category, summary: score == null ? 'No sufficient professional evidence was found to determine growth potential.' : `${category === 'HIGH' ? 'Strong' : category === 'MEDIUM' ? 'Moderate' : 'Limited'} growth evidence based on transferable skills, career history and documented projects.`, why, strengths, evidence, transferableEvidence, gaps, coverLetter: letterAnalysis, components: { transferable, progression, adjacent, projects: projectScore, learning: learningScore, coverLetter: coverScore, criticalGapPenalty }, componentBreakdown, progression: progressionData, method: 'deterministic_growth_evidence_v1' };
}

export { sourceLabel };
