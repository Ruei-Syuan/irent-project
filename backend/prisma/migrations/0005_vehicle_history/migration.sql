CREATE TABLE IF NOT EXISTS "customers" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "member_no" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "customers_member_no_key"
  ON "customers"("member_no");

ALTER TABLE "rentals"
  ADD COLUMN "customer_id" INTEGER REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rentals"
  ADD COLUMN "rental_fee" INTEGER NOT NULL DEFAULT 0 CHECK ("rental_fee" >= 0);

CREATE INDEX IF NOT EXISTS "rentals_customer_id_idx"
  ON "rentals"("customer_id");

CREATE TABLE IF NOT EXISTS "vehicle_service_records" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "vehicle_id" INTEGER NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('cleaning', 'maintenance')),
  "performed_at" TEXT NOT NULL,
  "cost" INTEGER NOT NULL DEFAULT 0 CHECK ("cost" >= 0),
  "note" TEXT NOT NULL DEFAULT '',
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_service_records_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_service_records_vehicle_id_type_performed_at_key"
  ON "vehicle_service_records"("vehicle_id", "type", "performed_at");
CREATE INDEX IF NOT EXISTS "vehicle_service_records_vehicle_id_performed_at_idx"
  ON "vehicle_service_records"("vehicle_id", "performed_at");
