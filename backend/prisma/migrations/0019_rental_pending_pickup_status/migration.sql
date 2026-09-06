PRAGMA foreign_keys = OFF;

CREATE TABLE "new_rentals" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "vehicle_id" INTEGER NOT NULL,
  "customer_id" INTEGER,
  "started_at" TEXT NOT NULL,
  "ended_at" TEXT,
  "status" TEXT NOT NULL DEFAULT 'completed' CHECK ("status" IN ('pending_pickup', 'active', 'completed', 'cancelled')),
  "rental_fee" INTEGER NOT NULL DEFAULT 0 CHECK ("rental_fee" >= 0),
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rentals_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rentals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_rentals" (
  "id", "vehicle_id", "customer_id", "started_at", "ended_at", "status", "rental_fee", "created_at", "updated_at"
)
SELECT
  "id", "vehicle_id", "customer_id", "started_at", "ended_at", "status", "rental_fee", "created_at", "updated_at"
FROM "rentals";

DROP TABLE "rentals";
ALTER TABLE "new_rentals" RENAME TO "rentals";
CREATE UNIQUE INDEX "rentals_vehicle_id_started_at_ended_at_key" ON "rentals" ("vehicle_id", "started_at", "ended_at");
CREATE INDEX "rentals_started_at_ended_at_status_idx" ON "rentals" ("started_at", "ended_at", "status");
CREATE INDEX "rentals_customer_id_idx" ON "rentals" ("customer_id");

CREATE TRIGGER "rentals_status_pending_pickup_guard"
BEFORE INSERT ON "rentals"
FOR EACH ROW
WHEN NEW."status" NOT IN ('pending_pickup', 'active', 'completed', 'cancelled')
BEGIN
  SELECT RAISE(ABORT, 'invalid rental status');
END;

PRAGMA foreign_keys = ON;
