ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "baseAmountTndCents" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentAmountMinor" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerExchangeRate" DECIMAL(20,10);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerConvertedAmount" INTEGER;

UPDATE "Payment"
SET "paymentAmountMinor" = "amountCents"
WHERE "paymentAmountMinor" IS NULL;
