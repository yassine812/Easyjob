-- Reconcile additive fields previously maintained by local scripts.
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "priceTndCents" INTEGER;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "pricesJson" JSONB;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "billingCountry" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiMatchScore" INTEGER;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "atsScore" INTEGER;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiQualification" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiRecommendation" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "potentialScore" TEXT;
ALTER TABLE "Application" ALTER COLUMN "potentialScore" DROP DEFAULT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "potentialReason" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "strengths" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "missingRequirements" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiScreeningStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "aiScreenedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "stageChangedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "stageChangedById" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "stageChangeSource" TEXT DEFAULT 'SYSTEM';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Application_stageChangedById_fkey') THEN
 ALTER TABLE "Application" ADD CONSTRAINT "Application_stageChangedById_fkey" FOREIGN KEY ("stageChangedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
 END IF;
END $$;
ALTER TABLE "CandidateProfile" ADD COLUMN "professionalData" JSONB;
ALTER TABLE "Resume" ADD COLUMN "atsReport" JSONB, ADD COLUMN "extractedProfile" JSONB;
ALTER TABLE "Job" ADD COLUMN "domain" TEXT, ADD COLUMN "workMode" TEXT, ADD COLUMN "educationRequirement" TEXT, ADD COLUMN "minimumYearsExperience" INTEGER;
ALTER TABLE "Application" ADD COLUMN "matchExplanation" JSONB, ADD COLUMN "autoApplied" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "cvTextSnapshot" TEXT;

CREATE TABLE "CareerSettings" (
 "candidateId" TEXT PRIMARY KEY, "emailAlerts" BOOLEAN NOT NULL DEFAULT false,
 "frequency" TEXT NOT NULL DEFAULT 'DAILY', "domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "locations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "workModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "minimumScore" INTEGER NOT NULL DEFAULT 70, "autoApply" BOOLEAN NOT NULL DEFAULT false,
 "autoMinimumScore" INTEGER NOT NULL DEFAULT 80, "maxPerDay" INTEGER NOT NULL DEFAULT 3,
 "excludedCompanies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "excludedJobTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "approvedDraftId" TEXT, "autoConsentAt" TIMESTAMP(3), "lastAlertAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CareerSettings_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CvDraft" (
 "id" TEXT PRIMARY KEY, "candidateId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "targetJobId" TEXT, "sourceResumeId" TEXT, "content" TEXT NOT NULL, "originalContent" TEXT NOT NULL,
 "beforeScore" INTEGER, "afterScore" INTEGER, "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CvDraft_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CvDraft_candidateId_createdAt_idx" ON "CvDraft"("candidateId", "createdAt");
CREATE TABLE "CareerDelivery" (
 "id" TEXT PRIMARY KEY, "candidateId" TEXT NOT NULL, "jobId" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "reason" TEXT, "matchScore" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CareerDelivery_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CareerDelivery_candidateId_jobId_kind_key" ON "CareerDelivery"("candidateId", "jobId", "kind");
CREATE INDEX "CareerDelivery_candidateId_createdAt_idx" ON "CareerDelivery"("candidateId", "createdAt");
CREATE TABLE "CoachSession" (
 "id" TEXT PRIMARY KEY, "candidateId" TEXT NOT NULL, "jobId" TEXT, "jobTitle" TEXT NOT NULL,
 "company" TEXT, "interviewType" TEXT NOT NULL, "locale" TEXT NOT NULL DEFAULT 'en',
 "questions" JSONB NOT NULL, "answers" JSONB NOT NULL DEFAULT '[]', "visionConsent" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CoachSession_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CoachSession_candidateId_createdAt_idx" ON "CoachSession"("candidateId", "createdAt");

-- Entitlements are configuration, not demo records. Preserve existing PRO prices.
UPDATE "Plan" SET "features" = "features" || '{"ai.cv_analyze":true,"ats.basic":true,"career.match":false,"career.builder":false,"career.alerts":false,"career.auto_apply":false,"career.coach":false,"career.vision":false}'::jsonb WHERE "type" = 'CANDIDATE' AND "name" = 'FREE';
UPDATE "Plan" SET "features" = "features" || '{"ai.cv_analyze":true,"ats.basic":true,"career.match":true,"career.builder":true,"career.alerts":true,"career.auto_apply":false,"career.coach":false,"career.vision":false,"ai.cv_generate":true,"ai.cv_tailor":true}'::jsonb WHERE "type" = 'CANDIDATE' AND "name" = 'PRO';
INSERT INTO "Plan" ("id","name","type","priceCents","currency","billingInterval","features","sortOrder","updatedAt")
VALUES ('candidate_career_ai','CAREER_AI','CANDIDATE',1999,'USD','MONTHLY','{"cv.uploads":50,"ats.basic":true,"ai.cv_analyze":true,"ai.cv_generate":true,"ai.cv_tailor":true,"ai.match":true,"ai.cover_letter":true,"ai.interview":true,"career.match":true,"career.builder":true,"career.alerts":true,"career.auto_apply":true,"career.coach":true,"career.vision":true}',3,CURRENT_TIMESTAMP)
ON CONFLICT ("name","type") DO UPDATE SET "features" = EXCLUDED."features";
