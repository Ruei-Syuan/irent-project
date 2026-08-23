CREATE TABLE IF NOT EXISTS "cleaning_orders" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "order_number" TEXT NOT NULL,
  "vehicle_license_plate" TEXT NOT NULL,
  "condition" TEXT NOT NULL CHECK ("condition" IN ('dirty', 'average', 'clean')),
  "note" TEXT NOT NULL DEFAULT '',
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cleaning_orders_vehicle_license_plate_fkey"
    FOREIGN KEY ("vehicle_license_plate") REFERENCES "vehicles" ("license_plate")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "cleaning_orders_order_number_key"
  ON "cleaning_orders"("order_number");
CREATE INDEX IF NOT EXISTS "cleaning_orders_vehicle_license_plate_created_at_idx"
  ON "cleaning_orders"("vehicle_license_plate", "created_at");
CREATE INDEX IF NOT EXISTS "cleaning_orders_condition_created_at_idx"
  ON "cleaning_orders"("condition", "created_at");
