CREATE TABLE "InterviewBrief" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "candidateSnapshot" JSONB NOT NULL,
  "jobSnapshot" JSONB NOT NULL,
  "analysisSnapshot" JSONB NOT NULL,
  "strengths" JSONB NOT NULL,
  "gaps" JSONB NOT NULL,
  "checklist" JSONB,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewBrief_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InterviewBrief_interviewId_key" ON "InterviewBrief"("interviewId");
ALTER TABLE "InterviewBrief" ADD CONSTRAINT "InterviewBrief_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InterviewQuestion" (
  "id" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "skill" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "sourceType" TEXT NOT NULL,
  "sourceReference" TEXT,
  "rationale" TEXT NOT NULL,
  "evidence" JSONB,
  "order" INTEGER NOT NULL,
  "covered" BOOLEAN NOT NULL DEFAULT false,
  "recruiterNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InterviewQuestion_briefId_order_idx" ON "InterviewQuestion"("briefId", "order");
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "InterviewBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
