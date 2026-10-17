import { logicalResumeId, resumeGroups } from '../../src/candidates/resume-versioning';

describe('logical CV version grouping', () => {
  const rows = [
    { id: 'original', createdAt: new Date('2026-09-20'), design: null },
    { id: 'v2', createdAt: new Date('2026-09-21'), design: { sourceResumeId: 'original', draftId: 'draft-a' } },
    { id: 'v3', createdAt: new Date('2026-09-22'), design: { logicalCvId: 'resume:original', sourceResumeId: 'v2', draftId: 'draft-a' } },
    { id: 'other', createdAt: new Date('2026-09-23'), design: null },
  ];
  it('follows legacy source links and explicit identity without merging another CV', () => {
    expect(logicalResumeId(rows[1], rows)).toBe('resume:original');
    // New explicit identities bind future versions to the original logical CV.
    expect(logicalResumeId(rows[2], rows)).toBe('resume:original');
    expect(resumeGroups(rows).size).toBe(2);
  });
  it('groups every publication carrying the same draft identity', () => {
    const manual = [{ id: 'first', createdAt: new Date('2026-09-23'), design: { draftId: 'draft-b' } }];
    const next = { id: 'next', createdAt: new Date('2026-09-24'), design: { draftId: 'draft-b' } };
    expect(resumeGroups([...manual, next]).get('draft:draft-b')?.map(row => row.id)).toEqual(['first', 'next']);
  });
});
