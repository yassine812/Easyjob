import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { JobAutofillService, JobQualityValidator } from '../../src/jobs/job-creation.service';
import { JobDraftingClient } from '../../src/jobs/job-drafting.client';
import fixture from '../fixtures/job-draft-v2.json';

describe('deterministic job drafting bridge', () => {
  const originalFetch = global.fetch;
  const config = { ai: { baseUrl: 'http://internal-python', timeoutMs: 5000, apiKey: 'test-key' } };
  afterEach(() => { global.fetch = originalFetch; });

  it('calls only the deterministic endpoint with trusted company context', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => fixture });
    global.fetch = fetcher;
    const client = new JobDraftingClient(config as never);
    const company = { commercialName: 'Example', industry: 'Technology' };
    const result = await client.generate({ roleId: 'django_backend_developer', locale: 'fr' }, company);
    expect(result.responsibilities.length).toBeGreaterThanOrEqual(6);
    expect(fetcher).toHaveBeenCalledWith('http://internal-python/drafting/jobs', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-key' }), body: JSON.stringify({ roleId: 'django_backend_developer', locale: 'fr', company }) }));
  });

  it('fails closed rather than returning the old string generator', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(new JobDraftingClient(config as never).generate({ roleId: 'devops_engineer' }, { commercialName: '', industry: null })).rejects.toBeInstanceOf(ServiceUnavailableException);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ description: 'Incomplete output' }) });
    await expect(new JobDraftingClient(config as never).generate({ roleId: 'devops_engineer' }, { commercialName: '', industry: null })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses the shared Python taxonomy for basic suggestions and strips internal fields', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'devops_engineer', label: 'DevOps Engineer', score: 100 }] });
    const client = new JobDraftingClient(config as never);
    expect(await client.suggest('devops')).toEqual([{ id: 'devops_engineer', label: 'DevOps Engineer' }]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(await client.suggest('a')).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('checks entitlement before company lookup or drafting', async () => {
    const drafting = { generate: jest.fn() }, prisma = { company: { findUniqueOrThrow: jest.fn() } };
    const service = new JobAutofillService(drafting as never, { assertCan: async () => { throw new ForbiddenException(); } } as never, prisma as never);
    await expect(service.build('company', { roleId: 'devops_engineer' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(drafting.generate).not.toHaveBeenCalled();
    expect(prisma.company.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('uses persisted company information and never publishes while preparing', async () => {
    const company = { commercialName: 'Persisted company', industry: 'Finance' };
    const drafting = { generate: jest.fn().mockResolvedValue(fixture) };
    const service = new JobAutofillService(drafting as never, { assertCan: jest.fn() } as never, { company: { findUniqueOrThrow: jest.fn().mockResolvedValue(company) } } as never);
    const input = { roleId: 'django_backend_developer' };
    expect(await service.build('company', input)).not.toHaveProperty('status');
    expect(drafting.generate).toHaveBeenCalledWith(input, company);
  });

  it('still checks publication salary and seniority contradictions', () => {
    const warnings = new JobQualityValidator().validate({ title: 'Senior Developer', description: 'A role description long enough to review.', responsibilities: ['Build APIs'], skills: [{ required: true }], minimumYearsExperience: 1, experienceLevel: 'SENIOR', salaryMin: 3000, salaryMax: 2000 });
    expect(warnings).toContain('Le salaire maximum doit être supérieur ou égal au minimum.');
    expect(warnings).toContain('Le niveau Senior semble incohérent avec moins de 3 ans d’expérience.');
  });
});
