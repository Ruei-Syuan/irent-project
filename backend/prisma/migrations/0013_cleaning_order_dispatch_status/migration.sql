ALTER TABLE "cleaning_orders"
  ADD COLUMN "dispatch_status" TEXT NOT NULL DEFAULT 'assigned'
  CHECK ("dispatch_status" IN ('unassigned', 'assigned'));

CREATE INDEX IF NOT EXISTS "cleaning_orders_dispatch_status_created_at_idx"
  ON "cleaning_orders"("dispatch_status", "created_at");

UPDATE "cleaning_orders"
SET "dispatch_status" = 'unassigned'
WHERE "order_number" IN ('CO-260823-001', 'CO-260823-006', 'CO-260823-011');

CREATE TRIGGER IF NOT EXISTS "cleaning_orders_dispatch_status_before_insert"
BEFORE INSERT ON "cleaning_orders"
WHEN NEW."dispatch_status" NOT IN ('unassigned', 'assigned')
BEGIN
  SELECT RAISE(ABORT, 'invalid cleaning dispatch status');
END;

CREATE TRIGGER IF NOT EXISTS "cleaning_orders_dispatch_status_before_update"
BEFORE UPDATE OF "dispatch_status" ON "cleaning_orders"
WHEN NEW."dispatch_status" NOT IN ('unassigned', 'assigned')
BEGIN
  SELECT RAISE(ABORT, 'invalid cleaning dispatch status');
END;
