CREATE TABLE IF NOT EXISTS "rentals" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "vehicle_id" INTEGER NOT NULL,
  "started_at" TEXT NOT NULL,
  "ended_at" TEXT,
  "status" TEXT NOT NULL DEFAULT 'completed' CHECK ("status" IN ('active', 'completed', 'cancelled')),
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rentals_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "rentals_vehicle_id_started_at_ended_at_key"
  ON "rentals"("vehicle_id", "started_at", "ended_at");
CREATE INDEX IF NOT EXISTS "rentals_started_at_ended_at_status_idx"
  ON "rentals"("started_at", "ended_at", "status");
