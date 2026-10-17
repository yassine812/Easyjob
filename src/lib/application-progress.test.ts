import { describe, expect, it } from 'vitest';
import { applicationProgress } from './application-progress';
import type { Application } from '@/types/api';

const base = { id: 'application', status: 'APPLIED', appliedAt: '2026-09-24T10:00:00Z', aiScreeningStatus: 'COMPLETED', aiScreenedAt: '2026-09-24T10:00:01Z' } as Application;

describe('application progress from recorded events', () => {
  it('automatically shows completed analysis even while recruiter status remains applied', () => {
    const progress = applicationProgress(base);
    expect(progress.steps.map(step => step.state)).toEqual(['done', 'done', 'waiting', 'waiting', 'waiting', 'waiting']);
    expect(progress.steps[1].date).toBe(base.aiScreenedAt);
    expect(progress.message).toBe('awaitingRecruiter');
  });
  it('updates on actual review and interview events without marking skipped stages complete', () => {
    const progress = applicationProgress({ ...base, status: 'INTERVIEW', events: [{ id: 'event', newStatus: 'UNDER_REVIEW', createdAt: '2026-09-24T11:00:00Z' }], interviews: [{ id: 'interview', startAt: '2026-09-25T10:00:00Z', status: 'CONFIRMED' }] } as Application);
    expect(progress.steps[2].state).toBe('done');
    expect(progress.steps[3].state).toBe('active');
    expect(progress.steps[3].date).toBe('2026-09-25T10:00:00Z');
    expect(progress.steps[4].state).toBe('waiting');
    expect(applicationProgress({ ...base, status: 'OFFER' }).steps[2].state).toBe('waiting');
  });
  it('stops active steps after rejection or withdrawal', () => {
    for (const status of ['REJECTED', 'WITHDRAWN'] as const) {
      const progress = applicationProgress({ ...base, status, aiScreeningStatus: 'PENDING' });
      expect(progress.steps.some(step => step.state === 'active')).toBe(false);
      expect(progress.message).toBe(status);
    }
  });
  it('distinguishes processing and failure from completed analysis', () => {
    expect(applicationProgress({ ...base, aiScreeningStatus: 'PENDING' }).steps[1].state).toBe('waiting');
    expect(applicationProgress({ ...base, aiScreeningStatus: 'PROCESSING' }).steps[1].state).toBe('active');
    const failed = applicationProgress({ ...base, aiScreeningStatus: 'FAILED' });
    expect(failed.steps[1].state).toBe('failed');
    expect(failed.message).toBe('analysisNeedsAttention');
  });
});
