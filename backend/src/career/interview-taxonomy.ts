export type InterviewConceptCategory = 'technical' | 'tool' | 'soft_skill' | 'methodology' | 'domain';

export interface InterviewConcept {
  label: string;
  aliases: string[];
  category: InterviewConceptCategory;
}

/** Shared, reviewable vocabulary used by the deterministic interview matcher. */
export const INTERVIEW_TAXONOMY: Record<string, InterviewConcept> = {
  api_development: { label: 'API Development', aliases: ['api development', 'rest api', 'restful api', 'rest endpoints', 'rest endpoint', 'api design', 'web api', 'django rest framework', 'drf'], category: 'technical' },
  backend_development: { label: 'Backend Development', aliases: ['backend', 'back-end', 'server side', 'server-side', 'server development'], category: 'technical' },
  authentication: { label: 'Authentication and Authorization', aliases: ['authentication', 'authorization', 'authorisation', 'access control', 'oauth', 'jwt', 'login'], category: 'technical' },
  python: { label: 'Python', aliases: ['python'], category: 'technical' },
  django: { label: 'Django', aliases: ['django'], category: 'technical' },
  react: { label: 'React', aliases: ['react'], category: 'technical' },
  react_native: { label: 'React Native', aliases: ['react native', 'expo'], category: 'technical' },
  javascript: { label: 'JavaScript', aliases: ['javascript', 'js', 'ecmascript'], category: 'technical' },
  typescript: { label: 'TypeScript', aliases: ['typescript', 'ts'], category: 'technical' },
  postgresql: { label: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'postgres db'], category: 'technical' },
  sql: { label: 'SQL', aliases: ['sql', 'relational database', 'relational databases'], category: 'technical' },
  docker: { label: 'Docker', aliases: ['docker', 'containerization', 'containerisation', 'containers'], category: 'tool' },
  kubernetes: { label: 'Kubernetes', aliases: ['kubernetes', 'k8s'], category: 'tool' },
  git: { label: 'Git', aliases: ['git', 'version control'], category: 'tool' },
  testing: { label: 'Testing', aliases: ['testing', 'automated tests', 'unit tests', 'integration tests', 'tests automatisés', 'tests unitaires'], category: 'methodology' },
  system_design: { label: 'System Design', aliases: ['system design', 'architecture', 'software architecture', 'architecture logicielle', 'scalability', 'scalable'], category: 'technical' },
  ci_cd: { label: 'CI/CD', aliases: ['ci/cd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'integration continue', 'déploiement continu'], category: 'methodology' },
  communication: { label: 'Communication', aliases: ['communication', 'communicating', 'communication skills'], category: 'soft_skill' },
  teamwork: { label: 'Teamwork', aliases: ['teamwork', 'team work', 'collaboration', 'travail en équipe'], category: 'soft_skill' },
  leadership: { label: 'Leadership', aliases: ['leadership', 'leading a team', 'management', 'encadrement'], category: 'soft_skill' },
  problem_solving: { label: 'Problem Solving', aliases: ['problem solving', 'problem-solving', 'résolution de problèmes'], category: 'soft_skill' },
};

export function normalizeInterviewText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/[^\p{L}\p{N}+#./-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugConcept(value: string): string {
  return normalizeInterviewText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'requirement';
}

function boundaryMatch(text: string, alias: string): boolean {
  const normalizedText = normalizeInterviewText(text);
  const normalizedAlias = normalizeInterviewText(alias);
  if (!normalizedAlias) return false;
  return ` ${normalizedText} `.includes(` ${normalizedAlias} `);
}

export function findConceptMatches(text: string) {
  const matches: { concept: string; alias: string; matchType: 'exact' | 'alias' | 'token' }[] = [];
  for (const [concept, definition] of Object.entries(INTERVIEW_TAXONOMY)) {
    const normalizedLabel = normalizeInterviewText(definition.label);
    if (boundaryMatch(text, normalizedLabel)) matches.push({ concept, alias: definition.label, matchType: 'exact' });
    for (const alias of definition.aliases) {
      if (boundaryMatch(text, alias) && !matches.some(item => item.concept === concept && item.alias === alias)) matches.push({ concept, alias, matchType: alias === definition.label ? 'exact' : 'alias' });
    }
    if (!matches.some(item => item.concept === concept)) {
      const tokens = normalizedLabel.split(' ').filter(token => token.length > 2);
      if (tokens.length > 1 && tokens.every(token => boundaryMatch(text, token))) matches.push({ concept, alias: definition.label, matchType: 'token' });
    }
  }
  return matches;
}
