import { JobsService } from '../../src/jobs/jobs.service';
import { removeSkillRequirements, publicJobSalary } from '../../src/jobs/job-content';
import { JobQualityValidator } from '../../src/jobs/job-creation.service';

describe('job builder persistence', () => {
  it('generates one structured skill source and validates it for publication', () => {
    const draft = require('../fixtures/job-draft-v2.json');
    expect(draft.requirements).toEqual([]);
    expect(new JobQualityValidator().validate(draft)).not.toContain('Ajoutez au moins une compétence requise.');
  });
  it('redacts public salaries without changing the stored amounts', () => {
    const job = { salaryMin: 4500, salaryMax: 7200, salaryVisible: false };
    expect(publicJobSalary(job)).toEqual({ salaryMin: null, salaryMax: null, salaryVisible: false });
    expect(job.salaryMin).toBe(4500);
    expect(publicJobSalary({ ...job, salaryVisible: true }).salaryMin).toBe(4500);
  });
  it('keeps non-skill qualifications during legacy cleanup', () => {
    expect(removeSkillRequirements(['Maîtrise de Docker', 'Permis B'], [{ name: 'Docker' }])).toEqual(['Permis B']);
  });
  it('only returns hidden salary amounts through a permission-checked managed view', async () => {
    const job = { id: 'job', companyId: 'company', salaryVisible: false, salaryMin: 4500, salaryMax: 7200 };
    const prisma = { job: { findUnique: jest.fn().mockResolvedValue(job), findFirst: jest.fn().mockResolvedValue({ id: 'job' }) }, company: { findFirst: jest.fn().mockResolvedValue({ id: 'company' }) } };
    const access = { assertJobPermission: jest.fn() };
    const service = new JobsService(prisma as never, access as never, {} as never, {} as never, {} as never, {} as never);
    expect(await service.getById('job')).toMatchObject({ salaryMin: null, salaryMax: null });
    expect(await service.getById('job', 'recruiter', true)).toMatchObject({ salaryMin: 4500, salaryMax: 7200 });
    expect(access.assertJobPermission).toHaveBeenCalledWith('recruiter', 'company', 'job', 'application.view');
  });
  it('persists clearing salary and deadline and editing an active offer', async () => {
    const job = { id: 'job', companyId: 'company', status: 'PUBLISHED', salaryMin: 4500, salaryMax: 7200, currency: 'TND', requirements: ['Maîtrise de Docker', 'Permis B'] };
    const tx = { job: { update: jest.fn() }, jobSkill: { deleteMany: jest.fn(), create: jest.fn() }, skill: { upsert: jest.fn().mockResolvedValue({ id: 'skill' }) } };
    const prisma = { job: { findUnique: jest.fn().mockResolvedValue(job) }, $transaction: jest.fn(async fn => fn(tx)) };
    const access = { assertPermission: jest.fn() };
    const service = new JobsService(prisma as never, access as never, { log: jest.fn() } as never, {} as never, {} as never, {} as never);
    await service.update('user', 'job', { title: 'DevOps Engineer', salaryMin: null, salaryMax: null, expiresAt: null, skills: [{ name: 'Docker', required: true, level: 'ADVANCED' }] }, {});
    expect(access.assertPermission).toHaveBeenCalledWith('user', 'company', 'job.update');
    expect(tx.job.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ salaryMin: null, salaryMax: null, expiresAt: null, requirements: ['Permis B'] }) }));
    expect(tx.job.update.mock.calls[0][0].data.status).toBeUndefined();
  });
});
