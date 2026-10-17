ALTER TABLE "CareerSettings" ADD COLUMN "preferencesInitialized" BOOLEAN NOT NULL DEFAULT false;

-- Existing non-empty settings were already user-initialized. Empty shells from
-- the former read-time upsert remain false and receive CV defaults once.
UPDATE "CareerSettings"
SET "preferencesInitialized" = true
WHERE cardinality("targetTitles") > 0
   OR cardinality("requiredSkills") > 0
   OR cardinality("domains") > 0
   OR cardinality("locations") > 0
   OR "preferredResumeId" IS NOT NULL
   OR "autoApply" = true;
