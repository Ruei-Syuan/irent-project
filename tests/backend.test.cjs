const assert = require('node:assert/strict');
const { afterEach, describe, test } = require('node:test');

const {
  authenticateUser,
  createDatabase,
  createSession,
  getSessionUser,
  hasPermission
} = require('../server/database');

describe('SQLite 權限資料庫', () => {
  const databases = [];

  afterEach(() => {
    databases.splice(0).forEach(database => database.close());
  });

  test('角色、帳號及權限矩陣使用獨立關聯表，並建立各 10 筆虛擬資料', () => {
    const database = createDatabase(':memory:');
    databases.push(database);

    const tables = database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all().map(row => row.name);

    assert.deepEqual(tables, [
      'audit_logs',
      'departments',
      'inbox_items',
      'permissions',
      'role_permissions',
      'roles',
      'sessions',
      'users'
    ]);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM roles').get().count, 10);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM users').get().count, 10);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM audit_logs').get().count, 10);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM inbox_items WHERE kind = 'notification'").get().count, 50);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM inbox_items WHERE kind = 'message'").get().count, 20);
    assert.ok(database.prepare('SELECT COUNT(*) AS count FROM role_permissions').get().count > 10);
  });

  test('帳號只關聯一個角色且外鍵會阻止孤立資料', () => {
    const database = createDatabase(':memory:');
    databases.push(database);

    const roleColumns = database.prepare("PRAGMA table_info('users')").all()
      .filter(column => column.name === 'role_id');
    assert.equal(roleColumns.length, 1);

    assert.throws(() => {
      database.prepare(`
        INSERT INTO users (employee_no, name, password_hash, role_id, department_id, status)
        VALUES ('BAD001', '錯誤資料', 'hash', 999, 1, 'active')
      `).run();
    }, /FOREIGN KEY constraint failed/);
  });

  test('初始管理員可用員工編號登入並取得全部管理權限', async () => {
    const database = createDatabase(':memory:');
    databases.push(database);

    const user = await authenticateUser(database, 'ADM001', 'Admin@1234');

    assert.equal(user.employeeNo, 'ADM001');
    assert.equal(user.role.name, '系統管理員');
    assert.equal(user.passwordHash, undefined);
    assert.equal(hasPermission(user, 'permissions.manage'), true);
    assert.equal(hasPermission(user, 'dashboard.view'), true);
  });

  test('Session 僅以雜湊 Token 儲存並能還原登入者', async () => {
    const database = createDatabase(':memory:');
    databases.push(database);
    const user = await authenticateUser(database, 'ADM001', 'Admin@1234');

    const token = createSession(database, user.id, { ip: '127.0.0.1', userAgent: 'node:test' });
    const stored = database.prepare('SELECT token_hash FROM sessions').get();
    const restored = getSessionUser(database, token);

    assert.notEqual(stored.token_hash, token);
    assert.equal(restored.employeeNo, 'ADM001');
    assert.equal(restored.permissions.includes('permissions.manage'), true);
  });
});
