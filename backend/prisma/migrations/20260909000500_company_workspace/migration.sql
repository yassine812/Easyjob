-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InterviewType" ADD VALUE 'HR';
ALTER TYPE "InterviewType" ADD VALUE 'BEHAVIORAL';
ALTER TYPE "InterviewType" ADD VALUE 'MANAGERIAL';
ALTER TYPE "InterviewType" ADD VALUE 'AI';
ALTER TYPE "InterviewType" ADD VALUE 'FINAL';

-- AlterEnum
ALTER TYPE "InterviewStatus" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "culture" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "recruitmentSettings" JSONB,
ADD COLUMN     "size" TEXT;

-- AlterTable
ALTER TABLE "CompanyMember" ADD COLUMN     "isOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "position" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "department" TEXT,
ADD COLUMN     "interviewProcess" TEXT,
ADD COLUMN     "positions" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "preferredEducation" TEXT,
ADD COLUMN     "preferredLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "aiReport" JSONB,
ADD COLUMN     "answers" JSONB,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "questions" JSONB,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JobAssignment" (
    "jobId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("jobId","memberId")
);

-- CreateTable
CREATE TABLE "InterviewParticipant" (
    "interviewId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "InterviewParticipant_pkey" PRIMARY KEY ("interviewId","memberId")
);

-- CreateTable
CREATE TABLE "InterviewFeedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "technical" INTEGER,
    "communication" INTEGER,
    "problemSolving" INTEGER,
    "roleKnowledge" INTEGER,
    "summary" TEXT NOT NULL,
    "followUp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyEmailTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateCommunication" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentOffer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobAssignment_memberId_idx" ON "JobAssignment"("memberId");

-- CreateIndex
CREATE INDEX "InterviewParticipant_memberId_idx" ON "InterviewParticipant"("memberId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_interviewId_idx" ON "InterviewFeedback"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEmailTemplate_companyId_name_key" ON "CompanyEmailTemplate"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateCommunication_requestId_key" ON "CandidateCommunication"("requestId");

-- CreateIndex
CREATE INDEX "CandidateCommunication_applicationId_createdAt_idx" ON "CandidateCommunication"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "RecruitmentOffer_applicationId_status_idx" ON "RecruitmentOffer"("applicationId", "status");

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewParticipant" ADD CONSTRAINT "InterviewParticipant_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewParticipant" ADD CONSTRAINT "InterviewParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyEmailTemplate" ADD CONSTRAINT "CompanyEmailTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateCommunication" ADD CONSTRAINT "CandidateCommunication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentOffer" ADD CONSTRAINT "RecruitmentOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
