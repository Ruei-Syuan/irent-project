CREATE TABLE "damage_annotations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "case_id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "image_side" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "yolo_coordinates" TEXT NOT NULL,
    "created_by_id" INTEGER,
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "damage_annotations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "damage_annotations_case_id_image_side_idx" ON "damage_annotations"("case_id", "image_side");
CREATE INDEX "damage_annotations_plate_number_created_at_idx" ON "damage_annotations"("plate_number", "created_at");
