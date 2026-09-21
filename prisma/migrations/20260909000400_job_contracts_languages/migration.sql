ALTER TABLE "Job" ADD COLUMN "contractType" TEXT;
ALTER TABLE "Job" ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CareerSettings" ADD COLUMN "contractTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Job_contractType_status_idx" ON "Job"("contractType", "status");
