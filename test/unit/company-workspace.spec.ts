import { ForbiddenException } from '@nestjs/common';
import { CompanyAccessService } from '../../src/companies/company-access.service';
import { DEFAULT_THRESHOLDS, matchCategory, validThresholds } from '../../src/companies/recruitment-metrics';
import { InterviewsService } from '../../src/interviews/interviews.service';

describe('Company recruitment access', () => {
  function setup(role = 'INTERVIEWER') {
    const prisma = {
      companyMember: { findFirst: jest.fn().mockResolvedValue({ id: 'member', companyId: 'company', role }) },
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'company', status: 'ACTIVE' }) },
      role: { findUnique: jest.fn().mockResolvedValue({ permissions: ['application.view', 'interview.update'].map(name => ({ permission: { name } })) }) },
      job: { findFirst: jest.fn().mockResolvedValue({ id: 'job' }) },
      application: { findFirst: jest.fn().mockResolvedValue(null) },
      interview: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return { prisma, access: new CompanyAccessService(prisma as never) };
  }
  it('requires an active tenant membership before constructing any scope', async () => {
    const { prisma, access } = setup(); prisma.companyMember.findFirst.mockResolvedValue(null as never);
    await expect(access.applicationScope('stranger', 'company')).rejects.toThrow(ForbiddenException);
    expect(prisma.application.findFirst).not.toHaveBeenCalled();
  });
  it('limits a hiring manager to assigned jobs', async () => {
    const { access } = setup('HIRING_MANAGER');
    expect(await access.jobScope('user', 'company')).toEqual({ companyId: 'company', assignments: { some: { memberId: 'member' } } });
  });
  it('limits an interviewer to applications containing their own interview', async () => {
    const { access } = setup();
    expect(await access.applicationScope('user', 'company')).toEqual(expect.objectContaining({ interviews: { some: { participants: { some: { memberId: 'member' } } } } }));
  });
  it('denies a different interview even when it belongs to an assigned job', async () => {
    const { access, prisma } = setup();
    await expect(access.assertInterviewPermission('user', 'company', 'other-interview', 'interview.update')).rejects.toThrow(ForbiddenException);
    expect(prisma.interview.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [expect.objectContaining({ participants: { some: { memberId: 'member' } } }), { id: 'other-interview' }] } }));
  });
  it('denies writes for a suspended company', async () => {
    const { prisma, access } = setup(); prisma.company.findUnique.mockResolvedValue({ id: 'company', status: 'SUSPENDED' });
    await expect(access.assertPermission('user', 'company', 'interview.update')).rejects.toThrow(ForbiddenException);
  });
  it('removes private interview notes and AI evaluations from the candidate response', async () => {
    const prisma = { interview: { findUnique: jest.fn().mockResolvedValue({ id: 'interview', notes: 'Private hiring discussion', aiReport: { technical: 30 }, startAt: 'today', application: { candidate: { userId: 'candidate' }, job: { companyId: 'company' } } }) } };
    const service = new InterviewsService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    const result = await service.getById('interview', 'candidate');
    expect(result).not.toHaveProperty('notes'); expect(result).not.toHaveProperty('aiReport'); expect(result).toHaveProperty('startAt', 'today');
  });
});

describe('Recruitment match categories', () => {
  it.each([[null, 'UNANALYZED'], [0, 'WEAK'], [54, 'WEAK'], [55, 'POTENTIAL'], [69, 'POTENTIAL'], [70, 'GOOD'], [79, 'GOOD'], [80, 'STRONG'], [89, 'STRONG'], [90, 'EXCELLENT'], [100, 'EXCELLENT']] as const)('categorizes %s without deciding application status', (score, category) => expect(matchCategory(score)).toBe(category));
  it('uses custom thresholds and rejects ambiguous ordering', () => {
    expect(matchCategory(85, { excellent: 85, strong: 75, good: 65, potential: 50 })).toBe('EXCELLENT');
    expect(validThresholds(DEFAULT_THRESHOLDS)).toBe(true);
    expect(validThresholds({ ...DEFAULT_THRESHOLDS, good: 80 })).toBe(false);
  });
});
