import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  anomalySeeds,
  createCleaningOrderSeeds,
  createRentalSeeds,
  createAdditionalRepairOrderSeeds,
  createLastMonthRepairOrderSeeds,
  createRepairOrderSeeds,
  createServiceSeeds,
  customerSeeds,
  stationSeeds,
  vehicleSeeds
} from '../data/operations-seed.js';
import { hashPassword } from './auth.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrations = [
  {
    table: 'users',
    path: path.join(backendRoot, 'prisma', 'migrations', '0001_init', 'migration.sql')
  },
  {
    table: 'stations',
    path: path.join(backendRoot, 'prisma', 'migrations', '0002_fleet_operations', 'migration.sql')
  },
  {
    table: 'rentals',
    path: path.join(backendRoot, 'prisma', 'migrations', '0003_rentals', 'migration.sql')
  },
  {
    table: 'vehicles',
    column: 'cabin_condition',
    path: path.join(backendRoot, 'prisma', 'migrations', '0004_vehicle_cabin_condition', 'migration.sql')
  },
  {
    table: 'vehicle_service_records',
    path: path.join(backendRoot, 'prisma', 'migrations', '0005_vehicle_history', 'migration.sql')
  },
  {
    table: 'repair_orders',
    path: path.join(backendRoot, 'prisma', 'migrations', '0006_repair_orders', 'migration.sql')
  },
  {
    table: 'cleaning_orders',
    path: path.join(backendRoot, 'prisma', 'migrations', '0007_cleaning_orders', 'migration.sql')
  },
  {
    table: 'vehicles',
    removedColumn: 'health_score',
    path: path.join(backendRoot, 'prisma', 'migrations', '0008_remove_vehicle_health_score', 'migration.sql')
  },
  {
    table: 'cleaning_orders',
    column: 'cleaning_fee',
    path: path.join(backendRoot, 'prisma', 'migrations', '0009_cleaning_order_fee_and_provider', 'migration.sql')
  },
  {
    table: 'cleaning_orders',
    column: 'original_condition',
    path: path.join(backendRoot, 'prisma', 'migrations', '0010_cleaning_order_original_condition', 'migration.sql')
  },
  {
    table: 'cleaning_orders',
    trigger: 'cleaning_orders_original_condition_before_update',
    path: path.join(backendRoot, 'prisma', 'migrations', '0011_cleaning_order_original_condition_constraint', 'migration.sql')
  },
  {
    table: 'cleaning_orders',
    trigger: 'cleaning_orders_dirty_original_before_update',
    path: path.join(backendRoot, 'prisma', 'migrations', '0012_cleaning_order_dirty_original_constraint', 'migration.sql')
  },
  {
    table: 'cleaning_orders',
    trigger: 'cleaning_orders_dispatch_status_before_update',
    path: path.join(backendRoot, 'prisma', 'migrations', '0013_cleaning_order_dispatch_status', 'migration.sql')
  },
  {
    table: 'repair_orders',
    trigger: 'repair_orders_status_before_update',
    path: path.join(backendRoot, 'prisma', 'migrations', '0014_repair_order_dispatch_status', 'migration.sql')
  },
  {
    table: 'damage_annotations',
    path: path.join(backendRoot, 'prisma', 'migrations', '0015_damage_annotations', 'migration.sql')
  }
];

const permissionModules = [
  ['dashboard', '儀表板', ['view']],
  ['fleet', '車隊管理', ['view', 'create', 'edit', 'delete', 'export']],
  ['damage', '車損審核', ['view', 'review', 'export']],
  ['dispatch', '調度管理', ['view', 'create', 'edit', 'delete']],
  ['work_orders', '工單管理', ['view', 'create', 'edit', 'delete', 'approve', 'export']],
  // 報表分析暫時停用：['reports', '報表中心', ['view', 'export']],
  ['permissions', '權限設定', ['view', 'manage']],
  ['users', '帳號管理', ['view', 'create', 'edit', 'delete']],
  ['audit', '稽核紀錄', ['view', 'export']],
  ['departments', '部門管理', ['view', 'manage']]
];

const actionLabels = {
  view: '檢視',
  create: '新增',
  edit: '編輯',
  delete: '刪除',
  approve: '核准',
  review: '審核',
  export: '匯出',
  manage: '管理'
};

function databasePath(databaseUrl) {
  const value = String(databaseUrl).replace(/^file:/, '');
  if (!value || value === ':memory:') return value;
  return path.isAbsolute(value) ? value : path.resolve(backendRoot, value);
}

function bootstrapAdmin(database, options) {
  const existingUsers = database.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (existingUsers > 0) return false;

  const password = options.adminPassword ?? process.env.INITIAL_ADMIN_PASSWORD;
  const employeeNo = String(options.adminEmployeeNo ?? process.env.INITIAL_ADMIN_EMPLOYEE_NO ?? 'ADM001')
    .trim()
    .toUpperCase();
  const name = String(options.adminName ?? process.env.INITIAL_ADMIN_NAME ?? 'System Administrator').trim();
  if (!password || String(password).length < 8) {
    throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 8 characters for an empty database');
  }
  if (!/^[A-Z]{3}\d{3}$/.test(employeeNo) || !name) {
    throw new Error('Initial administrator data is invalid');
  }

  const seed = database.transaction(() => {
    database.prepare(`
      INSERT OR IGNORE INTO departments (name, description)
      VALUES ('系統管理部', '系統初始化建立')
    `).run();
    database.prepare(`
      INSERT OR IGNORE INTO roles (name, description, is_system)
      VALUES ('系統管理員', '系統最高權限角色', 1)
    `).run();

    const insertPermission = database.prepare(`
      INSERT OR IGNORE INTO permissions (code, module, module_label, action, action_label)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const [module, moduleLabel, actions] of permissionModules) {
      for (const action of actions) {
        insertPermission.run(`${module}.${action}`, module, moduleLabel, action, actionLabels[action]);
      }
    }

    const roleId = database.prepare("SELECT id FROM roles WHERE name = '系統管理員'").get().id;
    const departmentId = database.prepare("SELECT id FROM departments WHERE name = '系統管理部'").get().id;
    database.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      SELECT ?, id FROM permissions
    `).run(roleId);
    database.prepare(`
      INSERT INTO users (employee_no, name, password_hash, role_id, department_id, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(employeeNo, name, hashPassword(String(password)), roleId, departmentId);
  });

  seed();
  return true;
}

function seedOperations(database) {
  const insertStation = database.prepare(`
    INSERT OR IGNORE INTO stations
      (code, name, city, district, address, latitude, longitude, station_type, status)
    VALUES
      (@code, @name, @city, @district, @address, @latitude, @longitude, @stationType, 'active')
  `);
  const updateStationCoordinates = database.prepare(`
    UPDATE stations
    SET latitude = @latitude, longitude = @longitude
    WHERE code = @code
      AND @latitude IS NOT NULL
      AND @longitude IS NOT NULL
      AND (latitude IS NULL OR longitude IS NULL)
  `);
  const findStation = database.prepare('SELECT id FROM stations WHERE code = ?');
  const insertVehicle = database.prepare(`
    INSERT OR IGNORE INTO vehicles
      (license_plate, model, color, station_id, status, cabin_condition, today_mileage, latest_anomaly)
    VALUES
      (@licensePlate, @model, @color, @stationId, @status, @cabinCondition, @todayMileage, @latestAnomaly)
  `);
  const findVehicle = database.prepare('SELECT id FROM vehicles WHERE license_plate = ?');
  const findAlert = database.prepare(`
    SELECT id FROM ai_anomaly_alerts
    WHERE vehicle_id = ? AND anomaly_type = ? AND detected_at = ?
  `);
  const insertAlert = database.prepare(`
    INSERT INTO ai_anomaly_alerts
      (vehicle_id, anomaly_type, confidence, status, detected_at)
    VALUES
      (@vehicleId, @anomalyType, @confidence, @status, @detectedAt)
  `);
  const insertRental = database.prepare(`
    INSERT OR IGNORE INTO rentals
      (vehicle_id, customer_id, started_at, ended_at, status, rental_fee)
    VALUES
      (@vehicleId, @customerId, @startedAt, @endedAt, @status, @rentalFee)
  `);
  const insertCustomer = database.prepare(`
    INSERT OR IGNORE INTO customers (member_no, full_name, phone)
    VALUES (@memberNo, @fullName, @phone)
  `);
  const findCustomer = database.prepare('SELECT id FROM customers WHERE member_no = ?');
  const updateRentalHistory = database.prepare(`
    UPDATE rentals
    SET customer_id = @customerId,
        rental_fee = CASE WHEN rental_fee = 0 THEN @rentalFee ELSE rental_fee END
    WHERE id = @id AND customer_id IS NULL
  `);
  const insertServiceRecord = database.prepare(`
    INSERT OR IGNORE INTO vehicle_service_records
      (vehicle_id, type, performed_at, cost, note)
    VALUES
      (@vehicleId, @type, @performedAt, @cost, @note)
  `);
  const insertRepairOrder = database.prepare(`
    INSERT OR IGNORE INTO repair_orders
      (repair_center, order_number, vehicle_license_plate, maintenance_item, status, assigned_manager_id, estimated_cost, actual_cost, completed_at)
    VALUES
      (@repairCenter, @orderNumber, @licensePlate, @maintenanceItem, @status, @assignedManagerId, @estimatedCost, @actualCost, @completedAt)
  `);
  const insertCleaningOrder = database.prepare(`
    INSERT OR IGNORE INTO cleaning_orders
      (order_number, vehicle_license_plate, condition, dispatch_status, original_condition, cleaning_fee, cleaning_provider, note, created_at, updated_at)
    VALUES
      (@orderNumber, @licensePlate, @condition, @dispatchStatus, @originalCondition, @cleaningFee, @cleaningProvider, @note, @createdAt, @updatedAt)
  `);
  const repairCompletedCosts = database.prepare(`
    UPDATE repair_orders
    SET actual_cost = estimated_cost
    WHERE status = '維修完畢' AND actual_cost IS NULL
  `);
  const findManager = database.prepare('SELECT id FROM users WHERE email = @email LIMIT 1');

  const seed = database.transaction(() => {
    const created = {
      stations: 0,
      vehicles: 0,
      anomalyAlerts: 0,
      customers: 0,
      rentals: 0,
      serviceRecords: 0,
      cleaningOrders: 0,
      repairOrders: 0
    };

    for (const station of stationSeeds) {
      created.stations += insertStation.run(station).changes;
      updateStationCoordinates.run(station);
    }

    for (const vehicle of vehicleSeeds) {
      const station = findStation.get(vehicle.stationCode);
      if (!station) throw new Error(`Station seed not found: ${vehicle.stationCode}`);
      created.vehicles += insertVehicle.run({ ...vehicle, stationId: station.id }).changes;
    }
    for (const alert of anomalySeeds) {
      const vehicle = findVehicle.get(alert.licensePlate);
      if (!vehicle) throw new Error(`Vehicle seed not found: ${alert.licensePlate}`);
      if (findAlert.get(vehicle.id, alert.anomalyType, alert.detectedAt)) continue;
      created.anomalyAlerts += insertAlert.run({ ...alert, vehicleId: vehicle.id }).changes;
    }

    for (const customer of customerSeeds) {
      created.customers += insertCustomer.run(customer).changes;
    }

    const rentalCount = database.prepare('SELECT COUNT(*) AS count FROM rentals').get().count;
    if (rentalCount === 0) {
      for (const rental of createRentalSeeds()) {
        const vehicle = findVehicle.get(rental.licensePlate);
        const customer = findCustomer.get(rental.customerMemberNo);
        if (!vehicle) throw new Error(`Vehicle seed not found: ${rental.licensePlate}`);
        if (!customer) throw new Error(`Customer seed not found: ${rental.customerMemberNo}`);
        created.rentals += insertRental.run({
          ...rental,
          vehicleId: vehicle.id,
          customerId: customer.id
        }).changes;
      }
    } else {
      const rentals = database.prepare('SELECT id FROM rentals ORDER BY id').all();
      rentals.forEach((rental, index) => {
        const customer = findCustomer.get(customerSeeds[index % customerSeeds.length].memberNo);
        updateRentalHistory.run({
          id: rental.id,
          customerId: customer.id,
          rentalFee: 780 + index % 8 * 120
        });
      });
    }

    for (const record of createServiceSeeds()) {
      const vehicle = findVehicle.get(record.licensePlate);
      if (!vehicle) throw new Error(`Vehicle seed not found: ${record.licensePlate}`);
      created.serviceRecords += insertServiceRecord.run({
        ...record,
        vehicleId: vehicle.id
      }).changes;
    }

    for (const order of createCleaningOrderSeeds()) {
      const vehicle = findVehicle.get(order.licensePlate);
      if (!vehicle) throw new Error(`Cleaning order vehicle seed not found: ${order.licensePlate}`);
      created.cleaningOrders += insertCleaningOrder.run(order).changes;
    }

    for (const order of [...createRepairOrderSeeds(), ...createAdditionalRepairOrderSeeds(), ...createLastMonthRepairOrderSeeds()]) {
      const vehicle = findVehicle.get(order.licensePlate);
      if (!vehicle) throw new Error(`Repair order vehicle seed not found: ${order.licensePlate}`);
      const manager = findManager.get({ email: order.managerEmail ?? 'adm001@irent.example.tw' });
      created.repairOrders += insertRepairOrder.run({
        ...order,
        assignedManagerId: manager?.id ?? null
      }).changes;
    }
    repairCompletedCosts.run();

    return created;
  });

  return seed();
}

export async function initializeDatabase(options = {}) {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL ?? 'file:../data/irent.sqlite';
  const filename = databasePath(databaseUrl);
  const database = new Database(filename);

  try {
    database.pragma('foreign_keys = ON');
    const hasTable = database.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
    `);
    const hasTrigger = database.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?
    `);
    const migrationsApplied = [];
    for (const migration of migrations) {
      const columns = database.prepare(`PRAGMA table_info("${migration.table}")`).all();
      const alreadyApplied = migration.trigger
        ? Boolean(hasTrigger.get(migration.trigger))
        : migration.column
        ? columns.some(column => column.name === migration.column)
        : migration.removedColumn
          ? !columns.some(column => column.name === migration.removedColumn)
          : Boolean(hasTable.get(migration.table));
      if (alreadyApplied) continue;
      database.exec(await readFile(migration.path, 'utf8'));
      migrationsApplied.push(path.basename(path.dirname(migration.path)));
    }
    return {
      migrationsApplied,
      adminCreated: bootstrapAdmin(database, options),
      operationsSeeded: seedOperations(database)
    };
  } finally {
    database.close();
  }
}
