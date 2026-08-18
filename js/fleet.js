(function fleetModule(globalObject) {
  'use strict';

  const statusMeta = {
    available: { label: '可租', badge: 'green' },
    cleaning: { label: '待清潔', badge: 'amber' },
    maintenance: { label: '待維修', badge: 'red' }
  };
  const state = { vehicles: [], stations: [], context: null };
  const text = value => String(value ?? '').trim();

  function escapeText(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function filteredVehicles() {
    const search = document.querySelector('[data-fleet-search]');
    const status = document.querySelector('[data-fleet-status]');
    const keyword = `${state.context.getGlobalQuery()} ${search?.value || ''}`
      .trim()
      .toLocaleLowerCase('zh-Hant');
    return state.vehicles.filter(vehicle => {
      const searchable = [
        vehicle.licensePlate,
        vehicle.model,
        vehicle.color,
        vehicle.station?.code,
        vehicle.station?.name,
        vehicle.station?.city,
        vehicle.station?.district,
        vehicle.latestAnomaly
      ].join(' ').toLocaleLowerCase('zh-Hant');
      return (!keyword || searchable.includes(keyword))
        && (!status?.value || vehicle.status === status.value);
    });
  }

  function renderRows() {
    const body = document.querySelector('[data-fleet-body]');
    if (!body) return;
    const vehicles = filteredVehicles();
    body.innerHTML = vehicles.map(vehicle => {
      const status = statusMeta[vehicle.status] || { label: vehicle.status, badge: 'gray' };
      const healthClass = vehicle.healthScore < 70 ? 'risk' : vehicle.healthScore < 85 ? 'warn' : '';
      return `
        <tr data-vehicle-id="${vehicle.id}">
          <td>
            <span class="cell-title">${escapeText(vehicle.licensePlate)}</span>
            <span class="cell-meta">${escapeText(vehicle.model)}・${escapeText(vehicle.color)}</span>
          </td>
          <td>
            <span class="cell-title">${escapeText(vehicle.station?.name || '未分配')}</span>
            <span class="cell-meta">${escapeText([vehicle.station?.city, vehicle.station?.district].filter(Boolean).join(''))}</span>
          </td>
          <td><span class="badge ${status.badge}">${escapeText(status.label)}</span></td>
          <td>
            <b>${vehicle.healthScore}</b>
            <div class="progress ${healthClass}"><span style="width:${vehicle.healthScore}%"></span></div>
          </td>
          <td>${Number(vehicle.todayMileage).toFixed(1)} km</td>
          <td>${escapeText(vehicle.latestAnomaly || '無')}</td>
          <td><button class="btn small" type="button" data-action="view-vehicle">查看</button></td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="7" class="fleet-empty">沒有符合條件的車輛</td></tr>';
  }

  function renderMetrics() {
    const count = state.vehicles.length;
    const modelCount = new Set(state.vehicles.map(vehicle => vehicle.model)).size;
    const stationCount = new Set(state.vehicles.map(vehicle => vehicle.stationId)).size;
    const averageHealth = count
      ? state.vehicles.reduce((sum, vehicle) => sum + vehicle.healthScore, 0) / count
      : 0;
    const attentionCount = state.vehicles.filter(vehicle => vehicle.healthScore < 70).length;
    const availableCount = state.vehicles.filter(vehicle => vehicle.status === 'available').length;
    const availableRate = count ? availableCount / count * 100 : 0;
    const totalMileage = state.vehicles.reduce((sum, vehicle) => sum + Number(vehicle.todayMileage), 0);

    setText('[data-fleet-stat="total"]', count.toLocaleString('zh-TW'));
    setText('[data-fleet-meta="total"]', `${modelCount} 種車型・${stationCount} 個站點`);
    setText('[data-fleet-stat="health"]', averageHealth.toFixed(1));
    setText('[data-fleet-meta="health"]', `${count - attentionCount} 輛狀態良好`);
    setText('[data-fleet-stat="attention"]', attentionCount);
    setText('[data-fleet-stat="available"]', `${availableRate.toFixed(1)}%`);
    setText('[data-fleet-meta="available"]', `${availableCount} 輛目前可租`);
    setText('[data-fleet-stat="mileage"]', `${totalMileage.toFixed(1)} km`);
    setText('[data-fleet-meta="mileage"]', count ? `平均 ${(totalMileage / count).toFixed(1)} km` : '平均 0 km');
    setText('[data-fleet-health-average]', averageHealth.toFixed(1));

    const ring = document.querySelector('.ring');
    if (ring) {
      ring.style.background = `conic-gradient(var(--green) 0 ${averageHealth}%, #e4ebf1 ${averageHealth}%)`;
    }
  }

  function renderRiskRanking() {
    const container = document.querySelector('[data-region-risk]');
    if (!container) return;
    const regions = new Map();
    state.vehicles.forEach(vehicle => {
      const city = vehicle.station?.city || '未分配';
      if (!regions.has(city)) regions.set(city, { city, total: 0, score: 0, risk: 0 });
      const region = regions.get(city);
      region.total += 1;
      region.score += vehicle.healthScore;
      if (vehicle.healthScore < 70) region.risk += 1;
    });
    const ranked = [...regions.values()]
      .map(region => ({ ...region, average: region.score / region.total }))
      .sort((left, right) => right.risk - left.risk || left.average - right.average)
      .slice(0, 3);
    container.innerHTML = ranked.map(region => `
      <div class="inline" style="justify-content:space-between">
        <span>
          <b>${escapeText(region.city)}</b>
          <small class="cell-meta">平均 ${region.average.toFixed(1)}</small>
        </span>
        <b>${region.risk} 輛</b>
      </div>
    `).join('');
  }

  function updateMap() {
    const region = document.querySelector('[data-fleet-region]');
    const selectedCity = region?.value;
    const districtCounts = new Map();
    state.vehicles
      .filter(vehicle => !selectedCity || vehicle.station?.city === selectedCity)
      .forEach(vehicle => {
        const district = vehicle.station?.district || '未分配';
        districtCounts.set(district, (districtCounts.get(district) || 0) + 1);
      });
    const counts = [...districtCounts.entries()].sort((left, right) => right[1] - left[1]);
    document.querySelectorAll('.map .pin').forEach((pin, index) => {
      const item = counts[index];
      pin.hidden = !item;
      if (item) {
        pin.querySelector('span').textContent = item[1];
        pin.title = `${item[0]}：${item[1]} 輛`;
      }
    });
    document.querySelector('.map')?.setAttribute('aria-label', `${selectedCity || '全區'}車隊位置示意地圖`);
  }

  function renderRegionOptions() {
    const select = document.querySelector('[data-fleet-region]');
    if (!select) return;
    const cities = [...new Set(state.vehicles.map(vehicle => vehicle.station?.city).filter(Boolean))];
    select.innerHTML = cities.map(city =>
      `<option value="${escapeText(city)}">${escapeText(city)}</option>`
    ).join('');
    updateMap();
  }

  function findStation(value) {
    const normalized = text(value).toLocaleLowerCase('zh-Hant');
    return state.stations.find(station =>
      station.code.toLocaleLowerCase('zh-Hant') === normalized
      || station.name.toLocaleLowerCase('zh-Hant') === normalized
    );
  }

  async function refresh() {
    const [vehicles, stations] = await Promise.all([
      globalObject.IRentVehicleApi.list(),
      globalObject.IRentStationApi.list()
    ]);
    state.vehicles = vehicles;
    state.stations = stations;
    renderRows();
    renderMetrics();
    renderRiskRanking();
    renderRegionOptions();
  }

  async function addVehicle() {
    const licensePlate = window.prompt('請輸入車牌，例如 RAA-1234');
    if (!licensePlate) return;
    const model = window.prompt('請輸入車型', 'Toyota Yaris');
    if (!model) return;
    const color = window.prompt('請輸入顏色', '白');
    if (!color) return;
    const stationInput = window.prompt(
      '請輸入停靠站代碼或完整名稱',
      state.stations[0]?.code || ''
    );
    if (!stationInput) return;
    const station = findStation(stationInput);
    if (!station) throw new Error('找不到指定停靠站，請輸入站點代碼或完整名稱');

    await globalObject.IRentVehicleApi.create({
      licensePlate: text(licensePlate).toUpperCase(),
      model: text(model),
      color: text(color),
      stationId: station.id
    });
    await refresh();
    state.context.notify(`已新增車輛 ${text(licensePlate).toUpperCase()}`);
  }

  function parseCsv(content) {
    const lines = String(content).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    const aliases = {
      車牌: 'licensePlate',
      車型: 'model',
      顏色: 'color',
      站點代碼: 'stationCode',
      狀態: 'status',
      健康分數: 'healthScore',
      今日里程: 'todayMileage',
      最近異常: 'latestAnomaly'
    };
    const headers = lines[0].split(',').map(value => aliases[text(value)] || text(value));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(text);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    });
  }

  async function importVehicles(file) {
    const records = parseCsv(await file.text());
    if (!records.length) throw new Error('CSV 沒有可匯入的資料');
    const payloads = records.map(record => {
      const station = findStation(record.stationCode);
      if (!station) throw new Error(`${record.licensePlate || '未知車牌'} 的站點代碼不存在`);
      return {
        licensePlate: text(record.licensePlate).toUpperCase(),
        model: text(record.model),
        color: text(record.color),
        stationId: station.id,
        status: record.status || 'available',
        healthScore: record.healthScore ? Number(record.healthScore) : 100,
        todayMileage: record.todayMileage ? Number(record.todayMileage) : 0,
        latestAnomaly: record.latestAnomaly || null
      };
    });
    const results = await Promise.allSettled(payloads.map(payload =>
      globalObject.IRentVehicleApi.create(payload)
    ));
    const succeeded = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    await refresh();
    state.context.notify(`匯入完成：成功 ${succeeded} 輛，失敗 ${failed} 輛`);
  }

  function chooseCsv() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await importVehicles(file);
      } catch (error) {
        state.context.notify(error.message);
      }
    });
    input.click();
  }

  async function init(context) {
    state.context = context;
    context.setApplyFilter(renderRows);
    document.querySelector('[data-fleet-search]')?.addEventListener('input', renderRows);
    document.querySelector('[data-fleet-status]')?.addEventListener('change', renderRows);
    document.querySelector('[data-fleet-region]')?.addEventListener('change', updateMap);
    document.querySelector('[data-action="add-vehicle"]')?.addEventListener('click', async () => {
      try {
        await addVehicle();
      } catch (error) {
        context.notify(error.message);
      }
    });
    document.querySelector('[data-action="import-vehicles"]')?.addEventListener('click', chooseCsv);
    document.querySelector('[data-fleet-body]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-action="view-vehicle"]');
      if (!button) return;
      const vehicle = state.vehicles.find(item =>
        item.id === Number(button.closest('[data-vehicle-id]')?.dataset.vehicleId)
      );
      if (!vehicle) return;
      context.notify([
        vehicle.licensePlate,
        `${vehicle.model}・${vehicle.color}`,
        vehicle.station?.name || '未分配站點',
        statusMeta[vehicle.status]?.label || vehicle.status,
        `健康分數 ${vehicle.healthScore}`,
        vehicle.latestAnomaly || '無異常'
      ].join('\n'));
    });

    try {
      await refresh();
    } catch (error) {
      const body = document.querySelector('[data-fleet-body]');
      if (body) body.innerHTML = `<tr><td colspan="7" class="fleet-empty">${escapeText(error.message)}</td></tr>`;
    }
  }

  globalObject.IRentFleet = { init };
})(window);
