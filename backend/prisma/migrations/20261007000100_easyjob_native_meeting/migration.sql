ALTER TYPE "InterviewStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TABLE "Interview" ADD COLUMN "startedAt" TIMESTAMP(3), ADD COLUMN "endedAt" TIMESTAMP(3);
UPDATE "Interview" SET "meetingProvider" = 'EASYJOB', "meetingUrl" = NULL WHERE "locationType" = 'EASYJOB';
UPDATE "Interview" SET "endedAt" = COALESCE("completedAt", "updatedAt") WHERE "status" IN ('COMPLETED', 'CANCELLED', 'NO_SHOW');
