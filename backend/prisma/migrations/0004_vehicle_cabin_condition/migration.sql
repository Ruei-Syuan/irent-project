ALTER TABLE "vehicles"
  ADD COLUMN "cabin_condition" TEXT NOT NULL DEFAULT 'clean'
  CHECK ("cabin_condition" IN ('clean', 'average', 'dirty'));

UPDATE "vehicles"
SET "cabin_condition" = CASE
  WHEN "status" = 'cleaning' THEN 'dirty'
  WHEN "id" % 3 = 0 THEN 'average'
  ELSE 'clean'
END;
