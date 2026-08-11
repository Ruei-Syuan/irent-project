(() => {
  'use strict';

  const pages = [
    { key: 'dashboard', label: '營運總覽', href: 'dashboard.html', icon: 'car' },
    { key: 'fleet', label: '車隊管理', href: 'fleet.html', icon: 'car' },
    { key: 'damage-review', label: 'AI 車損案件', href: 'damage-review.html', icon: 'ai' },
    { key: 'dispatch', label: '清潔維修派工', href: 'dispatch.html', icon: 'dispatch' },
    { key: 'work-orders', label: '維修工單', href: 'work-orders.html', icon: 'wrench' },
    { key: 'reports', label: '報表分析', href: 'reports.html', icon: 'chart' },
    { key: 'permissions', label: '權限設定', href: 'permissions.html', icon: 'shield' }
  ];

  const icons = {
    car: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 11h14l-1.3-4.1A2 2 0 0 0 15.8 5H8.2a2 2 0 0 0-1.9 1.9L5 11Zm-1 2h16v5a2 2 0 0 1-2 2h-1v-2H7v2H6a2 2 0 0 1-2-2v-5Zm3 1.5A1.5 1.5 0 1 0 7 17a1.5 1.5 0 0 0 0-3Zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>',
    ai: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 2h6v2h3a2 2 0 0 1 2 2v3h2v6h-2v3a2 2 0 0 1-2 2h-3v2H9v-2H6a2 2 0 0 1-2-2v-3H2V9h2V6a2 2 0 0 1 2-2h3V2Zm-1 6v8h8V8H8Zm2 2h4v4h-4v-4Z"/></svg>',
    dispatch: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15.8 3.2 5 5-2 2-1.2-1.2-5.9 5.9 1.2 1.2-2.8 2.8-5-5 2.8-2.8 1.2 1.2 5.9-5.9-1.2-1.2 2-2ZM3 17l4 4H3v-4Z"/></svg>',
    wrench: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14.7 4.3a5 5 0 0 0-6.4 6.4L3 16v5h5l5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3-2-2ZM5 17h2v2H5v-2Z"/></svg>',
    chart: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 20h3V10H4v10Zm6 0h4V4h-4v16Zm7 0h3V7h-3v13Z"/></svg>',
    shield: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 2 8 3v6c0 5.1-3.4 9.5-8 11-4.6-1.5-8-5.9-8-11V5l8-3Zm0 5a3 3 0 0 0-1 5.8V17h2v-4.2A3 3 0 0 0 12 7Z"/></svg>',
    search: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/></svg>',
    notification: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 11h4a2 2 0 0 1-4 0Z"/></svg>',
    message: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h16v13H9l-5 4V4Zm4 5h8V7H8v2Zm0 4h6v-2H8v2Z"/></svg>',
    chevron: '<svg class="layout-user-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m7 9 5 5 5-5H7Z"/></svg>'
  };

  function renderSidebar(activePage) {
    const navigation = pages.map(page => {
      const current = page.key === activePage.key ? ' aria-current="page"' : '';
      return `<a href="${page.href}" data-page-key="${page.key}"${current}>${icons[page.icon]}<span>${page.label}</span></a>`;
    }).join('');

    return `
      <a class="app-brand" href="dashboard.html" aria-label="iRent 智能車況管家首頁">
        <span class="brand-wordmark">iRent</span>
        <span class="brand-product">智能車況管家</span>
      </a>
      <nav class="app-nav" aria-label="主要導覽">${navigation}</nav>
      <div class="app-sidebar-footer">
        <span class="layout-status-dot" aria-hidden="true"></span>
        <span>AI 服務與車聯網連線正常</span>
      </div>`;
  }

  function renderTopbar(activePage) {
    return `
      <div class="app-heading">
        <h1>${activePage.label}</h1>
        <p>掌握車隊營運與車況健康</p>
      </div>
      <div class="app-topbar-tools">
        <label class="app-search">
          <span class="sr-only">搜尋車輛或案件</span>
          <input type="search" placeholder="搜尋車牌、車輛、案件編號" aria-label="搜尋車牌、車輛、案件編號">
          ${icons.search}
        </label>
        <div class="app-utilities" aria-label="使用者工具">
          <button class="layout-utility-button" type="button" aria-label="通知">
            ${icons.notification}<span class="layout-utility-badge">5</span>
          </button>
          <button class="layout-utility-button" type="button" aria-label="訊息">
            ${icons.message}<span class="layout-utility-badge">2</span>
          </button>
        </div>
        <div class="app-user" aria-label="目前使用者 Celine，管理者">
          <span class="app-avatar">CE</span>
          <span class="app-user-copy"><strong>Celine</strong><small>管理者</small></span>
          ${icons.chevron}
        </div>
      </div>`;
  }

  function init() {
    const pageKey = document.body.dataset.page;
    const activePage = pages.find(page => page.key === pageKey);
    const sidebar = document.querySelector('[data-app-sidebar]');
    const topbar = document.querySelector('[data-app-topbar]');

    if (!activePage) {
      console.error(`[iRent layout] Unknown data-page: ${pageKey || '(empty)'}`);
      return;
    }
    if (!sidebar || !topbar) {
      console.error('[iRent layout] Missing shared layout mount point.');
      return;
    }

    sidebar.innerHTML = renderSidebar(activePage);
    topbar.innerHTML = renderTopbar(activePage);
  }

  window.IRentLayout = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
