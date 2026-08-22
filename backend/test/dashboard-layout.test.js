import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildApp } from '../src/app.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('車隊管理頁面不再顯示上方統計卡片', async () => {
  const [fleetHtml, fleetStyles, fleetScript] = await Promise.all([
    readFile(path.join(projectRoot, 'car-management.html'), 'utf8'),
    readFile(path.join(projectRoot, 'css', 'fleet.css'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'fleet.js'), 'utf8')
  ]);

  assert.doesNotMatch(fleetHtml, /fleet-metrics|data-fleet-stat=|data-fleet-meta=/);
  assert.doesNotMatch(fleetStyles, /\.fleet-metrics/);
  assert.doesNotMatch(fleetScript, /renderMetrics/);
});

test('車隊管理桌面版左側顯示即時分布，右側顯示車輛清單', async () => {
  const [fleetHtml, fleetStyles] = await Promise.all([
    readFile(path.join(projectRoot, 'car-management.html'), 'utf8'),
    readFile(path.join(projectRoot, 'css', 'fleet.css'), 'utf8')
  ]);

  assert.match(
    fleetHtml,
    /<section class="grid fleet-grid">[\s\S]*<article class="card fleet-map-card">[\s\S]*<article class="card fleet-list-card">[\s\S]*<\/section>/
  );
  assert.match(fleetStyles, /\.fleet-grid\s*\{[^}]*grid-template-columns:\s*minmax\(300px, \.7fr\) minmax\(0, 1\.3fr\)/s);
  assert.match(fleetStyles, /@media\(max-width:1100px\)[\s\S]*?\.fleet-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('車隊管理桌面版使用全螢幕儀表板且每頁顯示五筆車輛', async () => {
  const [fleetStyles, fleetScript] = await Promise.all([
    readFile(path.join(projectRoot, 'css', 'fleet.css'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'fleet.js'), 'utf8')
  ]);

  assert.match(fleetStyles, /@media\(min-width:1101px\)[\s\S]*?\.app-body\[data-page="fleet"\]\s*\{[^}]*height:\s*100vh;[^}]*overflow:\s*hidden/s);
  assert.match(fleetStyles, /\.app-body\[data-page="fleet"\] \.page\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0/s);
  assert.match(fleetStyles, /\.fleet-grid > \.card\s*\{[^}]*height:\s*100%/s);
  assert.match(fleetScript, /pageSize:\s*5\b/);
});

test('權限設定桌面版使用全螢幕儀表板佈局', async () => {
  const permissionsStyles = await readFile(path.join(projectRoot, 'css', 'permissions.css'), 'utf8');

  assert.match(permissionsStyles, /@media\(min-width:1051px\)[\s\S]*?\.app-body\[data-page="permissions"\]\s*\{[^}]*height:\s*100vh;[^}]*overflow:\s*hidden/s);
  assert.match(permissionsStyles, /\.app-body\[data-page="permissions"\] \.page\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0/s);
  assert.match(permissionsStyles, /\.app-body\[data-page="permissions"\] \.settings\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0/s);
  assert.match(permissionsStyles, /\.settings \[data-settings-panel\]:not\(\[hidden\]\)\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0/s);
  assert.match(permissionsStyles, /\.settings \[data-settings-panel\]:not\(\[hidden\]\) \.card-body\s*\{[^}]*overflow:\s*auto/s);
});

test('營運總覽不再顯示車況分布卡片', async () => {
  const dashboardHtml = await readFile(path.join(projectRoot, 'dashboard.html'), 'utf8');

  assert.doesNotMatch(dashboardHtml, /車況分布/);
  assert.doesNotMatch(dashboardHtml, /fleet-distribution-card|dashboard-summary-column/);
});

test('營運總覽不再顯示異常警示與優先處理卡片', async () => {
  const dashboardHtml = await readFile(path.join(projectRoot, 'dashboard.html'), 'utf8');

  assert.doesNotMatch(dashboardHtml, /最新 AI 異常警示|優先處理事項/);
  assert.doesNotMatch(dashboardHtml, /dashboard-lower-grid|ai-alerts-card|priority-card/);
});

test('營運總覽即時統計將資料表數量更新到五張卡片', async () => {
  const [dashboardHtml, dashboardStyles, dashboardScript] = await Promise.all([
    readFile(path.join(projectRoot, 'dashboard.html'), 'utf8'),
    readFile(path.join(projectRoot, 'css', 'dashboard.css'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'dashboard.js'), 'utf8')
  ]);
  const elements = new Map();
  const document = {
    querySelector(selector) {
      const metric = selector.match(/data-fleet-metric="([^"]+)"/)?.[1];
      if (metric && !dashboardHtml.includes(`data-fleet-metric="${metric}"`)) return null;
      if (!elements.has(selector)) elements.set(selector, { textContent: '' });
      return elements.get(selector);
    }
  };
  const browserWindow = {};

  vm.runInNewContext(dashboardScript, { window: browserWindow, document, console });
  browserWindow.IRentDashboard.renderFleetSummary({
    totalVehicles: 20,
    availableVehicles: 12,
    rentedVehicles: 4,
    cleaningVehicles: 3,
    maintenanceVehicles: 1
  });

  assert.equal(elements.get('[data-fleet-metric="total"] strong')?.textContent, '20');
  assert.equal(elements.get('[data-fleet-metric="available"] strong').textContent, '12');
  assert.equal(elements.get('[data-fleet-metric="rented"] strong').textContent, '4');
  assert.equal(elements.get('[data-fleet-metric="cleaning"] strong').textContent, '3');
  assert.equal(elements.get('[data-fleet-metric="maintenance"] strong').textContent, '1');
  assert.match(dashboardHtml, /data-fleet-metric="total"[\s\S]*?車輛總數/);
  assert.match(dashboardStyles, /\.dashboard-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s);
});

test('營運總覽待維修卡片的標題與數字使用紅色', async () => {
  const [dashboardHtml, dashboardStyles] = await Promise.all([
    readFile(path.join(projectRoot, 'dashboard.html'), 'utf8'),
    readFile(path.join(projectRoot, 'css', 'dashboard.css'), 'utf8')
  ]);
  const maintenanceCard = dashboardHtml.match(
    /<article class="dashboard-metric[^>]+data-fleet-metric="maintenance"[\s\S]*?<\/article>/
  )?.[0] || '';

  assert.match(maintenanceCard, /class="dashboard-metric is-red"/);
  assert.match(
    dashboardStyles,
    /\.dashboard-metric\.is-red \.metric-content > span\s*\{[^}]*color:\s*var\(--metric-color\)/s
  );
});

test('營運總覽可租車輛卡片使用打勾圖示', async () => {
  const dashboardHtml = await readFile(path.join(projectRoot, 'dashboard.html'), 'utf8');
  const availableCard = dashboardHtml.match(
    /<article class="dashboard-metric[^>]+data-fleet-metric="available"[\s\S]*?<\/article>/
  )?.[0] || '';

  assert.match(availableCard, /data-icon="check"/);
  assert.doesNotMatch(availableCard, /M5 11h14/);
});

test('區域車輛概況將七日租借數量轉為縣市氣泡點', async () => {
  const dashboardScript = await readFile(path.join(projectRoot, 'js/dashboard.js'), 'utf8');
  const browserWindow = {};

  vm.runInNewContext(dashboardScript, { window: browserWindow, console });

  const counties = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { COUNTYNAME: '臺北市' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] }
    }]
  };
  const bubbles = browserWindow.IRentDashboard.createRentalBubbleCollection(counties, [
    { city: '台北市', rentalCount: 18 },
    { city: '新北市', rentalCount: 12 }
  ]);

  assert.equal(bubbles.type, 'FeatureCollection');
  assert.equal(bubbles.features.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(bubbles.features[0].geometry.coordinates)), [2, 2]);
  assert.equal(bubbles.features[0].properties.county, '臺北市');
  assert.equal(bubbles.features[0].properties.rentalCount, 18);
});

test('區域車輛概況使用單色氣泡顯示七日租借數量', async () => {
  const [dashboardHtml, dashboardScript] = await Promise.all([
    readFile(path.join(projectRoot, 'dashboard.html'), 'utf8'),
    readFile(path.join(projectRoot, 'js/dashboard.js'), 'utf8')
  ]);
  const browserWindow = {};

  vm.runInNewContext(dashboardScript, { window: browserWindow, console });

  const counties = {
    type: 'FeatureCollection',
    features: []
  };
  const bubbles = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [121.5, 25.04] },
      properties: { county: '臺北市', rentalCount: 18 }
    }]
  };
  const style = browserWindow.IRentDashboard.createRegionMapStyle(counties, bubbles);
  const layers = Object.fromEntries(Array.from(style.layers, layer => [layer.id, layer]));

  assert.match(dashboardHtml, /maplibre-gl@5\.24\.0\/dist\/maplibre-gl\.css/);
  assert.match(dashboardHtml, /maplibre-gl@5\.24\.0\/dist\/maplibre-gl\.js/);
  assert.equal(style.sources['taiwan-counties'].data, counties);
  assert.equal(style.sources['dashboard-rentals'].data, bubbles);
  assert.equal(layers['taiwan-counties-fill'].type, 'fill');
  assert.equal(layers['taiwan-counties-line'].type, 'line');
  assert.equal(layers['dashboard-rental-bubbles'].type, 'circle');
  assert.equal(layers['dashboard-rental-bubbles'].paint['circle-color'], '#3B82F6');
  assert.match(JSON.stringify(layers['dashboard-rental-bubbles'].paint['circle-radius']), /rentalCount/);
  assert.equal(layers['dashboard-rental-counts'].type, 'symbol');
  assert.deepEqual(JSON.parse(JSON.stringify(layers['dashboard-rental-counts'].layout['text-field'])), [
    'to-string', ['get', 'rentalCount']
  ]);
  assert.doesNotMatch(JSON.stringify(style), /healthScore|issueCount|status/);
});

test('區域車輛概況不顯示健康狀態圖例與資訊圖示', async () => {
  const dashboardHtml = await readFile(path.join(projectRoot, 'dashboard.html'), 'utf8');
  const regionCard = dashboardHtml.match(/<article class="region-overview-card[\s\S]*?<\/article>/)?.[0] || '';

  assert.doesNotMatch(regionCard, /info-dot|region-key|健康狀態/);
});

test('區域車輛概況排在儀表板最左方', async () => {
  const dashboardHtml = await readFile(path.join(projectRoot, 'dashboard.html'), 'utf8');
  const regionIndex = dashboardHtml.indexOf('region-overview-card');
  const trendIndex = dashboardHtml.indexOf('fleet-trend-card');
  const cityIndex = dashboardHtml.indexOf('rental-city-card');

  assert.ok(regionIndex > -1);
  assert.ok(regionIndex < trendIndex);
  assert.ok(trendIndex < cityIndex);
});

test('台灣縣市 GeoJSON 包含完整行政區邊界', async () => {
  const geoJsonText = await readFile(path.join(projectRoot, 'data', 'taiwan-counties.geojson'), 'utf8').catch(() => '');

  assert.ok(geoJsonText, '尚未建立台灣縣市 GeoJSON');
  const geoJson = JSON.parse(geoJsonText);
  const countyNames = geoJson.features.map(feature => feature.properties.COUNTYNAME);

  assert.equal(geoJson.type, 'FeatureCollection');
  assert.ok(geoJson.features.length >= 22);
  assert.ok(countyNames.includes('臺北市'));
  assert.ok(countyNames.includes('新北市'));
  assert.ok(countyNames.includes('高雄市'));
  assert.ok(countyNames.includes('連江縣'));
  assert.ok(geoJson.features.every(feature => ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)));
});

test('後端可透過 data 路徑回傳台灣縣市 GeoJSON', async t => {
  const app = await buildApp({ logger: false, prisma: {} });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/data/taiwan-counties.geojson' });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^application\/(?:geo\+)?json/);
  const geoJson = response.json();
  assert.equal(geoJson.type, 'FeatureCollection');
  assert.equal(geoJson.features.length, 22);
});

test('縣市租借數量圓餅圖不分車輛狀態', async () => {
  const dashboardScript = await readFile(path.join(projectRoot, 'js/dashboard.js'), 'utf8');
  const browserWindow = {};

  vm.runInNewContext(dashboardScript, { window: browserWindow, console });

  const option = browserWindow.IRentDashboard.createRentalCityPieOption([
    { city: '臺北市', rentalCount: 18 },
    { city: '新北市', rentalCount: 12 }
  ]);

  assert.equal(option.series.length, 1);
  assert.equal(option.series[0].type, 'pie');
  assert.deepEqual(
    Array.from(option.series[0].data, item => [item.name, item.value]),
    [['臺北市', 18], ['新北市', 12]]
  );
});

test('營運總覽左右 ECharts 使用高對比企業色且不載入 Chart.js', async () => {
  const [dashboardHtml, dashboardScript] = await Promise.all([
    readFile(path.join(projectRoot, 'dashboard.html'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'dashboard.js'), 'utf8')
  ]);
  const browserWindow = {};

  vm.runInNewContext(dashboardScript, { window: browserWindow, console });

  const trendOption = browserWindow.IRentDashboard.createFleetTrendOption([
    { date: '2026-08-21', totalVehicles: 30, rentedVehicles: 9 },
    { date: '2026-08-22', totalVehicles: 30, rentedVehicles: 10 }
  ]);
  const cityOption = browserWindow.IRentDashboard.createRentalCityPieOption([
    { city: '臺北市', rentalCount: 18 },
    { city: '新北市', rentalCount: 12 }
  ]);

  assert.doesNotMatch(dashboardHtml, /chart\.js/i);
  assert.deepEqual(Array.from(trendOption.color), ['#10B981', '#3B82F6']);
  assert.equal(trendOption.xAxis.axisLabel.color, '#475569');
  assert.equal(trendOption.yAxis.axisLabel.color, '#475569');
  assert.equal(trendOption.yAxis.splitLine.lineStyle.color, '#E2E8F0');
  assert.deepEqual(Array.from(cityOption.color), ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']);
  assert.equal(cityOption.legend.textStyle.color, '#475569');
  assert.equal(cityOption.series[0].label.color, '#475569');
  assert.doesNotMatch(JSON.stringify({ trendOption, cityOption }), /opacity|filter|rgba\(/i);
});

test('營運總覽圖表載入完成後隱藏白色訊息遮罩', async () => {
  const dashboardStyles = await readFile(path.join(projectRoot, 'css', 'dashboard.css'), 'utf8');

  assert.match(
    dashboardStyles,
    /\.trend-chart-message\[hidden\],\s*\.rental-city-chart-message\[hidden\]\s*\{[^}]*display:\s*none/s
  );
});

test('營運總覽桌面版使用全螢幕儀表板佈局', async () => {
  const dashboardStyles = await readFile(path.join(projectRoot, 'css', 'dashboard.css'), 'utf8');

  assert.match(dashboardStyles, /@media\(min-width:1280px\)[\s\S]*?\.app-body\[data-page="dashboard"\]\s*\{[^}]*height:\s*100vh;[^}]*overflow:\s*hidden/s);
  assert.match(dashboardStyles, /\.app-body\[data-page="dashboard"\] \.dashboard-main\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0/s);
  assert.match(dashboardStyles, /\.app-body\[data-page="dashboard"\] \.dashboard-content-grid\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0/s);
  assert.match(dashboardStyles, /\.dashboard-content-grid > \.dashboard-card\s*\{[^}]*height:\s*100%/s);
});
