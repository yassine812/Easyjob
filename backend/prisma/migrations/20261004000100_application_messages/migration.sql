ALTER TABLE "CandidateCommunication" ADD COLUMN "senderType" TEXT NOT NULL DEFAULT 'RECRUITER';
ALTER TABLE "CandidateCommunication" ADD COLUMN "readAt" TIMESTAMP(3);
CREATE INDEX "CandidateCommunication_applicationId_senderType_readAt_idx" ON "CandidateCommunication"("applicationId", "senderType", "readAt");
