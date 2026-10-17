ALTER TABLE "Application"
  ADD COLUMN "alignmentOverrideById" TEXT,
  ADD COLUMN "alignmentOverriddenAt" TIMESTAMP(3),
  ADD COLUMN "alignmentOverrideReason" TEXT;

CREATE INDEX "Application_alignmentOverrideById_idx" ON "Application"("alignmentOverrideById");

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_alignmentOverrideById_fkey"
  FOREIGN KEY ("alignmentOverrideById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;