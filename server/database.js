'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_DATABASE_PATH = path.join(__dirname, '..', 'data', 'irent.sqlite');
const SESSION_HOURS = 8;

const departments = [
  ['資訊安全處', '負責系統、帳號與資安治理'],
  ['營運管理處', '負責全台車隊營運與服務品質'],
  ['車隊管理部', '負責車輛調度與站點配置'],
  ['事故理賠部', '負責車損審核與理賠案件'],
  ['維修保養部', '負責維修工單與供應商協作'],
  ['客戶服務部', '負責會員服務與客訴處理']
];

const roles = [
  ['系統管理員', '完整管理系統、帳號與權限'],
  ['營運主管', '檢視全台營運並管理車隊作業'],
  ['調度主管', '管理車輛調度與清潔維修派工'],
  ['車隊管理員', '維護車輛與站點資料'],
  ['車損審核員', '審核 AI 車損案件與補件'],
  ['維修專員', '管理維修工單與驗收進度'],
  ['報表分析員', '檢視與匯出營運報表'],
  ['客服主管', '檢視營運資訊並協助案件追蹤'],
  ['稽核人員', '唯讀檢視權限與操作紀錄'],
  ['外部協力廠商', '僅檢視受派維修工單']
];

const moduleDefinitions = [
  ['dashboard', '營運總覽', ['view']],
  ['fleet', '車隊管理', ['view', 'create', 'edit', 'delete', 'export']],
  ['damage', 'AI 車損案件', ['view', 'review', 'export']],
  ['dispatch', '清潔維修派工', ['view', 'create', 'edit', 'delete']],
  ['work_orders', '維修工單', ['view', 'create', 'edit', 'delete', 'approve', 'export']],
  ['reports', '報表分析', ['view', 'export']],
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

const users = [
  ['ADM001', 'Celine Yang', '系統管理員', '資訊安全處', 'active'],
  ['OPS101', '林芷晴', '營運主管', '營運管理處', 'active'],
  ['DSP208', '陳柏宇', '調度主管', '車隊管理部', 'active'],
  ['FLT315', '張雅雯', '車隊管理員', '車隊管理部', 'active'],
  ['DMG422', '李承翰', '車損審核員', '事故理賠部', 'active'],
  ['MNT536', '黃筱涵', '維修專員', '維修保養部', 'active'],
  ['RPT607', '吳俊傑', '報表分析員', '營運管理處', 'active'],
  ['CSV718', '蔡佩珊', '客服主管', '客戶服務部', 'active'],
  ['AUD829', '許家豪', '稽核人員', '資訊安全處', 'active'],
  ['VND930', '鄭美玲', '外部協力廠商', '維修保養部', 'suspended']
];

const rolePermissionMap = {
  系統管理員: ['*'],
  營運主管: [
    'dashboard.view', 'fleet.view', 'fleet.create', 'fleet.edit', 'fleet.export',
    'damage.view', 'damage.review', 'dispatch.view', 'dispatch.create', 'dispatch.edit',
    'work_orders.view', 'work_orders.create', 'work_orders.edit', 'work_orders.approve',
    'reports.view', 'reports.export', 'users.view', 'audit.view'
  ],
  調度主管: [
    'dashboard.view', 'fleet.view', 'fleet.edit', 'damage.view', 'dispatch.view',
    'dispatch.create', 'dispatch.edit', 'dispatch.delete', 'work_orders.view', 'work_orders.create'
  ],
  車隊管理員: [
    'dashboard.view', 'fleet.view', 'fleet.create', 'fleet.edit', 'fleet.export',
    'dispatch.view', 'work_orders.view'
  ],
  車損審核員: ['dashboard.view', 'fleet.view', 'damage.view', 'damage.review', 'damage.export', 'work_orders.view'],
  維修專員: ['dashboard.view', 'fleet.view', 'dispatch.view', 'work_orders.view', 'work_orders.create', 'work_orders.edit', 'work_orders.approve'],
  報表分析員: ['dashboard.view', 'fleet.view', 'damage.view', 'dispatch.view', 'work_orders.view', 'reports.view', 'reports.export'],
  客服主管: ['dashboard.view', 'fleet.view', 'damage.view', 'dispatch.view', 'work_orders.view', 'reports.view'],
  稽核人員: ['dashboard.view', 'permissions.view', 'users.view', 'audit.view', 'audit.export', 'reports.view'],
  外部協力廠商: ['work_orders.view', 'work_orders.edit']
};

const auditLogs = [
  ['ADM001', 'auth.login', 'session', null, '王立安登入管理後台', '10.24.8.16', '2026-08-12 13:42:00'],
  ['ADM001', 'role.permission.update', 'role', '2', '調整營運主管的報表匯出權限', '10.24.8.16', '2026-08-12 13:31:00'],
  ['DMG422', 'damage.review', 'damage_case', 'DMG-260809-018', '李承翰確認新增車損案件', '10.18.4.22', '2026-08-12 13:18:00'],
  ['DSP208', 'dispatch.assign', 'dispatch', 'DSP-0812-047', '陳柏宇指派台北站清潔任務', '10.16.2.31', '2026-08-12 12:56:00'],
  ['MNT536', 'work_order.approve', 'work_order', 'WO-260812-031', '黃筱涵完成維修工單驗收', '10.20.5.44', '2026-08-12 12:20:00'],
  ['ADM001', 'user.create', 'user', 'VND930', '新增外部協力廠商帳號', '10.24.8.16', '2026-08-12 12:00:00'],
  ['FLT315', 'fleet.update', 'vehicle', 'RAC-4582', '張雅雯更新車輛停放站點', '10.12.3.18', '2026-08-12 11:42:00'],
  ['RPT607', 'report.export', 'report', 'weekly-2026-32', '吳俊傑匯出第 32 週營運報表', '10.22.7.09', '2026-08-12 11:15:00'],
  ['CSV718', 'case.view', 'damage_case', 'DMG-260809-016', '蔡佩珊檢視會員申訴案件', '10.19.6.27', '2026-08-12 10:48:00'],
  ['AUD829', 'audit.export', 'audit_log', '2026-08-11', '許家豪匯出昨日稽核紀錄', '10.24.9.12', '2026-08-12 09:30:00']
];

const inboxTemplates = [
  ['notification', '高優先車損案件待審核', 'RFD-0332 的右前車損已由 AI 標記為高風險，請優先確認。', 'damage-review.html', 'danger', null, '2026-08-16 10:35:00'],
  ['notification', '維修工單即將逾期', '工單 #WO-260816-018 距離預計完成時間剩下 2 小時。', 'work-orders.html', 'warning', null, '2026-08-16 09:48:00'],
  ['notification', '新車輛調度任務', '台北車站新增 3 輛待調度車輛，請安排處理。', 'dispatch.html', 'info', null, '2026-08-16 09:12:00'],
  ['notification', '車輛電量低於 20%', 'RAC-4582 目前電量為 18%，已列入優先處理清單。', 'fleet.html', 'warning', null, '2026-08-16 08:46:00'],
  ['notification', '每日營運報表已產生', '8 月 16 日營運報表已完成，可前往報表分析查看。', 'reports.html', 'success', null, '2026-08-16 08:05:00'],
  ['message', '請協助確認北區調度', '今天下午的北區車輛需求增加，麻煩確認可支援數量。', 'dispatch.html', 'info', '調度中心', '2026-08-16 10:02:00'],
  ['message', '工單照片已補齊', '#WO-260816-011 的完工照片已上傳，請協助驗收。', 'work-orders.html', 'success', '維修團隊', '2026-08-16 09:25:00']
];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHex] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createSchema(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      module TEXT NOT NULL,
      module_label TEXT NOT NULL,
      action TEXT NOT NULL,
      action_label TEXT NOT NULL,
      UNIQUE (module, action)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_no TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      ip TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      summary TEXT NOT NULL,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inbox_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('notification', 'message')),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      href TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT 'info' CHECK (tone IN ('danger', 'warning', 'info', 'success')),
      sender TEXT,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
    CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_inbox_items_user_unread ON inbox_items(user_id, kind, is_read, created_at DESC);
  `);
}

function seedDatabase(database) {
  const existing = database.prepare('SELECT COUNT(*) AS count FROM roles').get().count;
  if (existing > 0) return;

  const insertDepartment = database.prepare('INSERT INTO departments (name, description) VALUES (?, ?)');
  const insertRole = database.prepare('INSERT INTO roles (name, description, is_system) VALUES (?, ?, ?)');
  const insertPermission = database.prepare(`
    INSERT INTO permissions (code, module, module_label, action, action_label)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertRolePermission = database.prepare(`
    INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)
  `);
  const insertUser = database.prepare(`
    INSERT INTO users (
      employee_no, name, email, phone, password_hash, role_id, department_id, status, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAudit = database.prepare(`
    INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, summary, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec('BEGIN');
  try {
    departments.forEach(department => insertDepartment.run(...department));
    roles.forEach((role, index) => insertRole.run(role[0], role[1], index === 0 ? 1 : 0));
    moduleDefinitions.forEach(([module, moduleLabel, actions]) => {
      actions.forEach(action => {
        insertPermission.run(`${module}.${action}`, module, moduleLabel, action, actionLabels[action]);
      });
    });

    const roleRows = database.prepare('SELECT id, name FROM roles').all();
    const permissionRows = database.prepare('SELECT id, code FROM permissions').all();
    const permissionByCode = new Map(permissionRows.map(permission => [permission.code, permission.id]));
    roleRows.forEach(role => {
      const codes = rolePermissionMap[role.name].includes('*')
        ? permissionRows.map(permission => permission.code)
        : rolePermissionMap[role.name];
      codes.forEach(code => insertRolePermission.run(role.id, permissionByCode.get(code)));
    });

    const departmentByName = new Map(database.prepare('SELECT id, name FROM departments').all().map(row => [row.name, row.id]));
    const roleByName = new Map(roleRows.map(row => [row.name, row.id]));
    const defaultPasswordHash = hashPassword('Demo@1234');
    users.forEach(([employeeNo, name, roleName, departmentName, status], index) => {
      const passwordHash = employeeNo === 'ADM001' ? hashPassword('Admin@1234') : defaultPasswordHash;
      insertUser.run(
        employeeNo,
        name,
        `${employeeNo.toLowerCase()}@irent.example.tw`,
        `09${String(12003456 + index * 8731).padStart(8, '0').slice(-8)}`,
        passwordHash,
        roleByName.get(roleName),
        departmentByName.get(departmentName),
        status,
        index < 9 ? `2026-08-12 ${String(9 + (index % 5)).padStart(2, '0')}:${String(10 + index * 4).padStart(2, '0')}:00` : null
      );
    });

    const userByEmployeeNo = new Map(database.prepare('SELECT id, employee_no FROM users').all().map(row => [row.employee_no, row.id]));
    auditLogs.forEach(([employeeNo, action, targetType, targetId, summary, ip, createdAt]) => {
      insertAudit.run(userByEmployeeNo.get(employeeNo), action, targetType, targetId, summary, ip, createdAt);
    });
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function seedInbox(database) {
  const existing = database.prepare('SELECT COUNT(*) AS count FROM inbox_items').get().count;
  if (existing > 0) return;

  const insertInboxItem = database.prepare(`
    INSERT INTO inbox_items (user_id, kind, title, body, href, tone, sender, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const userRows = database.prepare('SELECT id FROM users ORDER BY id').all();

  database.exec('BEGIN');
  try {
    userRows.forEach(user => {
      inboxTemplates.forEach(item => insertInboxItem.run(user.id, ...item));
    });
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

// 資料庫連線：
function createDatabase(filename = DEFAULT_DATABASE_PATH) {
  const database = new DatabaseSync(filename);
  createSchema(database);
  seedDatabase(database);
  seedInbox(database);
  return database;
}

function mapUser(database, row) {
  if (!row) return null;
  const permissions = database.prepare(`
    SELECT p.code
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ?
    ORDER BY p.code
  `).all(row.role_id).map(permission => permission.code);

  return {
    id: row.id,
    employeeNo: row.employee_no,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    lastLoginAt: row.last_login_at,
    role: { id: row.role_id, name: row.role_name },
    department: { id: row.department_id, name: row.department_name },
    permissions
  };
}

async function authenticateUser(database, employeeNo, password) {
  const row = database.prepare(`
    SELECT u.*, r.name AS role_name, d.name AS department_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN departments d ON d.id = u.department_id
    WHERE UPPER(u.employee_no) = UPPER(?)
  `).get(String(employeeNo || '').trim());

  if (!row || row.status !== 'active' || !verifyPassword(password, row.password_hash)) return null;
  return mapUser(database, row);
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(database, userId, metadata = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  database.prepare(`
    INSERT INTO sessions (user_id, token_hash, ip, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, hashSessionToken(token), metadata.ip || null, metadata.userAgent || null, expiresAt);
  return token;
}

function getSessionUser(database, token) {
  if (!token) return null;
  const row = database.prepare(`
    SELECT u.*, r.name AS role_name, d.name AS department_name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN roles r ON r.id = u.role_id
    JOIN departments d ON d.id = u.department_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
  `).get(hashSessionToken(token), new Date().toISOString());
  return mapUser(database, row);
}

function hasPermission(user, permissionCode) {
  return Boolean(user?.permissions?.includes(permissionCode));
}

function deleteSession(database, token) {
  if (!token) return;
  database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
}

function writeAudit(database, actorUserId, action, targetType, targetId, summary, ip) {
  database.prepare(`
    INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, summary, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorUserId || null, action, targetType, targetId ? String(targetId) : null, summary, ip || null);
}

module.exports = {
  DEFAULT_DATABASE_PATH,
  authenticateUser,
  createDatabase,
  createSession,
  deleteSession,
  getSessionUser,
  hashPassword,
  hasPermission,
  verifyPassword,
  writeAudit
};
