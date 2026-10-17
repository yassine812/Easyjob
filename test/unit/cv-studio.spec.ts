import { CvStudioService } from '../../src/career/cv-studio.service';
import { blankDocument, documentText, newSection } from '../../src/career/cv-document';
describe('CV studio persistence and proposals', () => {
  const doc = blankDocument(); doc.personal.name = 'Example Candidate'; doc.personal.title = 'Developer'; doc.sections = [newSection('experience')]; doc.sections[0].entries[0].text = 'Développement de plusieurs API.';
  let row: Record<string, unknown>;
  const findFirst = jest.fn(), updateMany = jest.fn(), update = jest.fn(), findUnique = jest.fn(), upsert = jest.fn(), create = jest.fn();
  const requireFeature = jest.fn(), targetJob = jest.fn(), tailorCv = jest.fn();
  const tx = { cvDraft: { updateMany, findUniqueOrThrow: async () => row }, cvDraftRevision: { upsert } };
  const prisma = { cvDraft: { findFirst, create, update, updateMany, findUnique }, resume: { findUnique: jest.fn() }, $transaction: (fn: (t: unknown) => unknown) => fn(tx), cvDraftRevision: { findFirst } };
  const service = new CvStudioService(prisma as never, { profile: async () => ({ id: 'owner', resumes: [] }), requireFeature, targetJob } as never, { tailorCv } as never, {} as never, { check: jest.fn() } as never);
  beforeEach(() => { jest.clearAllMocks(); row = { id: 'draft', candidateId: 'owner', version: 2, title: 'My CV', template: 'modern', fontSize: 14, content: documentText(doc), originalContent: documentText(doc), document: doc, keywords: [], analysisStatus: 'PENDING' }; findFirst.mockResolvedValue(row); findUnique.mockImplementation(async () => row); update.mockImplementation(async ({ data }) => { row = { ...row, ...data }; return row; }); updateMany.mockImplementation(async ({ data }) => { row = { ...row, ...data, version: data.version ? 3 : row.version }; return { count: 1 }; }); });
  it('requires ownership and paid access for the document', async () => {
    await service.get('user', 'draft'); expect(requireFeature).toHaveBeenCalledWith('owner', 'career.builder'); expect(findFirst).toHaveBeenCalledWith({ where: { id: 'draft', candidateId: 'owner' } });
    findFirst.mockResolvedValue(null); await expect(service.get('user', 'other')).rejects.toThrow('introuvable');
  });
  it('rejects stale saves before writing and retains complete structured revisions', async () => {
    await expect(service.save('user', 'draft', { expectedVersion: 1, title: 'My CV', template: 'modern', document: doc })).rejects.toThrow('autre version'); expect(updateMany).not.toHaveBeenCalled();
    const result = await service.save('user', 'draft', { expectedVersion: 2, title: 'Updated CV', template: 'classic', document: doc });
    expect(result.version).toBe(3); expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ document: doc, version: 2 }) }));
  });
  it('returns a contextual proposal without saving or changing other entries', async () => {
    tailorCv.mockResolvedValue({ tailored_cv: 'Développer plusieurs API.' });
    const result = await service.suggest('user', 'draft', { expectedVersion: 2, sectionId: doc.sections[0].id, entryId: doc.sections[0].entries[0].id });
    expect(result.changed).toBe(true); expect(result.document.sections[0].entries[0].text).toBe('Développer plusieurs API.'); expect(doc.sections[0].entries[0].text).toBe('Développement de plusieurs API.'); expect(updateMany).not.toHaveBeenCalled();
    expect(tailorCv).toHaveBeenCalledWith(expect.objectContaining({ job: expect.objectContaining({ cv_context: documentText(doc), editing_scope: 'content', section_type: 'experience' }) }));
  });
  it('keeps enrichment optional on an unchanged passage and never fabricates score changes', async () => {
    tailorCv.mockResolvedValue({ tailored_cv: doc.sections[0].entries[0].text });
    const result = await service.suggest('user', 'draft', { expectedVersion: 2, sectionId: doc.sections[0].id });
    expect(result.changed).toBe(false); expect(result.question).toContain('facultatif'); expect(result.reason).not.toContain('Aucune reformulation sûre'); expect(result.report.score).toBe(result.beforeScore); expect(updateMany).not.toHaveBeenCalled();
  });
  it('requests skills organization without requiring new achievements', async () => {
    const skills = newSection('technical'); skills.entries[0].text = 'Données & Outils : MySQL · SQL · Git';
    row.document = { ...doc, sections: [skills] };
    tailorCv.mockResolvedValue({ tailored_cv: 'Bases de données : MySQL · SQL\nOutils & méthodes : Git' });
    const result = await service.suggest('user', 'draft', { expectedVersion: 2, sectionId: skills.id });
    expect(result.changed).toBe(true); expect(result.question).toBeNull(); expect(result.reason).toContain('informations actuelles');
    expect(tailorCv).toHaveBeenCalledWith(expect.objectContaining({ job: expect.objectContaining({ editing_scope: 'content', section_type: 'technical', candidate_verified_facts: '' }) }));
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('uses existing CV skills to rewrite a summary without adding target-job skills', async () => {
    const summary = newSection('summary'), skills = newSection('skills'); summary.entries[0].text = 'Developer'; skills.entries[0].text = 'Python · SQL';
    row.document = { ...doc, sections: [summary, skills] };
    tailorCv.mockResolvedValue({ tailored_cv: 'Developer\nPython · SQL' });
    await service.suggest('user', 'draft', { expectedVersion: 2, sectionId: summary.id });
    expect(tailorCv).toHaveBeenCalledWith(expect.objectContaining({ cv_text: 'Developer\nPython · SQL' }));
  });
  it('uses the requested section intent and does not invent content when facts are absent', async () => {
    const empty = await service.suggest('user', 'draft', { expectedVersion: 2, sectionType: 'custom', instruction: 'Ajouter mes projets freelance' });
    expect(empty.changed).toBe(false); expect(empty.question).toBeTruthy(); expect(tailorCv).not.toHaveBeenCalled();
    tailorCv.mockResolvedValue({ tailored_cv: 'Projet freelance : création d’un portail Django.' });
    const result = await service.suggest('user', 'draft', { expectedVersion: 2, sectionType: 'custom', instruction: 'Ajouter mes projets freelance', facts: 'Création d’un portail Django.' });
    expect(result.document.sections.at(-1)?.type).toBe('projects'); expect(updateMany).not.toHaveBeenCalled();
  });
  it('uses deterministic, evidence-only tailoring for a job-linked draft', async () => {
    row.targetJobId = 'job-1';
    const linkedDoc = { ...doc, sections: [{ ...doc.sections[0], entries: [{ ...doc.sections[0].entries[0], text: 'Built REST API endpoints with Django. Maintained SQL migrations.' }] }] };
    row.document = linkedDoc;
    targetJob.mockResolvedValue({ title: 'Backend Engineer', requirements: ['REST API'], responsibilities: [], skills: [{ skill: { name: 'Django' }, required: true }], niceToHave: [] });
    const result = await service.suggest('user', 'draft', { expectedVersion: 2, sectionId: linkedDoc.sections[0].id });
    expect(tailorCv).not.toHaveBeenCalled();
    expect(result.category).toBe('rewrite');
    expect(result.after).toContain('REST API');
    expect(result.after).toContain('Django');
  });
});
