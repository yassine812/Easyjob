ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "priceTndCents" INTEGER;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "pricesJson" JSONB;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "billingCountry" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Payment_provider_providerPaymentId_idx" ON "Payment"("provider", "providerPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");

UPDATE "Plan" SET "priceTndCents" = 8900, "pricesJson" = '{"TND": 8900, "EUR": 2900, "USD": 2900}'::jsonb WHERE name = 'BUSINESS';
UPDATE "Plan" SET "priceTndCents" = 18900, "pricesJson" = '{"TND": 18900, "EUR": 9900, "USD": 9900}'::jsonb WHERE name = 'PRO';
UPDATE "Plan" SET "priceTndCents" = 49000, "pricesJson" = '{"TND": 49000, "EUR": 29900, "USD": 29900}'::jsonb WHERE name = 'ENTERPRISE';
