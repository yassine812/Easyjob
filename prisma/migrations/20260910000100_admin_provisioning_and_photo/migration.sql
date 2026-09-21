ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "temporaryPasswordExpiresAt" TIMESTAMP(3),
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CandidateProfile" ADD COLUMN "photoKey" TEXT;
CREATE TABLE "CompanyAccessDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY, "companyId" TEXT NOT NULL UNIQUE, "userId" TEXT NOT NULL UNIQUE,
 "companyName" TEXT NOT NULL, "email" TEXT NOT NULL, "encryptedBody" TEXT,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
 "deliveredAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CompanyAccessDelivery_status_nextAttemptAt_idx" ON "CompanyAccessDelivery"("status", "nextAttemptAt");
