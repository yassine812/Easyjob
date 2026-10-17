import { AutomationService } from '../../src/automation/automation.service';
import { AutomationTriggerType } from '@prisma/client';

describe('AutomationService', () => {
  const makeService = (overrides: Record<string, unknown> = {}) => {
    const prisma = {
      automationRule: { findMany: jest.fn() },
      automationExecution: { create: jest.fn() },
      ...overrides,
    };
    const access = { assertPermission: jest.fn() };
    const audit = { log: jest.fn() };
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new AutomationService(prisma as never, access as never, audit as never, queue as never);
    return { service, prisma, queue };
  };

  const payload = {
    entityType: 'Application',
    entityId: 'app1',
    companyId: 'companyA',
    applicationId: 'app1',
    jobId: 'job1',
    newStatus: 'SHORTLISTED',
    previousStatus: 'SCREENING',
  };

  it('only evaluates rules matching the trigger', async () => {
    const { service, prisma, queue } = makeService();
    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule1',
        triggerConfig: {},
        conditions: [{ field: 'newStatus', op: 'eq', value: 'SHORTLISTED' }],
        actions: [],
      },
    ]);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec1' });
    await service.evaluate(payload.companyId, AutomationTriggerType.APPLICATION_STATUS_CHANGED, payload);
    expect(prisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ triggerType: 'APPLICATION_STATUS_CHANGED' }) }),
    );
    expect(queue.add).toHaveBeenCalledWith('execute', { executionId: 'exec1' }, expect.anything());
  });

  it('skips rules whose conditions fail', async () => {
    const { service, prisma, queue } = makeService();
    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule1',
        triggerConfig: {},
        conditions: [{ field: 'newStatus', op: 'eq', value: 'OFFER' }],
        actions: [],
      },
    ]);
    const enqueued = await service.evaluate(payload.companyId, AutomationTriggerType.APPLICATION_STATUS_CHANGED, payload);
    expect(enqueued).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('filters by trigger config', async () => {
    const { service, prisma, queue } = makeService();
    prisma.automationRule.findMany.mockResolvedValue([
      { id: 'rule1', triggerConfig: { jobId: 'job999' }, conditions: [], actions: [] },
    ]);
    const enqueued = await service.evaluate(payload.companyId, AutomationTriggerType.APPLICATION_STATUS_CHANGED, payload);
    expect(enqueued).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('is idempotent — unique rule/entity conflict prevents re-execution', async () => {
    const { service, prisma, queue } = makeService();
    prisma.automationRule.findMany.mockResolvedValue([
      { id: 'rule1', triggerConfig: {}, conditions: [], actions: [] },
    ]);
    prisma.automationExecution.create.mockRejectedValue({ code: 'P2002' });
    const enqueued = await service.evaluate(payload.companyId, AutomationTriggerType.APPLICATION_STATUS_CHANGED, payload);
    expect(enqueued).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('supports numeric and string operators', async () => {
    const { service, prisma } = makeService();
    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule1',
        triggerConfig: {},
        conditions: [
          { field: 'newStatus', op: 'neq', value: 'REJECTED' },
          { field: 'overall', op: 'gt', value: 50 },
          { field: 'title', op: 'contains', value: 'Engineer' },
        ],
        actions: [],
      },
    ]);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec1' });
    const enqueued = await service.evaluate(
      'companyA',
      AutomationTriggerType.CANDIDATE_MATCH_SCORE_UPDATED,
      { entityType: 'Application', entityId: 'app1', companyId: 'companyA', overall: 72, title: 'Backend Engineer' },
    );
    expect(enqueued).toBe(1);
  });
});
