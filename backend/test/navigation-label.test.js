import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('左側車損案件導覽不顯示 AI', async () => {
  const layoutScript = await readFile(path.join(projectRoot, 'js', 'layout.js'), 'utf8');

  assert.match(layoutScript, /key: 'damage-review', label: '車損案件'/);
  assert.doesNotMatch(layoutScript, /key: 'damage-review', label: 'AI 車損案件'/);
});

test('左側營運總覽使用專用儀表板圖示', async () => {
  const layoutScript = await readFile(path.join(projectRoot, 'js', 'layout.js'), 'utf8');

  assert.match(layoutScript, /key: 'dashboard', label: '營運總覽', href: 'dashboard\.html', icon: 'dashboard'/);
  assert.match(layoutScript, /dashboard:\s*'<svg[^']+M3 3h8v8H3V3/);
});

test('車輛管理與清潔工單頁面使用新的檔名與呼叫路徑', async () => {
  const [layoutScript, appSource] = await Promise.all([
    readFile(path.join(projectRoot, 'js', 'layout.js'), 'utf8'),
    readFile(path.join(projectRoot, 'backend', 'src', 'app.js'), 'utf8')
  ]);

  await assert.doesNotReject(access(path.join(projectRoot, 'car-management.html')));
  await assert.doesNotReject(access(path.join(projectRoot, 'clear-orders.html')));
  await assert.rejects(access(path.join(projectRoot, 'fleet.html')));
  await assert.rejects(access(path.join(projectRoot, 'dispatch.html')));
  assert.match(layoutScript, /href: 'car-management\.html'/);
  assert.match(layoutScript, /href: 'clear-orders\.html'/);
  assert.doesNotMatch(layoutScript, /href: '(?:fleet|dispatch)\.html'/);
  assert.match(appSource, /'car-management\.html': 'fleet\.view'/);
  assert.match(appSource, /'clear-orders\.html': 'dispatch\.view'/);
});

test('報表分析頁面與樣式以雙橫線檔名封存並停止提供路由', async t => {
  const [layoutScript, appSource, databaseSetupSource] = await Promise.all([
    readFile(path.join(projectRoot, 'js', 'layout.js'), 'utf8'),
    readFile(path.join(projectRoot, 'backend', 'src', 'app.js'), 'utf8'),
    readFile(path.join(projectRoot, 'backend', 'src', 'services', 'database-setup.js'), 'utf8')
  ]);
  const app = await buildApp({ logger: false, prisma: {} });
  t.after(() => app.close());

  await assert.doesNotReject(access(path.join(projectRoot, '--reports.html')));
  await assert.doesNotReject(access(path.join(projectRoot, 'css', '--reports.css')));
  await assert.rejects(access(path.join(projectRoot, 'reports.html')));
  await assert.rejects(access(path.join(projectRoot, 'css', 'reports.css')));
  const archivedHtml = await readFile(path.join(projectRoot, '--reports.html'), 'utf8');
  const archivedStyles = await readFile(path.join(projectRoot, 'css', '--reports.css'), 'utf8');
  const response = await app.inject({ url: '/reports.html' });

  assert.equal(response.statusCode, 404);
  assert.match(layoutScript, /\/\/ 報表分析暫時停用：\s*\{ key: 'reports'/);
  assert.match(layoutScript, /\/\* 報表分析互動暫時停用[\s\S]*function initReports\(\)[\s\S]*\*\//);
  assert.match(appSource, /\/\/ 報表分析暫時停用：\s*'reports\.html': 'reports\.view'/);
  assert.match(databaseSetupSource, /\/\/ 報表分析暫時停用：\s*\['reports'/);
  assert.match(archivedHtml, /<!-- 報表分析頁面暫時停用/);
  assert.match(archivedHtml, /href="css\/--reports\.css"/);
  assert.match(archivedStyles, /\/\* 報表分析樣式暫時停用/);
});

test('points management navigation is available', async () => {
  const [layoutScript, appSource, databaseSetupSource] = await Promise.all([
    readFile(path.join(projectRoot, 'js', 'layout.js'), 'utf8'),
    readFile(path.join(projectRoot, 'backend', 'src', 'app.js'), 'utf8'),
    readFile(path.join(projectRoot, 'backend', 'src', 'services', 'database-setup.js'), 'utf8')
  ]);

  await assert.doesNotReject(access(path.join(projectRoot, 'points-management.html')));
  assert.match(layoutScript, /key:\s*["']points["'],\s*label:\s*["']積分管理["'],\s*href:\s*["']points-management\.html["']/);
  assert.match(appSource, /'points-management\.html': 'points\.view'/);
  assert.match(databaseSetupSource, /\['points',\s*['"](?:積分管理|\\u7A4D\\u5206\\u7BA1\\u7406)['"]/);
});

test('management logout uses SweetAlert2 confirmation', async () => {
  const adminPages = [
    'dashboard.html',
    'car-management.html',
    'damage-review.html',
    'clear-orders.html',
    'work-orders.html',
    'points-management.html',
    'permissions.html',
  ];
  const [layoutScript, ...pageSources] = await Promise.all([
    readFile(path.join(projectRoot, 'js', 'layout.js'), 'utf8'),
    ...adminPages.map((page) => readFile(path.join(projectRoot, page), 'utf8')),
  ]);

  assert.match(layoutScript, /Swal\.fire\(/);
  assert.doesNotMatch(layoutScript, /window\.confirm\(/);
  for (const pageSource of pageSources) {
    assert.match(pageSource, /cdn\.jsdelivr\.net\/npm\/sweetalert2@11/);
  }
});
