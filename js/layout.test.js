const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLayout() {
  const document = {
    readyState: 'loading',
    addEventListener() {},
    body: { dataset: {} }
  };
  const window = {};
  const source = fs.readFileSync(path.join(__dirname, 'layout.js'), 'utf8');

  vm.runInNewContext(source, { console, document, window });
  return window.IRentLayout;
}

function makeClassList(initial = []) {
  const values = new Set(initial);

  return {
    contains(value) {
      return values.has(value);
    },
    toggle(value, force) {
      if (force) values.add(value);
      else values.delete(value);
    }
  };
}

test('filterElements 同時套用關鍵字與狀態並更新 hidden', () => {
  const { helpers } = loadLayout();
  const elements = [
    { textContent: 'RAC-4582 待維修', hidden: false },
    { textContent: 'RBC-2108 待清潔', hidden: false },
    { textContent: 'RBA-6935 可租', hidden: false }
  ];

  const visible = helpers.filterElements(elements, 'rbc', element => element.textContent.includes('待清潔'));

  assert.equal(visible, 1);
  assert.deepEqual(elements.map(element => element.hidden), [true, false, true]);
});

test('setActive 只保留指定項目的 active 狀態', () => {
  const { helpers } = loadLayout();
  const elements = [
    { classList: makeClassList(['active']) },
    { classList: makeClassList() },
    { classList: makeClassList() }
  ];

  helpers.setActive(elements, elements[1]);

  assert.deepEqual(elements.map(element => element.classList.contains('active')), [false, true, false]);
});

test('rowsToCsv 會正確處理逗號、引號與換行', () => {
  const { helpers } = loadLayout();
  const csv = helpers.rowsToCsv([
    ['車牌', '說明'],
    ['RAC-4582', '刮傷, 8 cm²'],
    ['RBC-2108', '使用「深度清潔」\n處理']
  ]);

  assert.equal(
    csv,
    '\uFEFF車牌,說明\r\nRAC-4582,"刮傷, 8 cm²"\r\nRBC-2108,"使用「深度清潔」\n處理"'
  );
});
