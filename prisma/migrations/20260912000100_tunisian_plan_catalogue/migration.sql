-- Catalogue denomination, not an exchange-rate conversion. The original
-- commercial amounts (9.99 / 19.99 etc.) are now priced in Tunisian dinars.
-- EasyJob's legacy *Cents fields remain hundredths of the named currency.
-- The Konnect adapter alone converts hundredths into millimes.
-- Only the unchanged bundled USD catalogue is migrated. Custom plans/prices
-- and every historical Payment row are deliberately preserved.
WITH catalogue("name", "type", "price") AS (VALUES
  ('FREE', 'CANDIDATE', 0), ('PRO', 'CANDIDATE', 999),
  ('CAREER_AI', 'CANDIDATE', 1999), ('TRIAL', 'COMPANY', 0),
  ('BUSINESS', 'COMPANY', 4900), ('PRO', 'COMPANY', 9900),
  ('ENTERPRISE', 'COMPANY', 29900)
)
UPDATE "Plan" p
SET "currency" = 'TND',
    "priceCents" = COALESCE(p."priceTndCents", p."priceCents"),
    "priceTndCents" = COALESCE(p."priceTndCents", p."priceCents"),
    "updatedAt" = CURRENT_TIMESTAMP
FROM catalogue c
WHERE p."name" = c."name" AND p."type"::text = c."type"
  AND p."currency" = 'USD' AND p."priceCents" = c."price";

ALTER TABLE "Plan" ALTER COLUMN "currency" SET DEFAULT 'TND';
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'TND';
