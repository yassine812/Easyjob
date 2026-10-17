CREATE TABLE "ExternalResearchCache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "queryType" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalResearchCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalResearchCache_key_key" ON "ExternalResearchCache"("key");
CREATE INDEX "ExternalResearchCache_queryType_normalizedQuery_idx" ON "ExternalResearchCache"("queryType", "normalizedQuery");
CREATE INDEX "ExternalResearchCache_expiresAt_idx" ON "ExternalResearchCache"("expiresAt");
