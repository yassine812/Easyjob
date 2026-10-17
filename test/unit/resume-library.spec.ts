import { ResumesService } from '../../src/candidates/resumes.service';
import { FileValidationService } from '../../src/files/file-validation.service';

describe('CV library API', () => {
  const profile = { findUnique: jest.fn(async () => ({ id: 'owner' })) };
  const resume = { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn(), create: jest.fn(), deleteMany: jest.fn() };
  const cvDraft = { findMany: jest.fn() };
  const transaction = jest.fn(async ops => Promise.all(ops));
  const storage = { put: jest.fn() };
  const service = new ResumesService({ candidateProfile: profile, resume, cvDraft, $transaction: transaction } as never, storage as never, new FileValidationService(), {} as never, {} as never, {} as never, {} as never);
  beforeEach(() => { jest.clearAllMocks(); cvDraft.findMany.mockResolvedValue([]); });
  it('returns only stored diagnostic summaries for owned CVs, not analysis details or invented scores', async () => {
    resume.findMany.mockResolvedValue([{ id: 'a', processingStatus: 'COMPLETED', atsReport: { score: 79, privateDetails: 'not a library field', documentInspection: { pages: [{}, {}] } } }, { id: 'b', processingStatus: 'PROCESSING', atsReport: { score: 99 } }, { id: 'c', processingStatus: 'COMPLETED', atsReport: null }]);
    const rows = await service.list('user');
    expect(resume.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { candidateId: 'owner' } }));
    expect(rows.map(r => r.analysisSummary)).toEqual([{ score: 79, status: 'COMPLETED', source: 'version', pageCount: 2 }, { score: null, status: 'PROCESSING', source: 'version', pageCount: null }, { score: null, status: 'COMPLETED', source: 'version', pageCount: null }]);
    expect(rows[0]).not.toHaveProperty('atsReport');
  });
  it('returns one current card for all versions of the same logical CV', async () => {
    const old = { id: 'old', filename: 'CV.pdf', createdAt: new Date('2026-09-20'), updatedAt: new Date('2026-09-20'), processingStatus: 'COMPLETED', isPrimary: true, design: null, atsReport: { score: 70 } };
    const current = { id: 'new', filename: 'CV.pdf', createdAt: new Date('2026-09-25'), updatedAt: new Date('2026-09-25'), processingStatus: 'COMPLETED', isPrimary: false, design: { logicalCvId: 'resume:old', sourceResumeId: 'old', draftId: 'draft', draftVersion: 5 }, atsReport: { score: 95 } };
    resume.findMany.mockResolvedValue([old, current]);
    cvDraft.findMany.mockResolvedValue([{ id: 'draft', sourceResumeId: 'old', version: 6, updatedAt: new Date('2026-09-26'), language: 'fr', afterScore: 82, analysisStatus: 'COMPLETED' }]);
    const rows = await service.list('user');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ id: 'new', version: 2, versionCount: 2, isPrimary: true, workingDraftId: 'draft', analysisSummary: { score: 82, status: 'COMPLETED', source: 'draft', pageCount: null } }));
  });
  it('does not render a stale saved score while the active draft is being analysed', async () => {
    const current = { id: 'current', filename: 'CV.pdf', createdAt: new Date('2026-09-25'), updatedAt: new Date('2026-09-25'), processingStatus: 'COMPLETED', isPrimary: true, design: { draftId: 'draft', draftVersion: 1 }, atsReport: { score: 95 } };
    resume.findMany.mockResolvedValue([current]);
    cvDraft.findMany.mockResolvedValue([{ id: 'draft', sourceResumeId: 'current', version: 2, updatedAt: new Date('2026-09-26'), language: 'fr', afterScore: 82, analysisStatus: 'PROCESSING' }]);
    const [row] = await service.list('user');
    expect(row.analysisSummary).toEqual({ score: null, status: 'PROCESSING', source: 'draft', pageCount: null });
  });
  it('changes the primary flag in a transaction after verifying ownership', async () => {
    resume.findFirst.mockResolvedValue({ id: 'owned' });
    await service.setPrimary('user', 'owned');
    expect(resume.findFirst).toHaveBeenCalledWith({ where: { id: 'owned', candidateId: 'owner' } });
    expect(resume.updateMany).toHaveBeenCalledWith({ where: { candidateId: 'owner' }, data: { isPrimary: false } });
    expect(resume.update).toHaveBeenCalledWith({ where: { id: 'owned' }, data: { isPrimary: true } });
    expect(transaction).toHaveBeenCalledTimes(1);
    resume.findFirst.mockResolvedValue(null);
    await expect(service.setPrimary('user', 'foreign')).rejects.toThrow('Resume not found');
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects fake PDF content or mismatched PDF type without writing a file or a resume', async () => {
    const file = { originalname: 'fake.pdf', mimetype: 'application/pdf', buffer: Buffer.from('not a PDF'), size: 9 };
    await expect(service.upload('user', file as Express.Multer.File, {})).rejects.toThrow('File content');
    await expect(service.upload('user', { ...file, mimetype: 'text/plain' } as Express.Multer.File, {})).rejects.toThrow('application/pdf');
    expect(storage.put).not.toHaveBeenCalled(); expect(resume.create).not.toHaveBeenCalled();
  });
});
