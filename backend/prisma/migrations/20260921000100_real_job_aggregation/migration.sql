-- CreateEnum
CREATE TYPE "JobSourceType" AS ENUM ('JOOBLE', 'TANITJOBS', 'LINKEDIN', 'COMPANY_DIRECT', 'OTHER_JOB_BOARD');

-- CreateEnum
CREATE TYPE "SourceApplicationMethod" AS ENUM ('NATIVE_EASYJOB', 'EXTERNAL_APPLICATION', 'EMAIL_APPLICATION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AggregatedJobStatus" AS ENUM ('OPEN', 'CLOSED', 'NO_LONGER_AVAILABLE');

-- CreateEnum
CREATE TYPE "ExternalApplicationStatus" AS ENUM ('READY_TO_APPLY_EXTERNALLY', 'EXTERNAL_SITE_OPENED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "answers" JSONB,
ADD COLUMN     "candidateSnapshot" JSONB,
ADD COLUMN     "coverLetter" TEXT;


-- CreateTable
CREATE TABLE "JobSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "JobSourceType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "syncStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatedJob" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyName" TEXT,
    "companyLogoUrl" TEXT,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceLevel" TEXT,
    "employmentType" TEXT,
    "workplaceType" TEXT,
    "location" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryText" TEXT,
    "currency" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closingAt" TIMESTAMP(3),
    "status" "AggregatedJobStatus" NOT NULL DEFAULT 'OPEN',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregatedJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatedJobSource" (
    "id" TEXT NOT NULL,
    "aggregatedJobId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "applicationUrl" TEXT,
    "applicationMethod" "SourceApplicationMethod" NOT NULL DEFAULT 'UNKNOWN',
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AggregatedJobSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalJobSave" (
    "candidateId" TEXT NOT NULL,
    "aggregatedJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalJobSave_pkey" PRIMARY KEY ("candidateId","aggregatedJobId")
);

-- CreateTable
CREATE TABLE "ExternalApplicationPreparation" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "aggregatedJobId" TEXT NOT NULL,
    "resumeId" TEXT,
    "status" "ExternalApplicationStatus" NOT NULL DEFAULT 'READY_TO_APPLY_EXTERNALLY',
    "candidateSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "coverLetter" TEXT,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalSiteOpenedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalApplicationPreparation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobSource_type_key" ON "JobSource"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatedJob_dedupeKey_key" ON "AggregatedJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "AggregatedJob_status_publishedAt_idx" ON "AggregatedJob"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "AggregatedJob_title_idx" ON "AggregatedJob"("title");

-- CreateIndex
CREATE INDEX "AggregatedJob_location_idx" ON "AggregatedJob"("location");

-- CreateIndex
CREATE INDEX "AggregatedJobSource_aggregatedJobId_idx" ON "AggregatedJobSource"("aggregatedJobId");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatedJobSource_sourceId_sourceJobId_key" ON "AggregatedJobSource"("sourceId", "sourceJobId");

-- CreateIndex
CREATE INDEX "ExternalJobSave_aggregatedJobId_idx" ON "ExternalJobSave"("aggregatedJobId");

-- CreateIndex
CREATE INDEX "ExternalApplicationPreparation_candidateId_status_idx" ON "ExternalApplicationPreparation"("candidateId", "status");

-- CreateIndex
CREATE INDEX "ExternalApplicationPreparation_aggregatedJobId_idx" ON "ExternalApplicationPreparation"("aggregatedJobId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalApplicationPreparation_candidateId_aggregatedJobId_key" ON "ExternalApplicationPreparation"("candidateId", "aggregatedJobId");

-- AddForeignKey
ALTER TABLE "AggregatedJobSource" ADD CONSTRAINT "AggregatedJobSource_aggregatedJobId_fkey" FOREIGN KEY ("aggregatedJobId") REFERENCES "AggregatedJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedJobSource" ADD CONSTRAINT "AggregatedJobSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "JobSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalJobSave" ADD CONSTRAINT "ExternalJobSave_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalJobSave" ADD CONSTRAINT "ExternalJobSave_aggregatedJobId_fkey" FOREIGN KEY ("aggregatedJobId") REFERENCES "AggregatedJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalApplicationPreparation" ADD CONSTRAINT "ExternalApplicationPreparation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalApplicationPreparation" ADD CONSTRAINT "ExternalApplicationPreparation_aggregatedJobId_fkey" FOREIGN KEY ("aggregatedJobId") REFERENCES "AggregatedJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalApplicationPreparation" ADD CONSTRAINT "ExternalApplicationPreparation_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

