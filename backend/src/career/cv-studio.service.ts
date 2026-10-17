import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, CvDraft } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiClient } from '../ai/ai-client';
import { StorageService } from '../files/storage.service';
import { CareerService } from './career.service';
import { atsReport } from './career-engine';
import { answerInterview, blankDocument, cvLocales, CvDocument, CvLocale, documentText, importDocument, languageForLocale, newId, newSection, nextInterviewQuestion, normalizeImportedDocument, relabelDocument, SectionType, validateDocument } from './cv-document';
import { renderDocument } from './cv-document-render';
import { CreateCvVariantDto, InterviewAnswerDto, StartCvDto, StudioSaveDto, StudioSuggestDto } from './cv-studio.dto';
import { logicalResumeId, resumeDesign, resumeGroups, resumeLocale } from '../candidates/resume-versioning';
import { WritingQualityService } from './writing-quality.service';
import { evidenceContains, requirementEvidence, type EvidenceJob } from './recruitment-evidence';
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class CvStudioService {
  constructor(private readonly prisma: PrismaService, private readonly career: CareerService, private readonly ai: AiClient, private readonly storage: StorageService, private readonly writing: WritingQualityService) {}
  private document(value: unknown, content = '') { try { return value ? validateDocument(value) : importDocument(content); } catch (e) { throw new BadRequestException(e instanceof Error ? e.message : 'Document invalide'); } }
  private baseTitle(value: string) {
    return value.replace(/\.[^.]+$/, '').replace(/(?:[_\s-](?:FR|EN|ES|DE|IT|PT|NL|AR))(?:\s*\([^)]*\))?$/i, '').trim() || 'Mon CV';
  }
  private contentHash(content: string) { return createHash('sha256').update(content).digest('hex'); }
  private deterministicTailoring(section: CvDocument['sections'][number], before: string, document: CvDocument, job: EvidenceJob, facts?: string) {
    const evidence = requirementEvidence(job, documentText(document), '');
    const supported = evidence.requirements.filter(row => row.cvStatus === 'EXPLICITLY_SUPPORTED');
    if (!before.trim() && facts?.trim()) return { after: facts.trim(), category: 'add_if_true' as const, reason: 'Ajout proposé uniquement à partir des faits vérifiés fournis.', question: null, evidence };
    if (!before.trim()) return { after: before, category: 'add_if_true' as const, reason: 'Aucun contenu existant ne peut être complété sans faits vérifiés.', question: 'Ajoute uniquement une réalisation réelle si elle existe.', evidence };
    if (section.type === 'skills' || section.type === 'technical') {
      const separator = before.includes('\n') ? '\n' : before.includes('·') ? ' · ' : ', ';
      const values = before.split(/\r?\n|\s*[·,;|]\s*/).map(value => value.trim()).filter(Boolean);
      const rank = (value: string) => { const index = supported.findIndex(row => evidenceContains(value, row.label) || evidenceContains(row.label, value)); return index < 0 ? supported.length + 1 : index; };
      const after = [...values].sort((a, b) => rank(a) - rank(b)).join(separator);
      return { after, category: 'reorder' as const, reason: supported.length ? 'Compétences déjà présentes dans ton CV, réordonnées selon les exigences documentées de cette offre.' : 'Aucune compétence de l’offre n’est attestée dans ce passage ; aucune nouvelle compétence n’a été ajoutée.', question: null, evidence };
    }
  const matching = supported.filter(row => row.evidence.some(citation => citation.source === 'CV' && citation.quote.trim()));
  if (matching.length) {
    // Make an editorial-only change by bringing sentences that already cite a
    // verified requirement to the front. Every character comes from the CV;
    // this cannot invent a responsibility, result, or skill.
    const separator = before.includes('\n') ? '\n' : ' ';
    const parts = before.split(/\n+|(?<=[.!?])\s+/).map(value => value.trim()).filter(Boolean);
    const relevant = parts.filter(value => supported.some(row => evidenceContains(value, row.label) || evidenceContains(row.label, value)));
    const remaining = parts.filter(value => !relevant.includes(value));
    const after = [...relevant, ...remaining].join(separator);
    return { after, category: 'rewrite' as const, reason: 'Les preuves déjà présentes dans ton CV sont rendues plus visibles pour cette offre, sans ajouter de fait.', question: null, evidence };
  }
  return { after: before, category: 'rewrite' as const, reason: 'Aucune reformulation sûre n’a été produite : le CV reste inchangé pour éviter toute invention.', question: ['experience', 'projects', 'volunteering'].includes(section.type) ? 'Tu peux reformuler manuellement une contribution déjà vérifiable.' : null, evidence };
}
  private async owned(uid: string, id: string) {
    const p = await this.career.profile(uid); await this.career.requireFeature(p.id, 'career.builder');
    const draft = await this.prisma.cvDraft.findFirst({ where: { id, candidateId: p.id } });
    if (!draft) throw new NotFoundException('Ce CV est introuvable ou a été supprimé.');
    return draft;
  }
  private result(draft: CvDraft) {
    const document = this.document(draft.document, draft.content), content = documentText(document), calculated = atsReport(content, draft.keywords);
    const stored = draft.analysisStatus === 'COMPLETED' && draft.analyzedContentHash === this.contentHash(content) && draft.atsReport && typeof draft.atsReport === 'object' ? draft.atsReport as unknown as ReturnType<typeof atsReport> : null;
    const report = stored ?? calculated;
    const issues = report.criteria.map(c => {
      const match = document.sections.flatMap(s => s.entries.flatMap(e => [...e.bullets.map(b => ({ sectionId: s.id, entryId: e.id, bulletId: b.id, text: b.text })), { sectionId: s.id, entryId: e.id, bulletId: undefined, text: e.text }])).find(ref => c.evidence?.some(v => v.length > 6 && ref.text.toLocaleLowerCase().includes(v.toLocaleLowerCase())));
      const fallback = document.sections.find(s => ({ quantified_evidence: 'experience', experience: 'experience', education: 'education', skills: 'skills', summary: 'summary' } as Record<string, string>)[c.key] === s.type);
      return { ...c, sectionId: match?.sectionId ?? fallback?.id, entryId: match?.entryId, bulletId: match?.bulletId, severity: c.passed ? 'strong' : c.priority === 'high' ? 'important' : 'opportunity' };
    });
    return { ...draft, document, report, issues, nextQuestion: nextInterviewQuestion(document) };
  }
  async list(uid: string) {
    const p = await this.career.profile(uid); await this.career.requireFeature(p.id, 'career.builder');
    const drafts = await this.prisma.cvDraft.findMany({ where: { candidateId: p.id }, orderBy: { updatedAt: 'desc' } });
    const published = new Set(p.resumes.map(r => { const design = r.design as { draftId?: string; draftVersion?: number } | null; return `${design?.draftId}:${design?.draftVersion}`; }));
    const seen = new Set<string>();
    return drafts.filter(d => {
      if (published.has(`${d.id}:${d.version}`)) return false;
      const key = JSON.stringify([d.sourceResumeId, d.targetJobId, d.title, d.content, d.template, d.document], (k, v) => k === 'id' ? undefined : v);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(d => {
      const document = d.document as unknown as Partial<CvDocument> | null;
      return { id: d.id, title: d.title, version: d.version, updatedAt: d.updatedAt, sourceResumeId: d.sourceResumeId, locale: document?.locale || d.language || 'fr-FR', variantGroupId: document?.variantGroupId || null, afterScore: d.afterScore, template: d.template, interview: !!document && ((document.interview?.length ?? 0) > 0 || !document.sections?.length) };
    });
  }
  async get(uid: string, id: string) {
    const draft = await this.owned(uid, id);
    // Persist imported IDs and repair legacy contact mapping exactly once.
    const currentDocument = this.document(draft.document, draft.content);
    const normalized = currentDocument.importNormalized || (!draft.sourceResumeId && !currentDocument.importReview)
      ? { document: currentDocument, changed: false }
      : normalizeImportedDocument(currentDocument, draft.originalContent || draft.content);
    const content = documentText(normalized.document), hash = this.contentHash(content);
    if (!draft.document || normalized.changed || !draft.atsReport || draft.analyzedContentHash !== hash || draft.analysisStatus !== 'COMPLETED') {
      let report = atsReport(content, draft.keywords);
      if (draft.version === 1 && draft.sourceResumeId && !draft.atsReport && !draft.keywords.length) {
        const source = await this.prisma.resume.findUnique({ where: { id: draft.sourceResumeId }, select: { atsReport: true } });
        if (source?.atsReport && typeof source.atsReport === 'object') report = source.atsReport as unknown as ReturnType<typeof atsReport>;
      }
      await this.prisma.cvDraft.update({ where: { id }, data: { document: json(normalized.document), content, afterScore: report.score, atsReport: json(report), analysisStatus: 'COMPLETED', analyzedContentHash: hash } });
      return this.result((await this.prisma.cvDraft.findUnique({ where: { id } }))!);
    }
    return this.result(draft);
  }
  async start(uid: string, dto: StartCvDto) {
    if (dto.draftId) return this.get(uid, dto.draftId);
    const p = await this.career.profile(uid); await this.career.requireFeature(p.id, 'career.builder');
    let document = blankDocument(), title = dto.title || 'Mon CV', original = '', sourceResumeId: string | undefined, shouldNormalizeImport = false;
    if (dto.resumeId) {
      const source = p.resumes.find(r => r.id === dto.resumeId);
      if (!source) throw new NotFoundException('CV source introuvable');
      if (source.processingStatus !== 'COMPLETED' || !source.parsedText?.trim()) throw new BadRequestException('Attends la fin du traitement, ou importe un PDF avec du texte sélectionnable.');
      const logicalId = logicalResumeId(source, p.resumes), groupIds = resumeGroups(p.resumes).get(logicalId)?.map(row => row.id) ?? [source.id];
      const publishedDraftIds = groupIds.flatMap(resumeId => { const row = p.resumes.find(item => item.id === resumeId); return resumeDesign(row?.design).draftId ? [resumeDesign(row?.design).draftId!] : []; });
      const candidates = await this.prisma.cvDraft.findMany({ where: { candidateId: p.id, targetJobId: dto.jobId ?? null, OR: [{ sourceResumeId: { in: groupIds } }, { id: { in: publishedDraftIds } }] }, orderBy: { updatedAt: 'desc' } });
      const sourceDesign = resumeDesign(source.design), sourceLocale = resumeLocale(source);
      const publishedVersion = new Map<string, number>();
      for (const row of p.resumes.filter(item => groupIds.includes(item.id))) { const design = resumeDesign(row.design); if (design.draftId && typeof design.draftVersion === 'number') publishedVersion.set(design.draftId, Math.max(publishedVersion.get(design.draftId) ?? 0, design.draftVersion)); }
      // Keep language variants isolated: a newer French draft must never be
      // reopened when the selected source resume is the English variant.
      const matchingLocale = candidates.filter(candidate => {
        const candidateDocument = candidate.document as unknown as Partial<CvDocument> | null;
        return (candidateDocument?.locale || candidate.language || 'fr-FR') === sourceLocale;
      });
      const existing = matchingLocale.find(candidate => candidate.sourceResumeId === source.id || sourceDesign.draftId === candidate.id || candidate.version > (publishedVersion.get(candidate.id) ?? 0));
      // A restored version is a new clean base. Never reopen the newer draft it replaced.
      const resumable = sourceDesign.restoredFromResumeId ? candidates.find(candidate => candidate.sourceResumeId === source.id) : existing;
      if (resumable) return this.get(uid, resumable.id);
      const design = source.design as { document?: unknown; editableContent?: string } | null;
      original = design?.editableContent || source.parsedText;
      document = relabelDocument(this.document(design?.document, original), sourceLocale as CvLocale);
      shouldNormalizeImport = !design?.document || (!document.importNormalized && document.importReview);
      title = this.baseTitle(source.filename); sourceResumeId = source.id;
    } else {
      document.personal = { ...document.personal, name: p.user.name, email: p.user.email, location: p.location || '', phone: p.phone || '' };
      if (dto.mode === 'manual') document.sections = [newSection('summary'), newSection('experience'), newSection('education'), newSection('skills')];
    }
    const job = dto.jobId ? await this.career.targetJob(dto.jobId) : null;
    if (shouldNormalizeImport) document = normalizeImportedDocument(document, original).document;
    const content = documentText(document), keywords = job?.skills.map(s => s.skill.name) || [];
    const source = sourceResumeId ? p.resumes.find(row => row.id === sourceResumeId) : null;
    const report = !keywords.length && source?.atsReport && typeof source.atsReport === 'object' ? source.atsReport as unknown as ReturnType<typeof atsReport> : atsReport(content, keywords);
    const draft = await this.prisma.cvDraft.create({ data: { candidateId: p.id, title, sourceResumeId, targetJobId: job?.id, targetRole: job?.title, document: json(document), content, originalContent: original || content, template: 'international', language: document.locale, beforeScore: original ? report.score : null, afterScore: report.score, atsReport: json(report), analysisStatus: 'COMPLETED', analyzedContentHash: this.contentHash(content), keywords } });
    return this.result(draft);
  }
  async save(uid: string, id: string, dto: StudioSaveDto) {
    const draft = await this.owned(uid, id), document = this.document(dto.document);
    if (dto.title.trim().length < 2) throw new BadRequestException('Donne un nom au CV (au moins deux caractères).');
    if (dto.expectedVersion !== draft.version) throw new ConflictException('Une autre version a été enregistrée. Recharge-la avant de continuer. Tes modifications sont conservées dans cet écran.');
    const content = documentText(document);
    const marked = await this.prisma.cvDraft.updateMany({ where: { id, version: dto.expectedVersion }, data: { analysisStatus: 'PROCESSING' } });
    if (marked.count !== 1) throw new ConflictException('Ce CV a changé. Recharge sa dernière version.');
    const report = atsReport(content, draft.keywords);
    let saved: CvDraft;
    try {
      saved = await this.prisma.$transaction(async tx => {
        const updated = await tx.cvDraft.updateMany({ where: { id, version: dto.expectedVersion }, data: { document: json(document), content, title: dto.title.trim(), template: dto.template, language: document.locale, fontSize: document.style.size, version: { increment: 1 }, afterScore: report.score, atsReport: json(report), analysisStatus: 'COMPLETED', analyzedContentHash: this.contentHash(content), approvedAt: dto.approve ? new Date() : null } });
        if (updated.count !== 1) throw new ConflictException('Ce CV a changé. Recharge sa dernière version.');
        // Debounced saves retain recoverable snapshots; no revision is silently overwritten.
        await tx.cvDraftRevision.upsert({ where: { draftId_version: { draftId: id, version: draft.version } }, create: { draftId: id, version: draft.version, document: draft.document ?? json(importDocument(draft.content)), content: draft.content, title: draft.title, template: draft.template, fontSize: draft.fontSize, report: json(atsReport(draft.content, draft.keywords)) }, update: {} });
        return tx.cvDraft.findUniqueOrThrow({ where: { id } });
      });
    } catch (error) {
      await this.prisma.cvDraft.updateMany({ where: { id, version: dto.expectedVersion }, data: { analysisStatus: 'FAILED' } });
      throw error;
    }
    return this.result(saved);
  }
  async restore(uid: string, id: string, revisionId: string, version: number) {
    await this.owned(uid, id);
    const revision = await this.prisma.cvDraftRevision.findFirst({ where: { id: revisionId, draftId: id } });
    if (!revision) throw new NotFoundException('Version introuvable');
    return this.save(uid, id, { expectedVersion: version, title: revision.title, template: revision.template, document: this.document(revision.document, revision.content) });
  }
  async duplicate(uid: string, id: string) {
    const draft = await this.owned(uid, id);
    const copy = await this.prisma.cvDraft.create({ data: { candidateId: draft.candidateId, title: `${draft.title.slice(0, 140)} — copie`, sourceResumeId: draft.sourceResumeId, targetJobId: draft.targetJobId, targetRole: draft.targetRole, document: json(this.document(draft.document, draft.content)), content: draft.content, originalContent: draft.content, template: draft.template, fontSize: draft.fontSize, keywords: draft.keywords, afterScore: draft.afterScore, atsReport: draft.atsReport ?? undefined, analysisStatus: draft.analysisStatus, analyzedContentHash: draft.analyzedContentHash } });
    return this.result(copy);
  }
  async variant(uid: string, id: string, dto: CreateCvVariantDto) {
    const source = await this.owned(uid, id), original = this.document(source.document, source.content), locale = dto.locale as CvLocale;
    if (original.locale === locale) throw new BadRequestException('Cette variante linguistique est déjà ouverte.');
    if (!cvLocales.includes(locale)) throw new BadRequestException('La langue cible sélectionnée est invalide.');
    const sourceLocale = cvLocales.includes(original.locale) ? original.locale : 'fr-FR';
    if (!documentText(original).trim()) throw new BadRequestException('Le CV ne contient aucun contenu traduisible.');
    let document = relabelDocument(original, locale), translated = false, method = 'labels_only';
    if (dto.mode === 'full') {
      const result = await this.ai.translateCv({ document: original as unknown as Record<string, unknown>, sourceLocale, targetLocale: locale, sourceLanguage: sourceLocale.slice(0, 2), targetLanguage: locale.slice(0, 2), professionalDomain: original.personal.title });
      if (result.translated && result.document) { document = relabelDocument(this.document(result.document), locale); translated = true; method = result.method; }
    }
    const reviewRequired = locale.slice(0, 2) !== original.locale.slice(0, 2) && this.hasUntranslatedSource(document, original.locale);
    if (reviewRequired) document.sections = document.sections.map(section => ({ ...section, needsReview: section.needsReview || this.hasUntranslatedText(section, original.locale) }));
    const template = locale === 'fr-CA' ? 'canadian-fr' : locale === 'en-CA' ? 'canadian-en' : locale === 'fr-FR' ? 'french-cv' : locale === 'en-US' ? 'us-resume' : locale === 'en-GB' ? 'uk-cv' : 'international';
    const title = this.baseTitle(source.title);
    const content = documentText(document), report = atsReport(content, source.keywords);
    const created = await this.prisma.cvDraft.create({ data: { candidateId: source.candidateId, title, sourceResumeId: source.sourceResumeId, targetJobId: source.targetJobId, targetRole: source.targetRole, document: json(document), content, originalContent: source.content, template, language: locale, fontSize: document.style.size, keywords: source.keywords, afterScore: report.score, atsReport: json(report), analysisStatus: 'COMPLETED', analyzedContentHash: this.contentHash(content) } });
    return { ...this.result(created), translation: { requested: dto.mode, translated, method, reviewRequired } };
  }
  private hasUntranslatedSource(document: CvDocument, sourceLocale: CvLocale) {
    const pattern = sourceLocale.startsWith('fr') ? /\b(?:développeur|expérimenté|développement|expérience|avec|compétences|formation|aujourd’hui|présent)\b/i : sourceLocale.startsWith('en') ? /\b(?:developer|professional summary|work experience|education|present)\b/i : undefined;
    return !!pattern && pattern.test(documentText(document));
  }
  private hasUntranslatedText(section: CvDocument['sections'][number], sourceLocale: CvLocale) {
    return this.hasUntranslatedSource({ ...blankDocument(), sections: [section] } as CvDocument, sourceLocale);
  }
  async writingQuality(uid: string, id: string) {
    const draft = await this.owned(uid, id);
    return this.writing.check(this.document(draft.document, draft.content));
  }
  async answer(uid: string, id: string, dto: InterviewAnswerDto) {
    const draft = await this.owned(uid, id), doc = this.document(draft.document, draft.content);
    const current = nextInterviewQuestion(doc), previous = doc.interview.find(a => a.key === dto.key);
    let question = current;
    if (previous) { const before = structuredClone(doc); before.interview = before.interview.slice(0, before.interview.findIndex(a => a.key === dto.key)); question = nextInterviewQuestion(before); }
    if (!question || question.key !== dto.key || (!question.optional && !dto.answer.trim())) throw new BadRequestException('Réponds à la question courante avant de poursuivre.');
    return this.save(uid, id, { expectedVersion: dto.expectedVersion, title: draft.title, template: draft.template, document: answerInterview(doc, question, dto.answer) });
  }
  async suggest(uid: string, id: string, dto: StudioSuggestDto) {
    const p = await this.career.profile(uid); await this.career.requireFeature(p.id, 'career.builder');
    const draft = await this.owned(uid, id);
    if (draft.version !== dto.expectedVersion) throw new ConflictException('Enregistre les dernières modifications avant de demander une proposition.');
    const document = this.document(draft.document, draft.content), proposal = structuredClone(document);
    let section = proposal.sections.find(s => s.id === dto.sectionId);
    if (!section && dto.sectionType) {
      let type = dto.sectionType as SectionType;
      if (type === 'custom') {
        const intent = `${dto.instruction || ''} ${dto.facts || ''}`;
        const types: [SectionType, RegExp][] = [['projects', /projet|project|freelance/i], ['certifications', /certificat/i], ['volunteering', /bénévol|volunteer|associati/i], ['publications', /publication|article/i], ['languages', /langue|language/i], ['skills', /compétence|skills/i]];
        type = types.find(([, pattern]) => pattern.test(intent))?.[0] ?? type;
      }
      section = newSection(type); proposal.sections.push(section);
    }
    if (!section) throw new BadRequestException('Choisis une rubrique.');
    const entry = dto.entryId ? section.entries.find(e => e.id === dto.entryId) : section.entries[0];
    if (!entry) throw new BadRequestException('Entrée introuvable');
    const bullet = dto.bulletId ? entry.bullets.find(b => b.id === dto.bulletId) : undefined;
    if (dto.bulletId && !bullet) throw new BadRequestException('Réalisation introuvable');
    const before = bullet ? bullet.text : entry.text;
    const summaryEvidence = section.type === 'summary'
      ? [document.personal.title, ...document.sections.filter(s => s.visible && ['skills', 'technical'].includes(s.type)).flatMap(s => s.entries.map(e => e.text))].filter(value => value.trim() && !before.includes(value)).join('\n')
      : '';
    // Existing CV evidence used to enrich a summary remains part of the edit
    // source; user facts and the writing instruction stay separate fields.
    const source = [before, summaryEvidence].filter(Boolean).join('\n') || (dto.facts?.trim() ? 'Aucun contenu existant. Rédige uniquement à partir des faits vérifiés fournis séparément.' : '');
    if (!source.trim() && !summaryEvidence.trim()) return { document, before, after: before, changed: false, question: 'Quels faits souhaites-tu présenter ? Décris ton rôle, ton contexte et une contribution réelle.', reason: 'Des informations vérifiables sont nécessaires avant de rédiger.', report: atsReport(draft.content, draft.keywords) };
    const job = draft.targetJobId ? await this.career.targetJob(draft.targetJobId) : null;
    if (job) {
      const deterministic = this.deterministicTailoring(section, before, document, job, dto.facts);
      if (bullet) bullet.text = deterministic.after; else entry.text = deterministic.after;
      const validated = this.document(proposal), report = atsReport(documentText(validated), draft.keywords);
      return { document: validated, before, after: deterministic.after, changed: before.trim() !== deterministic.after.trim(), sectionId: section.id, entryId: entry.id, bulletId: bullet?.id, alternativeIndex: dto.alternativeIndex || 0, category: deterministic.category, reason: deterministic.reason, question: deterministic.question, beforeScore: atsReport(draft.content, draft.keywords).score, report };
    }
    const result = await this.ai.tailorCv({ cv_text: source || summaryEvidence, job: { title: document.personal.title, requirements: [], skills: [], editing_scope: bullet ? 'line' : 'content', section_type: section.type, cv_context: documentText(document), entry_context: { title: entry.title, organization: entry.organization, period: entry.period }, language: document.locale, original_content: before, current_suggestion: dto.currentSuggestion || '', alternative_index: dto.alternativeIndex || 0, writing_instruction: dto.instruction || 'Améliore la formulation, la structure et la lisibilité avec les faits existants. Organise les compétences et harmonise les termes. Ne demande pas de précisions pour une correction éditoriale.', candidate_verified_facts: dto.facts || '', ats_context: { keywords: draft.keywords, report: draft.atsReport || null } } });
    let after = result.tailored_cv?.trim();
    // A style instruction is metadata, never CV content. Remove an accidental
    // verbatim echo before validating or displaying the proposal.
    const instruction = dto.instruction?.trim();
    if (after && instruction && after.toLocaleLowerCase().includes(instruction.toLocaleLowerCase())) {
      const escaped = instruction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      after = after.replace(new RegExp(escaped, 'gi'), '').replace(/[ \t]{2,}/g, ' ').trim();
    }
    if (!after) throw new BadRequestException('Aucune proposition reçue. Tes informations ont été conservées.');
    if (bullet) bullet.text = after; else entry.text = after;
    const validated = this.document(proposal), report = atsReport(documentText(validated), draft.keywords);
    const changed = before.trim() !== after.trim();
    return { document: validated, before, after, changed, sectionId: section.id, entryId: entry.id, bulletId: bullet?.id, alternativeIndex: dto.alternativeIndex || 0, reason: changed ? 'Voici une version plus claire et mieux structurée à partir de tes informations actuelles.' : 'Cette proposition conserve les faits et applique les améliorations éditoriales disponibles. Tu peux demander un autre style ou ajuster le texte directement.', question: ['experience', 'projects', 'volunteering'].includes(section.type) ? 'Pour aller plus loin, tu peux préciser un résultat ou un usage concret (facultatif).' : null, beforeScore: atsReport(draft.content, draft.keywords).score, report };
  }
  async export(uid: string, id: string) {
    return this.render(await this.owned(uid, id));
  }
  private render(draft: CvDraft) {
    const doc = this.document(draft.document, draft.content), rendered = renderDocument(doc, draft.template);
    if (!doc.personal.name.trim() || rendered.text.length < 20) throw new BadRequestException('Complète le nom et le contenu du CV avant de l’exporter.');
    return this.ai.renderCvPdf({ content: rendered.text, template: draft.template, fontSize: doc.style.size, html: rendered.html, css: rendered.css, margin: rendered.margin });
  }
  async publish(uid: string, id: string) {
    const draft = await this.owned(uid, id);
    if (!draft.approvedAt) throw new BadRequestException('Vérifie et approuve les faits avant d’ajouter cette version à tes CV.');
    const p = await this.career.profile(uid);
    const existing = p.resumes.find(r => { const design = resumeDesign(r.design); return design.draftId === id && design.draftVersion === draft.version; });
    if (existing) return { id: existing.id };
    const source = draft.sourceResumeId ? p.resumes.find(row => row.id === draft.sourceResumeId) : undefined;
    const sourceLogicalId = source ? logicalResumeId(source, p.resumes) : null;
    const existingForDraft = p.resumes.filter(row => resumeDesign(row.design).draftId === id);
    const doc = this.document(draft.document, draft.content);
    const logicalCvId = sourceLogicalId ?? (existingForDraft[0] ? logicalResumeId(existingForDraft[0], p.resumes) : `variant:${doc.variantGroupId}`);
    const group = resumeGroups(p.resumes).get(logicalCvId) ?? [], variantGroup = group.filter(row => resumeLocale(row) === doc.locale);
    if (!group.length) await this.career.assertCvUploadLimit(p.id);
    const logicalVersion = variantGroup.length + 1, wasPrimary = group.some(row => row.isPrimary);
    // Reuse the existing publication entitlement, with the canonical studio renderer.
    const rendered = await this.render(draft), bytes = Buffer.from(rendered.pdfBase64, 'base64');
    const key = `resumes/${p.id}/studio-${id}-${draft.version}-${newId()}.pdf`;
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new BadRequestException('Le PDF n’a pas pu être généré.');
    await this.storage.put(key, bytes, 'application/pdf');
    const existingFilename = variantGroup.at(-1)?.filename ?? group.at(-1)?.filename ?? '';
    const extension = existingFilename.match(/\.[^.]+$/)?.[0] || '.pdf';
    const filename = variantGroup.at(-1)?.filename ?? `${this.baseTitle(draft.title).replace(/[\\/:*?"<>|]/g, '_')}${extension}`;
    try { return await this.prisma.$transaction(async tx => {
      if (wasPrimary) await tx.resume.updateMany({ where: { id: { in: group.map(row => row.id) } }, data: { isPrimary: false } });
      return tx.resume.create({ data: { candidateId: p.id, filename, storageKey: key, fileSize: bytes.length, mimeType: 'application/pdf', version: logicalVersion, isPrimary: wasPrimary || !p.resumes.length, parsedText: rendered.inspection.text, processingStatus: 'COMPLETED', atsReport: json({ ...atsReport(rendered.inspection.text, draft.keywords), documentInspection: rendered.inspection }), design: json({ document: doc, template: draft.template, editableContent: draft.content, logicalCvId, sourceResumeId: draft.sourceResumeId, draftId: id, draftVersion: draft.version, targetJobId: draft.targetJobId, targetRole: draft.targetRole, language: languageForLocale(doc.locale), locale: doc.locale, market: doc.market, variantGroupId: doc.variantGroupId }) } });
    }); }
    catch (error) { await this.storage.delete(key).catch(() => undefined); throw error; }
  }
}
