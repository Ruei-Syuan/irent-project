UPDATE "cleaning_orders"
SET "cleaning_provider" = 'external_company',
    "cleaning_fee" = CASE WHEN "cleaning_fee" <= 0 THEN 500 ELSE "cleaning_fee" END
WHERE "original_condition" = 'dirty';

CREATE TRIGGER IF NOT EXISTS "cleaning_orders_dirty_original_before_insert"
BEFORE INSERT ON "cleaning_orders"
WHEN NEW."original_condition" = 'dirty'
  AND (NEW."cleaning_provider" <> 'external_company' OR NEW."cleaning_fee" <= 0)
BEGIN
  SELECT RAISE(ABORT, '原始狀況為髒污時，必須由外部清潔公司處理並填寫清潔費用');
END;

CREATE TRIGGER IF NOT EXISTS "cleaning_orders_dirty_original_before_update"
BEFORE UPDATE OF "original_condition", "cleaning_provider", "cleaning_fee" ON "cleaning_orders"
WHEN NEW."original_condition" = 'dirty'
  AND (NEW."cleaning_provider" <> 'external_company' OR NEW."cleaning_fee" <= 0)
BEGIN
  SELECT RAISE(ABORT, '原始狀況為髒污時，必須由外部清潔公司處理並填寫清潔費用');
END;
