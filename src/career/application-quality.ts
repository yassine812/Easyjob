import { createHash } from 'crypto';
import { validateApplicationAnswers } from '../applications/application-fields';
import { atsReport, extractProfile } from './career-engine';
import { requirementEvidence, type EvidenceJob } from './recruitment-evidence';
import type { ApplyDto } from '../applications/dto/application.dto';

export function applicationQuality(job: EvidenceJob & { id: string; applicationFields?: unknown }, resume: { id: string; mimeType: string; parsedText: string | null; processingStatus: string } | undefined, dto: ApplyDto, ownedFileIds: string[]) {
  const text = resume?.parsedText ?? '', schema = Array.isArray(job.applicationFields) ? job.applicationFields : [];
  const fields = schema as { id: string; label: string; required: boolean; type: string }[];
  const letterFields = fields.filter(f => ['coverletter', 'motivation', 'motivationletter'].includes(f.id.toLowerCase().replace(/[^a-z]/g, '')));
  const letterRequired = letterFields.some(f => f.required), letter = dto.coverLetter ?? dto.motivation ?? '';
  const answers = { ...(dto.answers ?? {}), ...Object.fromEntries(letterFields.map(f => [f.id, letter])) };
  const checks: { key: string; status: 'PASS' | 'BLOCK' | 'REVIEW' | 'UNKNOWN'; kind: string; evidence: string[]; message: string }[] = [];
  const add = (key: string, status: 'PASS' | 'BLOCK' | 'REVIEW' | 'UNKNOWN', message: string, evidence: string[] = []) => checks.push({ key, status, kind: status === 'UNKNOWN' ? 'UNKNOWN' : status === 'REVIEW' ? 'RECOMMENDATION' : 'FACT', evidence, message });
  const validPdf = resume?.mimeType === 'application/pdf' && resume.processingStatus === 'COMPLETED' && !!text.trim();
  add('selected_pdf', validPdf ? 'PASS' : 'BLOCK', validPdf ? 'CV PDF traité et texte disponible.' : 'Choisis un CV PDF dont le traitement est terminé.');
  const validContact = dto.candidateSnapshot?.fullName?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.candidateSnapshot.email);
  add('contact', validContact ? 'PASS' : 'BLOCK', validContact ? 'Nom et adresse e-mail renseignés.' : 'Vérifie le nom et l’adresse e-mail transmis.');
  let fieldErrors: Record<string, string> = {};
  try { validateApplicationAnswers(schema, answers, ownedFileIds); add('questions', 'PASS', 'Les réponses respectent les champs demandés par l’employeur.'); }
  catch (error) { const response = (error as { getResponse?: () => unknown }).getResponse?.() as { fieldErrors?: Record<string, string> } | undefined; fieldErrors = response?.fieldErrors ?? {}; add('questions', 'BLOCK', 'Complète ou corrige les réponses demandées.', Object.keys(fieldErrors)); }
  add('cover_letter', !letterRequired || letter.trim() ? 'PASS' : 'BLOCK', letterRequired ? 'L’employeur demande une lettre de motivation.' : 'La lettre est facultative pour cette offre.');
  if (letter.trim()) add('letter_target', letter.toLocaleLowerCase().includes(job.title.toLocaleLowerCase()) ? 'PASS' : 'REVIEW', 'Vérifie que cette lettre correspond au poste sélectionné.', [job.title]);
  if (letter.trim()) add('letter_language', 'UNKNOWN', 'Relis la langue de la lettre selon les consignes de l’employeur ; aucune langue de candidature obligatoire n’est déduite automatiquement.');
  const parsed = extractProfile(text);
  if (parsed.email && dto.candidateSnapshot?.email && parsed.email.toLowerCase() !== dto.candidateSnapshot.email.toLowerCase()) add('contact_consistency', 'REVIEW', 'Le CV et la candidature indiquent des adresses e-mail différentes.', [parsed.email, dto.candidateSnapshot.email]);
  for (const field of fields.filter(f => f.type === 'number' && /years|années|ans.*exp|exp.*ans/i.test(f.label))) {
    const answer = answers[field.id];
    if (typeof answer === 'number' && parsed.yearsExperience != null && answer !== parsed.yearsExperience) add(`experience_${field.id}`, 'REVIEW', 'La durée d’expérience déclarée diffère entre le CV et la réponse. Vérifie le périmètre de la question.', [String(parsed.yearsExperience), String(answer)]);
    else if (typeof answer === 'number' && answer >= 5 && /\bjunior\b/i.test(parsed.headline ?? '')) add(`seniority_${field.id}`, 'REVIEW', 'Le titre du CV indique « junior » et la réponse déclare au moins cinq ans d’expérience. Vérifie le périmètre ; aucune réponse n’a été modifiée.', [parsed.headline!, String(answer)]);
  }
  const fit = requirementEvidence(job, text), gaps = fit.requirements.filter(r => r.priority === 'REQUIRED' && r.cvStatus !== 'EXPLICITLY_SUPPORTED');
  if (gaps.length) add('required_evidence', 'REVIEW', 'Certaines exigences ne sont pas explicitement attestées dans ce CV. Cela ne signifie pas que tu ne les maîtrises pas.', gaps.map(g => g.label));
  if (!fit.requirements.length) add('job_evidence', 'UNKNOWN', 'La source ne fournit pas assez d’exigences pour évaluer la pertinence.');
  const evaluated = checks.filter(c => c.status !== 'UNKNOWN');
  return { method: 'application_preflight_v1', generatedAt: new Date().toISOString(), ready: !checks.some(c => c.status === 'BLOCK'), readiness: evaluated.length ? Math.round(100 * evaluated.filter(c => c.status === 'PASS').length / evaluated.length) : null,
    checks, fieldErrors, fit, audit: atsReport(text, job.skills.map(s => s.skill.name)), source: { resumeId: resume?.id ?? null, jobId: job.id, cvHash: createHash('sha256').update(text).digest('hex') }, limitations: ['Préparation documentaire, pas une probabilité de recrutement.', 'Les faits déclarés par le candidat ne sont pas certifiés.'] };
}
