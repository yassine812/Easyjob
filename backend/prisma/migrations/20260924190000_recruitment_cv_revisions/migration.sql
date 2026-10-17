ALTER TABLE "CvDraft" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "language" TEXT NOT NULL DEFAULT 'fr', ADD COLUMN "targetRole" TEXT;
CREATE TABLE "CvDraftRevision" (
 "id" TEXT NOT NULL PRIMARY KEY, "draftId" TEXT NOT NULL, "version" INTEGER NOT NULL,
 "content" TEXT NOT NULL, "title" TEXT NOT NULL, "template" TEXT NOT NULL, "fontSize" INTEGER NOT NULL,
 "report" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CvDraftRevision_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CvDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CvDraftRevision_draftId_version_key" ON "CvDraftRevision"("draftId", "version");
