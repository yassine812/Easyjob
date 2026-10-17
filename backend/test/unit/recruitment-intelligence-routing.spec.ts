import { DEFAULT_THRESHOLDS, recruitmentClassification } from '../../src/companies/recruitment-metrics';

describe('Premium recruitment intelligence routing', () => {
  it('routes a 15% profile with no potential to Low Alignment', () => {
    expect(recruitmentClassification(15, 'LOW', DEFAULT_THRESHOLDS, 3)).toBe('LOW_ALIGNMENT');
  });
  it('keeps strong and promising profiles in the active intelligence queues', () => {
    expect(recruitmentClassification(91, 'HIGH')).toBe('STRONG_MATCH');
    expect(recruitmentClassification(74, 'HIGH')).toBe('PROMISING');
  });
  it('does not let critical gaps promote a candidate', () => {
    expect(recruitmentClassification(74, 'HIGH', DEFAULT_THRESHOLDS, 1)).toBe('LOW_ALIGNMENT');
  });
});
