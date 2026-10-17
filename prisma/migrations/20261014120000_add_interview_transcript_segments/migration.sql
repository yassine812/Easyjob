CREATE TABLE "InterviewTranscriptSegment" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "participantId" TEXT,
    "participantRole" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'FASTER_WHISPER',
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewTranscriptSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InterviewTranscriptSegment_interviewId_startedAt_idx" ON "InterviewTranscriptSegment"("interviewId", "startedAt");
ALTER TABLE "InterviewTranscriptSegment" ADD CONSTRAINT "InterviewTranscriptSegment_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
