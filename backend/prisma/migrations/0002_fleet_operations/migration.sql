CREATE TABLE IF NOT EXISTS "stations" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "latitude" REAL,
  "longitude" REAL,
  "station_type" TEXT NOT NULL DEFAULT 'station' CHECK ("station_type" IN ('station', 'parking')),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'inactive')),
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "vehicles" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "license_plate" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "station_id" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'available' CHECK ("status" IN ('available', 'cleaning', 'maintenance')),
  "health_score" INTEGER NOT NULL DEFAULT 100 CHECK ("health_score" BETWEEN 0 AND 100),
  "today_mileage" REAL NOT NULL DEFAULT 0 CHECK ("today_mileage" >= 0),
  "latest_anomaly" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicles_station_id_fkey"
    FOREIGN KEY ("station_id") REFERENCES "stations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ai_anomaly_alerts" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "vehicle_id" INTEGER NOT NULL,
  "anomaly_type" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL CHECK ("confidence" BETWEEN 0 AND 100),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'review', 'resolved')),
  "detected_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_anomaly_alerts_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "stations_code_key" ON "stations"("code");
CREATE INDEX IF NOT EXISTS "stations_city_district_status_idx" ON "stations"("city", "district", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_license_plate_key" ON "vehicles"("license_plate");
CREATE INDEX IF NOT EXISTS "vehicles_station_id_status_idx" ON "vehicles"("station_id", "status");
CREATE INDEX IF NOT EXISTS "ai_anomaly_alerts_vehicle_id_status_detected_at_idx"
  ON "ai_anomaly_alerts"("vehicle_id", "status", "detected_at");
