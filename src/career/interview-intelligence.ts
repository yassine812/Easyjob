export type InterviewCategory = 'TECHNICAL' | 'CODING' | 'SYSTEM_DESIGN' | 'BEHAVIORAL' | 'SITUATIONAL' | 'HR' | 'MANAGERIAL' | 'CASE_STUDY';
export type RequirementCategory = 'CORE_TECHNICAL' | 'TECHNICAL_NICE_TO_HAVE' | 'DOMAIN_KNOWLEDGE' | 'RESPONSIBILITY' | 'EXPERIENCE' | 'SOFT_SKILL' | 'EDUCATION' | 'TOOL' | 'METHODOLOGY' | 'BEHAVIORAL_SIGNAL';
export type RequirementImportance = 'REQUIRED' | 'PREFERRED' | 'OPTIONAL' | 'UNKNOWN';

export interface InterviewRequirement {
  skill: string;
  category: RequirementCategory;
  importance: RequirementImportance;
  evidence: string;
}

export interface InterviewJobAnalysis {
  role: string;
  normalizedRole: string;
  company: string;
  department: string | null;
  industry: string | null;
  location: string | null;
  workplaceType: string | null;
  employmentType: string | null;
  seniority: string;
  technicalSkills: string[];
  tools: string[];
  responsibilities: string[];
  softSkills: string[];
  education: string[];
  experienceRequirements: string[];
  domainKnowledge: string[];
  niceToHave: string[];
  interviewSignals: string[];
  requirements: InterviewRequirement[];
  recommendedTypes: InterviewCategory[];
  optionalTypes: InterviewCategory[];
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  preparationPlan: string[];
  candidateEvidence: string[];
  gaps: string[];
}

const TECHNICAL = new Set(['python', 'django', 'django rest framework', 'drf', 'react', 'react native', 'javascript', 'typescript', 'java', 'c#', '.net', 'php', 'laravel', 'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'graphql', 'rest', 'api', 'kubernetes', 'aws', 'azure', 'gcp', 'docker', 'linux', 'html', 'css', 'git']);
const TOOLS = new Set(['git', 'docker', 'jira', 'notion', 'figma', 'jenkins', 'github', 'gitlab', 'postman', 'linux']);
const SOFT_TERMS = ['communication', 'teamwork', 'collaboration', 'leadership', 'problem solving', 'problem-solving', 'adaptability', 'autonomy', 'communication', 'communication', 'travail en équipe', 'collaboration', 'leadership', 'résolution de problèmes'];
const CANONICAL_SKILLS: Record<string, string> = { python: 'Python', django: 'Django', 'django rest framework': 'Django REST Framework', drf: 'Django REST Framework', react: 'React', 'react native': 'React Native', javascript: 'JavaScript', typescript: 'TypeScript', postgresql: 'PostgreSQL', postgres: 'PostgreSQL', mysql: 'MySQL', docker: 'Docker', git: 'Git', rest: 'REST', api: 'API', html: 'HTML', css: 'CSS', linux: 'Linux', aws: 'AWS', azure: 'Azure', gcp: 'GCP', kubernetes: 'Kubernetes' };
function canonicalSkill(value: string) { return CANONICAL_SKILLS[normalize(value)] || value.trim(); }

function normalize(value: string) { return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
function unique(values: string[]) { return [...new Map(values.filter(Boolean).map(value => [normalize(value), value.trim()])).values()]; }
function textOf(job: any) { return [job.title, job.description, job.requirements, job.domain, job.company?.industry].filter(Boolean).map(String).join('\n'); }
function sentenceEvidence(text: string) { return text.split(/(?:\r?\n|(?<=[.!?])\s+)/).map(value => value.trim().replace(/^[-•*]\s*/, '')).filter(value => value.length >= 18).slice(0, 8); }
function seniority(job: any, text: string) {
  const explicit = String(job.experienceLevel || '').toUpperCase();
  if (explicit === 'EXECUTIVE' || /director|directeur|head of|vp\b/i.test(text)) return 'Director';
  if (explicit === 'LEAD' || /\blead\b|manager|responsable d'?équipe|chef d'?équipe/i.test(text)) return 'Lead';
  if (explicit === 'SENIOR' || /senior|confirmé|expérimenté|expert/i.test(text)) return 'Senior';
  if (explicit === 'JUNIOR' || /junior|débutant|entry[- ]level|stage|intern|alternance/i.test(text)) return /stage|intern|alternance/i.test(text) ? 'Intern' : 'Junior';
  return explicit === 'MID' ? 'Mid' : 'Mid';
}
function normalizedRole(title: string) { return title.replace(/\b(sr\.?|jr\.?|senior|junior|[–—-]\s*(?:cdi|cdd|stage).*)$/i, '').replace(/\s+/g, ' ').trim() || title; }

export function analyzeInterviewJob(job: any, candidateText = ''): InterviewJobAnalysis {
  const title = String(job.title || 'Ce poste').trim();
  const description = String(job.description || '');
  const context = textOf(job);
  const sentences = sentenceEvidence(description);
  const suppliedSkills = (job.skills || []).map((item: any) => typeof item === 'string' ? item : item?.name).filter(Boolean).map(String).map(canonicalSkill);
  const mentionedSkills = [...TECHNICAL].filter(skill => normalize(context).includes(normalize(skill))).map(canonicalSkill);
  const technicalSkills = unique([...suppliedSkills, ...mentionedSkills].filter(skill => !TOOLS.has(normalize(skill))));
  const tools = unique([...suppliedSkills, ...mentionedSkills].filter(skill => TOOLS.has(normalize(skill))));
  const softSkills = unique(SOFT_TERMS.filter(term => normalize(context).includes(normalize(term))));
  const responsibilities = sentences.filter(value => /\b(develop|build|design|maintain|manage|collaborat|create|implement|developp|concev|assur|particip|analy|dévelop|concevoir|maintenir|gérer|collaborer|mettre en œuvre)\w*/i.test(value)).slice(0, 6);
  const level = seniority(job, context), role = normalizedRole(title), lower = normalize(context);
  const requirements: InterviewRequirement[] = [
    ...technicalSkills.map(skill => {
      const supplied = (job.skills || []).find((item: any) => normalize(item?.name || item) === normalize(skill));
      const importance: RequirementImportance = supplied && supplied.required !== false ? 'REQUIRED' : 'PREFERRED';
      return { skill, category: 'CORE_TECHNICAL' as const, importance, evidence: sentences.find(sentence => normalize(sentence).includes(normalize(skill))) || `La compétence ${skill} est associée à cette offre.` };
    }),
    ...tools.map(skill => ({ skill, category: 'TOOL' as const, importance: 'PREFERRED' as const, evidence: sentences.find(sentence => normalize(sentence).includes(normalize(skill))) || `L’outil ${skill} est cité dans l’offre.` })),
    ...softSkills.map(skill => ({ skill, category: 'SOFT_SKILL' as const, importance: 'UNKNOWN' as const, evidence: sentences.find(sentence => normalize(sentence).includes(normalize(skill))) || `Le comportement ${skill} est mentionné dans l’offre.` })),
    ...responsibilities.map(value => ({ skill: value, category: 'RESPONSIBILITY' as const, importance: 'REQUIRED' as const, evidence: value })),
  ];
  const recommendedTypes: InterviewCategory[] = [];
  const technicalRole = technicalSkills.length > 0 || /developer|engineer|développeur|ingénieur|data|devops|software|technique/i.test(title);
  if (technicalRole) recommendedTypes.push('TECHNICAL');
  if (technicalRole && /developer|engineer|développeur|ingénieur|software|coding|program/i.test(title)) recommendedTypes.push('CODING');
  if (['Senior', 'Lead', 'Director'].includes(level) && /architecture|scalab|distributed|system design|conception/i.test(lower)) recommendedTypes.push('SYSTEM_DESIGN');
  if (softSkills.length || responsibilities.length) recommendedTypes.push('BEHAVIORAL', 'SITUATIONAL');
  if (/manager|lead|director|responsable|chef d'équipe/i.test(title)) recommendedTypes.push('MANAGERIAL');
  if (/finance|marketing|sales|commercial|product|consult|analyst|analyste|business/i.test(title)) recommendedTypes.push('CASE_STUDY');
  recommendedTypes.push('HR');
  const ordered = [...new Set(recommendedTypes)];
  const optionalTypes = (['SYSTEM_DESIGN', 'CASE_STUDY', 'MANAGERIAL'] as InterviewCategory[]).filter(type => !ordered.includes(type));
  const candidate = normalize(candidateText);
  const gaps = technicalSkills.filter(skill => !candidate || !candidate.includes(normalize(skill))).slice(0, 8);
  const difficulty = level === 'Intern' || level === 'Junior' ? (technicalSkills.length >= 5 ? 'INTERMEDIATE' : 'BEGINNER') : level === 'Senior' || level === 'Lead' ? 'ADVANCED' : 'EXPERT';
  const preparationPlan = unique([
    'Présenter son parcours et l’expérience la plus pertinente',
    ...technicalSkills.slice(0, 5).map(skill => `Maîtriser une réalisation concrète avec ${skill}`),
    ...responsibilities.slice(0, 3).map(value => `Préparer une réponse sur : ${value}`),
    'Préparer un exemple structuré Situation → Action → Résultat',
    'Préparer des questions sur l’équipe, les objectifs et les critères de réussite',
  ]).slice(0, 10);
  return { role: title, normalizedRole: role, company: String(job.company?.commercialName || job.companyName || ''), department: null, industry: job.company?.industry || job.industry || job.domain || null, location: job.location || null, workplaceType: job.workMode || (job.remote ? 'REMOTE' : null), employmentType: job.employmentType || job.contractType || null, seniority: level, technicalSkills, tools, responsibilities, softSkills, education: [], experienceRequirements: [], domainKnowledge: job.domain ? [String(job.domain)] : [], niceToHave: tools, interviewSignals: ordered.map(type => `${type.toLowerCase()}_relevant`), requirements, recommendedTypes: ordered, optionalTypes, difficulty, preparationPlan, candidateEvidence: technicalSkills.filter(skill => candidate.includes(normalize(skill))), gaps };
}
