-- AlterTable
ALTER TABLE "AggregatedJob" ADD COLUMN     "sourceCompanyId" TEXT;


-- CreateTable
CREATE TABLE "SourceCompany" (
    "id" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceCompany_identityKey_key" ON "SourceCompany"("identityKey");

-- AddForeignKey
ALTER TABLE "AggregatedJob" ADD CONSTRAINT "AggregatedJob_sourceCompanyId_fkey" FOREIGN KEY ("sourceCompanyId") REFERENCES "SourceCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
