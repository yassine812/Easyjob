ALTER TABLE "Assessment" ADD COLUMN "jobId" TEXT;
CREATE INDEX "Assessment_jobId_idx" ON "Assessment"("jobId");
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
