import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { anomalySeeds, stationSeeds, vehicleSeeds } from '../data/operations-seed.js';
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
  }
];

const permissionModules = [
  ['dashboard', '儀表板', ['view']],
  ['fleet', '車隊管理', ['view', 'create', 'edit', 'delete', 'export']],
  ['damage', '車損審核', ['view', 'review', 'export']],
  ['dispatch', '調度管理', ['view', 'create', 'edit', 'delete']],
  ['work_orders', '工單管理', ['view', 'create', 'edit', 'delete', 'approve', 'export']],
  ['reports', '報表中心', ['view', 'export']],
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
      (code, name, city, district, address, station_type, status)
    VALUES
      (@code, @name, @city, @district, @address, @stationType, 'active')
  `);
  const findStation = database.prepare('SELECT id FROM stations WHERE code = ?');
  const insertVehicle = database.prepare(`
    INSERT OR IGNORE INTO vehicles
      (license_plate, model, color, station_id, status, health_score, today_mileage, latest_anomaly)
    VALUES
      (@licensePlate, @model, @color, @stationId, @status, @healthScore, @todayMileage, @latestAnomaly)
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

  const seed = database.transaction(() => {
    const created = { stations: 0, vehicles: 0, anomalyAlerts: 0 };

    for (const station of stationSeeds) {
      created.stations += insertStation.run(station).changes;
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
    const migrationsApplied = [];
    for (const migration of migrations) {
      if (hasTable.get(migration.table)) continue;
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
