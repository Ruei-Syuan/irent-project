const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, test } = require('node:test');

const { createApp } = require('../server/app');
const { createDatabase } = require('../server/database');

describe('權限管理 API', () => {
  let database;
  let server;
  let baseUrl;

  beforeEach(async () => {
    database = createDatabase(':memory:');
    const app = createApp({ database });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
    database.close();
  });

  async function login(employeeNo = 'ADM001', password = 'Admin@1234') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ employeeNo, password })
    });
    return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }

  test('未登入不能讀取 API，存取頁面會導向登入頁', async () => {
    const apiResponse = await fetch(`${baseUrl}/api/users`);
    const pageResponse = await fetch(`${baseUrl}/dashboard.html`, { redirect: 'manual' });

    assert.equal(apiResponse.status, 401);
    assert.equal(pageResponse.status, 302);
    assert.equal(pageResponse.headers.get('location'), '/login.html');
  });

  test('管理員登入後以 HttpOnly Cookie 取得帳號與權限矩陣', async () => {
    const { response, cookie } = await login();
    const usersResponse = await fetch(`${baseUrl}/api/users`, { headers: { cookie } });
    const matrixResponse = await fetch(`${baseUrl}/api/roles`, { headers: { cookie } });
    const users = await usersResponse.json();
    const roles = await matrixResponse.json();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
    assert.equal(users.items.length, 10);
    assert.equal(roles.items.length, 10);
    assert.equal(roles.items[0].permissions.length > 10, true);
  });

  test('沒有帳號管理權限的角色會收到 403', async () => {
    const { cookie } = await login('RPT607', 'Demo@1234');
    const response = await fetch(`${baseUrl}/api/users`, { headers: { cookie } });

    assert.equal(response.status, 403);
  });

  test('登入者可取得通知與訊息，並將未讀項目標示為已讀', async () => {
    const { cookie } = await login();
    const inboxResponse = await fetch(`${baseUrl}/api/inbox`, { headers: { cookie } });
    const inbox = await inboxResponse.json();

    assert.equal(inboxResponse.status, 200);
    assert.equal(inbox.unread.notifications, 5);
    assert.equal(inbox.unread.messages, 2);
    assert.equal(inbox.items.filter(item => item.kind === 'notification').length, 5);
    assert.equal(inbox.items.filter(item => item.kind === 'message').length, 2);

    const firstNotification = inbox.items.find(item => item.kind === 'notification');
    const readResponse = await fetch(`${baseUrl}/api/inbox/${firstNotification.id}/read`, {
      method: 'PATCH',
      headers: { cookie }
    });
    const readResult = await readResponse.json();

    assert.equal(readResponse.status, 200);
    assert.equal(readResult.item.isRead, true);

    const readAllResponse = await fetch(`${baseUrl}/api/inbox/read-all`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'message' })
    });
    assert.equal(readAllResponse.status, 200);

    const refreshed = await (await fetch(`${baseUrl}/api/inbox`, { headers: { cookie } })).json();
    assert.equal(refreshed.unread.notifications, 4);
    assert.equal(refreshed.unread.messages, 0);
  });

  test('角色與帳號可分開新增、編輯及刪除', async () => {
    const { cookie } = await login();
    const jsonHeaders = { cookie, 'content-type': 'application/json' };

    const roleCreateResponse = await fetch(`${baseUrl}/api/roles`, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name: '北區營運專員', description: '管理北區日常營運' })
    });
    const role = await roleCreateResponse.json();
    assert.equal(roleCreateResponse.status, 201);

    const departmentResponse = await fetch(`${baseUrl}/api/departments`, { headers: { cookie } });
    const departments = await departmentResponse.json();
    const userCreateResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        employeeNo: 'OPS999', name: '周欣怡', password: 'Test@1234',
        roleId: role.item.id, departmentId: departments.items[0].id, status: 'active'
      })
    });
    const user = await userCreateResponse.json();
    assert.equal(userCreateResponse.status, 201);

    const updateResponse = await fetch(`${baseUrl}/api/users/${user.item.id}`, {
      method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ name: '周欣怡（北區）', status: 'active' })
    });
    assert.equal((await updateResponse.json()).item.name, '周欣怡（北區）');

    const blockedDelete = await fetch(`${baseUrl}/api/roles/${role.item.id}`, { method: 'DELETE', headers: { cookie } });
    assert.equal(blockedDelete.status, 409);

    assert.equal((await fetch(`${baseUrl}/api/users/${user.item.id}`, { method: 'DELETE', headers: { cookie } })).status, 204);
    assert.equal((await fetch(`${baseUrl}/api/roles/${role.item.id}`, { method: 'DELETE', headers: { cookie } })).status, 204);
  });

  test('儲存角色權限矩陣會更新關聯表', async () => {
    const { cookie } = await login();
    const roles = await (await fetch(`${baseUrl}/api/roles`, { headers: { cookie } })).json();
    const permissions = await (await fetch(`${baseUrl}/api/permissions`, { headers: { cookie } })).json();
    const role = roles.items.find(item => item.name === '外部協力廠商');
    const selected = permissions.items.filter(item => ['work_orders.view', 'work_orders.edit', 'dashboard.view'].includes(item.code));

    const response = await fetch(`${baseUrl}/api/roles/${role.id}/permissions`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ permissionIds: selected.map(item => item.id) })
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(result.item.permissions.map(item => item.code).sort(), ['dashboard.view', 'work_orders.edit', 'work_orders.view']);
  });

  test('部門可獨立管理，仍有帳號關聯時禁止刪除', async () => {
    const { cookie } = await login();
    const jsonHeaders = { cookie, 'content-type': 'application/json' };
    const createResponse = await fetch(`${baseUrl}/api/departments`, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name: '北區營運部', description: '北區站點營運' })
    });
    const department = await createResponse.json();
    assert.equal(createResponse.status, 201);

    const updateResponse = await fetch(`${baseUrl}/api/departments/${department.item.id}`, {
      method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ name: '北區營運中心' })
    });
    assert.equal((await updateResponse.json()).item.name, '北區營運中心');

    const usedDepartment = database.prepare('SELECT department_id FROM users LIMIT 1').get();
    const blockedResponse = await fetch(`${baseUrl}/api/departments/${usedDepartment.department_id}`, {
      method: 'DELETE', headers: { cookie }
    });
    assert.equal(blockedResponse.status, 409);
    assert.equal((await fetch(`${baseUrl}/api/departments/${department.item.id}`, { method: 'DELETE', headers: { cookie } })).status, 204);
  });
});
