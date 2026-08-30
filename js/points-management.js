(function pointsManagementPage(globalObject) {
  'use strict';

  const state = {
    page: 1,
    pageSize: 10,
    customers: [],
    selectedMemberNo: '',
    historyFilter: 'all',
    detailResult: null
  };

  const typeLabels = { earn: '增加', redeem: '扣除', adjustment: '調整' };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('zh-TW');
  }

  function formatDate(value) {
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function selectedCustomer() {
    return state.customers.find(customer => customer.memberNo === state.selectedMemberNo);
  }

  function renderSummary(items, pagination) {
    const memberCount = document.querySelector('[data-points-member-count]');
    const total = document.querySelector('[data-points-total]');
    const activeCount = document.querySelector('[data-points-active-count]');
    if (memberCount) memberCount.textContent = formatNumber(pagination.total);
    if (total) total.textContent = formatNumber(
      items.reduce((sum, item) => sum + item.pointsBalance, 0)
    );
    if (activeCount) activeCount.textContent = formatNumber(
      items.filter(item => item.pointsBalance > 0).length
    );
  }

  function renderTable(items) {
    const body = document.querySelector('[data-points-body]');
    if (items.length === 0) {
      body.innerHTML = '<tr><td class="points-empty" colspan="3">查無會員資料</td></tr>';
      return;
    }

    body.innerHTML = items.map(customer => `
      <tr data-member-no="${escapeHtml(customer.memberNo)}" class="${customer.memberNo === state.selectedMemberNo ? 'is-selected' : ''}">
        <td><span class="cell-title">${escapeHtml(customer.memberNo)}</span><span class="cell-meta">${escapeHtml(customer.phone)}</span></td>
        <td>${escapeHtml(customer.fullName)}</td>
        <td><strong class="points-balance ${customer.pointsBalance > 0 ? 'is-positive' : ''}">${formatNumber(customer.pointsBalance)}</strong></td>
      </tr>`).join('');

    body.querySelectorAll('tr[data-member-no]').forEach(row => {
      row.addEventListener('click', () => showDetail(row.dataset.memberNo));
    });
  }

  function renderPagination(pagination) {
    const info = document.querySelector('[data-points-page-info]');
    const previous = document.querySelector('[data-points-previous]');
    const pageNumbers = document.querySelector('[data-points-page-numbers]');
    const next = document.querySelector('[data-points-next]');
    const totalPages = Math.max(pagination.totalPages, 1);
    info.textContent = `第 ${pagination.page} / ${totalPages} 頁，共 ${pagination.total} 筆`;
    previous.disabled = pagination.page <= 1;
    next.disabled = pagination.page >= pagination.totalPages;
    pageNumbers.innerHTML = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      const current = page === pagination.page ? ' aria-current="page"' : '';
      return `<button class="btn small" type="button" data-points-page="${page}"${current}>${page}</button>`;
    }).join('');
  }

  async function loadCustomers() {
    const body = document.querySelector('[data-points-body]');
    body.innerHTML = '<tr><td class="points-loading" colspan="3">資料載入中…</td></tr>';
    try {
      const result = await globalObject.IRentPointsApi.list(state);
      state.customers = result.items;
      renderSummary(result.items, result.pagination);
      renderTable(result.items);
      renderPagination(result.pagination);
      state.detailResult = null;
      state.historyFilter = 'all';
      document.querySelector('[data-points-detail-panel]').innerHTML = '<p class="points-empty">會員點數歷史紀錄預覽</p>';
    } catch (error) {
      body.innerHTML = `<tr><td class="points-empty" colspan="3">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  function renderHistory(result) {
    const filteredItems = result.items.filter(item => {
      if (state.historyFilter === 'earn') return item.points > 0;
      if (state.historyFilter === 'redeem') return item.points < 0;
      return true;
    });
    const rows = filteredItems.length === 0
      ? '<p class="points-empty">尚無符合條件的點數異動紀錄</p>'
      : `<div class="points-history">${filteredItems.map(item => {
        const positive = item.points > 0;
        return `<article class="points-history-item">
          <div class="points-history-item-main">
            <span class="points-history-icon ${positive ? 'is-positive' : 'is-negative'}">${positive ? '+' : '-'}</span>
            <div><strong>${escapeHtml(typeLabels[item.type] || item.type)}</strong><small>${formatDate(item.createdAt)} · ${escapeHtml(item.reason)}</small></div>
          </div>
          <div class="points-history-item-value"><strong class="${positive ? 'points-positive' : 'points-negative'}">${positive ? '+' : '-'}${formatNumber(Math.abs(item.points))}</strong><small>異動後餘額：${formatNumber(item.balanceAfter)} 點</small></div>
        </article>`;
      }).join('')}</div>`;
    return `
      <div class="points-detail-head">
        <div><h2>${escapeHtml(result.customer.fullName)}</h2><p>${escapeHtml(result.customer.memberNo)} · ${escapeHtml(result.customer.phone)}</p></div>
        <div class="points-detail-balance"><span>目前點數</span><strong>${formatNumber(result.summary.pointsBalance)} 點</strong></div>
      </div>
      <div class="points-detail-summary">
        <div><span>累積獲得</span><strong class="points-positive" data-points-summary-earned>${formatNumber(result.summary.totalEarned)} 點</strong></div>
        <div><span>累積扣除</span><strong class="points-negative" data-points-summary-redeemed>${formatNumber(result.summary.totalRedeemed)} 點</strong></div>
        <div><span>本月異動</span><strong class="points-monthly" data-points-summary-monthly>${result.summary.monthlyChange >= 0 ? '+' : ''}${formatNumber(result.summary.monthlyChange)} 點</strong></div>
      </div>
      <div class="points-history-heading"><h3>點數異動紀錄</h3><div class="points-history-filters">${[
        ['all', '全部'], ['earn', '獲得'], ['redeem', '扣除']
      ].map(([value, label]) => `<button class="btn small ${state.historyFilter === value ? 'is-active' : ''}" type="button" data-points-history-filter="${value}">${label}</button>`).join('')}</div></div>
      ${rows}`;
  }

  function bindHistoryFilters() {
    document.querySelectorAll('[data-points-history-filter]').forEach(button => {
      button.addEventListener('click', () => {
        state.historyFilter = button.dataset.pointsHistoryFilter;
        const panel = document.querySelector('[data-points-detail-panel]');
        panel.innerHTML = renderHistory(state.detailResult);
        bindHistoryFilters();
      });
    });
  }

  async function showDetail(memberNo) {
    state.selectedMemberNo = memberNo;
    renderTable(state.customers);
    const panel = document.querySelector('[data-points-detail-panel]');
    panel.hidden = false;
    panel.innerHTML = '<p class="points-loading">明細載入中…</p>';
    try {
      state.historyFilter = 'all';
      state.detailResult = await globalObject.IRentPointsApi.transactions(memberNo);
      panel.innerHTML = renderHistory(state.detailResult);
      bindHistoryFilters();
    } catch (error) {
      panel.innerHTML = `<p class="points-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  function openCreateForm() {
    const customer = selectedCustomer();
    const form = document.querySelector('[data-points-form]');
    form.reset();
    form.querySelector('[name="memberNo"]').value = customer?.memberNo || '';
    document.querySelector('[data-points-form-message]').textContent = '';
    document.querySelector('[data-points-form-dialog]').hidden = false;
  }

  function closeCreateForm() {
    document.querySelector('[data-points-form-dialog]').hidden = true;
  }

  async function submitCreateForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector('[data-points-form-message]');
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    data.points = Number(data.points);
    message.textContent = '';
    submit.disabled = true;
    try {
      await globalObject.IRentPointsApi.create(data);
      closeCreateForm();
      await loadCustomers();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  }

  function init() {
    if (document.body.dataset.page !== 'points') return;
    document.querySelector('[data-points-page-size]').addEventListener('change', event => {
      state.pageSize = Number(event.target.value) || 5;
      state.page = 1;
      loadCustomers();
    });
    document.querySelector('[data-points-previous]').addEventListener('click', () => { state.page -= 1; loadCustomers(); });
    document.querySelector('[data-points-next]').addEventListener('click', () => { state.page += 1; loadCustomers(); });
    document.querySelector('[data-points-page-numbers]').addEventListener('click', event => {
      const button = event.target.closest('[data-points-page]');
      if (!button) return;
      state.page = Number(button.dataset.pointsPage);
      loadCustomers();
    });
    document.querySelector('[data-points-add]')?.addEventListener('click', openCreateForm);
    document.querySelector('[data-points-form-cancel]').addEventListener('click', closeCreateForm);
    document.querySelector('[data-points-form]').addEventListener('submit', submitCreateForm);
    loadCustomers();
  }

  globalObject.IRentPointsPage = { init };
})(window);
