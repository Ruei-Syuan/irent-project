import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createPrisma } from '../src/plugins/prisma.js';
import { initializeDatabase } from '../src/services/database-setup.js';

test('resource GET routes are readable without a back-office session', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-public-get-'));
  const databaseUrl = `file:${path.join(temporaryDirectory, 'test.sqlite')}`;
  let app;
  let prisma;

  try {
    await initializeDatabase({ databaseUrl, adminPassword: 'TestPassword123!' });
    prisma = createPrisma(databaseUrl);
    app = await buildApp({ prisma, logger: false });
    const station = await prisma.station.findFirstOrThrow();
    const vehicle = await prisma.vehicle.findFirstOrThrow();
    const department = await prisma.department.findFirstOrThrow();
    const user = await prisma.user.findFirstOrThrow();
    const role = await prisma.role.findFirstOrThrow();
    const permission = await prisma.permission.findFirstOrThrow();

    const urls = [
      '/api/v1/auth/me',
      '/api/v1/dashboard/fleet-summary',
      '/api/v1/dashboard/fleet-trend',
      '/api/v1/dashboard/rental-count-by-city',
      '/api/v1/ai-anomaly-alerts',
      '/api/v1/damage-annotations/not-found',
      '/api/v1/vehicles',
      '/api/v1/vehicles/map-summary',
      `/api/v1/vehicles/${vehicle.id}/history`,
      `/api/v1/vehicles/${vehicle.id}`,
      '/api/v1/cleaning-orders',
      '/api/v1/cleaning-orders/summary',
      '/api/v1/departments',
      `/api/v1/departments/${department.id}`,
      '/api/v1/users',
      `/api/v1/users/${user.id}`,
      '/api/v1/permissions',
      `/api/v1/permissions/${permission.id}`,
      '/api/v1/points',
      '/api/v1/points/MEM0001/transactions',
      '/api/v1/repair-orders',
      '/api/v1/stations',
      `/api/v1/stations/${station.id}`,
      '/api/v1/audit-logs',
      '/api/v1/audit-logs/1',
      '/api/v1/roles',
      `/api/v1/roles/${role.id}`,
    ];

    for (const url of urls) {
      const response = await app.inject({ method: 'GET', url });
      assert.notEqual(response.statusCode, 401, `GET ${url} should not require authentication`);
      assert.notEqual(response.statusCode, 403, `GET ${url} should not require a permission`);
    }
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});


test('vehicle map summary provides each vehicle plate and station address', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-vehicle-map-'));
  const databaseUrl = `file:${path.join(temporaryDirectory, 'test.sqlite')}`;
  let app;
  let prisma;

  try {
    await initializeDatabase({ databaseUrl, adminPassword: 'TestPassword123!' });
    prisma = createPrisma(databaseUrl);
    app = await buildApp({ prisma, logger: false });
    const response = await app.inject({ method: 'GET', url: '/api/v1/vehicles/map-summary' });
    const feature = response.json().features[0];
    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: feature.properties.id },
      include: { station: true }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(feature.properties.plateNumber, vehicle.licensePlate);
    assert.equal(feature.properties.stationName, vehicle.station.name);
    assert.equal(feature.properties.stationAddress, vehicle.station.address);
    assert.equal(feature.properties.vehicleTypeName, vehicle.model || '未知車型');
    const vehicleColumns = await prisma.$queryRawUnsafe('PRAGMA table_info("vehicles")');
    const modelColumn = vehicleColumns.find(column => column.name === 'model');
    assert.match(String(modelColumn?.dflt_value), /未知車型/);
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('vehicle history returns completed cleaning and repair orders as maintenance records', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-maintenance-history-'));
  const databaseUrl = `file:${path.join(temporaryDirectory, 'test.sqlite')}`;
  let app;
  let prisma;

  try {
    await initializeDatabase({ databaseUrl, adminPassword: 'TestPassword123!' });
    prisma = createPrisma(databaseUrl);
    app = await buildApp({ prisma, logger: false });
    const vehicle = await prisma.vehicle.findFirstOrThrow();

    await prisma.cleaningOrder.create({
      data: {
        orderNumber: 'CO-TEST-MAINTENANCE',
        vehicleLicensePlate: vehicle.licensePlate,
        condition: 'clean',
        dispatchStatus: 'assigned',
        originalCondition: 'average',
        cleaningFee: 500,
        cleaningProvider: 'irent_staff',
        note: '工單清潔測試',
        createdAt: '2030-01-02T02:00:00.000Z',
        updatedAt: '2030-01-02T02:00:00.000Z'
      }
    });
    await prisma.repairOrder.create({
      data: {
        repairCenter: '測試維修中心',
        orderNumber: 'RO-TEST-MAINTENANCE',
        vehicleLicensePlate: vehicle.licensePlate,
        maintenanceItem: '工單維修測試',
        status: '維修完畢',
        estimatedCost: 1200,
        actualCost: 1000,
        createdAt: '2030-01-01T02:00:00.000Z',
        completedAt: '2030-01-03T02:00:00.000Z'
      }
    });

    const response = await app.inject({ method: 'GET', url: `/api/v1/vehicles/${vehicle.id}/history` });
    const records = response.json().maintenanceRecords;

    assert.equal(response.statusCode, 200);
    assert.equal(records[0].type, 'maintenance');
    assert.equal(records[0].performedAt, '2030-01-03T02:00:00.000Z');
    assert.equal(records[1].type, 'cleaning');
    assert.equal(records[1].performedAt, '2030-01-02T02:00:00.000Z');
    assert.equal(records[1].note, '工單清潔測試');
  } finally {
    await app?.close();
    await prisma?.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});