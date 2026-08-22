import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createPrisma } from '../src/plugins/prisma.js';
import * as dashboardTrend from '../src/services/dashboard-trend.js';
import { initializeDatabase } from '../src/services/database-setup.js';

test('即時車隊統計讓租用中優先於可租狀態且不重複計算', () => {
  const summary = dashboardTrend.aggregateFleetSummary([
    { id: 1, status: 'available' },
    { id: 2, status: 'available' },
    { id: 3, status: 'cleaning' },
    { id: 4, status: 'maintenance' }
  ], [2, 2]);

  assert.deepEqual(summary, {
    totalVehicles: 4,
    availableVehicles: 1,
    rentedVehicles: 1,
    cleaningVehicles: 1,
    maintenanceVehicles: 1
  });
});

test('跨日租借逐日計入且同車同日不重複計算', () => {
  const items = dashboardTrend.aggregateFleetTrend([
    {
      vehicleId: 1,
      startedAt: '2026-08-20T02:00:00.000Z',
      endedAt: '2026-08-22T01:00:00.000Z'
    },
    {
      vehicleId: 1,
      startedAt: '2026-08-22T03:00:00.000Z',
      endedAt: '2026-08-22T04:00:00.000Z'
    },
    {
      vehicleId: 2,
      startedAt: '2026-08-21T06:00:00.000Z',
      endedAt: null
    }
  ], 30, new Date('2026-08-22T04:00:00.000Z'));

  assert.deepEqual(items.map(item => item.date), [
    '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19',
    '2026-08-20', '2026-08-21', '2026-08-22'
  ]);
  assert.deepEqual(items.map(item => item.rentedVehicles), [0, 0, 0, 0, 1, 2, 2]);
  assert.ok(items.every(item => item.totalVehicles === 30));
});

test('過去七天租借筆數依車輛所屬縣市加總', () => {
  const items = dashboardTrend.aggregateRentalsByCity([
    { vehicle: { station: { city: '臺北市' } } },
    { vehicle: { station: { city: '新北市' } } },
    { vehicle: { station: { city: '臺北市' } } }
  ]);

  assert.deepEqual(items, [
    { city: '臺北市', rentalCount: 2 },
    { city: '新北市', rentalCount: 1 }
  ]);
});

test('車隊趨勢回傳今天起算過去七天的租用車輛數', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-dashboard-'));
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

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/fleet-trend',
      headers: { cookie: loginResponse.headers['set-cookie'] }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.items.length, 7);
    assert.deepEqual(Object.keys(body.items[0]), ['date', 'totalVehicles', 'rentedVehicles']);
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('即時車隊統計 API 從車輛與租借資料表回傳各狀態數量', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-fleet-summary-'));
  const databaseUrl = `file:${path.join(temporaryDirectory, 'test.sqlite')}`;
  const password = 'TestPassword123!';
  let app;
  let prisma;

  try {
    await initializeDatabase({ databaseUrl, adminPassword: password });
    prisma = createPrisma(databaseUrl);
    await prisma.rental.deleteMany();
    await prisma.vehicle.updateMany({
      data: { status: 'available', cabinCondition: 'clean' }
    });

    const vehicles = await prisma.vehicle.findMany({
      select: { id: true },
      orderBy: { id: 'asc' }
    });
    await prisma.vehicle.update({
      where: { id: vehicles[0].id },
      data: { status: 'cleaning', cabinCondition: 'dirty' }
    });
    await prisma.vehicle.update({
      where: { id: vehicles[1].id },
      data: { status: 'maintenance' }
    });
    await prisma.rental.create({
      data: {
        vehicleId: vehicles[2].id,
        startedAt: new Date().toISOString(),
        status: 'active'
      }
    });

    app = await buildApp({ prisma, logger: false });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { employeeNo: 'ADM001', password }
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/fleet-summary',
      headers: { cookie: loginResponse.headers['set-cookie'] }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      totalVehicles: vehicles.length,
      availableVehicles: vehicles.length - 3,
      rentedVehicles: 1,
      cleaningVehicles: 1,
      maintenanceVehicles: 1
    });
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('縣市租借統計 API 僅加總過去七天開始的租借紀錄', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-rental-city-'));
  const databaseUrl = `file:${path.join(temporaryDirectory, 'test.sqlite')}`;
  const password = 'TestPassword123!';
  let app;
  let prisma;

  try {
    await initializeDatabase({ databaseUrl, adminPassword: password });
    prisma = createPrisma(databaseUrl);
    await prisma.rental.deleteMany();

    const taipeiStation = await prisma.station.findFirstOrThrow({ where: { city: '臺北市' } });
    const newTaipeiStation = await prisma.station.findFirstOrThrow({ where: { city: '新北市' } });
    const taipeiVehicle = await prisma.vehicle.create({
      data: { licensePlate: 'TST-7001', model: '測試車', color: '白', stationId: taipeiStation.id }
    });
    const newTaipeiVehicle = await prisma.vehicle.create({
      data: { licensePlate: 'TST-7002', model: '測試車', color: '白', stationId: newTaipeiStation.id }
    });
    const now = Date.now();
    await prisma.rental.createMany({
      data: [
        { vehicleId: taipeiVehicle.id, startedAt: new Date(now - 86400000).toISOString(), status: 'completed' },
        { vehicleId: taipeiVehicle.id, startedAt: new Date(now - 172800000).toISOString(), status: 'completed' },
        { vehicleId: newTaipeiVehicle.id, startedAt: new Date(now - 259200000).toISOString(), status: 'completed' },
        { vehicleId: newTaipeiVehicle.id, startedAt: new Date(now - 691200000).toISOString(), status: 'completed' }
      ]
    });

    app = await buildApp({ prisma, logger: false });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { employeeNo: 'ADM001', password }
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/rental-count-by-city',
      headers: { cookie: loginResponse.headers['set-cookie'] }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().items, [
      { city: '臺北市', rentalCount: 2 },
      { city: '新北市', rentalCount: 1 }
    ]);
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
