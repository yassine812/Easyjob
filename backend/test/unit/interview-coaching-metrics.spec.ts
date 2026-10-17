import { speechMetrics } from '../../src/career/interview-coaching-metrics';

describe('interview coaching speech metrics', () => {
  it('measures pace and filler rate without judging the candidate', () => {
    const result = speechMetrics('Euh I built an API, um, with Django.', 30, undefined, 2);
    expect(result.wordCount).toBe(8);
    expect(result.wordsPerMinute).toBe(16);
    expect(result.fillerCount).toBe(2);
    expect(result.longPauseCount).toBe(2);
    expect(result.source).toBe('browser_transcript');
  });
});
