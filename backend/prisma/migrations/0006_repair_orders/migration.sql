CREATE TABLE IF NOT EXISTS "repair_orders" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "repair_center" TEXT NOT NULL,
  "order_number" TEXT NOT NULL,
  "vehicle_license_plate" TEXT NOT NULL,
  "maintenance_item" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('待驗收', '維修中', '維修完畢')),
  "assigned_manager_id" INTEGER,
  "estimated_cost" INTEGER NOT NULL DEFAULT 0 CHECK ("estimated_cost" >= 0),
  "actual_cost" INTEGER CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0),
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TEXT,
  CONSTRAINT "repair_orders_vehicle_license_plate_fkey"
    FOREIGN KEY ("vehicle_license_plate") REFERENCES "vehicles" ("license_plate") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "repair_orders_assigned_manager_id_fkey"
    FOREIGN KEY ("assigned_manager_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "repair_orders_order_number_key"
  ON "repair_orders"("order_number");
CREATE INDEX IF NOT EXISTS "repair_orders_vehicle_license_plate_status_created_at_idx"
  ON "repair_orders"("vehicle_license_plate", "status", "created_at");
CREATE INDEX IF NOT EXISTS "repair_orders_assigned_manager_id_status_idx"
  ON "repair_orders"("assigned_manager_id", "status");
