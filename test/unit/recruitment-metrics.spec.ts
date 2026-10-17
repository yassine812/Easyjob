import { recruitmentClassification } from '../../src/companies/recruitment-metrics';

describe('recruitment classification', () => {
  it('keeps a high-potential candidate in review below the promising threshold', () => {
    expect(recruitmentClassification(59, 'HIGH')).toBe('REVIEW');
  });

  it('does not override critical gaps with potential', () => {
    expect(recruitmentClassification(59, 'HIGH', undefined, 1)).toBe('LOW_ALIGNMENT');
  });
});
