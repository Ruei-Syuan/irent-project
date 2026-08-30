import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('積分管理使用左會員清單右點數預覽的滿版雙欄版面', async () => {
  const [html, styles, script, layout] = await Promise.all([
    readFile(path.join(projectRoot, 'points-management.html'), 'utf8'),
    readFile(path.join(projectRoot, 'css', 'points-management.css'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'points-management.js'), 'utf8'),
    readFile(path.join(projectRoot, 'js', 'layout.js'), 'utf8')
  ]);

  assert.match(html, /class="points-layout"/);
  assert.match(html, /data-points-customer-list/);
  assert.match(html, /data-points-detail-panel/);
  assert.doesNotMatch(html, /data-points-search/);
  assert.doesNotMatch(script, /data-points-search/);
  assert.doesNotMatch(html, /<th>最後異動<\/th>/);
  assert.doesNotMatch(script, /formatDate\(customer\.updatedAt\)/);
  assert.match(html, /data-points-detail-panel>[\s\S]*會員點數歷史紀錄預覽[\s\S]*<\/article>/);
  assert.doesNotMatch(script, /showDetail\(state\.selectedMemberNo \|\| state\.customers\[0\]\.memberNo\)/);
  assert.match(script, /row\.addEventListener\('click', \(\) => showDetail\(row\.dataset\.memberNo\)\)/);
  assert.match(script, /globalObject\.IRentPointsApi\.transactions\(memberNo\)/);
  assert.match(script, /會員點數歷史紀錄預覽/);
  assert.match(script, /data-points-history-filter/);
  assert.match(script, /data-points-summary-earned/);
  assert.match(script, /data-points-summary-redeemed/);
  assert.match(script, /data-points-summary-monthly/);
  assert.match(html, /data-points-page-size/);
  assert.match(html, /<option value="10" selected>10 筆<\/option>/);
  assert.match(html, /data-points-page-numbers/);
  assert.match(script, /data-points-page-size/);
  assert.match(script, /pageSize: 10/);
  assert.match(script, /data-points-page-numbers/);
  assert.match(script, /document\.querySelector\('\[data-points-add\]'\)\?\.addEventListener/);
  assert.match(script, /const memberCount = document\.querySelector\('\[data-points-member-count\]'\)/);
  assert.match(script, /if \(memberCount\)/);
  assert.match(styles, /\.points-pagination/);
  assert.match(styles, /(?:^|\n)\.points-positive\s*\{[^}]*color:\s*var\(--green\)/);
  assert.match(styles, /(?:^|\n)\.points-negative\s*\{[^}]*color:\s*var\(--red\)/);
  assert.match(styles, /\.points-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(280px, 1fr\) minmax\(280px, 1fr\)/);
  assert.doesNotMatch(script, /showDetail\(state\.selectedMemberNo \|\| state\.customers\[0\]\.memberNo\)/);
  assert.doesNotMatch(script, /data-points-detail(?!-panel)|查看明細/);
  assert.ok(layout.indexOf('key: "points"') < layout.indexOf('key: "permissions"'));
});
