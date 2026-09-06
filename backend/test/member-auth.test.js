import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createPrisma } from '../src/plugins/prisma.js';
import { initializeDatabase } from '../src/services/database-setup.js';

async function withMemberApp(run) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-member-auth-'));
  const databaseUrl = `file:${path.join(temporaryDirectory, 'test.sqlite')}`;
  let app;
  let prisma;

  try {
    await initializeDatabase({ databaseUrl, adminPassword: 'TestPassword123!' });
    prisma = createPrisma(databaseUrl);
    app = await buildApp({ prisma, logger: false });
    await run({ app, prisma });
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

test('一般會員可註冊、登入、取得自己的資料並登出', async () => {
  await withMemberApp(async ({ app }) => {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/register',
      payload: {
        memberNo: 'MEM9001',
        fullName: '測試會員',
        phone: '0912345678',
        password: 'MemberPass123!'
      }
    });

    assert.equal(registerResponse.statusCode, 201, registerResponse.body);
    assert.deepEqual(registerResponse.json().item, {
      memberNo: 'MEM9001',
      fullName: '測試會員',
      phone: '0912345678'
    });
    const cookie = registerResponse.headers['set-cookie'];
    assert.ok(cookie);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/member-auth/me',
      headers: { cookie }
    });
    assert.equal(meResponse.statusCode, 200);
    assert.deepEqual(meResponse.json().item, {
      memberNo: 'MEM9001',
      fullName: '測試會員',
      phone: '0912345678'
    });

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/logout',
      headers: { cookie }
    });
    assert.equal(logoutResponse.statusCode, 204);

    const afterLogoutResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/member-auth/me',
      headers: { cookie }
    });
    assert.equal(afterLogoutResponse.statusCode, 401);
  });
});

test('一般會員可用手機號碼登入且錯誤密碼會被拒絕', async () => {
  await withMemberApp(async ({ app }) => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/register',
      payload: {
        memberNo: 'MEM9002',
        fullName: '手機登入會員',
        phone: '0922333444',
        password: 'MemberPass123!'
      }
    });

    const invalidResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/login',
      payload: { identifier: '0922333444', password: 'wrong-password' }
    });
    assert.equal(invalidResponse.statusCode, 401);

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/login',
      payload: { identifier: '0922333444', password: 'MemberPass123!' }
    });
    assert.equal(loginResponse.statusCode, 200, loginResponse.body);
    assert.deepEqual(loginResponse.json().item, {
      memberNo: 'MEM9002',
      fullName: '手機登入會員',
      phone: '0922333444'
    });
  });
});

test('管理員目前資料 API 未登入時會拒絕請求', async () => {
  await withMemberApp(async ({ app }) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me'
    });

    assert.equal(response.statusCode, 401);
  });
});

test('允許前端 5000 使用會員登入 API 與 Cookie', async () => {
  await withMemberApp(async ({ app }) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/member-auth/login',
      headers: {
        origin: 'http://127.0.0.1:5000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://127.0.0.1:5000');
    assert.match(response.headers['access-control-allow-credentials'], /true/);
  });
});
test('允許區網前端使用會員登入 API 與 Cookie', async () => {
  await withMemberApp(async ({ app }) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/member-auth/login',
      headers: {
        origin: 'http://192.168.1.112:5000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type'
      }
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://192.168.1.112:5000');
    assert.match(response.headers['access-control-allow-credentials'], /true/);
  });
});

test('member rental API stores a pending-pickup rental for the signed-in member', async () => {
  await withMemberApp(async ({ app, prisma }) => {
    const vehicle = await prisma.vehicle.findFirst({ where: { status: 'available' } });
    assert.ok(vehicle);

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/register',
      payload: {
        memberNo: 'MEMRENT1',
        fullName: 'Frontend Member',
        phone: '0911111111',
        password: 'MemberPass123!'
      }
    });
    assert.equal(registerResponse.statusCode, 201, registerResponse.body);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/rentals',
      headers: { cookie: registerResponse.headers['set-cookie'] },
      payload: {
        vehicleId: vehicle.id,
        startedAt: '2026-09-05T09:30:00.000Z',
        endedAt: '2026-09-05T11:30:00.000Z',
        rentalFee: 384
      }
    });

    assert.equal(response.statusCode, 201, response.body);
    assert.equal(response.json().item.vehicleId, vehicle.id);
    assert.equal(response.json().item.status, 'pending_pickup');
    assert.equal(response.json().item.customer.memberNo, 'MEMRENT1');
    assert.equal(response.json().item.rentalFee, 384);

    const stored = await prisma.rental.findFirst({
      where: { vehicleId: vehicle.id, customer: { memberNo: 'MEMRENT1' } },
      include: { customer: true }
    });
    assert.ok(stored);
    assert.equal(stored.status, 'pending_pickup');
    assert.equal(stored.rentalFee, 384);
  });
});

test('member rental API lists and transitions a rental through all pickup states', async () => {
  await withMemberApp(async ({ app, prisma }) => {
    const vehicle = await prisma.vehicle.findFirst({ where: { status: 'available' } });
    assert.ok(vehicle);

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/register',
      payload: {
        memberNo: 'MEMRENT2',
        fullName: 'Rental Status Member',
        phone: '0922222222',
        password: 'MemberPass123!'
      }
    });
    assert.equal(registerResponse.statusCode, 201, registerResponse.body);
    const cookie = registerResponse.headers['set-cookie'];

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/member-auth/rentals',
      headers: { cookie },
      payload: {
        vehicleId: vehicle.id,
        startedAt: '2026-09-06T09:30:00.000Z',
        endedAt: '2026-09-06T11:30:00.000Z',
        rentalFee: 384
      }
    });
    assert.equal(createResponse.statusCode, 201, createResponse.body);
    const rentalId = createResponse.json().item.id;
    assert.equal(createResponse.json().item.status, 'pending_pickup');

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/member-auth/rentals',
      headers: { cookie }
    });
    assert.equal(listResponse.statusCode, 200, listResponse.body);
    assert.equal(listResponse.json().items.length, 1);
    assert.equal(listResponse.json().items[0].id, rentalId);
    assert.equal(listResponse.json().items[0].vehicle.id, vehicle.id);
    assert.ok(listResponse.json().items[0].vehicle.station.name);

    const pickupResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/member-auth/rentals/${rentalId}/status`,
      headers: { cookie },
      payload: { status: 'active' }
    });
    assert.equal(pickupResponse.statusCode, 200, pickupResponse.body);
    assert.equal(pickupResponse.json().item.status, 'active');

    const returnResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/member-auth/rentals/${rentalId}/status`,
      headers: { cookie },
      payload: { status: 'completed' }
    });
    assert.equal(returnResponse.statusCode, 200, returnResponse.body);
    assert.equal(returnResponse.json().item.status, 'completed');
  });
});
