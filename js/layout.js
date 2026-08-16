(() => {
  'use strict';

  // 共用頁面設定：用於產生側欄導覽與判斷目前頁面。
  const pages = [
    { key: 'dashboard', label: '營運總覽', href: 'dashboard.html', icon: 'car' },
    { key: 'fleet', label: '車隊管理', href: 'fleet.html', icon: 'car' },
    { key: 'damage-review', label: 'AI 車損案件', href: 'damage-review.html', icon: 'ai' },
    { key: 'dispatch', label: '清潔維修派工', href: 'dispatch.html', icon: 'dispatch' },
    { key: 'work-orders', label: '維修工單', href: 'work-orders.html', icon: 'wrench' },
    { key: 'reports', label: '報表分析', href: 'reports.html', icon: 'chart' },
    { key: 'permissions', label: '權限設定', href: 'permissions.html', icon: 'shield' }
  ];

  const searchSources = [
    { href: 'fleet.html', category: '車輛', selector: 'table tbody tr', titleSelector: '.cell-title' },
    { href: 'damage-review.html', category: '車損案件', selector: '.case-list .case', titleSelector: '.case-top b', hash: '#detail' },
    { href: 'dispatch.html', category: '調度任務', selector: '.kanban .task', titleSelector: 'h3' },
    { href: 'work-orders.html', category: '維修工單', selector: 'table tbody tr', titleSelector: '.cell-title' }
  ];

  // 共用 SVG 圖示，避免各頁重複維護相同標記。
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

  // 依目前頁面產生側欄，並標示作用中的導覽項目。
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

  // 產生各頁共用的標題、搜尋與使用者工具列。
  function renderTopbar(activePage) {
    return `
      <div class="app-heading">
        <h1>${activePage.label}</h1>
        <p>掌握車隊營運與車況健康</p>
      </div>
      <div class="app-topbar-tools">
        <div class="app-search" data-global-search>
          <label class="sr-only" for="global-search-input">搜尋車輛或案件</label>
          <input id="global-search-input" type="search" placeholder="搜尋車牌、車輛、案件編號" aria-label="搜尋車牌、車輛、案件編號" autocomplete="off" aria-controls="global-search-results" aria-expanded="false">
          ${icons.search}
          <section class="layout-inbox-panel layout-search-panel" id="global-search-results" aria-label="全站搜尋結果" hidden>
            <header class="layout-inbox-head layout-search-head">
              <div><span>全站搜尋</span><h2>搜尋結果</h2></div>
              <small>搜尋範圍：全部功能</small>
            </header>
            <div class="layout-inbox-list layout-search-results" data-search-results>
              <p class="layout-inbox-status layout-search-status">輸入車牌、案件或工單編號開始搜尋。</p>
            </div>
          </section>
        </div>
        <div class="app-utilities" aria-label="使用者工具">
          <div class="layout-inbox" data-inbox="notification">
            <button class="layout-utility-button" type="button" aria-label="通知" aria-controls="notification-panel" aria-expanded="false" data-inbox-trigger>
              ${icons.notification}<span class="layout-utility-badge" data-inbox-badge hidden></span>
            </button>
            <section class="layout-inbox-panel" id="notification-panel" aria-label="通知清單" hidden>
              <header class="layout-inbox-head">
                <div><span>通知中心</span><h2>最新通知</h2></div>
                <button type="button" data-inbox-read-all>全部已讀</button>
              </header>
              <div class="layout-inbox-list" data-inbox-list><p class="layout-inbox-status">通知載入中…</p></div>
              <p class="layout-inbox-feedback" aria-live="polite" data-inbox-feedback></p>
            </section>
          </div>
          <div class="layout-inbox" data-inbox="message">
            <button class="layout-utility-button" type="button" aria-label="訊息" aria-controls="message-panel" aria-expanded="false" data-inbox-trigger>
              ${icons.message}<span class="layout-utility-badge" data-inbox-badge hidden></span>
            </button>
            <section class="layout-inbox-panel" id="message-panel" aria-label="訊息清單" hidden>
              <header class="layout-inbox-head">
                <div><span>內部訊息</span><h2>最新訊息</h2></div>
                <button type="button" data-inbox-read-all>全部已讀</button>
              </header>
              <div class="layout-inbox-list" data-inbox-list><p class="layout-inbox-status">訊息載入中…</p></div>
              <p class="layout-inbox-feedback" aria-live="polite" data-inbox-feedback></p>
            </section>
          </div>
        </div>
        <button class="app-user" type="button" aria-label="目前使用者選單" data-user-menu>
          <span class="app-avatar">--</span>
          <span class="app-user-copy"><strong>載入中</strong><small>驗證登入狀態</small></span>
          ${icons.chevron}
        </button>
      </div>`;
  }

  // 保存跨共用搜尋與頁面篩選器使用的暫時狀態。
  const pageState = {
    applyFilter: null,
    globalQuery: ''
  };

  const inboxState = {
    items: []
  };

  const searchState = {
    catalogPromise: null
  };

  function countUnread(items) {
    return {
      notifications: items.filter(item => item.kind === 'notification' && !item.isRead).length,
      messages: items.filter(item => item.kind === 'message' && !item.isRead).length
    };
  }

  // 統一搜尋文字格式，讓英文搜尋不受大小寫影響。
  function normalizeText(value) {
    return String(value || '').trim().toLocaleLowerCase('zh-Hant');
  }

  function searchCatalog(catalog, query, limit = 10) {
    const keyword = normalizeText(query);
    if (!keyword) return [];
    const categoryRank = { 車輛: 0, 車損案件: 1, 調度任務: 2, 維修工單: 3 };

    return catalog.map((item, index) => {
      const title = normalizeText(item.title);
      const content = normalizeText(item.searchText);
      if (!content.includes(keyword)) return null;
      const score = title === keyword
        ? 0
        : title.startsWith(keyword)
          ? 10
          : title.includes(keyword)
            ? 20
            : 30 + (categoryRank[item.category] ?? 9);
      return { item, index, score };
    }).filter(Boolean)
      .sort((left, right) => left.score - right.score || left.index - right.index)
      .slice(0, limit)
      .map(result => result.item);
  }

  // 依關鍵字及額外條件顯示或隱藏資料項目。
  function filterElements(elements, query, predicate = () => true) {
    const keyword = normalizeText(query);
    let visible = 0;

    Array.from(elements).forEach(element => {
      const matches = (!keyword || normalizeText(element.textContent).includes(keyword)) && predicate(element);
      element.hidden = !matches;
      if (matches) visible += 1;
    });

    return visible;
  }

  // 將 active 狀態集中套用到指定項目。
  function setActive(elements, target, className = 'active') {
    Array.from(elements).forEach(element => {
      element.classList.toggle(className, element === target);
    });
  }

  // 將二維資料轉為可由 Excel 正確開啟的 UTF-8 CSV。
  function rowsToCsv(rows) {
    const escapeCell = value => {
      const text = String(value ?? '');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    return `\uFEFF${rows.map(row => row.map(escapeCell).join(',')).join('\r\n')}`;
  }

  // 在瀏覽器端建立並下載 CSV，不需額外套件或後端服務。
  function downloadCsv(filename, rows) {
    const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // 以原生提示提供操作結果，避免新增額外 UI 結構。
  function notify(message) {
    if (typeof window.alert === 'function') window.alert(message);
  }

  // 依按鈕文字尋找既有控制項，沿用目前 HTML 結構。
  function findButton(scope, label) {
    return Array.from(scope.querySelectorAll('button')).find(button => normalizeText(button.textContent).includes(normalizeText(label)));
  }

  // 擷取表格文字，供匯出功能使用。
  function getTableRows(table) {
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).map(row =>
      Array.from(row.children).map(cell => cell.textContent.replace(/\s+/g, ' ').trim())
    );
  }

  // 同步更新狀態標籤的文字與既有顏色類別。
  function setBadge(badge, text, color) {
    if (!badge) return;
    badge.textContent = text;
    badge.classList.remove('red', 'amber', 'green', 'blue', 'violet', 'gray');
    badge.classList.add(color);
  }

  // 內建基礎測試；需要時可在瀏覽器 Console 執行 IRentLayout.runSelfTests()。
  function runSelfTests() {
    const results = [];

    // 執行單一測試並記錄成功或失敗，避免其中一項失敗時中斷其他測試。
    const test = (name, callback) => {
      try {
        callback();
        results.push({ name, passed: true });
      } catch (error) {
        results.push({ name, passed: false, error: error.message });
      }
    };

    // 測試用斷言：條件不成立時回報指定錯誤。
    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };

    // 建立最小化的 classList 模擬物件，測試 active 狀態切換。
    const createClassList = initial => {
      const values = new Set(initial);
      return {
        contains: value => values.has(value),
        toggle: (value, force) => force ? values.add(value) : values.delete(value)
      };
    };

    // 驗證關鍵字與狀態條件會共同決定項目的顯示狀態。
    test('搜尋與狀態篩選', () => {
      const elements = [
        { textContent: 'RAC-4582 待維修', hidden: false },
        { textContent: 'RBC-2108 待清潔', hidden: false },
        { textContent: 'RBA-6935 可租', hidden: false }
      ];
      const visible = filterElements(elements, 'rbc', element => element.textContent.includes('待清潔'));
      assert(visible === 1, '可見筆數應為 1');
      assert(elements[0].hidden && !elements[1].hidden && elements[2].hidden, 'hidden 狀態不正確');
    });

    // 驗證切換後只有指定項目保留 active 類別。
    test('作用中項目切換', () => {
      const elements = [
        { classList: createClassList(['active']) },
        { classList: createClassList([]) },
        { classList: createClassList([]) }
      ];
      setActive(elements, elements[1]);
      assert(!elements[0].classList.contains('active'), '原項目不應保留 active');
      assert(elements[1].classList.contains('active'), '指定項目應為 active');
      assert(!elements[2].classList.contains('active'), '其他項目不應為 active');
    });

    // 驗證 CSV 會正確跳脫逗號、引號與換行字元。
    test('CSV 特殊字元處理', () => {
      const csv = rowsToCsv([
        ['車牌', '說明'],
        ['RAC-4582', '刮傷, 8 cm²'],
        ['RBC-2108', '使用「深度清潔」\n處理']
      ]);
      const expected = '\uFEFF車牌,說明\r\nRAC-4582,"刮傷, 8 cm²"\r\nRBC-2108,"使用「深度清潔」\n處理"';
      assert(csv === expected, 'CSV 內容不正確');
    });

    // 彙整測試結果並輸出至瀏覽器 Console，供開發時快速確認。
    const summary = {
      passed: results.filter(result => result.passed).length,
      total: results.length,
      results
    };
    const logger = summary.passed === summary.total ? console.info : console.error;
    logger(`[iRent tests] ${summary.passed}/${summary.total} passed`, results);
    return summary;
  }

  function loadSearchCatalog() {
    if (searchState.catalogPromise) return searchState.catalogPromise;

    searchState.catalogPromise = Promise.all(searchSources.map(async source => {
      const response = await fetch(source.href);
      if (response.status === 403) return [];
      if (!response.ok || response.url.endsWith('/login.html')) throw new Error('無法讀取全站搜尋資料');
      const html = await response.text();
      const page = new DOMParser().parseFromString(html, 'text/html');

      return Array.from(page.querySelectorAll(source.selector)).map(element => {
        const title = element.querySelector(source.titleSelector)?.textContent.replace(/\s+/g, ' ').trim();
        const searchText = element.textContent.replace(/\s+/g, ' ').trim();
        return title ? {
          title,
          category: source.category,
          searchText,
          summary: searchText.replace(title, '').trim().slice(0, 110),
          href: `${source.href}?search=${encodeURIComponent(title)}${source.hash || ''}`
        } : null;
      }).filter(Boolean);
    })).then(groups => groups.flat());

    return searchState.catalogPromise;
  }

  function closeSearchPanel() {
    const search = document.querySelector('[data-global-search]');
    if (!search) return;
    search.querySelector('.layout-search-panel').hidden = true;
    search.querySelector('input').setAttribute('aria-expanded', 'false');
  }

  async function renderSearchResults(query) {
    const search = document.querySelector('[data-global-search]');
    const input = search.querySelector('input');
    const panel = search.querySelector('.layout-search-panel');
    const container = search.querySelector('[data-search-results]');
    const keyword = String(query || '').trim();

    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (!keyword) {
      container.innerHTML = '<p class="layout-inbox-status layout-search-status">輸入車牌、案件或工單編號開始搜尋。</p>';
      return;
    }

    container.innerHTML = '<p class="layout-inbox-status layout-search-status">搜尋中…</p>';
    try {
      const catalog = await loadSearchCatalog();
      if (input.value.trim() !== keyword) return;
      const results = searchCatalog(catalog, keyword);
      container.replaceChildren();

      if (results.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'layout-inbox-status layout-search-status';
        empty.textContent = `找不到「${keyword}」相關資料。`;
        container.append(empty);
        return;
      }

      results.forEach(result => {
        const link = document.createElement('a');
        link.className = 'layout-inbox-item layout-search-result';
        link.href = result.href;
        const marker = document.createElement('span');
        marker.className = 'layout-inbox-marker';
        marker.setAttribute('aria-hidden', 'true');
        const copy = document.createElement('span');
        copy.className = 'layout-inbox-copy';
        const category = document.createElement('span');
        category.className = 'layout-inbox-meta';
        category.textContent = result.category;
        const title = document.createElement('strong');
        title.textContent = result.title;
        const summary = document.createElement('span');
        summary.className = 'layout-inbox-body';
        summary.textContent = result.summary;
        copy.append(category, title, summary);
        link.append(marker, copy);
        container.append(link);
      });
    } catch (error) {
      container.innerHTML = '<p class="layout-inbox-status layout-search-status is-error">搜尋資料載入失敗，請重新整理後再試。</p>';
      console.error('[iRent search]', error);
    }
  }

  function formatInboxTime(value) {
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  function updateInboxBadges() {
    const unread = countUnread(inboxState.items);
    document.querySelectorAll('[data-inbox]').forEach(inbox => {
      const kind = inbox.dataset.inbox;
      const count = kind === 'notification' ? unread.notifications : unread.messages;
      const badge = inbox.querySelector('[data-inbox-badge]');
      const trigger = inbox.querySelector('[data-inbox-trigger]');
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count === 0;
      trigger.setAttribute('aria-label', `${kind === 'notification' ? '通知' : '訊息'}，${count} 則未讀`);
    });
  }

  function setInboxFeedback(inbox, message, isError = false) {
    const feedback = inbox.querySelector('[data-inbox-feedback]');
    feedback.textContent = message;
    feedback.classList.toggle('is-error', isError);
  }

  function renderInboxPanel(kind) {
    const inbox = document.querySelector(`[data-inbox="${kind}"]`);
    if (!inbox) return;
    const list = inbox.querySelector('[data-inbox-list]');
    const items = inboxState.items.filter(item => item.kind === kind);
    list.replaceChildren();

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'layout-inbox-status';
      empty.textContent = kind === 'notification' ? '目前沒有通知。' : '目前沒有訊息。';
      list.append(empty);
      return;
    }

    items.forEach(item => {
      const link = document.createElement('a');
      link.className = `layout-inbox-item tone-${item.tone}${item.isRead ? '' : ' is-unread'}`;
      link.href = /^[\w-]+\.html$/.test(item.href) ? item.href : '#';
      link.dataset.inboxItemId = String(item.id);

      const marker = document.createElement('span');
      marker.className = 'layout-inbox-marker';
      marker.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('span');
      copy.className = 'layout-inbox-copy';
      const meta = document.createElement('span');
      meta.className = 'layout-inbox-meta';
      meta.textContent = item.sender || (item.isRead ? '已讀通知' : '未讀通知');
      const title = document.createElement('strong');
      title.textContent = item.title;
      const body = document.createElement('span');
      body.className = 'layout-inbox-body';
      body.textContent = item.body;
      const time = document.createElement('time');
      time.dateTime = item.createdAt;
      time.textContent = formatInboxTime(item.createdAt);
      copy.append(meta, title, body, time);
      link.append(marker, copy);

      link.addEventListener('click', async event => {
        if (link.href.endsWith('#')) return;
        event.preventDefault();
        try {
          if (!item.isRead) {
            const response = await fetch(`/api/inbox/${item.id}/read`, { method: 'PATCH' });
            if (!response.ok) throw new Error('無法更新已讀狀態');
            item.isRead = true;
            updateInboxBadges();
          }
          window.location.href = link.getAttribute('href');
        } catch (error) {
          setInboxFeedback(inbox, error.message, true);
        }
      });
      list.append(link);
    });
  }

  function renderInbox() {
    renderInboxPanel('notification');
    renderInboxPanel('message');
    updateInboxBadges();
  }

  function closeInboxPanels(except = null) {
    document.querySelectorAll('[data-inbox]').forEach(inbox => {
      if (inbox === except) return;
      inbox.querySelector('.layout-inbox-panel').hidden = true;
      inbox.querySelector('[data-inbox-trigger]').setAttribute('aria-expanded', 'false');
    });
  }

  async function loadInbox() {
    try {
      const response = await fetch('/api/inbox');
      if (!response.ok) throw new Error('無法載入通知與訊息');
      const result = await response.json();
      inboxState.items = result.items;
      renderInbox();
    } catch (error) {
      document.querySelectorAll('[data-inbox]').forEach(inbox => {
        const list = inbox.querySelector('[data-inbox-list]');
        list.innerHTML = '<p class="layout-inbox-status is-error">載入失敗，請稍後再試。</p>';
        setInboxFeedback(inbox, error.message, true);
      });
      console.error('[iRent inbox]', error);
    }
  }

  // 綁定所有頁面共用的頂部搜尋、通知與訊息按鈕。
  function initSharedInteractions() {
    const topSearch = document.querySelector('.app-search input');

    topSearch?.addEventListener('input', () => {
      pageState.globalQuery = topSearch.value;
      pageState.applyFilter?.();
      renderSearchResults(topSearch.value);
    });
    topSearch?.addEventListener('focus', () => renderSearchResults(topSearch.value));

    document.querySelectorAll('[data-inbox]').forEach(inbox => {
      const trigger = inbox.querySelector('[data-inbox-trigger]');
      const panel = inbox.querySelector('.layout-inbox-panel');
      trigger.addEventListener('click', event => {
        event.stopPropagation();
        const opening = panel.hidden;
        closeInboxPanels(opening ? inbox : null);
        panel.hidden = !opening;
        trigger.setAttribute('aria-expanded', String(opening));
      });

      inbox.querySelector('[data-inbox-read-all]').addEventListener('click', async () => {
        const kind = inbox.dataset.inbox;
        try {
          const response = await fetch('/api/inbox/read-all', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind })
          });
          if (!response.ok) throw new Error('無法更新已讀狀態');
          inboxState.items.forEach(item => {
            if (item.kind === kind) item.isRead = true;
          });
          renderInboxPanel(kind);
          updateInboxBadges();
          setInboxFeedback(inbox, '已將全部項目標示為已讀。');
        } catch (error) {
          setInboxFeedback(inbox, error.message, true);
        }
      });
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('[data-inbox]')) closeInboxPanels();
      if (!event.target.closest('[data-global-search]')) closeSearchPanel();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeInboxPanels();
        closeSearchPanel();
      }
    });

    loadInbox();

    const initialSearch = new URLSearchParams(window.location.search).get('search');
    if (initialSearch) {
      topSearch.value = initialSearch;
      pageState.globalQuery = initialSearch;
      pageState.applyFilter?.();
    }

    fetch('/api/auth/me').then(async response => {
      if (response.status === 401) {
        window.location.replace('/login.html');
        return null;
      }
      if (!response.ok) throw new Error('無法取得登入資料');
      return response.json();
    }).then(result => {
      if (!result) return;
      const user = result.item;
      window.IRentCurrentUser = user;
      const userButton = document.querySelector('[data-user-menu]');
      userButton.querySelector('.app-avatar').textContent = user.name.slice(-2);
      userButton.querySelector('strong').textContent = user.name;
      userButton.querySelector('small').textContent = user.role.name;
      userButton.setAttribute('aria-label', `目前使用者 ${user.name}，${user.role.name}；點擊登出`);
      userButton.addEventListener('click', async () => {
        if (!window.confirm(`確定要登出 ${user.name}？`)) return;
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.replace('/login.html');
      });
    }).catch(error => console.error('[iRent auth]', error));
  }

  // 營運總覽：搜尋警示、切換趨勢期間並開啟案件頁面。
  function initDashboard() {
    const searchable = () => document.querySelectorAll('.alerts-table tbody tr, .priority-list > a');
    const period = document.querySelector('.period-pill');

    pageState.applyFilter = () => filterElements(searchable(), pageState.globalQuery);

    if (period) {
      period.setAttribute('role', 'button');
      period.setAttribute('tabindex', '0');
      const togglePeriod = () => {
        const isSevenDays = period.textContent.includes('7');
        period.childNodes[0].textContent = isSevenDays ? '近 30 天 ' : '近 7 天 ';
        document.querySelector('.fleet-trend-card .dashboard-card-head p').textContent = isSevenDays
          ? '最近三十日即時狀態變化'
          : '最近七日即時狀態變化';
      };
      period.addEventListener('click', togglePeriod);
      period.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          togglePeriod();
        }
      });
    }

    document.querySelectorAll('.alerts-table tbody tr').forEach(row => {
      row.tabIndex = 0;
      row.setAttribute('role', 'link');
      const openCase = () => { window.location.href = 'damage-review.html'; };
      row.addEventListener('click', openCase);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter') openCase();
      });
    });
  }

  // 車隊管理：車輛篩選、區域切換、查看、新增及 CSV 匯入。
  function initFleet() {
    const table = document.querySelector('table');
    const search = document.querySelector('.filters .search');
    const status = document.querySelector('.filters .select');
    const region = document.querySelector('.fleet-grid .select');
    const getRows = () => table?.querySelectorAll('tbody tr') || [];

    pageState.applyFilter = () => filterElements(getRows(), `${pageState.globalQuery} ${search?.value || ''}`, row =>
      !status || status.value === '全部狀態' || !row.textContent.includes('可租')
    );
    search?.addEventListener('input', pageState.applyFilter);
    status?.addEventListener('change', pageState.applyFilter);

    const regionCounts = {
      台北都會區: ['38', '52', '8', '27'],
      桃園: ['24', '31', '5', '18']
    };
    region?.addEventListener('change', () => {
      const counts = regionCounts[region.value] || regionCounts.台北都會區;
      document.querySelectorAll('.map .pin span').forEach((pin, index) => { pin.textContent = counts[index]; });
      document.querySelector('.map')?.setAttribute('aria-label', `${region.value}車隊位置示意地圖`);
    });

    table?.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const row = button.closest('tr');
      Array.from(getRows()).forEach(item => item.removeAttribute('aria-selected'));
      row.setAttribute('aria-selected', 'true');
      notify(row.textContent.replace(/\s+/g, ' ').trim());
    });

    findButton(document, '新增車輛')?.addEventListener('click', () => {
      const plate = window.prompt('請輸入車牌');
      if (!plate) return;
      const model = window.prompt('請輸入車型', 'Toyota Yaris') || '未設定車型';
      const station = window.prompt('請輸入站點', '待分配') || '待分配';
      const row = document.createElement('tr');
      row.innerHTML = `<td><span class="cell-title"></span><span class="cell-meta"></span></td><td></td><td><span class="badge green">可租</span></td><td><b>100</b><div class="progress"><span style="width:100%"></span></div></td><td>0 km</td><td>無</td><td><button class="btn small">查看</button></td>`;
      row.querySelector('.cell-title').textContent = plate.toUpperCase();
      row.querySelector('.cell-meta').textContent = model;
      row.children[1].textContent = station;
      table.querySelector('tbody').append(row);
      pageState.applyFilter();
    });

    findButton(document, '匯入車輛')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,text/csv';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
          const records = lines.slice(1).map(line => line.split(',').map(value => value.trim()));
          records.forEach(([plate, model = '未設定車型', station = '待分配']) => {
            if (!plate) return;
            const row = document.createElement('tr');
            row.innerHTML = `<td><span class="cell-title"></span><span class="cell-meta"></span></td><td></td><td><span class="badge green">可租</span></td><td><b>100</b><div class="progress"><span style="width:100%"></span></div></td><td>0 km</td><td>無</td><td><button class="btn small">查看</button></td>`;
            row.querySelector('.cell-title').textContent = plate.toUpperCase();
            row.querySelector('.cell-meta').textContent = model;
            row.children[1].textContent = station;
            table.querySelector('tbody').append(row);
          });
          pageState.applyFilter();
          notify(`已匯入 ${records.length} 輛車。`);
        });
        reader.readAsText(file, 'utf-8');
      });
      input.click();
    });
  }

  // 智慧派工：任務篩選、指派、驗收及新增派工。
  function initDispatch() {
    const board = document.querySelector('.kanban');
    const search = document.querySelector('.filters .search');
    const type = document.querySelector('.filters .select');
    const getTasks = () => board?.querySelectorAll('.task') || [];

    pageState.applyFilter = () => {
      return filterElements(getTasks(), `${pageState.globalQuery} ${search?.value || ''}`, task => {
        if (!type || type.value === '全部任務') return true;
        const cleaning = /清潔|髒污|整理|抽洗|異味/.test(task.textContent);
        return type.value === '清潔' ? cleaning : !cleaning;
      });
    };
    search?.addEventListener('input', pageState.applyFilter);
    type?.addEventListener('change', pageState.applyFilter);

    board?.addEventListener('click', event => {
      const button = event.target.closest('button');
      const task = button?.closest('.task');
      if (!button || !task) return;

      if (button.textContent.includes('指派')) {
        const sourceColumn = task.closest('.column');
        const assignedColumn = board.querySelectorAll('.column')[1];
        const sourceCount = sourceColumn.querySelector('.column-title .badge');
        const assignedCount = assignedColumn.querySelector('.column-title .badge');
        task.querySelector('.task-foot').innerHTML = '<span>AI 智慧指派</span><span>剛剛</span>';
        assignedColumn.append(task);
        sourceCount.textContent = Math.max(0, Number.parseInt(sourceCount.textContent, 10) - 1);
        assignedCount.textContent = Number.parseInt(assignedCount.textContent, 10) + 1;
      } else if (button.textContent.includes('驗收')) {
        const count = task.closest('.column').querySelector('.column-title .badge');
        setBadge(task.querySelector('.badge'), '已驗收', 'green');
        button.textContent = '驗收完成';
        button.disabled = true;
        count.textContent = Math.max(0, Number.parseInt(count.textContent, 10) - 1);
      }
    });

    findButton(document, '建立派工')?.addEventListener('click', () => {
      const plate = window.prompt('請輸入車牌');
      if (!plate) return;
      const task = document.createElement('article');
      task.className = 'task';
      task.innerHTML = `<span class="badge blue">新任務</span><h3></h3><p>待補充任務內容・預估 30 分鐘</p><div class="task-foot"><span>等待指派</span><button class="btn small">指派</button></div>`;
      task.querySelector('h3').textContent = `${plate.toUpperCase()} 新增派工`;
      const pendingColumn = board.querySelector('.column');
      pendingColumn.append(task);
      const count = pendingColumn.querySelector('.column-title .badge');
      count.textContent = Number.parseInt(count.textContent, 10) + 1;
      pageState.applyFilter();
    });

    const scheduleButton = findButton(document, '自動排程設定');
    scheduleButton?.addEventListener('click', () => {
      const enabled = scheduleButton.getAttribute('aria-pressed') !== 'true';
      scheduleButton.setAttribute('aria-pressed', String(enabled));
      scheduleButton.textContent = enabled ? '自動排程：開啟' : '自動排程設定';
    });
  }

  // 案件清單切換時使用的靜態展示資料。
  const damageDetails = {
    '#DMG-260809-018': ['表面刮傷', '右後保桿', '中度', 'NT$ 3,200–4,800', '前 3 次租借影像未出現此刮傷；角度與亮度合格，建議判定為本次新增損傷。'],
    '#DMG-260809-016': ['液體髒污', '副駕座椅', '中度', 'NT$ 1,200–2,200', '影像顯示本次還車後新增液體痕跡，建議要求補拍近距離照片。'],
    '#DMG-260809-012': ['疑似淺刮痕', '左前門', '輕度', 'NT$ 1,800–2,800', '低角度反光可能影響判定，建議人工確認是否為既有損傷。']
  };

  // 車損案件：案件篩選、詳情切換、判定與匯出。
  function initDamageReview() {
    const list = document.querySelector('.case-list');
    const search = document.querySelector('.filters .search');
    const status = document.querySelector('.filters .select');
    const detail = document.querySelector('#detail');
    const getCases = () => list?.querySelectorAll('.case') || [];

    pageState.applyFilter = () => filterElements(getCases(), `${pageState.globalQuery} ${search?.value || ''}`, item =>
      !status || status.value === '全部狀態' || item.textContent.includes('高風險')
    );
    search?.addEventListener('input', pageState.applyFilter);
    status?.addEventListener('change', pageState.applyFilter);

    list?.addEventListener('click', event => {
      const item = event.target.closest('.case');
      if (!item) return;
      event.preventDefault();
      setActive(getCases(), item);
      const caseNumber = item.querySelector('.case-top b').textContent.trim();
      const vehicle = item.querySelector('p b').textContent.trim();
      const sourceBadge = item.querySelector('.badge');
      detail.querySelector('.card-head h2').textContent = `${caseNumber} 新增損傷比對`;
      detail.querySelector('.card-head p').textContent = vehicle;
      const detailBadge = detail.querySelector('.card-head .badge');
      detailBadge.className = sourceBadge.className;
      detailBadge.textContent = sourceBadge.textContent.trim();
      const values = damageDetails[caseNumber];
      if (values) {
        detail.querySelectorAll('.ai-result strong').forEach((element, index) => { element.textContent = values[index]; });
        detail.querySelector('.ai-note').innerHTML = `<b>AI 歷史比對：</b>${values[4]}`;
      }
    });

    detail?.querySelector('.decision')?.addEventListener('click', event => {
      const button = event.target.closest('button');
      const activeCase = list.querySelector('.case.active');
      if (!button || !activeCase) return;
      const listBadge = activeCase.querySelector('.badge');
      const detailBadge = detail.querySelector('.card-head .badge');
      if (button.textContent.includes('補拍')) {
        setBadge(listBadge, '待補件', 'amber');
        setBadge(detailBadge, '待補件', 'amber');
      } else if (button.textContent.includes('非本次')) {
        setBadge(listBadge, '已排除', 'gray');
        setBadge(detailBadge, '已排除', 'gray');
      } else if (button.textContent.includes('確認新增')) {
        setBadge(listBadge, '已派工', 'green');
        setBadge(detailBadge, '已派工', 'green');
      }
    });

    findButton(document, '批次指派')?.addEventListener('click', event => {
      const cases = Array.from(getCases()).filter(item => !item.hidden);
      cases.forEach(item => setBadge(item.querySelector('.badge'), '已指派', 'green'));
      const count = cases.length;
      event.currentTarget.textContent = `已指派 ${count} 件`;
      event.currentTarget.disabled = true;
    });
    findButton(document, '匯出案件')?.addEventListener('click', () => {
      const rows = [['案件', '車輛', '狀態'], ...Array.from(getCases()).filter(item => !item.hidden).map(item => [
        item.querySelector('.case-top b').textContent.trim(),
        item.querySelector('p b').textContent.trim(),
        item.querySelector('.badge').textContent.trim()
      ])];
      downloadCsv('irent-damage-cases.csv', rows);
    });
  }

  // 維修工單：清單篩選、詳情同步、進度更新與匯出。
  function initWorkOrders() {
    const table = document.querySelector('.order-layout table');
    const detail = document.querySelector('.order-layout aside');
    const search = document.querySelector('.filters .search');
    const status = document.querySelector('.filters .select');
    let selectedRow = table?.querySelector('tbody tr');
    const getRows = () => table?.querySelectorAll('tbody tr') || [];

    pageState.applyFilter = () => filterElements(getRows(), `${pageState.globalQuery} ${search?.value || ''}`, row =>
      !status || status.value === '全部狀態' || row.textContent.includes(status.value)
    );
    search?.addEventListener('input', pageState.applyFilter);
    status?.addEventListener('change', pageState.applyFilter);

    table?.addEventListener('click', event => {
      const row = event.target.closest('tbody tr');
      if (!row) return;
      selectedRow = row;
      Array.from(getRows()).forEach(item => item.removeAttribute('aria-selected'));
      row.setAttribute('aria-selected', 'true');
      const cells = row.children;
      const sourceBadge = cells[5].querySelector('.badge');
      detail.querySelector('.card-head h2').textContent = cells[0].querySelector('.cell-title').textContent.trim();
      detail.querySelector('.card-head p').textContent = `${cells[0].querySelector('.cell-meta').textContent.trim()}・${cells[1].textContent.trim()}`;
      detail.querySelector('.cost strong').textContent = cells[4].textContent.trim();
      detail.querySelector('.vendor b').textContent = cells[3].textContent.trim();
      const detailBadge = detail.querySelector('.card-head .badge');
      detailBadge.className = sourceBadge.className;
      detailBadge.textContent = sourceBadge.textContent.trim();
    });

    findButton(detail, '查看原始案件')?.addEventListener('click', () => { window.location.href = 'damage-review.html'; });
    findButton(detail, '聯絡')?.addEventListener('click', () => notify(`聯絡 ${detail.querySelector('.vendor b').textContent.trim()}`));
    findButton(detail, '更新進度')?.addEventListener('click', () => {
      if (!selectedRow) return;
      const rowBadge = selectedRow.children[5].querySelector('.badge');
      const detailBadge = detail.querySelector('.card-head .badge');
      const next = detailBadge.textContent.includes('維修中') ? ['待驗收', 'green'] : ['已完成', 'blue'];
      setBadge(rowBadge, next[0], next[1]);
      setBadge(detailBadge, next[0], next[1]);
    });

    findButton(document, '建立工單')?.addEventListener('click', () => {
      const plate = window.prompt('請輸入車牌');
      if (!plate) return;
      const row = document.createElement('tr');
      row.innerHTML = `<td><span class="cell-title">#WO-NEW</span><span class="cell-meta"></span></td><td>待確認維修項目</td><td><span class="badge amber">P2</span></td><td>待指派</td><td>待報價</td><td><span class="badge amber">待報價</span></td><td>待確認</td>`;
      row.querySelector('.cell-meta').textContent = plate.toUpperCase();
      table.querySelector('tbody').prepend(row);
      pageState.applyFilter();
    });
    findButton(document, '匯出工單')?.addEventListener('click', () => downloadCsv('irent-work-orders.csv', getTableRows(table)));
  }

  // 報表分析：切換期間資料並匯出目前管理指標。
  function initReports() {
    const period = document.querySelector('.page-head .select');
    const exportButton = findButton(document, '匯出管理報表');
    const metricValues = document.querySelectorAll('.metric > b');
    const chartBars = document.querySelectorAll('.chart-grid .bar');
    const datasets = {
      '2026/08/03–08/09': {
        metrics: ['78.4%', '1.8h', '72.6%', '1,126', '96.1%'],
        bars: [58, 76, 68, 70, 64, 63, 77, 57, 72, 51, 86, 46, 92, 39]
      },
      '最近 30 日': {
        metrics: ['76.9%', '2.1h', '69.8%', '1,184', '95.4%'],
        bars: [63, 71, 72, 66, 69, 61, 81, 55, 76, 49, 84, 44, 88, 41]
      }
    };

    pageState.applyFilter = () => filterElements(document.querySelectorAll('.report-grid .card'), pageState.globalQuery);
    period?.addEventListener('change', () => {
      const data = datasets[period.value];
      if (!data) return;
      metricValues.forEach((element, index) => { element.textContent = data.metrics[index]; });
      chartBars.forEach((element, index) => { element.style.height = `${data.bars[index]}%`; });
      document.querySelector('.report-grid .card-head p').textContent = period.value === '最近 30 日' ? '最近 30 日・小時／件數' : '最近 7 日・小時／件數';
    });
    exportButton?.addEventListener('click', () => downloadCsv('irent-management-report.csv', [
      ['期間', period.value],
      ['指標', '數值'],
      ...Array.from(document.querySelectorAll('.metric')).map(metric => [
        metric.querySelector('.metric-label').childNodes[0].textContent.trim(),
        metric.querySelector('b').textContent.trim()
      ])
    ]));
  }

  // 權限設定：角色切換、權限矩陣、成員及稽核資料操作。
  function initPermissions() {
    const menuLinks = document.querySelectorAll('.settings-menu a');
    const roleContainer = document.querySelector('.role-tabs');
    const permissionRows = document.querySelectorAll('.perm tbody tr');
    const roleProfiles = [
      [21, 63, 63, 53, 63],
      [5, 31, 31, 21, 1],
      [1, 45, 13, 17, 0],
      [1, 9, 15, 1, 0],
      [1, 1, 5, 0, 0]
    ];
    let savedProfiles = roleProfiles.map(profile => [...profile]);
    let activeRole = 0;

    const renderPermissions = () => {
      permissionRows.forEach((row, rowIndex) => {
        Array.from(row.children).slice(1).forEach((cell, permissionIndex) => {
          const enabled = Boolean(roleProfiles[activeRole][rowIndex] & (1 << permissionIndex));
          cell.innerHTML = enabled ? '<span class="check">✓</span>' : '—';
          cell.tabIndex = 0;
          cell.setAttribute('role', 'checkbox');
          cell.setAttribute('aria-checked', String(enabled));
        });
      });
    };

    menuLinks.forEach(link => link.addEventListener('click', event => {
      setActive(menuLinks, link);
      if (!document.querySelector(link.getAttribute('href'))) {
        event.preventDefault();
        notify(`${link.textContent.trim()}尚無可顯示的設定內容。`);
      }
    }));
    roleContainer?.addEventListener('click', event => {
      const role = event.target.closest('.role');
      if (!role) return;
      const roles = Array.from(roleContainer.querySelectorAll('.role'));
      activeRole = roles.indexOf(role);
      setActive(roles, role);
      renderPermissions();
    });
    document.querySelector('.perm')?.addEventListener('click', event => {
      const cell = event.target.closest('td');
      if (!cell || cell.cellIndex === 0) return;
      const rowIndex = cell.parentElement.rowIndex - 1;
      roleProfiles[activeRole][rowIndex] ^= 1 << (cell.cellIndex - 1);
      renderPermissions();
    });

    findButton(document.querySelector('#roles'), '取消變更')?.addEventListener('click', () => {
      savedProfiles.forEach((profile, index) => { roleProfiles[index] = [...profile]; });
      renderPermissions();
    });
    findButton(document.querySelector('#roles'), '儲存權限')?.addEventListener('click', () => {
      savedProfiles = roleProfiles.map(profile => [...profile]);
      notify('權限設定已儲存。');
    });
    findButton(document.querySelector('#roles'), '新增角色')?.addEventListener('click', () => {
      const name = window.prompt('請輸入角色名稱');
      if (!name) return;
      roleProfiles.push([0, 0, 0, 0, 0]);
      savedProfiles.push([0, 0, 0, 0, 0]);
      const button = document.createElement('button');
      button.className = 'role';
      button.textContent = `${name} 0`;
      roleContainer.append(button);
      button.click();
    });

    findButton(document, '邀請成員')?.addEventListener('click', () => {
      const name = window.prompt('請輸入成員姓名');
      if (!name) return;
      const member = document.createElement('div');
      member.className = 'member';
      member.innerHTML = '<span class="avatar"></span><div><b></b><p>待設定角色・待設定營運區</p></div><span class="badge amber">待驗證</span>';
      member.querySelector('.avatar').textContent = name.slice(0, 1);
      member.querySelector('b').textContent = name;
      document.querySelector('#members .card-body').prepend(member);
    });
    findButton(document, '下載稽核紀錄')?.addEventListener('click', () => downloadCsv('irent-audit-log.csv', [
      ['操作', '內容', '時間'],
      ...Array.from(document.querySelectorAll('.audit')).map(item => [
        item.querySelector('b').textContent.trim(),
        item.querySelector('p').textContent.trim(),
        item.querySelector('time').textContent.trim()
      ])
    ]));
    findButton(document.querySelector('#members'), '管理全部')?.addEventListener('click', () => document.querySelector('#members').scrollIntoView({ behavior: 'smooth' }));
    findButton(document.querySelector('#audit'), '查看全部')?.addEventListener('click', () => document.querySelector('#audit').scrollIntoView({ behavior: 'smooth' }));

    pageState.applyFilter = () => filterElements(document.querySelectorAll('.member, .audit'), pageState.globalQuery);
    renderPermissions();
  }

  // 僅初始化目前頁面需要的互動，避免跨頁選取不存在的元件。
  function initPageInteractions(pageKey) {
    pageState.applyFilter = null;
    pageState.globalQuery = '';
    const initializers = {
      dashboard: initDashboard,
      fleet: initFleet,
      'damage-review': initDamageReview,
      dispatch: initDispatch,
      'work-orders': initWorkOrders,
      reports: initReports,
      permissions: () => {}
    };
    initializers[pageKey]?.();
  }

  // 共用入口：先渲染版型，再掛載目前頁面的互動。
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
    initPageInteractions(pageKey);
    initSharedInteractions();
  }

  window.IRentLayout = {
    init,
    initPageInteractions,
    runSelfTests,
    downloadCsv,
    helpers: { countUnread, filterElements, normalizeText, rowsToCsv, searchCatalog, setActive }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
