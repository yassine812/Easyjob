import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';

/** Canonical forward progression order. */
export const PIPELINE_ORDER: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.SCREENING,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.ASSESSMENT,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.HIRED,
];

export const TERMINAL_STATUSES = new Set<ApplicationStatus>([
  ApplicationStatus.HIRED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
]);

/**
 * Deliberate transition rule: applications move forward along the pipeline, or
 * to REJECTED/WITHDRAWN. Terminal statuses are final; backwards moves are not
 * allowed. This single function guards every status change.
 */
export function assertTransition(current: ApplicationStatus, next: ApplicationStatus): void {
  if (current === next) {
    throw new BadRequestException(`Application is already ${current}`);
  }
  if (TERMINAL_STATUSES.has(current)) {
    throw new BadRequestException(`Application is in terminal status ${current} and cannot be changed`);
  }
  const currentIdx = PIPELINE_ORDER.indexOf(current);
  const nextIdx = PIPELINE_ORDER.indexOf(next);
  const forward = nextIdx > currentIdx;
  const rejectOrWithdraw =
    next === ApplicationStatus.REJECTED || next === ApplicationStatus.WITHDRAWN;
  if (!forward && !rejectOrWithdraw) {
    throw new BadRequestException(
      `Invalid status transition ${current} → ${next}. Statuses can only move forward in the pipeline or to REJECTED/WITHDRAWN.`,
    );
  }
}
