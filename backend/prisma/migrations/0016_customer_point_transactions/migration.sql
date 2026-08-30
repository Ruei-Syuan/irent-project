CREATE TABLE "customer_point_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL CHECK ("points" <> 0),
    "balance_after" INTEGER NOT NULL CHECK ("balance_after" >= 0),
    "type" TEXT NOT NULL CHECK ("type" IN ('earn', 'redeem', 'adjustment')),
    "reason" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_point_transactions_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "customer_point_transactions_customer_id_id_idx"
  ON "customer_point_transactions"("customer_id", "id");

INSERT OR IGNORE INTO permissions (code, module, module_label, action, action_label)
VALUES ('points.view', 'points', char(31309, 20998, 31649, 29702), 'view', char(26597, 30475));

INSERT OR IGNORE INTO permissions (code, module, module_label, action, action_label)
VALUES ('points.create', 'points', char(31309, 20998, 31649, 29702), 'create', char(26032, 22686));

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.code IN ('points.view', 'points.create')
WHERE roles.is_system = 1;
