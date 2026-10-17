import { dashboardMetrics } from '../../src/companies/dashboard-metrics';

const date = (day: number) => new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00Z`);
const event = (newStatus: string, day: number) => ({ newStatus, createdAt: date(day) });
describe('recruitment dashboard cohorts', () => {
  it('compares equal periods without including the boundary twice and fills inactive dates', () => {
    const result = dashboardMetrics([1, 2, 5, 6, 6, 8, 10].map(day => ({ appliedAt: date(day), events: [] })), date(5), date(9));
    expect(result.comparison).toEqual({ previousApplications: 2, applicationsPercent: 100 });
    expect(result.daily.map(item => item.count)).toEqual([1, 2, 0, 1, 0]);
  });
  it('hides undefined growth instead of inventing 100% against zero', () => {
    expect(dashboardMetrics([{ appliedAt: date(5), events: [] }], date(5), date(9)).comparison.applicationsPercent).toBeNull();
  });
  it('computes velocity only from chronological recorded events, ignoring future events', () => {
    const result = dashboardMetrics([
      { appliedAt: date(1), events: [event('HIRED', 7), event('INTERVIEW', 3), event('OFFER', 5)] },
      { appliedAt: date(1), events: [event('OFFER', 2), event('INTERVIEW', 3), event('HIRED', 10)] },
    ], date(1), date(9));
    expect(result.velocity).toEqual([
      { key: 'applicationToInterview', averageDays: 2, sampleSize: 2 },
      { key: 'interviewToOffer', averageDays: 2, sampleSize: 1 },
      { key: 'offerToHire', averageDays: 2, sampleSize: 1 },
    ]);
  });
  it('does not infer skipped funnel steps from a later stage and deduplicates revisits', () => {
    const result = dashboardMetrics([
      { appliedAt: date(1), events: [event('UNDER_REVIEW', 2), event('UNDER_REVIEW', 3), event('SHORTLISTED', 4), event('INTERVIEW', 5)] },
      { appliedAt: date(1), events: [event('INTERVIEW', 3)] },
    ], date(1), date(9));
    expect(result.funnel.map(item => item.count)).toEqual([2, 1, 1, 1, 0, 0]);
    expect(result.funnel[1].conversion).toBe(50);
  });
  it('keeps velocity and funnel empty without history', () => {
    const result = dashboardMetrics([{ appliedAt: date(2), events: [] }], date(1), date(9));
    expect(result.funnel).toEqual([]);
    expect(result.velocity.every(item => item.averageDays === null)).toBe(true);
  });
});
