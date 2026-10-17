import { blankDocument, newSection } from '../../src/career/cv-document';
import { WritingQualityService } from '../../src/career/writing-quality.service';

describe('CV writing quality', () => {
  it('finds deterministic French grammar, repetition and typography issues without changing content', async () => {
    const document = blankDocument(), experience = newSection('experience');
    experience.entries[0].text = 'Développement de plusieurs application  web web!'; document.sections = [experience];
    const before = JSON.stringify(document), service = new WritingQualityService({ languageTool: { timeoutMs: 1000 } } as never);
    const result = await service.check(document);
    expect(result.provider).toBe('local'); expect(result.issues.map(issue => issue.category)).toEqual(expect.arrayContaining(['grammar', 'repetition', 'punctuation'])); expect(JSON.stringify(document)).toBe(before);
  });
});
