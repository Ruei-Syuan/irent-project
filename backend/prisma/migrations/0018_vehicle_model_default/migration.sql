PRAGMA foreign_keys = OFF;

CREATE TABLE "new_vehicles" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "license_plate" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT '未知車型',
  "color" TEXT NOT NULL,
  "station_id" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'available' CHECK ("status" IN ('available', 'cleaning', 'maintenance')),
  "cabin_condition" TEXT NOT NULL DEFAULT 'clean' CHECK ("cabin_condition" IN ('clean', 'average', 'dirty')),
  "today_mileage" REAL NOT NULL DEFAULT 0 CHECK ("today_mileage" >= 0),
  "latest_anomaly" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicles_station_id_fkey"
    FOREIGN KEY ("station_id") REFERENCES "stations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_vehicles" (
  "id", "license_plate", "model", "color", "station_id", "status", "cabin_condition",
  "today_mileage", "latest_anomaly", "created_at", "updated_at"
)
SELECT
  "id", "license_plate", COALESCE(NULLIF(TRIM("model"), ''), '未知車型'), "color", "station_id", "status", "cabin_condition",
  "today_mileage", "latest_anomaly", "created_at", "updated_at"
FROM "vehicles";

DROP TABLE "vehicles";
ALTER TABLE "new_vehicles" RENAME TO "vehicles";
CREATE UNIQUE INDEX "vehicles_license_plate_key" ON "vehicles"("license_plate");
CREATE INDEX "vehicles_station_id_status_idx" ON "vehicles"("station_id", "status");

CREATE TRIGGER "vehicles_model_default_after_insert"
AFTER INSERT ON "vehicles"
FOR EACH ROW
WHEN TRIM(NEW."model") = ''
BEGIN
  UPDATE "vehicles" SET "model" = '未知車型' WHERE "id" = NEW."id";
END;

PRAGMA foreign_keys = ON;