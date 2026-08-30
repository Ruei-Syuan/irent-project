import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createPrisma } from '../src/plugins/prisma.js';
import { initializeDatabase } from '../src/services/database-setup.js';

async function withAuthenticatedApp(run) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'irent-points-'));
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

test('會員積分管理可列出會員點數並新增記點交易', async () => {
  await withAuthenticatedApp(async ({ app, prisma, cookie }) => {
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/points?search=MEM0001',
      headers: { cookie }
    });

    assert.equal(listResponse.statusCode, 200, listResponse.body);
    assert.equal(listResponse.json().items[0].memberNo, 'MEM0001');
    assert.equal(listResponse.json().items[0].pointsBalance, 0);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/points',
      headers: { cookie },
      payload: {
        memberNo: 'MEM0001',
        points: 100,
        type: 'earn',
        reason: '租借回饋'
      }
    });

    assert.equal(createResponse.statusCode, 201, createResponse.body);
    assert.equal(createResponse.json().item.points, 100);
    assert.equal(createResponse.json().item.balanceAfter, 100);

    const deductResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/points',
      headers: { cookie },
      payload: {
        memberNo: 'MEM0001',
        points: -30,
        type: 'redeem',
        reason: '折抵租金'
      }
    });

    assert.equal(deductResponse.statusCode, 201);
    assert.equal(deductResponse.json().item.balanceAfter, 70);

    const historyResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/points/MEM0001/transactions',
      headers: { cookie }
    });

    assert.equal(historyResponse.statusCode, 200);
    assert.equal(historyResponse.json().items.length, 2);
    assert.equal(historyResponse.json().summary.pointsBalance, 70);
    assert.equal(historyResponse.json().summary.totalEarned, 100);
    assert.equal(historyResponse.json().summary.totalRedeemed, 30);
    assert.equal(typeof historyResponse.json().summary.monthlyChange, 'number');
    assert.equal(await prisma.customerPointTransaction.count(), 2);
  });
});

test('會員積分不可扣成負數', async () => {
  await withAuthenticatedApp(async ({ app, cookie }) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/points',
      headers: { cookie },
      payload: {
        memberNo: 'MEM0001',
        points: -1,
        type: 'redeem',
        reason: '超出餘額'
      }
    });

    assert.equal(response.statusCode, 409);
  });
});
