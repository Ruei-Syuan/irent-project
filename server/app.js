'use strict';

const path = require('node:path');
const express = require('express');
const {
  authenticateUser,
  createSession,
  deleteSession,
  getSessionUser,
  hashPassword,
  hasPermission,
  writeAudit
} = require('./database');

const PROJECT_ROOT = path.join(__dirname, '..');
const SESSION_COOKIE = 'irent_session';
const pagePermissions = {
  'dashboard.html': 'dashboard.view',
  'fleet.html': 'fleet.view',
  'damage-review.html': 'damage.view',
  'dispatch.html': 'dispatch.view',
  'work-orders.html': 'work_orders.view',
  'reports.html': 'reports.view',
  'permissions.html': 'permissions.view'
};

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator === -1) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function publicUser(user) {
  return {
    id: user.id,
    employeeNo: user.employeeNo,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    role: user.role,
    department: user.department,
    permissions: user.permissions
  };
}

function listRoles(database) {
  const roleRows = database.prepare(`
    SELECT r.*, COUNT(DISTINCT u.id) AS user_count
    FROM roles r
    LEFT JOIN users u ON u.role_id = r.id
    GROUP BY r.id
    ORDER BY r.is_system DESC, r.id
  `).all();
  const permissionQuery = database.prepare(`
    SELECT p.id, p.code, p.module, p.module_label, p.action, p.action_label
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ?
    ORDER BY p.module, p.id
  `);
  return roleRows.map(role => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: Boolean(role.is_system),
    userCount: role.user_count,
    permissions: permissionQuery.all(role.id).map(mapPermission)
  }));
}

function mapPermission(permission) {
  return {
    id: permission.id,
    code: permission.code,
    module: permission.module,
    moduleLabel: permission.module_label,
    action: permission.action,
    actionLabel: permission.action_label
  };
}

function listUsers(database) {
  return database.prepare(`
    SELECT
      u.id, u.employee_no, u.name, u.email, u.phone, u.status, u.last_login_at,
      r.id AS role_id, r.name AS role_name,
      d.id AS department_id, d.name AS department_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN departments d ON d.id = u.department_id
    ORDER BY u.id
  `).all().map(row => ({
    id: row.id,
    employeeNo: row.employee_no,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    lastLoginAt: row.last_login_at,
    role: { id: row.role_id, name: row.role_name },
    department: { id: row.department_id, name: row.department_name }
  }));
}

function getUserById(database, id) {
  return listUsers(database).find(user => user.id === Number(id)) || null;
}

function validationError(response, message) {
  return response.status(400).json({ error: message });
}

function createApp({ database }) {
  if (!database) throw new Error('createApp 需要 database');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use('/css', express.static(path.join(PROJECT_ROOT, 'css')));
  app.use('/js', express.static(path.join(PROJECT_ROOT, 'js')));

  app.get('/login.html', (request, response) => {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (getSessionUser(database, token)) return response.redirect('/dashboard.html');
    response.sendFile(path.join(PROJECT_ROOT, 'login.html'));
  });

  app.get('/', (request, response) => response.redirect('/dashboard.html'));

  app.post('/api/auth/login', async (request, response) => {
    const employeeNo = String(request.body?.employeeNo || '').trim().toUpperCase();
    const password = String(request.body?.password || '');
    if (!employeeNo || !password) return validationError(response, '請輸入員工編號與密碼');

    const user = await authenticateUser(database, employeeNo, password);
    if (!user) {
      writeAudit(database, null, 'auth.login_failed', 'session', employeeNo, `員工編號 ${employeeNo} 登入失敗`, request.ip);
      return response.status(401).json({ error: '員工編號或密碼錯誤' });
    }

    database.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    const token = createSession(database, user.id, { ip: request.ip, userAgent: request.get('user-agent') });
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });
    writeAudit(database, user.id, 'auth.login', 'session', null, `${user.name}登入管理後台`, request.ip);
    return response.json({ item: publicUser(user) });
  });

  app.post('/api/auth/logout', (request, response) => {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    const user = getSessionUser(database, token);
    deleteSession(database, token);
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', path: '/' });
    if (user) writeAudit(database, user.id, 'auth.logout', 'session', null, `${user.name}登出管理後台`, request.ip);
    response.status(204).end();
  });

  function requireAuth(request, response, next) {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    const user = getSessionUser(database, token);
    if (!user) return response.status(401).json({ error: '請先登入' });
    request.user = user;
    request.sessionToken = token;
    next();
  }

  function requirePermission(code) {
    return (request, response, next) => {
      if (!hasPermission(request.user, code)) return response.status(403).json({ error: '沒有執行此操作的權限' });
      next();
    };
  }

  Object.entries(pagePermissions).forEach(([filename, permission]) => {
    app.get(`/${filename}`, (request, response, next) => {
      const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
      const user = getSessionUser(database, token);
      if (!user) return response.redirect('/login.html');
      if (!hasPermission(user, permission)) return response.status(403).sendFile(path.join(PROJECT_ROOT, 'forbidden.html'));
      next();
    }, (request, response) => response.sendFile(path.join(PROJECT_ROOT, filename)));
  });

  app.use('/data', requireAuth, express.static(path.join(PROJECT_ROOT, 'data')));

  app.get('/api/auth/me', requireAuth, (request, response) => response.json({ item: publicUser(request.user) }));

  app.get('/api/roles', requireAuth, requirePermission('permissions.view'), (request, response) => {
    response.json({ items: listRoles(database) });
  });

  app.post('/api/roles', requireAuth, requirePermission('permissions.manage'), (request, response) => {
    const name = String(request.body?.name || '').trim();
    const description = String(request.body?.description || '').trim();
    if (!name) return validationError(response, '請輸入角色名稱');
    const result = database.prepare('INSERT INTO roles (name, description) VALUES (?, ?)').run(name, description);
    writeAudit(database, request.user.id, 'role.create', 'role', result.lastInsertRowid, `${request.user.name}新增角色「${name}」`, request.ip);
    const item = listRoles(database).find(role => role.id === Number(result.lastInsertRowid));
    response.status(201).json({ item });
  });

  app.patch('/api/roles/:id', requireAuth, requirePermission('permissions.manage'), (request, response) => {
    const current = database.prepare('SELECT * FROM roles WHERE id = ?').get(request.params.id);
    if (!current) return response.status(404).json({ error: '找不到角色' });
    const name = String(request.body?.name ?? current.name).trim();
    const description = String(request.body?.description ?? current.description).trim();
    if (!name) return validationError(response, '請輸入角色名稱');
    database.prepare(`
      UPDATE roles SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(name, description, current.id);
    writeAudit(database, request.user.id, 'role.update', 'role', current.id, `${request.user.name}更新角色「${name}」`, request.ip);
    response.json({ item: listRoles(database).find(role => role.id === current.id) });
  });

  app.delete('/api/roles/:id', requireAuth, requirePermission('permissions.manage'), (request, response) => {
    const role = database.prepare(`
      SELECT r.*, COUNT(u.id) AS user_count
      FROM roles r LEFT JOIN users u ON u.role_id = r.id
      WHERE r.id = ? GROUP BY r.id
    `).get(request.params.id);
    if (!role) return response.status(404).json({ error: '找不到角色' });
    if (role.is_system) return response.status(409).json({ error: '系統角色不可刪除' });
    if (role.user_count > 0) return response.status(409).json({ error: '角色仍有帳號使用，請先調整帳號角色' });
    database.prepare('DELETE FROM roles WHERE id = ?').run(role.id);
    writeAudit(database, request.user.id, 'role.delete', 'role', role.id, `${request.user.name}刪除角色「${role.name}」`, request.ip);
    response.status(204).end();
  });

  app.get('/api/permissions', requireAuth, requirePermission('permissions.view'), (request, response) => {
    const items = database.prepare('SELECT * FROM permissions ORDER BY module, id').all().map(mapPermission);
    response.json({ items });
  });

  app.put('/api/roles/:id/permissions', requireAuth, requirePermission('permissions.manage'), (request, response) => {
    const role = database.prepare('SELECT * FROM roles WHERE id = ?').get(request.params.id);
    if (!role) return response.status(404).json({ error: '找不到角色' });
    const permissionIds = [...new Set((request.body?.permissionIds || []).map(Number))];
    if (permissionIds.some(id => !Number.isInteger(id) || id <= 0)) return validationError(response, '權限資料格式錯誤');
    const validIds = new Set(database.prepare('SELECT id FROM permissions').all().map(item => item.id));
    if (permissionIds.some(id => !validIds.has(id))) return validationError(response, '包含不存在的權限');

    database.exec('BEGIN');
    try {
      database.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
      const insert = database.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      permissionIds.forEach(permissionId => insert.run(role.id, permissionId));
      database.prepare('UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role.id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    writeAudit(database, request.user.id, 'role.permission.update', 'role', role.id, `${request.user.name}更新「${role.name}」權限矩陣`, request.ip);
    response.json({ item: listRoles(database).find(item => item.id === role.id) });
  });

  app.get('/api/departments', requireAuth, requirePermission('users.view'), (request, response) => {
    const items = database.prepare('SELECT id, name, description FROM departments ORDER BY id').all();
    response.json({ items });
  });

  app.post('/api/departments', requireAuth, requirePermission('departments.manage'), (request, response) => {
    const name = String(request.body?.name || '').trim();
    const description = String(request.body?.description || '').trim();
    if (!name) return validationError(response, '請輸入部門名稱');
    const result = database.prepare('INSERT INTO departments (name, description) VALUES (?, ?)').run(name, description);
    writeAudit(database, request.user.id, 'department.create', 'department', result.lastInsertRowid, `${request.user.name}新增部門「${name}」`, request.ip);
    response.status(201).json({ item: { id: Number(result.lastInsertRowid), name, description } });
  });

  app.patch('/api/departments/:id', requireAuth, requirePermission('departments.manage'), (request, response) => {
    const current = database.prepare('SELECT * FROM departments WHERE id = ?').get(request.params.id);
    if (!current) return response.status(404).json({ error: '找不到部門' });
    const name = String(request.body?.name ?? current.name).trim();
    const description = String(request.body?.description ?? current.description).trim();
    if (!name) return validationError(response, '請輸入部門名稱');
    database.prepare('UPDATE departments SET name = ?, description = ? WHERE id = ?').run(name, description, current.id);
    writeAudit(database, request.user.id, 'department.update', 'department', current.id, `${request.user.name}更新部門「${name}」`, request.ip);
    response.json({ item: { id: current.id, name, description } });
  });

  app.delete('/api/departments/:id', requireAuth, requirePermission('departments.manage'), (request, response) => {
    const department = database.prepare(`
      SELECT d.*, COUNT(u.id) AS user_count
      FROM departments d LEFT JOIN users u ON u.department_id = d.id
      WHERE d.id = ? GROUP BY d.id
    `).get(request.params.id);
    if (!department) return response.status(404).json({ error: '找不到部門' });
    if (department.user_count > 0) return response.status(409).json({ error: '部門仍有成員，請先調整帳號部門' });
    database.prepare('DELETE FROM departments WHERE id = ?').run(department.id);
    writeAudit(database, request.user.id, 'department.delete', 'department', department.id, `${request.user.name}刪除部門「${department.name}」`, request.ip);
    response.status(204).end();
  });

  app.post('/api/departments', requireAuth, requirePermission('departments.manage'), (request, response) => {
    const name = String(request.body?.name || '').trim();
    const description = String(request.body?.description || '').trim();
    if (!name) return validationError(response, '請輸入部門名稱');
    const result = database.prepare('INSERT INTO departments (name, description) VALUES (?, ?)').run(name, description);
    writeAudit(database, request.user.id, 'department.create', 'department', result.lastInsertRowid, `${request.user.name}新增部門「${name}」`, request.ip);
    response.status(201).json({ item: { id: Number(result.lastInsertRowid), name, description } });
  });

  app.patch('/api/departments/:id', requireAuth, requirePermission('departments.manage'), (request, response) => {
    const current = database.prepare('SELECT * FROM departments WHERE id = ?').get(request.params.id);
    if (!current) return response.status(404).json({ error: '找不到部門' });
    const name = String(request.body?.name ?? current.name).trim();
    const description = String(request.body?.description ?? current.description).trim();
    if (!name) return validationError(response, '請輸入部門名稱');
    database.prepare('UPDATE departments SET name = ?, description = ? WHERE id = ?').run(name, description, current.id);
    writeAudit(database, request.user.id, 'department.update', 'department', current.id, `${request.user.name}更新部門「${name}」`, request.ip);
    response.json({ item: { id: current.id, name, description } });
  });

  app.delete('/api/departments/:id', requireAuth, requirePermission('departments.manage'), (request, response) => {
    const department = database.prepare(`
      SELECT d.*, COUNT(u.id) AS user_count
      FROM departments d LEFT JOIN users u ON u.department_id = d.id
      WHERE d.id = ? GROUP BY d.id
    `).get(request.params.id);
    if (!department) return response.status(404).json({ error: '找不到部門' });
    if (department.user_count > 0) return response.status(409).json({ error: '部門仍有成員，請先調整帳號部門' });
    database.prepare('DELETE FROM departments WHERE id = ?').run(department.id);
    writeAudit(database, request.user.id, 'department.delete', 'department', department.id, `${request.user.name}刪除部門「${department.name}」`, request.ip);
    response.status(204).end();
  });

  app.get('/api/users', requireAuth, requirePermission('users.view'), (request, response) => {
    response.json({ items: listUsers(database) });
  });

  app.post('/api/users', requireAuth, requirePermission('users.create'), (request, response) => {
    const employeeNo = String(request.body?.employeeNo || '').trim().toUpperCase();
    const name = String(request.body?.name || '').trim();
    const password = String(request.body?.password || '');
    const roleId = Number(request.body?.roleId);
    const departmentId = Number(request.body?.departmentId);
    const status = request.body?.status === 'suspended' ? 'suspended' : 'active';
    if (!/^[A-Z]{3}\d{3}$/.test(employeeNo)) return validationError(response, '員工編號格式需為 3 碼英文加 3 碼數字');
    if (!name) return validationError(response, '請輸入姓名');
    if (password.length < 8) return validationError(response, '密碼至少需要 8 個字元');
    if (!database.prepare('SELECT 1 FROM roles WHERE id = ?').get(roleId)) return validationError(response, '角色不存在');
    if (!database.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId)) return validationError(response, '部門不存在');

    const result = database.prepare(`
      INSERT INTO users (employee_no, name, email, phone, password_hash, role_id, department_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeNo,
      name,
      String(request.body?.email || '').trim() || null,
      String(request.body?.phone || '').trim() || null,
      hashPassword(password),
      roleId,
      departmentId,
      status
    );
    writeAudit(database, request.user.id, 'user.create', 'user', result.lastInsertRowid, `${request.user.name}新增帳號 ${employeeNo}（${name}）`, request.ip);
    response.status(201).json({ item: getUserById(database, result.lastInsertRowid) });
  });

  app.patch('/api/users/:id', requireAuth, requirePermission('users.edit'), (request, response) => {
    const current = database.prepare('SELECT * FROM users WHERE id = ?').get(request.params.id);
    if (!current) return response.status(404).json({ error: '找不到帳號' });
    const name = String(request.body?.name ?? current.name).trim();
    const roleId = Number(request.body?.roleId ?? current.role_id);
    const departmentId = Number(request.body?.departmentId ?? current.department_id);
    const status = request.body?.status ?? current.status;
    if (!name) return validationError(response, '請輸入姓名');
    if (!['active', 'suspended'].includes(status)) return validationError(response, '帳號狀態錯誤');
    if (!database.prepare('SELECT 1 FROM roles WHERE id = ?').get(roleId)) return validationError(response, '角色不存在');
    if (!database.prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId)) return validationError(response, '部門不存在');

    const passwordHash = request.body?.password
      ? hashPassword(String(request.body.password))
      : current.password_hash;
    if (request.body?.password && String(request.body.password).length < 8) return validationError(response, '密碼至少需要 8 個字元');
    database.prepare(`
      UPDATE users
      SET name = ?, email = ?, phone = ?, password_hash = ?, role_id = ?, department_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      String(request.body?.email ?? current.email ?? '').trim() || null,
      String(request.body?.phone ?? current.phone ?? '').trim() || null,
      passwordHash,
      roleId,
      departmentId,
      status,
      current.id
    );
    writeAudit(database, request.user.id, 'user.update', 'user', current.id, `${request.user.name}更新帳號 ${current.employee_no}`, request.ip);
    response.json({ item: getUserById(database, current.id) });
  });

  app.delete('/api/users/:id', requireAuth, requirePermission('users.delete'), (request, response) => {
    const user = database.prepare('SELECT id, employee_no, name FROM users WHERE id = ?').get(request.params.id);
    if (!user) return response.status(404).json({ error: '找不到帳號' });
    if (user.id === request.user.id) return response.status(409).json({ error: '不可刪除目前登入的帳號' });
    database.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    writeAudit(database, request.user.id, 'user.delete', 'user', user.id, `${request.user.name}刪除帳號 ${user.employee_no}（${user.name}）`, request.ip);
    response.status(204).end();
  });

  app.get('/api/audit-logs', requireAuth, requirePermission('audit.view'), (request, response) => {
    const items = database.prepare(`
      SELECT a.id, a.action, a.target_type, a.target_id, a.summary, a.ip, a.created_at,
             u.id AS actor_id, u.name AS actor_name, u.employee_no AS actor_employee_no
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_user_id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 200
    `).all().map(row => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      summary: row.summary,
      ip: row.ip,
      createdAt: row.created_at,
      actor: row.actor_id ? { id: row.actor_id, name: row.actor_name, employeeNo: row.actor_employee_no } : null
    }));
    response.json({ items });
  });

  app.use('/api', (request, response) => response.status(404).json({ error: '找不到 API' }));
  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    if (String(error.message).includes('UNIQUE constraint failed')) {
      return response.status(409).json({ error: '資料重複，請檢查員工編號、Email 或角色名稱' });
    }
    console.error(error);
    return response.status(500).json({ error: '系統處理失敗' });
  });

  return app;
}

module.exports = { createApp, listRoles, listUsers, parseCookies };
