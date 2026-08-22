(function fleetModule(globalObject) {
  'use strict';

  const statusMeta = {
    available: { label: '可租', badge: 'green' },
    cleaning: { label: '待清潔', badge: 'amber' },
    maintenance: { label: '待維修', badge: 'red' }
  };
  const cabinConditionMeta = {
    clean: { label: '乾淨', badge: 'green' },
    average: { label: '普通', badge: 'blue' },
    dirty: { label: '髒污', badge: 'amber' }
  };
  const rentalStatusMeta = {
    active: '租借中',
    completed: '已完成',
    cancelled: '已取消'
  };
  const state = {
    vehicles: [],
    stations: [],
    mapData: { type: 'FeatureCollection', features: [] },
    map: null,
    mapLoaded: false,
    page: 1,
    pageSize: 5,
    context: null
  };
  const text = value => String(value ?? '').trim();

  function getOverallStatus(vehicle) {
    const conditions = [];
    if (vehicle.status === 'maintenance') conditions.push('待維修');
    if (vehicle.status === 'cleaning' || vehicle.cabinCondition === 'dirty') conditions.push('待清潔');
    return conditions.length ? conditions.join('／') : '可租';
  }

  function escapeText(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }

  function escapeAttribute(value) {
    return escapeText(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  function formatMoney(value) {
    return `NT$ ${Number(value || 0).toLocaleString('zh-TW')}`;
  }

  function formatDateTime(value) {
    return value ? new Date(value).toLocaleString('zh-TW', { hour12: false }) : '尚未還車';
  }

  function dateTimeInputValue(value) {
    if (!value) return '';
    const date = new Date(value);
    const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localTime.toISOString().slice(0, 16);
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
        cabinConditionMeta[vehicle.cabinCondition]?.label,
        vehicle.latestAnomaly
      ].join(' ').toLocaleLowerCase('zh-Hant');
      const matchesStatus = !status?.value
        || (status.value === 'cleaning'
          ? vehicle.status === 'cleaning' || vehicle.cabinCondition === 'dirty'
          : vehicle.status === status.value);
      return (!keyword || searchable.includes(keyword)) && matchesStatus;
    });
  }

  function renderRows() {
    const body = document.querySelector('[data-fleet-body]');
    if (!body) return;
    const vehicles = filteredVehicles();
    const totalPages = Math.max(1, Math.ceil(vehicles.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const pageStart = (state.page - 1) * state.pageSize;
    const pageVehicles = vehicles.slice(pageStart, pageStart + state.pageSize);
    body.innerHTML = pageVehicles.map((vehicle, index) => {
      const cabinCondition = cabinConditionMeta[vehicle.cabinCondition]
        || { label: vehicle.cabinCondition, badge: 'gray' };
      const healthClass = vehicle.healthScore < 70 ? 'risk' : vehicle.healthScore < 85 ? 'warn' : '';
      return `
        <tr data-vehicle-id="${vehicle.id}">
          <td class="fleet-sequence">${pageStart + index + 1}</td>
          <td>
            <span class="cell-title">${escapeText(vehicle.licensePlate)}</span>
            <span class="cell-meta">${escapeText(vehicle.model)}・${escapeText(vehicle.color)}</span>
          </td>
          <td>
            <span class="cell-title">${escapeText(vehicle.station?.name || '未分配')}</span>
            <span class="cell-meta">${escapeText([vehicle.station?.city, vehicle.station?.district].filter(Boolean).join(''))}</span>
          </td>
          <td><span class="fleet-overall-status">${escapeText(getOverallStatus(vehicle))}</span></td>
          <td><span class="fleet-cabin-condition is-${escapeText(vehicle.cabinCondition)}">${escapeText(cabinCondition.label)}</span></td>
          <td>
            <b>${vehicle.healthScore}</b>
            <div class="progress ${healthClass}"><span style="width:${vehicle.healthScore}%"></span></div>
          </td>
          <td>${escapeText(vehicle.latestAnomaly || '無')}</td>
          <td>
            <div class="inline fleet-row-actions">
              <button class="btn small" type="button" data-action="view-vehicle">查看</button>
              <button class="btn small" type="button" data-action="view-history">歷程</button>
            </div>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="8" class="fleet-empty">沒有符合條件的車輛</td></tr>';

    setText('[data-fleet-page-info]', `第 ${state.page} / ${totalPages} 頁，共 ${vehicles.length} 輛`);
    const previous = document.querySelector('[data-fleet-page-previous]');
    const next = document.querySelector('[data-fleet-page-next]');
    if (previous) previous.disabled = state.page === 1;
    if (next) next.disabled = state.page === totalPages;
  }

  function resetPageAndRenderRows() {
    state.page = 1;
    renderRows();
  }

  async function editCabinCondition(vehicle) {
    const inputOptions = vehicle.status === 'available'
      ? { clean: '乾淨', average: '普通' }
      : vehicle.status === 'cleaning'
        ? { dirty: '髒污' }
        : { clean: '乾淨', average: '普通', dirty: '髒污' };
    const result = await globalObject.Swal.fire({
      title: `修改 ${escapeText(vehicle.licensePlate)} 車內狀況`,
      input: 'select',
      inputOptions,
      inputValue: vehicle.cabinCondition,
      showCancelButton: true,
      confirmButtonText: '儲存',
      cancelButtonText: '取消',
      confirmButtonColor: '#08775d',
      inputValidator: value => value ? undefined : '請選擇車內狀況'
    });
    if (!result.isConfirmed) return;

    await globalObject.IRentVehicleApi.update(vehicle.id, { cabinCondition: result.value });
    await refresh();
    state.context.notify(`已更新 ${vehicle.licensePlate} 車內狀況`);
  }

  async function showVehicleDetails(vehicle) {
    const cabinCondition = cabinConditionMeta[vehicle.cabinCondition]
      || { label: vehicle.cabinCondition, badge: 'gray' };
    const details = `
      <div class="fleet-vehicle-detail">
        <div class="fleet-detail-item">
          <span>車型／顏色</span>
          <strong>${escapeText(vehicle.model)}・${escapeText(vehicle.color)}</strong>
        </div>
        <div class="fleet-detail-item">
          <span>整體狀態</span>
          <strong><i class="fleet-overall-status">${escapeText(getOverallStatus(vehicle))}</i></strong>
        </div>
        <div class="fleet-detail-item">
          <span>車內狀況</span>
          <strong><i class="fleet-cabin-condition is-${escapeText(vehicle.cabinCondition)}">${escapeText(cabinCondition.label)}</i></strong>
        </div>
        <div class="fleet-detail-item fleet-detail-wide">
          <span>目前站點</span>
          <strong>${escapeText(vehicle.station?.name || '未分配')}</strong>
          <small>${escapeText([vehicle.station?.city, vehicle.station?.district].filter(Boolean).join(''))}</small>
        </div>
        <div class="fleet-detail-item">
          <span>健康分數</span>
          <strong>${escapeText(vehicle.healthScore)}</strong>
        </div>
        <div class="fleet-detail-item">
          <span>今日里程</span>
          <strong>${Number(vehicle.todayMileage).toFixed(1)} km</strong>
        </div>
        <div class="fleet-detail-item fleet-detail-wide">
          <span>最近異常</span>
          <strong>${escapeText(vehicle.latestAnomaly || '無')}</strong>
        </div>
      </div>
    `;

    if (globalObject.Swal?.fire) {
      const result = await globalObject.Swal.fire({
        title: escapeText(vehicle.licensePlate),
        html: details,
        showCancelButton: true,
        confirmButtonText: '修改車內狀況',
        cancelButtonText: '關閉',
        confirmButtonColor: '#08775d',
        customClass: { popup: 'fleet-vehicle-dialog' },
        width: 'min(560px, calc(100vw - 28px))'
      });
      if (result.isConfirmed) await editCabinCondition(vehicle);
      return;
    }

    state.context.notify([
      vehicle.licensePlate,
      `${vehicle.model}・${vehicle.color}`,
      vehicle.station?.name || '未分配站點',
      getOverallStatus(vehicle),
      `車內狀況 ${cabinCondition.label}`,
      `健康分數 ${vehicle.healthScore}`,
      vehicle.latestAnomaly || '無異常'
    ].join('\n'));
  }

  function rentalHistoryHtml(rentals) {
    if (!rentals.length) return '<p class="fleet-history-empty">尚無租借紀錄</p>';
    return rentals.map(rental => `
      <article class="fleet-history-entry">
        <div class="fleet-history-entry-head">
          <div>
            <strong>${escapeText(formatDateTime(rental.startedAt))}</strong>
            <small>${escapeText(formatDateTime(rental.endedAt))}・${escapeText(rentalStatusMeta[rental.status] || rental.status)}</small>
          </div>
          <b>${escapeText(formatMoney(rental.rentalFee))}</b>
        </div>
        <div class="fleet-history-customer">
          <span>租客：${escapeText(rental.customer?.fullName || '未登記')}</span>
          <span>會員編號：${escapeText(rental.customer?.memberNo || '—')}</span>
          <span>電話：${escapeText(rental.customer?.phone || '—')}</span>
        </div>
        <button class="btn small" type="button" data-history-edit="rental" data-record-id="${rental.id}">修改紀錄</button>
      </article>
    `).join('');
  }

  function serviceHistoryHtml(services, type) {
    const records = services.filter(record => record.type === type);
    if (!records.length) return `<p class="fleet-history-empty">尚無${type === 'cleaning' ? '清潔' : '維修'}紀錄</p>`;
    return records.map(record => `
      <article class="fleet-history-entry">
        <div class="fleet-history-entry-head">
          <div>
            <strong>${escapeText(formatDateTime(record.performedAt))}</strong>
            <small>${escapeText(record.note || '未填寫備註')}</small>
          </div>
          <b>${escapeText(formatMoney(record.cost))}</b>
        </div>
        <button class="btn small" type="button" data-history-edit="service" data-record-id="${record.id}">修改紀錄</button>
      </article>
    `).join('');
  }

  function vehicleHistoryHtml(history) {
    return `
      <div class="fleet-history">
        <div class="fleet-history-summary">
          <div><span>累計租金</span><b>${escapeText(formatMoney(history.summary.rentalFee))}</b></div>
          <div><span>清潔費用</span><b>${escapeText(formatMoney(history.summary.cleaningCost))}</b></div>
          <div><span>維修費用</span><b>${escapeText(formatMoney(history.summary.maintenanceCost))}</b></div>
        </div>
        <section class="fleet-history-section">
          <h3>租借紀錄</h3>
          ${rentalHistoryHtml(history.rentals)}
        </section>
        <section class="fleet-history-section">
          <h3>清潔紀錄</h3>
          ${serviceHistoryHtml(history.services, 'cleaning')}
        </section>
        <section class="fleet-history-section">
          <h3>維修紀錄</h3>
          ${serviceHistoryHtml(history.services, 'maintenance')}
        </section>
      </div>
    `;
  }

  function formValue(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  function formDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  async function showRentalHistoryForm(vehicle, rental = null) {
    const customer = rental?.customer || {};
    const result = await globalObject.Swal.fire({
      title: rental ? '修改租借紀錄' : '新增租借紀錄',
      html: `
        <div class="fleet-history-form">
          <label>租客全名<input id="history-customer-name" value="${escapeAttribute(customer.fullName || '')}"></label>
          <label>會員編號<input id="history-member-no" value="${escapeAttribute(customer.memberNo || '')}"></label>
          <label>完整電話<input id="history-phone" inputmode="tel" value="${escapeAttribute(customer.phone || '')}"></label>
          <label>租借時間<input id="history-started-at" type="datetime-local" value="${escapeAttribute(dateTimeInputValue(rental?.startedAt || new Date()))}"></label>
          <label>還車時間<input id="history-ended-at" type="datetime-local" value="${escapeAttribute(dateTimeInputValue(rental?.endedAt))}"></label>
          <label>租借狀態
            <select id="history-rental-status">
              <option value="active" ${rental?.status === 'active' ? 'selected' : ''}>租借中</option>
              <option value="completed" ${!rental || rental.status === 'completed' ? 'selected' : ''}>已完成</option>
              <option value="cancelled" ${rental?.status === 'cancelled' ? 'selected' : ''}>已取消</option>
            </select>
          </label>
          <label>租金（元）<input id="history-rental-fee" type="number" min="0" step="1" value="${escapeAttribute(rental?.rentalFee ?? 0)}"></label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '儲存',
      cancelButtonText: '取消',
      confirmButtonColor: '#08775d',
      customClass: { popup: 'fleet-history-form-dialog' },
      preConfirm: () => {
        const fullName = formValue('history-customer-name');
        const memberNo = formValue('history-member-no').toUpperCase();
        const phone = formValue('history-phone');
        const startedAt = formDateTime(formValue('history-started-at'));
        const endedValue = formValue('history-ended-at');
        const endedAt = endedValue ? formDateTime(endedValue) : null;
        const rentalFee = Number(formValue('history-rental-fee'));
        if (!fullName || !memberNo || !/^09\d{8}$/.test(phone) || !startedAt || !Number.isInteger(rentalFee) || rentalFee < 0) {
          globalObject.Swal.showValidationMessage('請完整填寫租客、日期與正確費用');
          return false;
        }
        if (endedValue && (!endedAt || endedAt < startedAt)) {
          globalObject.Swal.showValidationMessage('還車時間不可早於租借時間');
          return false;
        }
        return {
          customer: { fullName, memberNo, phone },
          startedAt,
          endedAt,
          status: formValue('history-rental-status'),
          rentalFee
        };
      }
    });
    if (!result.isConfirmed) return false;
    if (rental) {
      await globalObject.IRentVehicleApi.updateRentalHistory(vehicle.id, rental.id, result.value);
    } else {
      await globalObject.IRentVehicleApi.createRentalHistory(vehicle.id, result.value);
    }
    state.context.notify(`${vehicle.licensePlate} 租借歷程已儲存`);
    return true;
  }

  async function showServiceHistoryForm(vehicle, service = null, defaultType = 'cleaning') {
    const selectedType = service?.type || defaultType;
    const result = await globalObject.Swal.fire({
      title: service ? '修改紀錄' : '新增保養紀錄',
      html: `
        <div class="fleet-history-form">
          <label>紀錄類型
            <select id="history-service-type">
              <option value="cleaning" ${selectedType === 'cleaning' ? 'selected' : ''}>清潔</option>
              <option value="maintenance" ${selectedType === 'maintenance' ? 'selected' : ''}>維修</option>
            </select>
          </label>
          <label>處理時間<input id="history-performed-at" type="datetime-local" value="${escapeAttribute(dateTimeInputValue(service?.performedAt || new Date()))}"></label>
          <label>費用（元）<input id="history-service-cost" type="number" min="0" step="1" value="${escapeAttribute(service?.cost ?? 0)}"></label>
          <label class="fleet-history-form-wide">備註<textarea id="history-service-note" rows="3">${escapeText(service?.note || '')}</textarea></label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '儲存',
      cancelButtonText: '取消',
      confirmButtonColor: '#08775d',
      customClass: { popup: 'fleet-history-form-dialog' },
      preConfirm: () => {
        const performedAt = formDateTime(formValue('history-performed-at'));
        const cost = Number(formValue('history-service-cost'));
        if (!performedAt || !Number.isInteger(cost) || cost < 0) {
          globalObject.Swal.showValidationMessage('請填寫正確的處理時間與費用');
          return false;
        }
        return {
          type: formValue('history-service-type'),
          performedAt,
          cost,
          note: formValue('history-service-note')
        };
      }
    });
    if (!result.isConfirmed) return false;
    if (service) {
      await globalObject.IRentVehicleApi.updateServiceHistory(vehicle.id, service.id, result.value);
    } else {
      await globalObject.IRentVehicleApi.createServiceHistory(vehicle.id, result.value);
    }
    state.context.notify(`${vehicle.licensePlate} 保養歷程已儲存`);
    return true;
  }

  async function addVehicleHistory(vehicle) {
    const result = await globalObject.Swal.fire({
      title: '新增歷程',
      input: 'select',
      inputOptions: {
        rental: '租借紀錄',
        cleaning: '清潔紀錄',
        maintenance: '維修紀錄'
      },
      inputPlaceholder: '請選擇紀錄類型',
      showCancelButton: true,
      confirmButtonText: '下一步',
      cancelButtonText: '取消',
      confirmButtonColor: '#08775d',
      inputValidator: value => value ? undefined : '請選擇紀錄類型'
    });
    if (!result.isConfirmed) return false;
    if (result.value === 'rental') return showRentalHistoryForm(vehicle);
    return showServiceHistoryForm(vehicle, null, result.value);
  }

  async function showVehicleHistory(vehicle) {
    if (!globalObject.Swal?.fire) {
      state.context.notify('歷程視窗元件載入失敗');
      return;
    }
    const history = await globalObject.IRentVehicleApi.getHistory(vehicle.id);
    let editTarget = null;
    const result = await globalObject.Swal.fire({
      title: `${escapeText(vehicle.licensePlate)} 車輛歷程`,
      html: vehicleHistoryHtml(history),
      showCancelButton: true,
      confirmButtonText: '新增歷程',
      cancelButtonText: '關閉',
      confirmButtonColor: '#08775d',
      width: 'min(880px, calc(100vw - 24px))',
      customClass: { popup: 'fleet-history-dialog' },
      didOpen: popup => {
        popup.addEventListener('click', event => {
          const button = event.target.closest('[data-history-edit]');
          if (!button) return;
          editTarget = {
            kind: button.dataset.historyEdit,
            id: Number(button.dataset.recordId)
          };
          globalObject.Swal.close();
        });
      }
    });

    if (editTarget) {
      const record = editTarget.kind === 'rental'
        ? history.rentals.find(item => item.id === editTarget.id)
        : history.services.find(item => item.id === editTarget.id);
      if (!record) return;
      const saved = editTarget.kind === 'rental'
        ? await showRentalHistoryForm(vehicle, record)
        : await showServiceHistoryForm(vehicle, record);
      if (saved) await showVehicleHistory(vehicle);
      return;
    }
    if (result.isConfirmed && await addVehicleHistory(vehicle)) {
      await showVehicleHistory(vehicle);
    }
  }

  function selectedMapFeatures() {
    const region = document.querySelector('[data-fleet-region]');
    const selectedCity = region?.value;
    if (!selectedCity) return state.mapData.features;
    const vehicleIds = new Set(state.vehicles
      .filter(vehicle => vehicle.station?.city === selectedCity)
      .map(vehicle => vehicle.id));
    return state.mapData.features.filter(feature => vehicleIds.has(feature.properties.id));
  }

  function setMapMessage(message = '') {
    const element = document.querySelector('[data-fleet-map-message]');
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
  }

  function fitMapToFeatures(features) {
    if (!state.map || !features.length) return;
    if (features.length === 1) {
      state.map.easeTo({ center: features[0].geometry.coordinates, zoom: 13 });
      return;
    }
    const bounds = new globalObject.maplibregl.LngLatBounds();
    features.forEach(feature => bounds.extend(feature.geometry.coordinates));
    state.map.fitBounds(bounds, { padding: 42, maxZoom: 13, duration: 500 });
  }

  function updateMap() {
    const features = selectedMapFeatures();
    const selectedCity = document.querySelector('[data-fleet-region]')?.value;
    document.querySelector('[data-fleet-map]')
      ?.setAttribute('aria-label', `${selectedCity || '全台'}車隊即時位置地圖`);
    setMapMessage(features.length ? '' : '目前沒有可顯示的車輛座標');
    if (!state.mapLoaded) return;
    state.map.getSource('fleet-vehicles')?.setData({
      type: 'FeatureCollection',
      features
    });
    fitMapToFeatures(features);
  }

  function initMap() {
    const container = document.querySelector('[data-fleet-map]');
    if (!container) return;
    if (!globalObject.maplibregl) {
      setMapMessage('地圖元件載入失敗');
      return;
    }

    state.map = new globalObject.maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: [120.95, 23.7],
      zoom: 5.8
    });
    state.map.addControl(new globalObject.maplibregl.NavigationControl(), 'top-right');
    state.map.on('load', () => {
      state.map.addSource('fleet-vehicles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      state.map.addLayer({
        id: 'fleet-vehicles',
        type: 'circle',
        source: 'fleet-vehicles',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'issueCount'],
            0, 7,
            5, 15
          ],
          'circle-color': [
            'step', ['get', 'healthScore'],
            '#dc3545',
            70, '#f2a93b',
            85, '#20a66a'
          ],
          'circle-opacity': .9,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });
      state.mapLoaded = true;
      updateMap();
    });
    state.map.on('click', 'fleet-vehicles', event => {
      const feature = event.features?.[0];
      if (!feature) return;
      const properties = feature.properties;
      const status = statusMeta[properties.status] || { label: properties.status };
      new globalObject.maplibregl.Popup({ offset: 12 })
        .setLngLat(feature.geometry.coordinates)
        .setHTML(`
          <div class="fleet-map-popup">
            <strong>${escapeText(properties.plateNumber)}</strong>
            <span>健康分數：${escapeText(properties.healthScore)}</span>
            <span>異常數量：${escapeText(properties.issueCount)}</span>
            <span>車輛狀態：${escapeText(status.label)}</span>
            <span>最後更新：${escapeText(new Date(properties.updatedAt).toLocaleString('zh-TW'))}</span>
          </div>
        `)
        .addTo(state.map);
    });
    state.map.on('mouseenter', 'fleet-vehicles', () => {
      state.map.getCanvas().style.cursor = 'pointer';
    });
    state.map.on('mouseleave', 'fleet-vehicles', () => {
      state.map.getCanvas().style.cursor = '';
    });
  }

  function renderRegionOptions() {
    const select = document.querySelector('[data-fleet-region]');
    if (!select) return;
    const cities = [...new Set(state.vehicles.map(vehicle => vehicle.station?.city).filter(Boolean))];
    select.innerHTML = '<option value="">全台</option>' + cities.map(city =>
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
    const [vehicles, stations, mapData] = await Promise.all([
      globalObject.IRentVehicleApi.list(),
      globalObject.IRentStationApi.list(),
      globalObject.IRentVehicleApi.mapSummary()
    ]);
    state.vehicles = vehicles;
    state.stations = stations;
    state.mapData = mapData;
    renderRows();
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
    const cabinInput = window.prompt('請輸入車內狀況：乾淨或普通', '乾淨');
    if (!cabinInput) return;
    const cabinCondition = Object.entries(cabinConditionMeta).find(([key, meta]) =>
      key === text(cabinInput).toLowerCase() || meta.label === text(cabinInput)
    )?.[0];
    if (!['clean', 'average'].includes(cabinCondition)) {
      throw new Error('可租用車輛的車內狀況只能是乾淨或普通');
    }

    await globalObject.IRentVehicleApi.create({
      licensePlate: text(licensePlate).toUpperCase(),
      model: text(model),
      color: text(color),
      stationId: station.id,
      cabinCondition
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
      車內狀況: 'cabinCondition',
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
      const status = record.status || 'available';
      const defaultCabinCondition = status === 'cleaning' ? 'dirty' : 'clean';
      const cabinCondition = record.cabinCondition
        ? Object.entries(cabinConditionMeta).find(([key, meta]) =>
          key === text(record.cabinCondition).toLowerCase() || meta.label === text(record.cabinCondition)
        )?.[0]
        : defaultCabinCondition;
      if (!cabinCondition) throw new Error(`${record.licensePlate || '未知車牌'} 的車內狀況不正確`);
      return {
        licensePlate: text(record.licensePlate).toUpperCase(),
        model: text(record.model),
        color: text(record.color),
        stationId: station.id,
        status,
        cabinCondition,
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
    initMap();
    context.setApplyFilter(resetPageAndRenderRows);
    document.querySelector('[data-fleet-search]')?.addEventListener('input', resetPageAndRenderRows);
    document.querySelector('[data-fleet-status]')?.addEventListener('change', resetPageAndRenderRows);
    document.querySelector('[data-fleet-region]')?.addEventListener('change', updateMap);
    document.querySelector('[data-fleet-page-previous]')?.addEventListener('click', () => {
      if (state.page === 1) return;
      state.page -= 1;
      renderRows();
    });
    document.querySelector('[data-fleet-page-next]')?.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(filteredVehicles().length / state.pageSize));
      if (state.page === totalPages) return;
      state.page += 1;
      renderRows();
    });
    document.querySelector('[data-action="add-vehicle"]')?.addEventListener('click', async () => {
      try {
        await addVehicle();
      } catch (error) {
        context.notify(error.message);
      }
    });
    document.querySelector('[data-action="import-vehicles"]')?.addEventListener('click', chooseCsv);
    document.querySelector('[data-fleet-body]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const vehicle = state.vehicles.find(item =>
        item.id === Number(button.closest('[data-vehicle-id]')?.dataset.vehicleId)
      );
      if (!vehicle) return;
      const action = button.dataset.action === 'view-history'
        ? showVehicleHistory(vehicle)
        : showVehicleDetails(vehicle);
      action.catch(error => context.notify(error.message));
    });

    try {
      await refresh();
    } catch (error) {
      setMapMessage('車隊地圖資料載入失敗');
      const body = document.querySelector('[data-fleet-body]');
      if (body) body.innerHTML = `<tr><td colspan="8" class="fleet-empty">${escapeText(error.message)}</td></tr>`;
    }
  }

  globalObject.IRentFleet = { init, getOverallStatus };
})(window);
