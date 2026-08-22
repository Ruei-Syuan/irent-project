import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createPrisma } from '../src/plugins/prisma.js';
import { initializeDatabase } from '../src/services/database-setup.js';

async function withAuthenticatedApp(run) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-vehicle-'));
  const databaseUrl = `file:${path.join(temporaryDirectory, 'test.sqlite')}`;
  const password = 'TestPassword123!';
  let app;
  let prisma;

  try {
    await initializeDatabase({ databaseUrl, adminPassword: password });
    prisma = createPrisma(databaseUrl);
    app = await buildApp({ prisma, logger: false });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { employeeNo: 'ADM001', password }
    });
    assert.equal(loginResponse.statusCode, 200);
    await run({ app, prisma, cookie: loginResponse.headers['set-cookie'] });
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

test('新增車輛可儲存車內狀況', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const station = await prisma.station.findFirstOrThrow();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/vehicles',
      headers: { cookie },
      payload: {
        licensePlate: 'RZZ-9901',
        model: 'Toyota Yaris',
        color: '白',
        stationId: station.id,
        cabinCondition: 'average'
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().item.cabinCondition, 'average');
  });
});

test('修改車輛時只接受三種車內狀況', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const vehicle = await prisma.vehicle.findFirstOrThrow();
    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vehicles/${vehicle.id}`,
      headers: { cookie },
      payload: { status: 'maintenance', cabinCondition: 'dirty' }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().item.cabinCondition, 'dirty');

    const invalidResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vehicles/${vehicle.id}`,
      headers: { cookie },
      payload: { cabinCondition: 'unknown' }
    });
    assert.equal(invalidResponse.statusCode, 400);
  });
});

test('可租用車輛不可設定髒污且待清潔必須設定髒污', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const vehicle = await prisma.vehicle.findFirstOrThrow();
    const availableDirtyResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vehicles/${vehicle.id}`,
      headers: { cookie },
      payload: { status: 'available', cabinCondition: 'dirty' }
    });
    assert.equal(availableDirtyResponse.statusCode, 400);

    const cleaningCleanResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vehicles/${vehicle.id}`,
      headers: { cookie },
      payload: { status: 'cleaning', cabinCondition: 'clean' }
    });
    assert.equal(cleaningCleanResponse.statusCode, 400);

    const cleaningDirtyResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vehicles/${vehicle.id}`,
      headers: { cookie },
      payload: { status: 'cleaning', cabinCondition: 'dirty' }
    });
    assert.equal(cleaningDirtyResponse.statusCode, 200);
    assert.equal(cleaningDirtyResponse.json().item.cabinCondition, 'dirty');
  });
});

test('可新增修改租借歷程並回傳完整租客資料與租金統計', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const station = await prisma.station.findFirstOrThrow();
    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: 'RHH-0001',
        model: 'Toyota Yaris',
        color: '白',
        stationId: station.id
      }
    });
    const createResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/vehicles/${vehicle.id}/history/rentals`,
      headers: { cookie },
      payload: {
        customer: {
          memberNo: 'MEM0001',
          fullName: '王小明',
          phone: '0912345678'
        },
        startedAt: '2026-08-01T01:00:00.000Z',
        endedAt: '2026-08-01T04:00:00.000Z',
        status: 'completed',
        rentalFee: 1680
      }
    });

    assert.equal(createResponse.statusCode, 201);
    const rental = createResponse.json().item;
    assert.deepEqual(rental.customer, {
      memberNo: 'MEM0001',
      fullName: '王小明',
      phone: '0912345678'
    });

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vehicles/${vehicle.id}/history/rentals/${rental.id}`,
      headers: { cookie },
      payload: { rentalFee: 1880 }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().item.rentalFee, 1880);

    const historyResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/vehicles/${vehicle.id}/history`,
      headers: { cookie }
    });
    assert.equal(historyResponse.statusCode, 200);
    assert.equal(historyResponse.json().summary.rentalFee, 1880);
    assert.equal(historyResponse.json().rentals[0].customer.fullName, '王小明');
  });
});

test('可新增修改保養歷程並分別累計清潔與維修費', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const station = await prisma.station.findFirstOrThrow();
    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: 'RHH-0002',
        model: 'Honda Fit',
        color: '銀',
        stationId: station.id
      }
    });
    const cleaningResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/vehicles/${vehicle.id}/history/services`,
      headers: { cookie },
      payload: {
        type: 'cleaning',
        performedAt: '2026-08-02T03:00:00.000Z',
        cost: 500,
        note: '內裝清潔'
      }
    });
    assert.equal(cleaningResponse.statusCode, 201);

    const maintenanceResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/vehicles/${vehicle.id}/history/services`,
      headers: { cookie },
      payload: {
        type: 'maintenance',
        performedAt: '2026-08-03T03:00:00.000Z',
        cost: 2400,
        note: '更換煞車皮'
      }
    });
    assert.equal(maintenanceResponse.statusCode, 201);

    const cleaning = cleaningResponse.json().item;
    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vehicles/${vehicle.id}/history/services/${cleaning.id}`,
      headers: { cookie },
      payload: { cost: 650 }
    });
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().item.cost, 650);

    const historyResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/vehicles/${vehicle.id}/history`,
      headers: { cookie }
    });
    const history = historyResponse.json();
    assert.equal(history.summary.cleaningCost, 650);
    assert.equal(history.summary.maintenanceCost, 2400);
    assert.equal(history.services.length, 2);
  });
});
