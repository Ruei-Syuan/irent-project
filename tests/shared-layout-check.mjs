import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pages = [
  ['dashboard.html', 'dashboard', '營運總覽'],
  ['fleet.html', 'fleet', '車隊管理'],
  ['damage-review.html', 'damage-review', 'AI 車損案件'],
  ['dispatch.html', 'dispatch', '清潔維修派工'],
  ['work-orders.html', 'work-orders', '維修工單'],
  ['reports.html', 'reports', '報表分析'],
  ['permissions.html', 'permissions', '權限設定']
];

const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const profilePath = await mkdtemp(join(tmpdir(), 'irent-shared-layout-'));
const debuggingPort = 9341;
const chrome = spawn(chromePath, [
  '--headless',
  '--disable-gpu',
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profilePath}`,
  '--window-size=500,900',
  pathToFileURL(resolve(pages[0][0])).href
], { stdio: 'ignore', windowsHide: true });

const wait = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));

async function findPageTarget() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      const targets = await response.json();
      const target = targets.find(item => item.type === 'page');
      if (target) return target;
    } catch {
      // Chrome has not opened its debugging endpoint yet.
    }
    await wait(100);
  }
  throw new Error('Chrome page target was not available.');
}

async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  return {
    call(method, params = {}) {
      return new Promise((resolvePromise, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve: resolvePromise, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); }
  };
}

async function waitForPageReady(client, fileName, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const evaluation = await client.call('Runtime.evaluate', {
      expression: `document.readyState === 'complete'
        && Boolean(document.querySelector('.app-nav a[aria-current="page"]'))
        && Boolean(document.querySelector('.app-heading h1'))`,
      returnByValue: true
    });
    if (evaluation.result.value) return;
    await wait(50);
  }
  throw new Error(`${fileName}: timed out waiting for document and shared layout initialization.`);
}

try {
  const target = await findPageTarget();
  const client = await connect(target);
  await client.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true
  });

  for (const [fileName, expectedKey, expectedLabel] of pages) {
    await client.call('Page.navigate', { url: pathToFileURL(resolve(fileName)).href });
    await waitForPageReady(client, fileName);
    const evaluation = await client.call('Runtime.evaluate', {
      expression: `(() => {
        const rect = selector => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box ? { left: box.left, right: box.right, width: box.width } : null;
        };
        return {
          readyState: document.readyState,
          pageKey: document.body.dataset.page,
          viewport: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          styleSheets: document.styleSheets.length,
          activeNav: document.querySelector('.app-nav a[aria-current="page"]')?.dataset.pageKey,
          activeNavCount: document.querySelectorAll('.app-nav a[aria-current="page"]').length,
          navCount: document.querySelectorAll('.app-nav a').length,
          heading: document.querySelector('.app-heading h1')?.textContent.trim(),
          userName: document.querySelector('.app-user-copy strong')?.textContent.trim(),
          utilityButtons: document.querySelectorAll('.layout-utility-button[aria-label]').length,
          mainTextLength: document.querySelector('main')?.innerText.trim().length || 0,
          topbar: rect('.app-topbar'),
          user: rect('.app-user'),
          search: rect('.app-search')
        };
      })()`,
      returnByValue: true
    });
    const layout = evaluation.result.value;

    assert.equal(layout.readyState, 'complete', `${fileName}: document did not finish loading.`);
    assert.equal(layout.pageKey, expectedKey, `${fileName}: body page key mismatch.`);
    assert.equal(layout.activeNav, expectedKey, `${fileName}: active navigation mismatch.`);
    assert.equal(layout.activeNavCount, 1, `${fileName}: expected exactly one active navigation item.`);
    assert.equal(layout.navCount, 7, `${fileName}: expected seven navigation items.`);
    assert.equal(layout.heading, expectedLabel, `${fileName}: topbar heading mismatch.`);
    assert.equal(layout.userName, 'Celine', `${fileName}: Celine user area missing.`);
    assert.equal(layout.utilityButtons, 2, `${fileName}: notification/message buttons missing.`);
    assert.equal(layout.viewport, 390, `${fileName}: mobile viewport mismatch.`);
    assert.equal(layout.scrollWidth, layout.viewport, `${fileName}: page overflows mobile viewport.`);
    assert.ok(layout.styleSheets >= 3, `${fileName}: shared or page stylesheet missing.`);
    assert.ok(layout.mainTextLength > 0, `${fileName}: main content is empty.`);
    assert.ok(layout.topbar?.left >= 0 && layout.topbar?.right <= layout.viewport, `${fileName}: topbar is clipped.`);
    assert.ok(layout.user?.left >= 0 && layout.user?.right <= layout.viewport, `${fileName}: user area is clipped.`);
    assert.ok(layout.search?.left >= 0 && layout.search?.right <= layout.viewport, `${fileName}: search is clipped.`);

    console.log(`${fileName}: shared layout passed at 390px.`);
  }

  client.close();
  console.log(`Shared browser layout verification passed for ${pages.length} pages.`);
} finally {
  chrome.kill();
  await wait(250);
  await rm(profilePath, { recursive: true, force: true }).catch(() => {});
}
