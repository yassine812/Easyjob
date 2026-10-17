CREATE TABLE "CandidateStarStory" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "relatedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateStarStory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CandidateStarStory_candidateId_updatedAt_idx" ON "CandidateStarStory"("candidateId", "updatedAt");

ALTER TABLE "CandidateStarStory" ADD CONSTRAINT "CandidateStarStory_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
