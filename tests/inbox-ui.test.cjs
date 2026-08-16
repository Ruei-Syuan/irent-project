const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function loadLayoutHelpers() {
  const context = {
    console,
    document: {
      readyState: 'loading',
      addEventListener() {}
    },
    window: {}
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'layout.js'), 'utf8');
  vm.runInNewContext(source, context);
  return context.window.IRentLayout.helpers;
}

test('未讀徽章只計算對應類型且尚未讀取的項目', () => {
  const { countUnread } = loadLayoutHelpers();
  const counts = countUnread([
    { kind: 'notification', isRead: false },
    { kind: 'notification', isRead: false },
    { kind: 'notification', isRead: true },
    { kind: 'message', isRead: false },
    { kind: 'message', isRead: true }
  ]);

  assert.equal(counts.notifications, 2);
  assert.equal(counts.messages, 1);
});

test('全站搜尋會比對車牌及案件內容，並將標題相符結果排在前面', () => {
  const { searchCatalog } = loadLayoutHelpers();
  const catalog = [
    { title: '#WO-260809-042', searchText: '#WO-260809-042 RAC-4582 右後保桿鈑噴', category: '維修工單' },
    { title: 'RAC-4582', searchText: 'RAC-4582 Toyota Yaris 信義 A07', category: '車輛' },
    { title: '#DMG-260809-018', searchText: '#DMG-260809-018 RAC-4582 右後保桿刮傷', category: '車損案件' },
    { title: 'RBC-2108', searchText: 'RBC-2108 Toyota Vios', category: '車輛' }
  ];

  const results = searchCatalog(catalog, 'rac-4582');

  assert.equal(results.length, 3);
  assert.equal(results[0].title, 'RAC-4582');
  assert.equal(results[1].title, '#DMG-260809-018');
  assert.equal(results[2].title, '#WO-260809-042');
});
