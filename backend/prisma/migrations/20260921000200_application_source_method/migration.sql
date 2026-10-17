-- Record the source and method for native EasyJob submissions. External-only
-- preparations stay in ExternalApplicationPreparation until the source confirms submission.
ALTER TABLE "Application"
  ADD COLUMN "sourceType" "JobSourceType" NOT NULL DEFAULT 'COMPANY_DIRECT',
  ADD COLUMN "applicationMethod" "SourceApplicationMethod" NOT NULL DEFAULT 'NATIVE_EASYJOB';
