import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { assertTransition } from '../../src/applications/pipeline';

describe('application pipeline transitions', () => {
  it('allows forward movement', () => {
    expect(() => assertTransition(ApplicationStatus.APPLIED, ApplicationStatus.SCREENING)).not.toThrow();
    expect(() => assertTransition(ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW)).not.toThrow();
    expect(() => assertTransition(ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER)).not.toThrow();
    expect(() => assertTransition(ApplicationStatus.OFFER, ApplicationStatus.HIRED)).not.toThrow();
  });

  it('allows rejection and withdrawal from any non-terminal state', () => {
    expect(() => assertTransition(ApplicationStatus.SCREENING, ApplicationStatus.REJECTED)).not.toThrow();
    expect(() => assertTransition(ApplicationStatus.INTERVIEW, ApplicationStatus.WITHDRAWN)).not.toThrow();
  });

  it('rejects backward moves', () => {
    expect(() => assertTransition(ApplicationStatus.INTERVIEW, ApplicationStatus.APPLIED)).toThrow(BadRequestException);
    expect(() => assertTransition(ApplicationStatus.HIRED, ApplicationStatus.OFFER)).toThrow(BadRequestException);
  });

  it('rejects same-status moves', () => {
    expect(() => assertTransition(ApplicationStatus.APPLIED, ApplicationStatus.APPLIED)).toThrow(BadRequestException);
  });

  it('treats terminal statuses as final', () => {
    expect(() => assertTransition(ApplicationStatus.REJECTED, ApplicationStatus.APPLIED)).toThrow(BadRequestException);
    expect(() => assertTransition(ApplicationStatus.HIRED, ApplicationStatus.REJECTED)).toThrow(BadRequestException);
    expect(() => assertTransition(ApplicationStatus.WITHDRAWN, ApplicationStatus.SCREENING)).toThrow(BadRequestException);
  });
});
