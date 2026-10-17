export interface AutoApplyCvDefaults {
  experienceLevels: string[];
  domains: string[];
  skills: string[];
  locations: string[];
  targetTitles: string[];
}

type Experience = { title?: string | null; description?: string | null; startDate?: Date | null };

/** Stable, user-facing taxonomy used by AutoApply. These labels are deliberately
 * independent from the skills list so a technology never becomes a domain. */
export const AUTO_APPLY_DOMAINS = [
  'Web Development', 'Backend Development', 'Frontend Development', 'Full Stack Development',
  'Mobile Development', 'Software Engineering', 'Data Engineering', 'Data Science',
  'Machine Learning', 'DevOps', 'Cloud Computing', 'Cybersecurity', 'QA & Testing',
  'UI/UX Design', 'Product Management', 'Project Management', 'Finance & Accounting',
  'Marketing & Sales', 'Human Resources', 'Operations',
] as const;

const domainSignals: Record<(typeof AUTO_APPLY_DOMAINS)[number], string[]> = {
  'Web Development': ['web', 'website', 'webapp', 'web application', 'html', 'css', 'frontend', 'backend', 'full stack', 'django', 'laravel', 'react', 'vue', 'angular'],
  'Backend Development': ['backend', 'back-end', 'server-side', 'api', 'rest', 'django', 'laravel', 'node', 'php', 'spring', '.net'],
  'Frontend Development': ['frontend', 'front-end', 'react', 'vue', 'angular', 'html', 'css', 'javascript', 'typescript'],
  'Full Stack Development': ['full stack', 'full-stack', 'frontend and backend', 'front-end and back-end'],
  'Mobile Development': ['mobile', 'android', 'ios', 'react native', 'flutter', 'swift', 'kotlin'],
  'Software Engineering': ['software engineer', 'software development', 'application development', 'architecture', 'code review', 'agile'],
  'Data Engineering': ['data engineer', 'etl', 'data pipeline', 'spark', 'airflow', 'data warehouse'],
  'Data Science': ['data scientist', 'statistics', 'data analysis', 'pandas', 'jupyter'],
  'Machine Learning': ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'ml model'],
  DevOps: ['devops', 'ci/cd', 'continuous integration', 'kubernetes', 'docker', 'deployment', 'infrastructure'],
  'Cloud Computing': ['cloud', 'aws', 'azure', 'gcp', 'cloud computing'],
  Cybersecurity: ['cybersecurity', 'security', 'penetration testing', 'soc', 'vulnerability'],
  'QA & Testing': ['qa', 'quality assurance', 'testing', 'test automation', 'selenium', 'cypress'],
  'UI/UX Design': ['ui/ux', 'user experience', 'user interface', 'figma', 'product design'],
  'Product Management': ['product manager', 'product management', 'roadmap', 'user story'],
  'Project Management': ['project manager', 'project management', 'planning', 'scrum master'],
  'Finance & Accounting': ['finance', 'accounting', 'financial', 'audit'],
  'Marketing & Sales': ['marketing', 'sales', 'growth', 'commercial'],
  'Human Resources': ['human resources', 'recruitment', 'talent acquisition', 'hr'],
  Operations: ['operations', 'supply chain', 'logistics', 'process improvement'],
};

const canonicalSkills: Array<[RegExp, string]> = [
  [/^django rest framework$/, 'Django REST Framework'],
  [/^(rest api|rest apis|api rest)$/, 'REST API'],
  [/^html5?$/, 'HTML'], [/^css3?$/, 'CSS'], [/^node(?:\.js)?$/, 'Node.js'],
  [/^postgres(?:ql)?$/, 'PostgreSQL'], [/^(js|javascript)$/, 'JavaScript'],
  [/^(ts|typescript)$/, 'TypeScript'], [/^php$/, 'PHP'], [/^sql$/, 'SQL'],
  [/^python$/, 'Python'], [/^django$/, 'Django'], [/^laravel$/, 'Laravel'],
  [/^docker$/, 'Docker'], [/^authentication$/, 'Authentication'],
];

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

export function normalizeAutoApplySkill(value: string) {
  const normalized = clean(value).toLocaleLowerCase();
  if (!normalized) return '';
  return canonicalSkills.find(([pattern]) => pattern.test(normalized))?.[1]
    || normalized.replace(/\b\w/g, letter => letter.toUpperCase());
}

function normalizeDomain(value: string) {
  const key = clean(value).toLocaleLowerCase();
  return AUTO_APPLY_DOMAINS.find(domain => domain.toLocaleLowerCase() === key) ?? '';
}

/** Infer domains from role/profile evidence, with explicit classifications taking precedence. */
export function inferAutoApplyDomains(input: {
  explicitDomains?: string[];
  headline?: string | null;
  summary?: string | null;
  experiences?: Array<{ title?: string | null; description?: string | null }>;
  skills?: string[];
}) {
  const explicit = unique((input.explicitDomains ?? []).map(normalizeDomain).filter(Boolean));
  if (explicit.length) return explicit.slice(0, 8);
  const titleAndProfile = [input.headline, input.summary, ...(input.experiences ?? []).map(item => item.title)].filter(Boolean).join(' ').toLocaleLowerCase();
  const body = [input.summary, ...(input.experiences ?? []).map(item => item.description), ...(input.skills ?? [])].filter(Boolean).join(' ').toLocaleLowerCase();
  const ranked = AUTO_APPLY_DOMAINS.map(domain => {
    const signals = domainSignals[domain];
    const profileHits = signals.filter(signal => titleAndProfile.includes(signal)).length;
    const bodyHits = signals.filter(signal => body.includes(signal)).length;
    // A title/summary signal is authoritative; skills/descriptions need two signals.
    const score = profileHits * 3 + bodyHits;
    return { domain, score, profileHits, bodyHits };
  }).filter(item => item.profileHits > 0 || item.bodyHits >= 2)
    .sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  return ranked.filter(item => item.score >= (item.profileHits ? 3 : 2)).slice(0, 3).map(item => item.domain);
}

function unique(values: Array<string | null | undefined>) {
  return [...new Map(values.map(value => clean(value)).filter(Boolean).map(value => [value.toLocaleLowerCase(), value])).values()];
}

function yearsFromExperiences(experiences: Experience[]) {
  const dates = experiences.map(item => item.startDate?.getTime()).filter((value): value is number => Number.isFinite(value));
  if (!dates.length) return null;
  return Math.max(0, Math.floor((Date.now() - Math.min(...dates)) / (365.25 * 24 * 60 * 60 * 1000)));
}

function seniorityFromTitle(title: string | null | undefined) {
  const value = clean(title).toLocaleLowerCase();
  if (/(chief|executive|vp|vice president|director|directeur)/.test(value)) return 'EXECUTIVE';
  if (/(lead|principal|staff|manager|responsable)/.test(value)) return 'LEAD';
  if (/(senior|sr\.?|expert|confirmé|confirme)/.test(value)) return 'SENIOR';
  if (/(junior|jr\.?|intern|stagiaire|débutant)/.test(value)) return 'JUNIOR';
  return '';
}

const levelRank: Record<string, number> = { JUNIOR: 1, MID: 2, SENIOR: 3, LEAD: 4, EXECUTIVE: 5 };

export function buildAutoApplyDefaultsFromCv(input: {
  yearsExperience?: number | null;
  experiences?: Experience[];
  skills?: Array<{ name?: string | null }>;
  location?: string | null;
  jobPreference?: { location?: string | null; jobTitle?: string | null } | null;
  headline?: string | null;
  summary?: string | null;
  descriptions?: string[];
  explicitDomains?: string[];
}): AutoApplyCvDefaults {
  const experiences = input.experiences ?? [];
  const years = input.yearsExperience ?? yearsFromExperiences(experiences);
  const byYears = years === null ? '' : years <= 2 ? 'JUNIOR' : years <= 5 ? 'MID' : 'SENIOR';
  const recentTitle = [...experiences].sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))[0]?.title;
  const byTitle = seniorityFromTitle(recentTitle);
  const experienceLevel = byTitle && (!byYears || levelRank[byTitle] > levelRank[byYears]) ? byTitle : byYears || undefined;
  const skills = unique((input.skills ?? []).map(item => normalizeAutoApplySkill(item.name || '')).filter(Boolean));
  const targetTitles = unique([
    ...[...experiences].sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0)).map(item => item.title),
    input.headline,
    input.jobPreference?.jobTitle,
  ]).slice(0, 8);
  const locations = unique([input.location, input.jobPreference?.location]).slice(0, 5);

  return {
    experienceLevels: experienceLevel ? [experienceLevel] : [],
    domains: inferAutoApplyDomains({ explicitDomains: input.explicitDomains, headline: input.headline, summary: input.summary, experiences, skills: skills }),
    skills: skills.slice(0, 30),
    locations,
    targetTitles,
  };
}
