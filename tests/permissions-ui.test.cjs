const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { groupPermissions, validateUserPayload } = require('../js/permissions');

describe('權限管理前端資料處理', () => {
  test('權限依模組分組，角色矩陣不混入帳號資料', () => {
    const rows = groupPermissions([
      { id: 1, code: 'fleet.view', module: 'fleet', moduleLabel: '車隊管理', action: 'view', actionLabel: '檢視' },
      { id: 2, code: 'fleet.edit', module: 'fleet', moduleLabel: '車隊管理', action: 'edit', actionLabel: '編輯' },
      { id: 3, code: 'users.view', module: 'users', moduleLabel: '帳號管理', action: 'view', actionLabel: '檢視' }
    ]);

    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      module: 'fleet',
      moduleLabel: '車隊管理',
      permissions: {
        view: { id: 1, code: 'fleet.view', module: 'fleet', moduleLabel: '車隊管理', action: 'view', actionLabel: '檢視' },
        edit: { id: 2, code: 'fleet.edit', module: 'fleet', moduleLabel: '車隊管理', action: 'edit', actionLabel: '編輯' }
      }
    });
  });

  test('新增帳號會驗證員工編號、姓名、密碼及關聯欄位', () => {
    assert.equal(validateUserPayload({ employeeNo: 'OPS999', name: '周欣怡', password: 'Test@1234', roleId: 2, departmentId: 1 }), '');
    assert.equal(validateUserPayload({ employeeNo: '999', name: '周欣怡', password: 'Test@1234', roleId: 2, departmentId: 1 }), '員工編號格式需為 3 碼英文加 3 碼數字');
    assert.equal(validateUserPayload({ employeeNo: 'OPS999', name: '', password: 'Test@1234', roleId: 2, departmentId: 1 }), '請輸入姓名');
    assert.equal(validateUserPayload({ employeeNo: 'OPS999', name: '周欣怡', password: '123', roleId: 2, departmentId: 1 }), '密碼至少需要 8 個字元');
    assert.equal(validateUserPayload({ employeeNo: 'OPS999', name: '周欣怡', password: 'Test@1234', roleId: 0, departmentId: 1 }), '請選擇角色與部門');
  });
});
