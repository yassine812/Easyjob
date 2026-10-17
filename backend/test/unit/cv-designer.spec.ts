import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CareerService } from '../../src/career/career.service';
import { atsReport } from '../../src/career/career-engine';

describe('CV designer source isolation and paid access', () => {
  const source = 'CV source B\nDéveloppement Python. Expérience et formation présentes uniquement dans ce CV.';
  const profile = { id: 'candidate', resumes: [{ id: 'primary', parsedText: 'Unrelated primary CV' }, { id: 'chosen', parsedText: source }] };
  let service: CareerService;
  const create = jest.fn(async ({ data }) => ({ id: 'draft', template: 'classic', fontSize: 14, ...data }));
  const update = jest.fn(async ({ data }) => ({ id: 'draft', keywords: [], ...data }));
  const findFirst = jest.fn();
  const revision = jest.fn();
  const updateMany = jest.fn();
  const assertCan = jest.fn();
  const tailorCv = jest.fn(async () => ({ tailored_cv: source + '\nOrganisation revue.' }));
  beforeEach(() => {
    findFirst.mockReset();
    updateMany.mockResolvedValue({ count: 1 });
    service = new CareerService({ cvDraft: { create, update, findFirst }, $transaction: (run: (tx: unknown) => unknown) => run({ cvDraftRevision: { upsert: revision }, cvDraft: { updateMany, findUniqueOrThrow: async () => ({ id: 'draft', keywords: [], content: source }) } }) } as never, { assertCan } as never, { tailorCv } as never, {} as never);
    jest.spyOn(service, 'profile').mockResolvedValue(profile as never);
    assertCan.mockResolvedValue(undefined);
  });
  it('reopens the existing manual version without creating another copy', async () => {
    findFirst.mockResolvedValue({ id: 'saved', content: source + '\nAn edit', keywords: [], sourceResumeId: 'chosen' });
    const result = await service.buildDraft('user', { title: 'Mon CV', resumeId: 'chosen', mode: 'manual' });
    expect(result.id).toBe('saved');
    expect(result.content).toContain('An edit');
    expect(create).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ candidateId: 'candidate', sourceResumeId: 'chosen', originalContent: source }) }));
  });
  it('opens the selected source unchanged in manual mode without calling AI', async () => {
    const result = await service.buildDraft('user', { title: 'Mon CV', resumeId: 'chosen', mode: 'manual' });
    expect(result.content).toBe(source);
    expect(result.sourceResumeId).toBe('chosen');
    expect(tailorCv).not.toHaveBeenCalled();
    expect(assertCan).toHaveBeenCalledWith({ ownerType: 'CANDIDATE', ownerId: 'candidate' }, 'career.builder');
  });
  it('passes only the selected CV evidence to the improvement provider', async () => {
    await service.buildDraft('user', { title: 'Mon CV', resumeId: 'chosen', mode: 'optimize' });
    expect(tailorCv).toHaveBeenCalledWith(expect.objectContaining({ cv_text: source }));
  });
  it('rejects another candidate’s CV', async () => {
    await expect(service.buildDraft('user', { title: 'Mon CV', resumeId: 'foreign', mode: 'manual' })).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
  it('blocks draft creation and edits when the paid feature is unavailable', async () => {
    assertCan.mockRejectedValue(new ForbiddenException());
    await expect(service.buildDraft('user', { title: 'Mon CV', resumeId: 'chosen', mode: 'manual' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.saveDraft('user', 'draft', { content: source })).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it('persists layout and refreshes the diagnostic when saving owned content', async () => {
    findFirst.mockResolvedValue({ id: 'draft', keywords: [], content: source, version: 1, title: 'CV', template: 'modern', fontSize: 14 });
    const result = await service.saveDraft('user', 'draft', { content: source, template: 'technology', fontSize: 13 });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'draft', candidateId: 'candidate' } });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'draft', version: 1 }, data: expect.objectContaining({ template: 'technology', fontSize: 13, approvedAt: null, version: { increment: 1 } }) }));
    expect(revision).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ version: 1, content: source }), update: {} }));
    expect(result.report).toHaveProperty('criteria');
  });
  it('rejects stale saves before replacing the current version', async () => {
    findFirst.mockResolvedValue({ id: 'draft', version: 3 });
    await expect(service.saveDraft('user', 'draft', { content: source, expectedVersion: 2 })).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('returns a section proposal with real before and after diagnostics without saving it', async () => {
    findFirst.mockResolvedValue({ id: 'draft', keywords: [], targetJobId: null, title: 'CV' });
    const content = '# Candidate\n\n## Compétences\nPython\n\n## Formation\nDiplôme';
    const result = await service.regenerateSection('user', 'draft', { content, sectionIndex: 1 });
    expect(result.before).toBe('## Compétences\nPython');
    expect(result.after).toContain('Organisation revue.');
    expect(result.content).toContain('## Formation\nDiplôme');
    expect(result.beforeScore).toBe(atsReport(content).score);
    expect(result.score).toBe(atsReport(result.content).score);
    expect(result.report.score).toBe(result.score);
    expect(update).not.toHaveBeenCalled();
  });
  it('replaces only the selected occurrence of a line and preserves surrounding sections', async () => {
    findFirst.mockResolvedValue({ id: 'draft', keywords: [], targetJobId: null, title: 'CV' });
    tailorCv.mockResolvedValueOnce({ tailored_cv: '• Développer des outils Python.' });
    const content = '# Candidate\n\n## Expérience\nCompany A\n• Développement des outils Python.\nCompany B\n• Développement des outils Python.\n\n## Formation\nDiplôme';
    const result = await service.regenerateSection('user', 'draft', { content, sectionIndex: 1, lineIndex: 3 });
    expect(result.content).toBe(content.replace('Company B\n• Développement des outils Python.', 'Company B\n• Développer des outils Python.'));
    expect(result.before).toBe('• Développement des outils Python.');
    expect(result.scope).toBe('line');
    expect(tailorCv).toHaveBeenCalledWith(expect.objectContaining({ cv_text: result.before, job: expect.objectContaining({ editing_scope: 'line' }) }));
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects an out-of-range line without calling the provider', async () => {
    findFirst.mockResolvedValue({ id: 'draft', keywords: [], targetJobId: null, title: 'CV' });
    await expect(service.regenerateSection('user', 'draft', { content: '# Candidate\n\n## Skills\nPython', sectionIndex: 1, lineIndex: 8 })).rejects.toThrow('Select a CV text line');
    expect(tailorCv).not.toHaveBeenCalled();
  });
});

describe('approved CV PDF publication', () => {
  const content = '# Candidate\n\n## Skills\nPython\n\n## Experience\nDeveloped Python tools.';
  const draft = { id: 'draft', content, title: 'Targeted CV', template: 'modern', fontSize: 14, keywords: ['Python'], sourceResumeId: 'master', targetJobId: 'job', targetRole: 'Developer', language: 'en', version: 3 };
  const inspection = { text: content, pages: 1 };
  function fixture(approved = true, validPdf = true) {
    const create = jest.fn(async ({ data }) => ({ id: 'published', ...data }));
    const put = jest.fn();
    const renderCvPdf = jest.fn(async () => ({ pdfBase64: Buffer.from(validPdf ? '%PDF-1.7 test fixture' : 'not a PDF').toString('base64'), inspection, layout: 'ATS_SINGLE_COLUMN' }));
    const service = new CareerService({ cvDraft: { findFirst: jest.fn(async () => approved ? draft : null) }, resume: { create } } as never, { assertCan: jest.fn(), assertCandidateLimit: jest.fn() } as never, { renderCvPdf } as never, { put } as never);
    jest.spyOn(service, 'profile').mockResolvedValue({ id: 'candidate', resumes: [{ id: 'master', version: 1, parsedText: content }] } as never);
    return { service, create, put, renderCvPdf };
  }
  it('creates a new usable PDF version from approved content and retains source and target metadata', async () => {
    const { service, create, put } = fixture();
    const result = await service.publishDraft('user', 'draft');
    expect(result).toMatchObject({ id: 'published', version: 2, mimeType: 'application/pdf', processingStatus: 'COMPLETED', isPrimary: false, parsedText: content,
      design: { sourceResumeId: 'master', targetJobId: 'job', draftVersion: 3, editableContent: content } });
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^resumes\/candidate\/draft-draft-.*\.pdf$/), expect.any(Buffer), 'application/pdf');
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.atsReport).toMatchObject({ score: atsReport(content, ['Python']).score, documentInspection: inspection });
  });
  it('cannot publish without approval or store a non-PDF provider response', async () => {
    const unapproved = fixture(false);
    await expect(unapproved.service.publishDraft('user', 'draft')).rejects.toThrow('Review and approve');
    expect(unapproved.renderCvPdf).not.toHaveBeenCalled();
    const invalid = fixture(true, false);
    await expect(invalid.service.publishDraft('user', 'draft')).rejects.toThrow('PDF generation failed');
    expect(invalid.put).not.toHaveBeenCalled(); expect(invalid.create).not.toHaveBeenCalled();
  });
});
