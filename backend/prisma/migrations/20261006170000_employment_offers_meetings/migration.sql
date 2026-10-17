ALTER TABLE "RecruitmentOffer"
ADD COLUMN "contractType" TEXT, ADD COLUMN "salaryAmount" DECIMAL(14,3),
ADD COLUMN "salaryCurrency" TEXT NOT NULL DEFAULT 'TND', ADD COLUMN "salaryPeriod" TEXT NOT NULL DEFAULT 'MONTH',
ADD COLUMN "workMode" TEXT, ADD COLUMN "location" TEXT, ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[], ADD COLUMN "companyName" TEXT,
ADD COLUMN "sentAt" TIMESTAMP(3), ADD COLUMN "viewedAt" TIMESTAMP(3), ADD COLUMN "responseReason" TEXT;
ALTER TABLE "Interview" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Tunis',
ADD COLUMN "locationType" TEXT NOT NULL DEFAULT 'EXTERNAL', ADD COLUMN "meetingRoomId" TEXT,
ADD COLUMN "assistantEnabled" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "assistantNotes" JSONB,
ADD COLUMN "calendarSequence" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "reminderHourSentAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Interview_meetingRoomId_key" ON "Interview"("meetingRoomId");
ALTER TABLE "InterviewParticipant" ADD COLUMN "attendanceStatus" TEXT NOT NULL DEFAULT 'INVITED',
ADD COLUMN "invitedAt" TIMESTAMP(3), ADD COLUMN "acceptedAt" TIMESTAMP(3), ADD COLUMN "declinedAt" TIMESTAMP(3);
ALTER TABLE "InterviewFeedback" ADD COLUMN "criteria" JSONB, ADD COLUMN "recommendation" TEXT;
CREATE TABLE "InterviewConsent" ("interviewId" TEXT NOT NULL, "userId" TEXT NOT NULL,
"acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3), "version" TEXT NOT NULL DEFAULT '1',
CONSTRAINT "InterviewConsent_pkey" PRIMARY KEY ("interviewId", "userId"),
CONSTRAINT "InterviewConsent_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE);
