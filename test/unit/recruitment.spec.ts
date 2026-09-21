import { ForbiddenException } from '@nestjs/common';
import { ApplicationsService } from '../../src/applications/applications.service';
import { AutomationProcessor } from '../../src/automation/automation.processor';
import { DevPaymentProvider } from '../../src/payments/payment.provider';

describe('Recruitment boundaries', () => {
  function setup() {
    const prisma = { application: { findUnique: jest.fn().mockResolvedValue({ id: 'application', candidate: { userId: 'candidate' }, job: { companyId: 'company' } }), findMany: jest.fn().mockResolvedValue([]) }, applicationNote: { findMany: jest.fn() }, applicationEvent: { findMany: jest.fn().mockResolvedValue([{ id: 'event', metadata: { note: 'Private HR note' }, newStatus: 'SCREENING' }]) } };
    const permission = jest.fn().mockResolvedValue(undefined);
    const access = { assertPermission: permission, assertApplicationPermission: permission, applicationScope: jest.fn().mockResolvedValue({ job: { companyId: 'company' } }) };
    const service = new ApplicationsService(prisma as never, access as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    return { service, prisma, access };
  }
  it('does not reveal recruiter notes to the applicant', async () => {
    const { service, prisma, access } = setup();
    access.assertPermission.mockRejectedValue(new ForbiddenException());
    await expect(service.listNotes('application', 'candidate')).rejects.toThrow(ForbiddenException);
    expect(prisma.applicationNote.findMany).not.toHaveBeenCalled();
  });
  it('redacts internal event metadata from candidate history', async () => {
    const { service } = setup();
    expect(await service.listEvents('application', 'candidate')).toEqual([{ id: 'event', newStatus: 'SCREENING', metadata: null }]);
  });
  it('keeps unanalysed applications after scored candidates and scopes ranking to one tenant', async () => {
    const { service, prisma } = setup();
    await service.rankCandidatesForJob('hr', 'company', 'job');
    expect(prisma.application.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { jobId: 'job', job: { companyId: 'company' } }, orderBy: expect.arrayContaining([{ aiMatchScore: { sort: 'desc', nulls: 'last' } }]) }));
  });
  it.each(['REJECTED', 'HIRED', 'OFFER', 'WITHDRAWN'])('automation cannot move an applicant to %s', async status => {
    const prisma = { automationExecution: { findUnique: jest.fn().mockResolvedValue({ rule: { companyId: 'co', createdById: 'hr', actions: [{ type: 'move_application', config: { applicationId: 'app', toStatus: status } }] } }), update: jest.fn() }, automationLog: { create: jest.fn() } };
    const applications = { moveStatus: jest.fn() };
    const processor = new AutomationProcessor(prisma as never, {} as never, {} as never, applications as never);
    await processor.process({ data: { executionId: 'execution' } } as never);
    expect(applications.moveStatus).not.toHaveBeenCalled();
    expect(prisma.automationExecution.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
  });
  it.each(['development', 'production'])('does not create or accept simulated payments in %s', async env => {
    const provider = new DevPaymentProvider({ env, payment: { devWebhookSecret: 'test' } } as never);
    await expect(provider.createCheckout({} as never)).rejects.toThrow();
    await expect(provider.handleWebhook(Buffer.from('{}'), 'test')).rejects.toThrow();
  });
});
