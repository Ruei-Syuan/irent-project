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

test('車輛健康分數由車內與車外各占一半計算', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const station = await prisma.station.findFirstOrThrow();
    const cases = [
      { suffix: '01', status: 'available', cabinCondition: 'clean', expected: 100 },
      { suffix: '02', status: 'available', cabinCondition: 'average', expected: 85 },
      { suffix: '03', status: 'cleaning', cabinCondition: 'dirty', expected: 70 },
      { suffix: '04', status: 'maintenance', cabinCondition: 'clean', expected: 70 },
      { suffix: '05', status: 'maintenance', cabinCondition: 'average', expected: 55 },
      { suffix: '06', status: 'maintenance', cabinCondition: 'dirty', expected: 40 }
    ];

    for (const item of cases) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/vehicles',
        headers: { cookie },
        payload: {
          licensePlate: `RHS-99${item.suffix}`,
          model: 'Health Score Test',
          color: '白',
          stationId: station.id,
          status: item.status,
          cabinCondition: item.cabinCondition
        }
      });

      assert.equal(response.statusCode, 201);
      assert.equal(response.json().item.healthScore, item.expected);
    }
  });
});

test('修改車內或車外狀況時會重新計算健康分數', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const vehicle = await prisma.vehicle.findFirstOrThrow({
      where: { cabinCondition: 'clean', status: 'available' }
    });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vehicles/${vehicle.id}`,
      headers: { cookie },
      payload: { status: 'maintenance', cabinCondition: 'average' }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().item.healthScore, 55);
  });
});

test('車輛資料表不儲存健康分數', async () => {
  await withAuthenticatedApp(async ({ prisma }) => {
    const columns = await prisma.$queryRawUnsafe('PRAGMA table_info("vehicles")');
    assert.equal(columns.some(column => column.name === 'health_score'), false);
  });
});

test('查詢車輛時依最新車內與車外狀況動態計算健康分數', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const vehicle = await prisma.vehicle.findFirstOrThrow({
      where: { cabinCondition: 'clean', status: 'available' }
    });
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: 'maintenance', cabinCondition: 'average' }
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/vehicles/${vehicle.id}`,
      headers: { cookie }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().item.healthScore, 55);
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

test('清潔工單使用獨立資料表並保留歷史資料', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cleaning-orders?page=1&pageSize=5',
      headers: { cookie }
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.equal(body.items.length, 5);
    assert.ok(body.pagination.total > 30);
    assert.ok(body.items.every(item => ['dirty', 'average', 'clean'].includes(item.condition)));
    assert.ok(body.items.every(item => item.orderNumber && item.vehicle && item.createdAt));

    const history = await prisma.cleaningOrder.findMany({
      where: { vehicleLicensePlate: 'RAC-4582' },
      orderBy: { createdAt: 'asc' }
    });
    assert.ok(history.length >= 2);
    assert.notEqual(history[0].createdAt, history.at(-1).createdAt);

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/cleaning-orders/summary',
      headers: { cookie }
    });
    assert.equal(summaryResponse.statusCode, 200);
    const summary = summaryResponse.json();
    assert.equal(summary.total, body.pagination.total);
    assert.equal(summary.total, summary.dirty + summary.average + summary.clean);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cleaning-orders',
      headers: { cookie },
      payload: {
        vehicleLicensePlate: 'RAC-4582',
        condition: 'clean',
        note: '歷史資料新增測試'
      }
    });
    assert.equal(createResponse.statusCode, 201, createResponse.body);
    const createdItem = createResponse.json().item;
    const storedItem = await prisma.cleaningOrder.findUnique({
      where: { orderNumber: createdItem.orderNumber }
    });
    assert.equal(storedItem.note, '歷史資料新增測試');
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

test('維修工單以車牌關聯車輛並限制工單狀態', async () => {
  await withAuthenticatedApp(async ({ prisma }) => {
    const vehicle = await prisma.vehicle.findFirstOrThrow();
    const manager = await prisma.user.findFirstOrThrow();
    const repairOrder = await prisma.repairOrder.create({
      data: {
        repairCenter: '信義速修中心',
        orderNumber: 'RO-260822-001',
        vehicleLicensePlate: vehicle.licensePlate,
        maintenanceItem: '更換煞車皮',
        status: '維修中',
        assignedManagerId: manager.id,
        estimatedCost: 4200,
        actualCost: 3900
      },
      include: { vehicle: true, assignedManager: true }
    });

    assert.equal(repairOrder.vehicle.licensePlate, vehicle.licensePlate);
    assert.equal(repairOrder.assignedManager.id, manager.id);
    assert.equal(repairOrder.status, '維修中');

    await assert.rejects(
      prisma.repairOrder.create({
        data: {
          repairCenter: '信義速修中心',
          orderNumber: 'RO-260822-002',
          vehicleLicensePlate: vehicle.licensePlate,
          maintenanceItem: '更換輪胎',
          status: '待核准',
          estimatedCost: 1800
        }
      })
    );
  });
});

test('維修工單清單支援每頁五筆分頁', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    await prisma.repairOrder.deleteMany();
    const vehicles = await prisma.vehicle.findMany({ take: 6, orderBy: { id: 'asc' } });
    const manager = await prisma.user.findFirstOrThrow();
    await prisma.repairOrder.createMany({
      data: vehicles.map((vehicle, index) => ({
        repairCenter: '測試維修中心',
        orderNumber: `RO-PAGE-${String(index + 1).padStart(3, '0')}`,
        vehicleLicensePlate: vehicle.licensePlate,
        maintenanceItem: '分頁測試維修',
        status: '維修中',
        assignedManagerId: manager.id,
        estimatedCost: 1000 + index
      }))
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/repair-orders?page=2&pageSize=5',
      headers: { cookie }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.items.length, 1);
    assert.deepEqual(body.pagination, { page: 2, pageSize: 5, total: 6, totalPages: 2 });

    const searchResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/repair-orders?search=RO-PAGE-006&pageSize=5',
      headers: { cookie }
    });
    assert.equal(searchResponse.statusCode, 200);
    assert.equal(searchResponse.json().pagination.total, 1);
  });
});

test('維修工單清單同時套用月份與狀態篩選', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    await prisma.repairOrder.deleteMany();
    const vehicle = await prisma.vehicle.findFirstOrThrow();
    const manager = await prisma.user.findFirstOrThrow();
    await prisma.repairOrder.createMany({
      data: [
        {
          repairCenter: '測試維修中心',
          orderNumber: 'RO-FILTER-MATCH',
          vehicleLicensePlate: vehicle.licensePlate,
          maintenanceItem: '月份狀態交集測試',
          status: '維修完畢',
          assignedManagerId: manager.id,
          estimatedCost: 2000,
          completedAt: '2026-07-15T08:00:00.000Z'
        },
        {
          repairCenter: '測試維修中心',
          orderNumber: 'RO-FILTER-WRONG-STATUS',
          vehicleLicensePlate: vehicle.licensePlate,
          maintenanceItem: '月份狀態交集測試',
          status: '待驗收',
          assignedManagerId: manager.id,
          estimatedCost: 2000,
          completedAt: '2026-07-20T08:00:00.000Z'
        },
        {
          repairCenter: '測試維修中心',
          orderNumber: 'RO-FILTER-WRONG-MONTH',
          vehicleLicensePlate: vehicle.licensePlate,
          maintenanceItem: '月份狀態交集測試',
          status: '維修完畢',
          assignedManagerId: manager.id,
          estimatedCost: 2000,
          completedAt: '2026-06-20T08:00:00.000Z'
        }
      ]
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/repair-orders?month=2026-07&status=維修完畢',
      headers: { cookie }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().items.map(item => item.orderNumber), ['RO-FILTER-MATCH']);
  });
});

test('待驗收工單支援單筆與批次驗收', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    await prisma.repairOrder.deleteMany();
    const vehicles = await prisma.vehicle.findMany({ take: 3, orderBy: { id: 'asc' } });
    const manager = await prisma.user.findFirstOrThrow();
    const orders = await prisma.repairOrder.createManyAndReturn({
      data: vehicles.map((vehicle, index) => ({
        repairCenter: '測試維修中心',
        orderNumber: `RO-ACCEPT-${String(index + 1).padStart(3, '0')}`,
        vehicleLicensePlate: vehicle.licensePlate,
        maintenanceItem: '驗收測試',
        status: '待驗收',
        assignedManagerId: manager.id,
        estimatedCost: 1000
      }))
    });

    const singleResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/repair-orders/${orders[0].id}/accept`,
      headers: { cookie }
    });
    assert.equal(singleResponse.statusCode, 200);
    assert.equal(singleResponse.json().item.status, '維修完畢');
    assert.ok(singleResponse.json().item.completedAt);

    const batchResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/repair-orders/bulk-accept',
      headers: { cookie },
      payload: { ids: orders.slice(1).map(order => order.id) }
    });
    assert.equal(batchResponse.statusCode, 200);
    assert.equal(batchResponse.json().updatedCount, 2);

    const remaining = await prisma.repairOrder.count({ where: { status: '待驗收' } });
    assert.equal(remaining, 0);
  });
});

test('維修完畢工單的實際費用不可為空', async () => {
  await withAuthenticatedApp(async ({ prisma }) => {
    const missingActualCost = await prisma.repairOrder.count({
      where: { status: '維修完畢', actualCost: null }
    });
    assert.equal(missingActualCost, 0);
  });
});
