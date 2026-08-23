ALTER TABLE "cleaning_orders" ADD COLUMN "original_condition" TEXT NOT NULL DEFAULT 'dirty'
  CHECK ("original_condition" IN ('dirty', 'average', 'clean'));

UPDATE "cleaning_orders"
SET "original_condition" = "condition"
WHERE "condition" IN ('dirty', 'average', 'clean');
