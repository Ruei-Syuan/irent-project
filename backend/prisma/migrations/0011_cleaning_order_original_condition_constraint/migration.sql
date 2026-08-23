UPDATE "cleaning_orders"
SET "original_condition" = 'dirty'
WHERE "condition" IN ('clean', 'average')
  AND "original_condition" = 'clean';

CREATE TRIGGER IF NOT EXISTS "cleaning_orders_original_condition_before_insert"
BEFORE INSERT ON "cleaning_orders"
WHEN NEW."condition" IN ('clean', 'average')
  AND NEW."original_condition" = 'clean'
BEGIN
  SELECT RAISE(ABORT, '已清潔或清潔中的工單原始狀況只能是普通或髒污');
END;

CREATE TRIGGER IF NOT EXISTS "cleaning_orders_original_condition_before_update"
BEFORE UPDATE OF "condition", "original_condition" ON "cleaning_orders"
WHEN NEW."condition" IN ('clean', 'average')
  AND NEW."original_condition" = 'clean'
BEGIN
  SELECT RAISE(ABORT, '已清潔或清潔中的工單原始狀況只能是普通或髒污');
END;
