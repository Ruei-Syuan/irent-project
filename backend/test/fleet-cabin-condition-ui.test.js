import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('車輛清單與詳情提供車內狀況顯示及修改功能', async () => {
  const [fleetHtml, fleetScript, vehicleApi] = await Promise.all([
    readFile(path.join(projectRoot, 'car-management.html'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'fleet.js'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'api', 'vehicles.js'), 'utf8')
  ]);

  assert.match(fleetHtml, /<th>\s*車內狀況\s*<\/th>/);
  assert.match(fleetScript, /乾淨/);
  assert.match(fleetScript, /普通/);
  assert.match(fleetScript, /髒污/);
  assert.match(fleetScript, /修改車內狀況/);
  assert.match(vehicleApi, /update:\s*\(id, payload\)/);
});

test('清潔工單使用資料表呈現三種清潔狀態', async () => {
  const [clearOrdersHtml, cleaningOrderApi] = await Promise.all([
    readFile(path.join(projectRoot, 'clear-orders.html'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'api', 'cleaning-orders.js'), 'utf8')
  ]);

  assert.match(clearOrdersHtml, /data-cleaning-orders-body/);
  assert.match(clearOrdersHtml, /工單／車輛/);
  assert.match(clearOrdersHtml, /建立時間/);
  assert.match(clearOrdersHtml, /髒污/);
  assert.match(clearOrdersHtml, /普通/);
  assert.match(clearOrdersHtml, /乾淨/);
  assert.match(clearOrdersHtml, /data-cleaning-page-size/);
  assert.match(cleaningOrderApi, /\/cleaning-orders/);
  assert.match(cleaningOrderApi, /summary/);
});

test('車輛清單移除今日里程並改用整體狀態', async () => {
  const fleetHtml = await readFile(path.join(projectRoot, 'car-management.html'), 'utf8');

  assert.match(fleetHtml, /<th>\s*整體狀態\s*<\/th>/);
  assert.doesNotMatch(fleetHtml, /<th>\s*今日里程\s*<\/th>/);
  assert.doesNotMatch(fleetHtml, /data-fleet-search/);
});

test('整體狀態同時反映車外維修與車內清潔', async () => {
  const fleetScript = await readFile(path.join(projectRoot, 'js', 'fleet.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(fleetScript, sandbox);
  const getOverallStatus = sandbox.window.IRentFleet.getOverallStatus;

  assert.equal(typeof getOverallStatus, 'function');
  assert.equal(getOverallStatus({ status: 'maintenance', cabinCondition: 'dirty' }), '待維修／待清潔');
  assert.equal(getOverallStatus({ status: 'maintenance', cabinCondition: 'clean' }), '待維修');
  assert.equal(getOverallStatus({ status: 'cleaning', cabinCondition: 'dirty' }), '待清潔');
  assert.equal(getOverallStatus({ status: 'available', cabinCondition: 'average' }), '可租');
});

test('車隊表格使用 TanStack Table 篩選每個資料欄位並分頁', async () => {
  const fleetScript = await readFile(path.join(projectRoot, 'js', 'fleet.js'), 'utf8');
  const tableCore = await import('@tanstack/table-core');
  const sandbox = { window: { TableCore: tableCore } };
  vm.runInNewContext(fleetScript, sandbox);
  const table = sandbox.window.IRentFleet.createVehicleTable([
    {
      id: 1,
      licensePlate: 'RAC-4582',
      model: 'Toyota Yaris',
      color: '白',
      station: { name: '信義站' },
      status: 'available',
      cabinCondition: 'clean',
      healthScore: 96,
      latestAnomaly: '無'
    },
    {
      id: 2,
      licensePlate: 'RBC-2108',
      model: 'Honda Fit',
      color: '黑',
      station: { name: '板橋站' },
      status: 'cleaning',
      cabinCondition: 'dirty',
      healthScore: 70,
      latestAnomaly: '輪胎異常'
    },
    {
      id: 3,
      licensePlate: 'RBA-6935',
      model: 'Toyota Vios',
      color: '銀',
      station: { name: '信義站' },
      status: 'available',
      cabinCondition: 'average',
      healthScore: 85,
      latestAnomaly: '無'
    }
  ]);

  const visibleVehicles = () => table.getRowModel().rows.map(row => row.original.licensePlate);
  table.getColumn('vehicle').setFilterValue('RAC-4582');
  assert.deepEqual(visibleVehicles(), ['RAC-4582']);
  table.resetColumnFilters();
  table.getColumn('station').setFilterValue('信義');
  assert.deepEqual(visibleVehicles(), ['RAC-4582', 'RBA-6935']);
  table.resetColumnFilters();
  table.getColumn('overallStatus').setFilterValue('待清潔');
  assert.deepEqual(visibleVehicles(), ['RBC-2108']);
  table.resetColumnFilters();
  table.getColumn('cabinCondition').setFilterValue('普通');
  assert.deepEqual(visibleVehicles(), ['RBA-6935']);
  table.resetColumnFilters();
  table.getColumn('healthScore').setFilterValue('85');
  assert.deepEqual(visibleVehicles(), ['RBA-6935']);
  table.resetColumnFilters();
  table.getColumn('latestAnomaly').setFilterValue('輪胎');
  assert.deepEqual(visibleVehicles(), ['RBC-2108']);

  table.resetColumnFilters();
  table.setPageSize(1);
  assert.equal(visibleVehicles().length, 1);
});

test('車輛歷程 API 使用正確端點新增及修改紀錄', async () => {
  const vehicleApiScript = await readFile(path.join(projectRoot, 'js', 'api', 'vehicles.js'), 'utf8');
  const requests = [];
  const sandbox = {
    window: {
      IRentApi: {
        request: async (url, options = {}) => {
          requests.push({ url, options });
          return {};
        }
      }
    }
  };
  vm.runInNewContext(vehicleApiScript, sandbox);
  const api = sandbox.window.IRentVehicleApi;

  await api.getHistory(7);
  await api.createRentalHistory(7, { rentalFee: 1200 });
  await api.updateRentalHistory(7, 11, { rentalFee: 1300 });
  await api.createServiceHistory(7, { cost: 500 });
  await api.updateServiceHistory(7, 12, { cost: 650 });

  assert.deepEqual(requests.map(request => [request.url, request.options.method || 'GET']), [
    ['/vehicles/7/history', 'GET'],
    ['/vehicles/7/history/rentals', 'POST'],
    ['/vehicles/7/history/rentals/11', 'PATCH'],
    ['/vehicles/7/history/services', 'POST'],
    ['/vehicles/7/history/services/12', 'PATCH']
  ]);
});

test('點擊車輛歷程會載入完整費用與三類紀錄', async () => {
  const fleetScript = await readFile(path.join(projectRoot, 'js', 'fleet.js'), 'utf8');
  let bodyClickListener;
  let historyRequestCount = 0;
  const dialogs = [];
  const body = {
    innerHTML: '',
    addEventListener(type, listener) {
      if (type === 'click') bodyClickListener = listener;
    }
  };
  const document = {
    querySelector(selector) {
      return selector === '[data-fleet-body]' ? body : null;
    },
    createElement() {
      return {
        value: '',
        set textContent(value) {
          this.value = String(value ?? '');
        },
        get innerHTML() {
          return this.value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
        }
      };
    },
    getElementById() {
      return null;
    }
  };
  const vehicle = {
    id: 7,
    licensePlate: 'RHH-0007',
    model: 'Toyota Yaris',
    color: '白',
    stationId: 1,
    station: { name: '測試站', city: '臺北市', district: '中正區' },
    status: 'maintenance',
    cabinCondition: 'clean',
    healthScore: 95,
    latestAnomaly: null
  };
  const tableCore = await import('@tanstack/table-core');
  const sandbox = {
    document,
    window: {
      TableCore: tableCore,
      IRentVehicleApi: {
        list: async () => [vehicle],
        mapSummary: async () => ({ type: 'FeatureCollection', features: [] }),
        getHistory: async () => {
          historyRequestCount += 1;
          return {
            summary: { rentalFee: 1200, cleaningCost: 500, maintenanceCost: 2400 },
            rentals: [{
              id: 1,
              startedAt: '2026-08-01T01:00:00.000Z',
              endedAt: '2026-08-01T03:00:00.000Z',
              status: 'completed',
              rentalFee: 1200,
              customer: { fullName: '王小明', memberNo: 'MEM0001', phone: '0912345678' }
            }],
            services: [
              { id: 2, type: 'cleaning', performedAt: '2026-08-02T01:00:00.000Z', cost: 500, note: '清潔' },
              { id: 3, type: 'maintenance', performedAt: '2026-08-03T01:00:00.000Z', cost: 2400, note: '維修' }
            ]
          };
        }
      },
      IRentStationApi: { list: async () => [] },
      Swal: {
        fire: async options => {
          dialogs.push(options);
          return { isConfirmed: false };
        },
        close() {}
      }
    }
  };
  vm.runInNewContext(fleetScript, sandbox);
  await sandbox.window.IRentFleet.init({
    getGlobalQuery: () => '',
    setApplyFilter() {},
    notify() {}
  });

  assert.match(body.innerHTML, /fleet-overall-status is-maintenance/);
  assert.match(body.innerHTML, /<b class="fleet-health-score is-risk">70<\/b>/);
  assert.doesNotMatch(body.innerHTML, /class="progress/);
  assert.match(body.innerHTML, /data-action="view-history"/);
  bodyClickListener({
    target: {
      closest(selector) {
        if (selector === '[data-action]') {
          return {
            dataset: { action: 'view-history' },
            closest: () => ({ dataset: { vehicleId: '7' } })
          };
        }
        return null;
      }
    }
  });
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(historyRequestCount, 1);
  assert.equal(dialogs[0].confirmButtonText, '新增歷程');
  assert.match(dialogs[0].html, /累計租金/);
  assert.match(dialogs[0].html, /租借紀錄/);
  assert.match(dialogs[0].html, /清潔紀錄/);
  assert.match(dialogs[0].html, /維修紀錄/);
  assert.match(dialogs[0].html, /王小明/);
  assert.match(dialogs[0].html, /修改紀錄/);
});
