ALTER TABLE "CvDraft"
  ADD COLUMN "atsReport" JSONB,
  ADD COLUMN "analysisStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "analyzedContentHash" TEXT;

UPDATE "CvDraft"
SET "analysisStatus" = CASE
  WHEN "afterScore" IS NULL THEN 'PENDING'
  ELSE 'COMPLETED'
END;
