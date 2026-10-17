-- Automatic payment invoices with immutable plan/customer snapshots.
CREATE TYPE "InvoiceStatus" AS ENUM ('PAID', 'VOID');

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "ownerType" "PlanType" NOT NULL,
    "companyId" TEXT,
    "candidateId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "planName" TEXT NOT NULL,
    "planPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "billingInterval" "BillingInterval" NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "subtotalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PAID',
    "providerReference" TEXT,
    "pdfKey" TEXT,
    "docxKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceSequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "year" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "Invoice"("paymentId");
CREATE INDEX "Invoice_subscriptionId_createdAt_idx" ON "Invoice"("subscriptionId", "createdAt");
CREATE INDEX "Invoice_companyId_createdAt_idx" ON "Invoice"("companyId", "createdAt");
CREATE INDEX "Invoice_candidateId_createdAt_idx" ON "Invoice"("candidateId", "createdAt");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
