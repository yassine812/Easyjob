import { CANDIDATE_PLAN_CATALOG, mergePlanFeatures } from '../../src/subscriptions/plan-catalog';
import { PlanType } from '@prisma/client';

describe('candidate plan catalogue', () => {
  it('keeps the product matrix aligned with paid feature gates', () => {
    expect(CANDIDATE_PLAN_CATALOG.FREE).toMatchObject({ displayName: 'EasyJob Start', priceCents: 0 });
    expect(CANDIDATE_PLAN_CATALOG.PRO).toMatchObject({ displayName: 'EasyJob Boost', priceCents: 4900 });
    expect(CANDIDATE_PLAN_CATALOG.PREMIUM).toMatchObject({ displayName: 'EasyJob Max', priceCents: 7900 });
    expect(CANDIDATE_PLAN_CATALOG.FREE.features.auto_apply).toBe(false);
    expect(CANDIDATE_PLAN_CATALOG.PRO.features.cv_tailoring).toBe(true);
    expect(CANDIDATE_PLAN_CATALOG.PRO.features.interview_preparation).toBe(true);
    expect(CANDIDATE_PLAN_CATALOG.PRO.features.coding_interview).toBe(false);
    expect(CANDIDATE_PLAN_CATALOG.PREMIUM.features.auto_apply).toBe(true);
    expect(CANDIDATE_PLAN_CATALOG.PREMIUM.features.coding_interview).toBe(true);
  });

  it('exposes the exact candidate entitlement matrix', () => {
    const keys = ['advanced_ats', 'cv_tailoring', 'detailed_matching', 'interview_preparation', 'coding_interview', 'adaptive_interview', 'advanced_analytics', 'email_alerts', 'auto_apply'] as const;
    for (const key of keys) expect(CANDIDATE_PLAN_CATALOG.FREE.features[key]).toBe(false);
    for (const key of ['advanced_ats', 'cv_tailoring', 'detailed_matching', 'interview_preparation', 'advanced_analytics', 'email_alerts'] as const) expect(CANDIDATE_PLAN_CATALOG.PRO.features[key]).toBe(true);
    for (const key of ['coding_interview', 'adaptive_interview', 'auto_apply'] as const) expect(CANDIDATE_PLAN_CATALOG.PRO.features[key]).toBe(false);
    for (const key of keys) expect(CANDIDATE_PLAN_CATALOG.PREMIUM.features[key]).toBe(true);
  });

  it('upgrades stale candidate rows while preserving unknown metadata', () => {
    const features = mergePlanFeatures(PlanType.CANDIDATE, 'PRO', { legacy_marker: true, 'career.coach': false });
    expect(features.legacy_marker).toBe(true);
    expect(features['career.coach']).toBe(true);
    expect(features.advanced_ats).toBe(true);
  });
});
