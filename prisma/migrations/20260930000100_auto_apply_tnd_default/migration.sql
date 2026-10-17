UPDATE "CareerSettings" SET "salaryCurrency" = 'TND' WHERE "salaryCurrency" IS NULL OR "salaryCurrency" <> 'TND';
ALTER TABLE "CareerSettings" ALTER COLUMN "salaryCurrency" SET DEFAULT 'TND';
ALTER TABLE "CareerSettings" ADD COLUMN "maximumSalary" INTEGER;
