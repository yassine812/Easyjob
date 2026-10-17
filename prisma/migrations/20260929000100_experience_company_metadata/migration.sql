-- Add structured, nullable company metadata to candidate experiences.
ALTER TABLE "Experience" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Experience" ADD COLUMN "companyLogoUrl" TEXT;
ALTER TABLE "Experience" ADD COLUMN "companyWebsite" TEXT;
ALTER TABLE "Experience" ADD COLUMN "companyProvider" TEXT;
ALTER TABLE "Experience" ADD COLUMN "location" TEXT;
ALTER TABLE "Experience" ADD COLUMN "countryCode" TEXT;
