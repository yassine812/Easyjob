import { extractProfile } from '../../src/career/career-engine';
import { prefillFromCv } from '../../src/career/cv-prefill';

const text = 'Jane Doe\nPoste: Développeuse Python\nVille: Tunis\n+216 20 123 456\nProfil\n5 ans d’expérience en développement.\nCompétences: Python, SQL\nExpérience\nIngénieure chez Atlas\nFormation\nMaster informatique';
describe('CV prefill', () => {
  it('extracts labelled facts and inline sections without inferring missing years', () => {
    const result = extractProfile(text);
    expect(result).toMatchObject({ headline: 'Développeuse Python', location: 'Tunis', yearsExperience: 5, phone: '+216 20 123 456', skills: ['Python', 'SQL'] });
    expect(result.sections.experience).toEqual(['Ingénieure chez Atlas']);
    expect(extractProfile('2019 - 2022\nEducation\nMaster').yearsExperience).toBeNull();
  });
  it('preserves existing fields, reviewed sections and skills', async () => {
    const current = { id: 'c1', headline: 'My title', phone: null, location: 'Paris', bio: null, yearsExperience: 8,
      professionalData: { sections: { experience: ['My correction'] }, method: 'candidate_reviewed' }, updatedAt: new Date() };
    const tx = { candidateProfile: { findUnique: jest.fn().mockResolvedValue(current), findUniqueOrThrow: jest.fn().mockResolvedValue(current), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      candidateSkill: { count: jest.fn().mockResolvedValue(1), upsert: jest.fn() }, skill: { upsert: jest.fn() } };
    await prefillFromCv(tx as never, 'c1', extractProfile(text));
    const writes = tx.candidateProfile.updateMany.mock.calls.map(c => c[0]);
    expect(writes.some(c => c.data.headline || c.data.location || c.data.yearsExperience)).toBe(false);
    expect(writes.find(c => c.data.phone).where.OR).toEqual([{ phone: null }, { phone: '' }]);
    expect(writes.find(c => c.data.professionalData).data.professionalData.sections.experience).toEqual(['My correction']);
    expect(tx.skill.upsert).not.toHaveBeenCalled();
  });
});
