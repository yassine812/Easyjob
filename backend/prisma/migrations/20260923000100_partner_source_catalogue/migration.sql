-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AggregatedJobStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "AggregatedJobStatus" ADD VALUE 'PAUSED';
ALTER TYPE "AggregatedJobStatus" ADD VALUE 'REMOVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobSourceType" ADD VALUE 'APEC';
ALTER TYPE "JobSourceType" ADD VALUE 'GLASSDOOR';
ALTER TYPE "JobSourceType" ADD VALUE 'WELCOME_TO_THE_JUNGLE';
ALTER TYPE "JobSourceType" ADD VALUE 'INDEED';
ALTER TYPE "JobSourceType" ADD VALUE 'FABSKILL';
ALTER TYPE "JobSourceType" ADD VALUE 'JOBREVIEW';
ALTER TYPE "JobSourceType" ADD VALUE 'EMPLOITUNISIE';
ALTER TYPE "JobSourceType" ADD VALUE 'OPTIONCARRIERE';
ALTER TYPE "JobSourceType" ADD VALUE 'KEEJOB';

-- AlterTable
ALTER TABLE "AggregatedJob" ADD COLUMN     "address" TEXT,
ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyIndustry" TEXT,
ADD COLUMN     "companyLocation" TEXT,
ADD COLUMN     "companyWebsite" TEXT,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "contractDuration" TEXT,
ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "education" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "experienceMax" DOUBLE PRECISION,
ADD COLUMN     "experienceMin" DOUBLE PRECISION,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "niceToHave" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "positions" INTEGER,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "salaryPeriod" TEXT;

-- AlterTable
ALTER TABLE "AggregatedJobSource" ADD COLUMN     "applicationFields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "missingSince" TIMESTAMP(3),
ADD COLUMN     "normalizedData" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "rawMetadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "status" "AggregatedJobStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "consentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CareerSettings" ADD COLUMN     "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "excludedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "experienceLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "maxPerWeek" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "preferredResumeId" TEXT,
ADD COLUMN     "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "unattendedConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "applicationFields" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "JobSource" ADD COLUMN     "lastDuplicates" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDurationMs" INTEGER,
ADD COLUMN     "lastErrorCode" TEXT,
ADD COLUMN     "lastExpired" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailureAt" TIMESTAMP(3),
ADD COLUMN     "lastHttpStatus" INTEGER,
ADD COLUMN     "lastImported" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastRejected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastUpdated" INTEGER NOT NULL DEFAULT 0;


-- CreateTable
CREATE TABLE "JobSourceSyncRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "expired" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "httpStatus" INTEGER,

    CONSTRAINT "JobSourceSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobSourceSyncRun_sourceId_startedAt_idx" ON "JobSourceSyncRun"("sourceId", "startedAt");

-- AddForeignKey
ALTER TABLE "JobSourceSyncRun" ADD CONSTRAINT "JobSourceSyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
