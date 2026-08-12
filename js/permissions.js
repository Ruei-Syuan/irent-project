(function permissionsModule(globalObject, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalObject) globalObject.IRentPermissions = api;
})(typeof window !== 'undefined' ? window : globalThis, () => {
  'use strict';

  const actionColumns = [
    ['view'],
    ['create'],
    ['edit'],
    ['review', 'approve'],
    ['export'],
    ['delete', 'manage']
  ];

  function groupPermissions(permissions) {
    const groups = new Map();
    permissions.forEach(permission => {
      if (!groups.has(permission.module)) {
        groups.set(permission.module, {
          module: permission.module,
          moduleLabel: permission.moduleLabel,
          permissions: {}
        });
      }
      groups.get(permission.module).permissions[permission.action] = permission;
    });
    return [...groups.values()];
  }

  function validateUserPayload(payload, editing = false) {
    if (!/^[A-Z]{3}\d{3}$/.test(String(payload.employeeNo || '').trim().toUpperCase())) {
      return '員工編號格式需為 3 碼英文加 3 碼數字';
    }
    if (!String(payload.name || '').trim()) return '請輸入姓名';
    if (!editing && String(payload.password || '').length < 8) return '密碼至少需要 8 個字元';
    if (editing && payload.password && String(payload.password).length < 8) return '密碼至少需要 8 個字元';
    if (!Number(payload.roleId) || !Number(payload.departmentId)) return '請選擇角色與部門';
    return '';
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: options.body ? { 'content-type': 'application/json', ...options.headers } : options.headers
    });
    if (response.status === 401) {
      window.location.replace('/login.html');
      throw new Error('請先登入');
    }
    if (response.status === 204) return null;
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '操作失敗');
    return result;
  }

  function escapeText(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }

  function init() {
    const roleTabs = document.querySelector('[data-role-tabs]');
    if (!roleTabs) return;

    const state = {
      roles: [],
      permissions: [],
      users: [],
      departments: [],
      auditLogs: [],
      activeRoleId: null,
      draftPermissionIds: new Set()
    };
    const permissionBody = document.querySelector('[data-permission-table] tbody');
    const usersBody = document.querySelector('[data-users-table] tbody');
    const roleFilter = document.querySelector('[data-role-filter]');
    const userSearch = document.querySelector('[data-user-search]');
    const userDialog = document.querySelector('[data-user-dialog]');
    const userForm = document.querySelector('[data-user-form]');
    const matrixMessage = document.querySelector('[data-matrix-message]');

    const activeRole = () => state.roles.find(role => role.id === state.activeRoleId);
    const can = code => window.IRentCurrentUser?.permissions?.includes(code);

    function renderRoleTabs() {
      roleTabs.innerHTML = state.roles.map(role => `
        <button class="role${role.id === state.activeRoleId ? ' active' : ''}" type="button" data-role-id="${role.id}">
          ${escapeText(role.name)} <span>${role.userCount}</span>
        </button>
      `).join('');
      roleFilter.innerHTML = '<option value="">全部角色</option>' + state.roles.map(role =>
        `<option value="${role.id}">${escapeText(role.name)}</option>`
      ).join('');
    }

    function resetPermissionDraft() {
      state.draftPermissionIds = new Set((activeRole()?.permissions || []).map(permission => permission.id));
      renderPermissionMatrix();
      matrixMessage.textContent = '';
    }

    function renderPermissionMatrix() {
      permissionBody.innerHTML = groupPermissions(state.permissions).map(group => {
        const cells = actionColumns.map(actions => {
          const permission = actions.map(action => group.permissions[action]).find(Boolean);
          if (!permission) return '<td class="permission-unavailable">—</td>';
          const checked = state.draftPermissionIds.has(permission.id);
          return `<td><label class="permission-toggle" title="${escapeText(permission.actionLabel)}">
            <input type="checkbox" data-permission-id="${permission.id}" ${checked ? 'checked' : ''} ${can('permissions.manage') ? '' : 'disabled'}>
            <span aria-hidden="true">✓</span>
          </label></td>`;
        }).join('');
        return `<tr><td><span class="cell-title">${escapeText(group.moduleLabel)}</span><span class="cell-meta">${escapeText(group.module)}</span></td>${cells}</tr>`;
      }).join('');
    }

    function renderUsers() {
      const keyword = String(userSearch.value || '').trim().toLocaleLowerCase('zh-Hant');
      const roleId = Number(roleFilter.value || 0);
      const filtered = state.users.filter(user => {
        const content = `${user.employeeNo} ${user.name} ${user.department.name} ${user.role.name}`.toLocaleLowerCase('zh-Hant');
        return (!keyword || content.includes(keyword)) && (!roleId || user.role.id === roleId);
      });
      document.querySelector('[data-account-summary]').textContent = `共 ${state.users.length} 個帳號，角色以 role_id 個別關聯。`;
      usersBody.innerHTML = filtered.map(user => `
        <tr data-user-id="${user.id}">
          <td><span class="cell-title">${escapeText(user.employeeNo)}・${escapeText(user.name)}</span><span class="cell-meta">${escapeText(user.email || '未設定 Email')}</span></td>
          <td>${escapeText(user.department.name)}</td>
          <td><span class="badge blue">${escapeText(user.role.name)}</span></td>
          <td><span class="badge ${user.status === 'active' ? 'green' : 'amber'}">${user.status === 'active' ? '啟用' : '停用'}</span></td>
          <td>${escapeText(formatDateTime(user.lastLoginAt))}</td>
          <td class="row-actions">
            <button class="btn small" type="button" data-action="edit-user" ${can('users.edit') ? '' : 'disabled'}>編輯</button>
            <button class="btn small danger" type="button" data-action="delete-user" ${can('users.delete') ? '' : 'disabled'}>刪除</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="empty-state">沒有符合條件的帳號</td></tr>';
    }

    function renderDepartments() {
      document.querySelector('[data-department-list]').innerHTML = state.departments.map(department => `
        <div class="department-row" data-department-id="${department.id}">
          <div><b>${escapeText(department.name)}</b><p>${escapeText(department.description)}</p></div>
          <div class="row-actions">
            <button class="btn small" type="button" data-action="edit-department" ${can('departments.manage') ? '' : 'disabled'}>編輯</button>
            <button class="btn small danger" type="button" data-action="delete-department" ${can('departments.manage') ? '' : 'disabled'}>刪除</button>
          </div>
        </div>
      `).join('');
    }

    function renderAuditLogs() {
      document.querySelector('[data-audit-list]').innerHTML = state.auditLogs.slice(0, 10).map(log => `
        <div class="audit">
          <i></i>
          <div><b>${escapeText(log.summary)}</b><p>${escapeText(log.actor?.employeeNo || 'SYSTEM')}・IP ${escapeText(log.ip || '未記錄')}</p></div>
          <time datetime="${escapeText(log.createdAt)}">${escapeText(formatDateTime(log.createdAt))}</time>
        </div>
      `).join('');
    }

    function formatDateTime(value) {
      if (!value) return '尚未登入';
      const normalized = String(value).includes('T') ? value : `${value.replace(' ', 'T')}+08:00`;
      const date = new Date(normalized);
      return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-TW', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(date);
    }

    function fillUserSelects() {
      userForm.elements.roleId.innerHTML = '<option value="">請選擇</option>' + state.roles.map(role =>
        `<option value="${role.id}">${escapeText(role.name)}</option>`
      ).join('');
      userForm.elements.departmentId.innerHTML = '<option value="">請選擇</option>' + state.departments.map(department =>
        `<option value="${department.id}">${escapeText(department.name)}</option>`
      ).join('');
    }

    function openUserDialog(user = null) {
      userForm.reset();
      fillUserSelects();
      userForm.elements.id.value = user?.id || '';
      userForm.elements.employeeNo.value = user?.employeeNo || '';
      userForm.elements.employeeNo.readOnly = Boolean(user);
      userForm.elements.name.value = user?.name || '';
      userForm.elements.email.value = user?.email || '';
      userForm.elements.phone.value = user?.phone || '';
      userForm.elements.roleId.value = user?.role.id || '';
      userForm.elements.departmentId.value = user?.department.id || '';
      userForm.elements.status.value = user?.status || 'active';
      userForm.elements.password.required = !user;
      document.querySelector('[data-user-dialog-title]').textContent = user ? `編輯 ${user.employeeNo}` : '新增帳號';
      document.querySelector('[data-user-message]').textContent = '';
      userDialog.showModal();
    }

    async function refreshData() {
      const [roles, permissions, users, departments, auditLogs] = await Promise.all([
        request('/api/roles'), request('/api/permissions'), request('/api/users'),
        request('/api/departments'), request('/api/audit-logs')
      ]);
      state.roles = roles.items;
      state.permissions = permissions.items;
      state.users = users.items;
      state.departments = departments.items;
      state.auditLogs = auditLogs.items;
      if (!state.roles.some(role => role.id === state.activeRoleId)) state.activeRoleId = state.roles[0]?.id || null;
      renderRoleTabs();
      resetPermissionDraft();
      renderUsers();
      renderDepartments();
      renderAuditLogs();
    }

    roleTabs.addEventListener('click', event => {
      const button = event.target.closest('[data-role-id]');
      if (!button) return;
      state.activeRoleId = Number(button.dataset.roleId);
      renderRoleTabs();
      resetPermissionDraft();
    });

    permissionBody.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-permission-id]');
      if (!checkbox) return;
      const permissionId = Number(checkbox.dataset.permissionId);
      checkbox.checked ? state.draftPermissionIds.add(permissionId) : state.draftPermissionIds.delete(permissionId);
      matrixMessage.textContent = '尚未儲存變更';
    });

    document.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      try {
        if (action === 'save-permissions') {
          await request(`/api/roles/${state.activeRoleId}/permissions`, {
            method: 'PUT', body: JSON.stringify({ permissionIds: [...state.draftPermissionIds] })
          });
          matrixMessage.textContent = '權限已儲存';
          await refreshData();
        } else if (action === 'reset-permissions') {
          resetPermissionDraft();
        } else if (action === 'add-role') {
          const name = window.prompt('請輸入新角色名稱');
          if (!name) return;
          const description = window.prompt('請輸入角色說明', '') || '';
          const result = await request('/api/roles', { method: 'POST', body: JSON.stringify({ name, description }) });
          state.activeRoleId = result.item.id;
          await refreshData();
        } else if (action === 'edit-role') {
          const role = activeRole();
          if (!role) return;
          const name = window.prompt('編輯角色名稱', role.name);
          if (!name) return;
          const description = window.prompt('編輯角色說明', role.description) ?? role.description;
          await request(`/api/roles/${role.id}`, { method: 'PATCH', body: JSON.stringify({ name, description }) });
          await refreshData();
        } else if (action === 'delete-role') {
          const role = activeRole();
          if (!role || !window.confirm(`確定刪除角色「${role.name}」？`)) return;
          await request(`/api/roles/${role.id}`, { method: 'DELETE' });
          await refreshData();
        } else if (action === 'add-user') {
          openUserDialog();
        } else if (action === 'edit-user') {
          const id = Number(button.closest('[data-user-id]').dataset.userId);
          openUserDialog(state.users.find(user => user.id === id));
        } else if (action === 'delete-user') {
          const id = Number(button.closest('[data-user-id]').dataset.userId);
          const user = state.users.find(item => item.id === id);
          if (!user || !window.confirm(`確定刪除帳號 ${user.employeeNo}（${user.name}）？`)) return;
          await request(`/api/users/${id}`, { method: 'DELETE' });
          await refreshData();
        } else if (action === 'close-user-dialog') {
          userDialog.close();
        } else if (action === 'export-audit') {
          const rows = [['時間', '操作者', '操作', '來源 IP'], ...state.auditLogs.map(log => [
            log.createdAt, log.actor?.employeeNo || 'SYSTEM', log.summary, log.ip || ''
          ])];
          window.IRentLayout.downloadCsv('irent-audit-log.csv', rows);
        } else if (action === 'add-department') {
          const name = window.prompt('請輸入部門名稱');
          if (!name) return;
          const description = window.prompt('請輸入部門說明', '') || '';
          await request('/api/departments', { method: 'POST', body: JSON.stringify({ name, description }) });
          await refreshData();
        } else if (action === 'edit-department') {
          const id = Number(button.closest('[data-department-id]').dataset.departmentId);
          const department = state.departments.find(item => item.id === id);
          const name = window.prompt('編輯部門名稱', department.name);
          if (!name) return;
          const description = window.prompt('編輯部門說明', department.description) ?? department.description;
          await request(`/api/departments/${id}`, { method: 'PATCH', body: JSON.stringify({ name, description }) });
          await refreshData();
        } else if (action === 'delete-department') {
          const id = Number(button.closest('[data-department-id]').dataset.departmentId);
          const department = state.departments.find(item => item.id === id);
          if (!window.confirm(`確定刪除部門「${department.name}」？`)) return;
          await request(`/api/departments/${id}`, { method: 'DELETE' });
          await refreshData();
        }
      } catch (error) {
        window.alert(error.message);
      }
    });

    userForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(userForm);
      const id = Number(formData.get('id') || 0);
      const payload = {
        employeeNo: String(formData.get('employeeNo')).trim().toUpperCase(),
        name: String(formData.get('name')).trim(),
        email: String(formData.get('email')).trim(),
        phone: String(formData.get('phone')).trim(),
        password: String(formData.get('password')),
        roleId: Number(formData.get('roleId')),
        departmentId: Number(formData.get('departmentId')),
        status: formData.get('status')
      };
      const error = validateUserPayload(payload, Boolean(id));
      if (error) {
        document.querySelector('[data-user-message]').textContent = error;
        return;
      }
      if (id && !payload.password) delete payload.password;
      try {
        await request(id ? `/api/users/${id}` : '/api/users', {
          method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload)
        });
        userDialog.close();
        await refreshData();
      } catch (requestError) {
        document.querySelector('[data-user-message]').textContent = requestError.message;
      }
    });

    userSearch.addEventListener('input', renderUsers);
    roleFilter.addEventListener('change', renderUsers);
    request('/api/auth/me').then(result => {
      window.IRentCurrentUser = result.item;
      return refreshData();
    }).catch(error => {
      permissionBody.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeText(error.message)}</td></tr>`;
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }

  return { groupPermissions, init, validateUserPayload };
});
