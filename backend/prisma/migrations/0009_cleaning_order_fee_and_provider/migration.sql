ALTER TABLE "cleaning_orders" ADD COLUMN "cleaning_fee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cleaning_orders" ADD COLUMN "cleaning_provider" TEXT NOT NULL DEFAULT 'irent_staff'
  CHECK ("cleaning_provider" IN ('external_company', 'irent_staff'));
