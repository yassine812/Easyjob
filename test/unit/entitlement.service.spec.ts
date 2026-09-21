import { ForbiddenException } from '@nestjs/common';
import { EntitlementService } from '../../src/entitlements/entitlement.service';

describe('EntitlementService', () => {
  const makeService = (overrides: Record<string, unknown> = {}) => {
    const prisma = {
      subscription: { findFirst: jest.fn() },
      plan: { findFirst: jest.fn() },
      companyMember: { count: jest.fn() },
      job: { count: jest.fn() },
      resume: { count: jest.fn() },
      ...overrides,
    };
    return { service: new EntitlementService(prisma as never), prisma };
  };

  it('returns the free plan when there is no active subscription', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.plan.findFirst.mockResolvedValue({
      id: 'plan-free',
      name: 'FREE',
      features: { 'cv.uploads': 3 },
    });
    const plan = await service.getActivePlan({ ownerType: 'CANDIDATE', ownerId: 'c1' });
    expect(plan.name).toBe('FREE');
    expect(plan.features['cv.uploads']).toBe(3);
  });

  it('uses the active paid subscription when present', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findFirst.mockResolvedValue({
      planId: 'plan-pro',
      plan: { name: 'PRO', features: { 'cv.uploads': 20, 'ai.match': true } },
    });
    const plan = await service.getActivePlan({ ownerType: 'CANDIDATE', ownerId: 'c1' });
    expect(plan.name).toBe('PRO');
  });

  it('enforces feature flags', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.plan.findFirst.mockResolvedValue({ id: 'p', name: 'FREE', features: { 'ai.match': false } });
    await expect(service.assertCan({ ownerType: 'CANDIDATE', ownerId: 'c1' }, 'ai.match')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('enforces numeric limits using the provided count', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.plan.findFirst.mockResolvedValue({ id: 'p', name: 'TRIAL', features: { 'team.members': 5 } });
    await expect(
      service.assertCompanyLimit('companyA', 'team.members', async () => 5),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.assertCompanyLimit('companyA', 'team.members', async () => 3),
    ).resolves.toBeUndefined();
  });

  it('ignores canceled subscriptions', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.plan.findFirst.mockResolvedValue({ id: 'p', name: 'FREE', features: {} });
    await expect(
      service.getActivePlan({ ownerType: 'COMPANY', ownerId: 'c1' }),
    ).resolves.toMatchObject({ name: 'FREE' });
  });
});
