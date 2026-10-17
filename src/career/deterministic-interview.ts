import { INTERVIEW_TAXONOMY, findConceptMatches, normalizeInterviewText, slugConcept } from './interview-taxonomy';

export type DeterministicImportance = 'REQUIRED' | 'PREFERRED' | 'OPTIONAL' | 'UNKNOWN';
export type EvidenceStatus = 'strong' | 'partial' | 'weak' | 'missing';
export type EvidenceSection = 'work_experience' | 'projects' | 'skills' | 'summary' | 'education' | 'other';

export interface DeterministicRequirement { concept: string; label: string; importance: DeterministicImportance; importanceScore: number; source: string; occurrences: number; }
export interface DeterministicEvidence { concept: string; label: string; score: number; status: EvidenceStatus; section: EvidenceSection; evidence: string[]; aliases: string[]; occurrences: number; matchType: 'exact' | 'alias' | 'token' | 'none'; }
export interface DeterministicTopic { concept: string; label: string; priority: number; importance: DeterministicImportance; status: EvidenceStatus; evidenceScore: number; reason: string; questions: string[]; }

const SECTION_WEIGHT: Record<EvidenceSection, number> = { work_experience: 1, projects: .9, skills: .75, summary: .6, education: .5, other: .4 };
const IMPORTANCE_WEIGHT: Record<DeterministicImportance, number> = { REQUIRED: 1, PREFERRED: .65, OPTIONAL: .4, UNKNOWN: .5 };
const REQUIRED_RE = /\b(required|must have|mandatory|essential|requis|requis[eé]|obligatoire|indispensable)\b/i;
const PREFERRED_RE = /\b(nice to have|preferred|plus|bonus|preferred|souhait[eé]|appr[eé]ci[eé])\b/i;

const BANK: Record<string, Record<string, string[]>> = {
  api_development: { concept: ['How do you design a clear REST API for a new feature?', 'How do you handle validation and error responses in an API?'], practical: ['Describe an API endpoint you built and the decisions behind its contract.'], debugging: ['An API returns intermittent 500 errors. How would you investigate it?'], tradeoff: ['When would you choose a REST endpoint over another integration style?'], coding: ['Implement a small CRUD endpoint with validation and explain the edge cases.'] },
  backend_development: { concept: ['How do you structure a backend feature from request to persistence?'], practical: ['Describe a backend feature you delivered and how you verified it.'], debugging: ['How would you isolate a production defect in a backend service?'], tradeoff: ['What trade-offs do you consider when splitting backend responsibilities?'], coding: ['Design a service method that validates input and returns useful errors.'] },
  authentication: { concept: ['What is the difference between authentication and authorization?'], practical: ['How did you protect an endpoint or user workflow in a real project?'], debugging: ['How would you investigate a token or permission failure?'], tradeoff: ['What trade-offs matter when choosing a session or token-based design?'], coding: ['Sketch validation rules for an authenticated API request.'] },
  docker: { concept: ['What is the difference between a Docker image and a container?'], practical: ['How would you containerize a Django application for development and production?'], debugging: ['A container works locally but fails in deployment. How would you investigate it?'], tradeoff: ['How do you balance image size, reproducibility and build speed?'], coding: ['Write the key steps of a Dockerfile for a web service and explain each one.'] },
  kubernetes: { concept: ['What problem does Kubernetes solve?'], practical: ['How would you deploy and observe a web service on Kubernetes?'], debugging: ['A Kubernetes deployment keeps restarting. What would you inspect first?'], tradeoff: ['When is Kubernetes justified over a simpler deployment?'], coding: ['Describe the essential fields of a deployment and service manifest.'] },
  postgresql: { concept: ['How do you choose indexes for a PostgreSQL query?'], practical: ['Describe a PostgreSQL schema or query you designed.'], debugging: ['A PostgreSQL query becomes slow after data growth. How do you diagnose it?'], tradeoff: ['What trade-offs do you consider between normalization and query simplicity?'], coding: ['Write a query that returns the latest record per user and explain its indexes.'] },
  testing: { concept: ['What makes an automated test valuable?'], practical: ['Describe a test suite you added and what risk it covered.'], debugging: ['How do you investigate a flaky test?'], tradeoff: ['How do you balance unit, integration and end-to-end tests?'], coding: ['Write tests for a function with valid, invalid and empty inputs.'] },
  system_design: { concept: ['How would you design a service that remains reliable as usage grows?'], practical: ['Describe an architectural decision you made and its consequences.'], debugging: ['How would you locate a bottleneck in a distributed system?'], tradeoff: ['What trade-offs do you evaluate between consistency, latency and cost?'], coding: ['Sketch the main components and data flow for a scalable service.'] },
  communication: { concept: ['How do you explain a technical decision to a non-technical stakeholder?'], practical: ['Describe a time when clear communication changed a project outcome.'], debugging: ['How do you communicate an incident while the cause is still unknown?'], tradeoff: ['How do you balance speed with keeping stakeholders informed?'], coding: [] },
  teamwork: { concept: ['How do you collaborate when teammates disagree on an implementation?'], practical: ['Describe your contribution to a team delivery.'], debugging: ['How do you help a team recover when a handoff fails?'], tradeoff: ['How do you balance individual ownership with team consistency?'], coding: [] },
};

const BANK_FR: Record<string, Record<string, string[]>> = {
  api_development: { concept: ['Comment conçois-tu une API REST claire pour une nouvelle fonctionnalité ?', 'Comment gères-tu la validation et les réponses d’erreur d’une API ?'], practical: ['Décris un endpoint que tu as développé et les décisions prises pour son contrat.'], debugging: ['Une API renvoie parfois des erreurs 500. Comment l’investiguerais-tu ?'], tradeoff: ['Quand choisirais-tu une API REST plutôt qu’un autre style d’intégration ?'], coding: ['Implémente un petit endpoint CRUD avec validation et explique les cas limites.'] },
  backend_development: { concept: ['Comment structures-tu une fonctionnalité backend de la requête à la persistance ?'], practical: ['Décris une fonctionnalité backend livrée et la façon dont tu l’as vérifiée.'], debugging: ['Comment isolerais-tu un défaut de production dans un service backend ?'], tradeoff: ['Quels compromis évalues-tu en séparant les responsabilités backend ?'], coding: ['Conçois une méthode de service qui valide les entrées et renvoie des erreurs utiles.'] },
  authentication: { concept: ['Quelle est la différence entre authentification et autorisation ?'], practical: ['Comment as-tu protégé un endpoint ou un parcours utilisateur dans un projet réel ?'], debugging: ['Comment analyserais-tu un échec de jeton ou de permission ?'], tradeoff: ['Quels compromis comparer lors du choix entre sessions et jetons ?'], coding: ['Décris les règles de validation d’une requête API authentifiée.'] },
  docker: { concept: ['Quelle est la différence entre une image Docker et un conteneur ?'], practical: ['Comment conteneuriserais-tu une application Django pour le développement et la production ?'], debugging: ['Un conteneur fonctionne en local mais échoue au déploiement. Que vérifierais-tu ?'], tradeoff: ['Comment équilibrer taille d’image, reproductibilité et vitesse de build ?'], coding: ['Écris les étapes clés d’un Dockerfile pour un service web et explique-les.'] },
  kubernetes: { concept: ['Quel problème Kubernetes résout-il ?'], practical: ['Comment déploierais-tu et observerais-tu un service web sur Kubernetes ?'], debugging: ['Un déploiement Kubernetes redémarre sans cesse. Que vérifierais-tu en premier ?'], tradeoff: ['Quand Kubernetes est-il justifié face à un déploiement plus simple ?'], coding: ['Décris les champs essentiels d’un manifeste Deployment et Service.'] },
  postgresql: { concept: ['Comment choisis-tu les index d’une requête PostgreSQL ?'], practical: ['Décris un schéma ou une requête PostgreSQL que tu as conçu.'], debugging: ['Une requête PostgreSQL ralentit avec la croissance des données. Comment diagnostiquer ?'], tradeoff: ['Quels compromis entre normalisation et simplicité des requêtes ?'], coding: ['Écris une requête qui renvoie le dernier enregistrement par utilisateur et explique ses index.'] },
  testing: { concept: ['Qu’est-ce qui rend un test automatisé utile ?'], practical: ['Décris une suite de tests ajoutée et le risque couvert.'], debugging: ['Comment enquêter sur un test instable ?'], tradeoff: ['Comment équilibrer tests unitaires, intégration et bout en bout ?'], coding: ['Écris des tests pour des entrées valides, invalides et vides.'] },
  system_design: { concept: ['Comment concevoirais-tu un service fiable lorsque l’usage augmente ?'], practical: ['Décris une décision d’architecture et ses conséquences.'], debugging: ['Comment localiser un goulot d’étranglement dans un système distribué ?'], tradeoff: ['Quels compromis entre cohérence, latence et coût ?'], coding: ['Schématise les composants et le flux de données d’un service évolutif.'] },
  communication: { concept: ['Comment expliquer une décision technique à une personne non technique ?'], practical: ['Décris une situation où une communication claire a changé l’issue d’un projet.'], debugging: ['Comment communiquer lors d’un incident dont la cause est encore inconnue ?'], tradeoff: ['Comment équilibrer rapidité et information des parties prenantes ?'], coding: [] },
  teamwork: { concept: ['Comment collaborer lorsque des coéquipiers ne sont pas d’accord sur une implémentation ?'], practical: ['Décris ta contribution à une livraison en équipe.'], debugging: ['Comment aider une équipe à se rétablir après un mauvais transfert ?'], tradeoff: ['Comment équilibrer responsabilité individuelle et cohérence d’équipe ?'], coding: [] },
};

function linesWithSections(text: string): { text: string; section: EvidenceSection }[] {
  let section: EvidenceSection = 'other';
  return text.split(/\r?\n/).map(raw => {
    const line = raw.trim();
    const heading = normalizeInterviewText(line);
    if (/experience|work history|professional|experiences|experience professionnelle/.test(heading)) section = 'work_experience';
    else if (/project|projet/.test(heading)) section = 'projects';
    else if (/skill|competence|technical/.test(heading)) section = 'skills';
    else if (/summary|profile|profil|about|objectif/.test(heading)) section = 'summary';
    else if (/education|formation|diplom|degree/.test(heading)) section = 'education';
    return { text: line, section };
  }).filter(item => item.text.length > 0);
}

function importanceFor(text: string, fallback: DeterministicImportance): DeterministicImportance {
  if (REQUIRED_RE.test(text)) return 'REQUIRED';
  if (PREFERRED_RE.test(text)) return 'PREFERRED';
  return fallback;
}

function addRequirement(map: Map<string, DeterministicRequirement>, concept: string, source: string, fallback: DeterministicImportance, occurrences = 1) {
  const definition = INTERVIEW_TAXONOMY[concept];
  const existing = map.get(concept);
  const importance = importanceFor(source, fallback);
  if (existing) {
    existing.occurrences += occurrences;
    if (IMPORTANCE_WEIGHT[importance] > IMPORTANCE_WEIGHT[existing.importance]) { existing.importance = importance; existing.importanceScore = IMPORTANCE_WEIGHT[importance]; }
    if (source.length > existing.source.length) existing.source = source;
  } else map.set(concept, { concept, label: definition?.label || (concept.startsWith('custom_') ? source.trim() : concept.replace(/_/g, ' ')), importance, importanceScore: IMPORTANCE_WEIGHT[importance], source, occurrences });
}

export function extractDeterministicRequirements(job: { title?: string; description?: string; requirements?: string[]; niceToHave?: string[]; skills?: Array<{ name?: string; skill?: { name?: string }; required?: boolean }>; responsibilities?: string[] }) {
  const map = new Map<string, DeterministicRequirement>();
  const addText = (text: string, fallback: DeterministicImportance) => {
    const matches = findConceptMatches(text);
    if (matches.length) for (const match of matches) addRequirement(map, match.concept, text, fallback);
    else if (text.trim().length >= 3 && fallback !== 'UNKNOWN') addRequirement(map, `custom_${slugConcept(text)}`, text, fallback);
  };
  for (const skill of job.skills || []) { const name = String(skill.name || skill.skill?.name || '').trim(); if (name) { const match = findConceptMatches(name)[0]; match ? addRequirement(map, match.concept, name, skill.required === false ? 'PREFERRED' : 'REQUIRED') : addRequirement(map, `custom_${slugConcept(name)}`, name, skill.required === false ? 'PREFERRED' : 'REQUIRED'); } }
  (job.requirements || []).forEach(text => addText(text, 'REQUIRED'));
  (job.niceToHave || []).forEach(text => addText(text, 'PREFERRED'));
  (job.responsibilities || []).forEach(text => addText(text, 'UNKNOWN'));
  for (const sentence of String(job.description || '').split(/\r?\n|(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)) addText(sentence, REQUIRED_RE.test(sentence) ? 'REQUIRED' : PREFERRED_RE.test(sentence) ? 'PREFERRED' : 'UNKNOWN');
  return [...map.values()].sort((a, b) => b.importanceScore - a.importanceScore || b.occurrences - a.occurrences);
}

function customAliases(requirement: DeterministicRequirement): string[] { return INTERVIEW_TAXONOMY[requirement.concept]?.aliases || [requirement.label]; }

function evidenceFor(requirement: DeterministicRequirement, cvText: string): DeterministicEvidence {
  const rows = linesWithSections(cvText), aliases = customAliases(requirement), hits: { row: { text: string; section: EvidenceSection }; alias: string; type: 'exact' | 'alias' | 'token' }[] = [];
  for (const row of rows) for (const alias of aliases) {
    const found = findConceptMatches(`${requirement.label} ${row.text}`).find(match => match.concept === requirement.concept);
    if ((found || requirement.concept.startsWith('custom_')) && normalizeInterviewText(row.text).includes(normalizeInterviewText(alias))) hits.push({ row, alias, type: found?.matchType ?? 'exact' });
  }
  if (!hits.length) return { concept: requirement.concept, label: requirement.label, score: 0, status: 'missing', section: 'other', evidence: [], aliases, occurrences: 0, matchType: 'none' };
  type ScoredHit = (typeof hits)[number] & { score: number };
  const best = hits.reduce<ScoredHit>((current, hit) => {
    const matchWeight = hit.type === 'exact' ? 1 : hit.type === 'alias' ? .9 : .7;
    const score = Math.min(1, matchWeight * SECTION_WEIGHT[hit.row.section] + Math.min(.12, (hits.length - 1) * .04));
    return score > current.score ? { ...hit, score } : current;
  }, { ...hits[0], score: 0 });
  const score = Math.min(1, best.score);
  const status: EvidenceStatus = score >= .75 ? 'strong' : score >= .45 ? 'partial' : 'weak';
  return { concept: requirement.concept, label: requirement.label, score: Number(score.toFixed(3)), status, section: best.row.section, evidence: [...new Set(hits.map(hit => hit.row.text))].slice(0, 3), aliases, occurrences: hits.length, matchType: best.type };
}

function hash(value: string) { let h = 2166136261; for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619); return h >>> 0; }
function localeText(locale: string, en: string, fr: string, ar: string) { return locale === 'fr' ? fr : locale === 'ar' ? ar : en; }

export function contextualInterviewQuestion(label: string, locale: string) {
  const skill = label.replace(/^custom[_ ]+/i, '').trim();
  return localeText(locale,
    `Can you describe a concrete example involving ${skill}, the problem you addressed and how you checked the result?`,
    `Peux-tu décrire un exemple concret avec ${skill}, le problème à résoudre et la façon dont tu as vérifié le résultat ?`,
    `هل يمكنك وصف مثال عملي يتعلق بـ ${skill} والمشكلة التي عالجتها وكيف تحققت من النتيجة؟`);
}

function bankQuestions(topic: DeterministicTopic, seniority: string, locale: string): string[] {
  const bank = locale === 'fr' ? BANK_FR[topic.concept] || BANK[topic.concept] : BANK[topic.concept];
  if (!bank) return [contextualInterviewQuestion(topic.label, locale)];
  const level = /lead|director|senior/i.test(seniority) ? 'tradeoff' : /junior|intern/i.test(seniority) ? 'concept' : 'practical';
  const ordered = [...(bank[level] || []), ...(bank.concept || []), ...(bank.practical || []), ...(bank.debugging || []), ...(bank.tradeoff || []), ...(bank.coding || [])];
  return [...new Set(ordered)].slice(0, 3);
}

export function analyzeDeterministicInterview(job: { title?: string; description?: string; requirements?: string[]; niceToHave?: string[]; skills?: Array<{ name?: string; skill?: { name?: string }; required?: boolean }>; responsibilities?: string[] }, cvText: string, locale = 'en', seed = '') {
  const requirements = extractDeterministicRequirements(job);
  const evidence = requirements.map(requirement => evidenceFor(requirement, cvText));
  const gaps = evidence.filter(item => item.status !== 'strong').map(item => ({ ...item, importance: requirements.find(r => r.concept === item.concept)?.importance || 'UNKNOWN' as DeterministicImportance }));
  const topics: DeterministicTopic[] = gaps.map(gap => {
    const requirement = requirements.find(item => item.concept === gap.concept)!;
    const priority = Number((requirement.importanceScore * (1 - gap.score) * (1 + Math.min(requirement.occurrences, 3) * .15)).toFixed(3));
    return { concept: gap.concept, label: gap.label, priority, importance: requirement.importance, status: gap.status, evidenceScore: gap.score, reason: `${gap.status === 'missing' ? 'No CV evidence' : `${gap.status} CV evidence`} · ${requirement.importance.toLowerCase()} requirement · ${gap.occurrences || 0} job mention(s)`, questions: bankQuestions({ concept: gap.concept, label: gap.label, priority, importance: requirement.importance, status: gap.status, evidenceScore: gap.score, reason: '', questions: [] }, String((job as { experienceLevel?: string }).experienceLevel || ''), locale) };
  }).sort((a, b) => b.priority - a.priority || hash(`${seed}:${a.concept}`) - hash(`${seed}:${b.concept}`)).slice(0, 8);
  const weightedTotal = requirements.reduce((sum, req) => sum + req.importanceScore, 0);
  const weightedEvidence = evidence.reduce((sum, item) => sum + item.score * (requirements.find(req => req.concept === item.concept)?.importanceScore || .5), 0);
  return { method: 'deterministic_taxonomy_v1', analysis_engine: 'local_deterministic_fallback' as const, requirements, evidence, gaps, topics, score: weightedTotal ? Number((weightedEvidence / weightedTotal).toFixed(3)) : null, topicCount: topics.length };
}

export function selectDeterministicQuestions(analysis: ReturnType<typeof analyzeDeterministicInterview>, locale = 'en', number = 6, seed = '') {
  const questions = analysis.topics.flatMap(topic => topic.questions.map((question, index) => ({ question, key: normalizeInterviewText(question), rank: hash(`${seed}:${topic.concept}:${index}`), topic: topic.concept })));
  const unique = [...new Map(questions.map(item => [item.key, item])).values()].sort((a, b) => a.rank - b.rank);
  return unique.slice(0, Math.max(1, number)).map(item => item.question);
}
