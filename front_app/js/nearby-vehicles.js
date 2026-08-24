const mapElement = document.querySelector('[data-nearby-map]');
const mapPanel = document.querySelector('.map-panel');
const fallbackElement = document.querySelector('[data-map-fallback]');
const searchInput = document.querySelector('[data-vehicle-search]');
const listElement = document.querySelector('[data-vehicle-list]');
const countElement = document.querySelector('[data-vehicle-count]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const functionMenu = document.querySelector('[data-function-menu]');
const menuBackdrop = document.querySelector('.menu-backdrop');
const menuCloseButtons = document.querySelectorAll('[data-menu-close]');
const menuActionButtons = document.querySelectorAll('[data-menu-action]');
const nearbyViews = document.querySelectorAll('[data-nearby-view]');
const viewPanels = document.querySelectorAll('[data-view-panel]');
const navigationButtons = document.querySelectorAll('[data-nav-view]');
const scanButton = document.querySelector('[data-scan-start]');
const scanCount = document.querySelector('[data-scan-count]');
const scanInstruction = document.querySelector('[data-scan-instruction]');
const scanAngles = document.querySelectorAll('[data-scan-list] > div');
const feedbackSubmit = document.querySelector('[data-feedback-submit]');
const assistantResponse = document.querySelector('[data-assistant-response]');
const assistantPrompts = document.querySelectorAll('[data-assistant-prompt]');

let allVehicles = createDefaultVehicles();
let selectedVehicleId = allVehicles.features[0].properties.id;
let map;
let scanProgress = 0;

function createDefaultVehicles() {
  return {
    type: 'FeatureCollection',
    features: [
      vehicleFeature('yaris', 'ABC-1234', 'Toyota Yaris', 121.5324, 25.0451, 92, 1, 'available', '2026-08-24T09:39:00+08:00', 2, 3.2),
      vehicleFeature('corolla', 'EFG-5618', 'Toyota Corolla Cross', 121.5299, 25.0433, 86, 2, 'available', '2026-08-24T09:37:00+08:00', 4, 3.0),
      vehicleFeature('rav4', 'KJP-9081', 'Toyota RAV4', 121.5346, 25.0417, 78, 3, 'available', '2026-08-24T09:35:00+08:00', 6, 3.5),
    ],
  };
}

function vehicleFeature(id, plateNumber, displayName, longitude, latitude, healthScore, issueCount, status, updatedAt, walkMinutes, rate) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
    properties: { id, plateNumber, displayName, longitude, latitude, healthScore, issueCount, status, updatedAt, walkMinutes, rate },
  };
}

function getProperties(feature) {
  return feature.properties || {};
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function vehicleTone(healthScore) {
  if (healthScore >= 88) return 'is-teal';
  if (healthScore >= 80) return 'is-blue';
  return 'is-slate';
}

function carIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 11 2-5h10l2 5M4 11h16v7H4zM7 18v2M17 18v2M7 14h.01M17 14h.01"/></svg>';
}

function filteredVehicles() {
  const keyword = searchInput.value.trim().toLowerCase();
  if (!keyword) return allVehicles.features;
  return allVehicles.features.filter((feature) => {
    const properties = getProperties(feature);
    return `${properties.displayName} ${properties.plateNumber} ${properties.status}`.toLowerCase().includes(keyword);
  });
}

function renderVehicleList() {
  const features = filteredVehicles();
  countElement.textContent = features.length ? `距離你最近的 ${features.length} 台` : '找不到符合的車輛';
  listElement.replaceChildren();

  if (!features.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-list';
    empty.textContent = '找不到車輛，請換個關鍵字搜尋。';
    listElement.append(empty);
    return;
  }

  features.forEach((feature) => {
    const properties = getProperties(feature);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `nearby-row${properties.id === selectedVehicleId ? ' is-selected' : ''}`;
    row.dataset.vehicleId = properties.id;
    row.innerHTML = `
      <span class="row-car ${vehicleTone(Number(properties.healthScore))}">${carIcon()}</span>
      <span class="row-name"><strong>${escapeHtml(properties.displayName)}</strong><small>${escapeHtml(properties.plateNumber)}・步行 ${escapeHtml(properties.walkMinutes)} 分鐘</small></span>
      <span class="row-rate"><strong>$${escapeHtml(properties.rate)} / 分</strong><small>立即取車</small></span>
    `;
    row.addEventListener('click', () => {
      selectVehicle(properties.id, true);
      setActiveView('vehicle');
    });
    listElement.append(row);
  });
}

function selectVehicle(vehicleId, flyTo) {
  const feature = allVehicles.features.find((item) => getProperties(item).id === vehicleId);
  if (!feature) return;

  selectedVehicleId = vehicleId;
  renderVehicleList();

  if (!map) return;
  const coordinates = feature.geometry.coordinates;
  if (flyTo) map.flyTo({ center: coordinates, zoom: 15.8, essential: true, duration: 500 });
  showVehiclePopup(feature);
}

function showVehiclePopup(feature) {
  const properties = getProperties(feature);
  document.querySelectorAll('.maplibregl-popup').forEach((popup) => popup.remove());
  new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: 16 })
    .setLngLat(feature.geometry.coordinates)
    .setHTML(`<strong>${escapeHtml(properties.displayName)}</strong><span>${escapeHtml(properties.plateNumber)}・健康 ${escapeHtml(properties.healthScore)} 分</span>`)
    .addTo(map);
}

function updateMapSource() {
  if (!map || !map.getSource('vehicles')) return;
  map.getSource('vehicles').setData(allVehicles);
}

function createMapBackdrop() {
  return {
    roads: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[121.519, 25.039], [121.544, 25.046], [121.5435, 25.0472], [121.5185, 25.0402], [121.519, 25.039]]] }, properties: {} },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[121.521, 25.047], [121.543, 25.038], [121.544, 25.0394], [121.522, 25.0484], [121.521, 25.047]]] }, properties: {} },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[121.5285, 25.036], [121.531, 25.051], [121.5324, 25.0508], [121.5299, 25.0358], [121.5285, 25.036]]] }, properties: {} },
      ],
    },
    blocks: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[121.521, 25.045], [121.525, 25.045], [121.525, 25.048], [121.521, 25.048], [121.521, 25.045]]] }, properties: {} },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[121.535, 25.044], [121.539, 25.044], [121.539, 25.048], [121.535, 25.048], [121.535, 25.044]]] }, properties: {} },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[121.522, 25.037], [121.526, 25.037], [121.526, 25.040], [121.522, 25.040], [121.522, 25.037]]] }, properties: {} },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[121.537, 25.036], [121.542, 25.036], [121.542, 25.040], [121.537, 25.040], [121.537, 25.036]]] }, properties: {} },
      ],
    },
  };
}

async function fetchVehicleMapSummary() {
  try {
    const response = await fetch('/api/v1/vehicles/map-summary');
    if (!response.ok) return;
    const collection = await response.json();
    if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features) || !collection.features.length) return;

    allVehicles = {
      type: 'FeatureCollection',
      features: collection.features.map((feature, index) => {
        const properties = feature.properties || feature;
        return vehicleFeature(
          properties.id || `vehicle-${index}`,
          properties.plateNumber || '未提供車牌',
          properties.displayName || properties.vehicleName || `iRent 車輛 ${index + 1}`,
          Number(properties.longitude ?? feature.geometry?.coordinates?.[0]),
          Number(properties.latitude ?? feature.geometry?.coordinates?.[1]),
          Number(properties.healthScore ?? 80),
          Number(properties.issueCount ?? 0),
          properties.status || 'available',
          properties.updatedAt || '',
          Number(properties.walkMinutes ?? index * 2 + 2),
          Number(properties.rate ?? 3.2),
        );
      }).filter((feature) => Number.isFinite(feature.geometry.coordinates[0]) && Number.isFinite(feature.geometry.coordinates[1])),
    };

    if (!allVehicles.features.some((feature) => getProperties(feature).id === selectedVehicleId)) {
      selectedVehicleId = allVehicles.features[0]?.properties.id;
    }

    updateMapSource();
    renderVehicleList();
  } catch {
    // 後端尚未啟動或 API 尚未實作時，維持畫面預覽的 GeoJSON 資料。
  }
}

function initMap() {
  if (!window.maplibregl || !mapElement) return;

  map = new maplibregl.Map({
    container: mapElement,
    style: { version: 8, sources: {}, layers: [{ id: 'map-background', type: 'background', paint: { 'background-color': '#e8f5f3' } }] },
    center: [121.532, 25.044],
    zoom: 14.9,
    attributionControl: false,
  });

  map.on('load', () => {
    mapPanel.classList.add('is-map-ready');
    fallbackElement.setAttribute('aria-hidden', 'true');

    const backdrop = createMapBackdrop();
    map.addSource('roads', { type: 'geojson', data: backdrop.roads });
    map.addSource('blocks', { type: 'geojson', data: backdrop.blocks });
    map.addLayer({ id: 'city-blocks', type: 'fill', source: 'blocks', paint: { 'fill-color': '#cde4df', 'fill-outline-color': '#e8f5f3' } });
    map.addLayer({ id: 'road-fill', type: 'fill', source: 'roads', paint: { 'fill-color': '#ffffff', 'fill-outline-color': '#d6e7e3' } });

    map.addSource('vehicles', { type: 'geojson', data: allVehicles });
    map.addSource('current-location', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [121.5311, 25.0442] }, properties: {} }] },
    });

    map.addLayer({
      id: 'vehicle-shadow',
      type: 'circle',
      source: 'vehicles',
      paint: { 'circle-radius': 20, 'circle-color': '#00a79b', 'circle-opacity': 0.16 },
    });
    map.addLayer({
      id: 'vehicle-circle',
      type: 'circle',
      source: 'vehicles',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'issueCount'], 0, 11, 3, 15, 6, 19],
        'circle-color': ['case', ['>=', ['get', 'healthScore'], 88], '#00a79b', ['>=', ['get', 'healthScore'], 80], '#62b2cf', '#71868a'],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });
    map.addLayer({ id: 'current-location', type: 'circle', source: 'current-location', paint: { 'circle-radius': 9, 'circle-color': '#4f9ec1', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });

    map.on('click', 'vehicle-circle', (event) => {
      const feature = event.features?.[0];
      if (feature) selectVehicle(feature.properties.id, false);
    });
    map.on('mouseenter', 'vehicle-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'vehicle-circle', () => { map.getCanvas().style.cursor = ''; });
  });

  map.on('error', () => {
    // 若底圖載入失敗，保留 CSS 地圖示意，確保預覽頁仍可使用。
  });
}

function setMenuOpen(isOpen) {
  functionMenu.classList.toggle('is-open', isOpen);
  menuBackdrop.classList.toggle('is-open', isOpen);
  functionMenu.setAttribute('aria-hidden', String(!isOpen));
  menuToggle.setAttribute('aria-expanded', String(isOpen));
}

function setActiveView(viewName) {
  nearbyViews.forEach((element) => element.classList.toggle('is-hidden', viewName !== 'nearby'));
  viewPanels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === viewName));
  menuActionButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.view === viewName));
  navigationButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.navView === viewName));
  if (viewName === 'nearby' && map) window.setTimeout(() => map.resize(), 0);
}

function updateScanProgress() {
  scanCount.textContent = `${scanProgress} / 8`;
  scanAngles.forEach((angle, index) => {
    angle.classList.toggle('is-done', index < scanProgress);
    angle.classList.toggle('is-current', index === scanProgress && scanProgress < scanAngles.length);
    angle.querySelector('small').textContent = index < scanProgress ? '已取得' : index === scanProgress && scanProgress < scanAngles.length ? '正在掃描' : '等待掃描';
  });
  if (scanProgress >= scanAngles.length) {
    scanInstruction.textContent = '已完成 8 個車外角度掃描，AI 正在比對既有車況紀錄。';
    scanButton.textContent = '掃描完成';
    scanButton.disabled = true;
  }
}

function updateAssistantResponse(prompt) {
  const responses = {
    '這台車可以借嗎？': 'Toyota Yaris 的健康分數為 92 分，外觀正常、車內乾淨，目前可以安心取車。',
    '掃描要怎麼做？': '請距離車輛約 2～3 公尺，按下開始掃描後繞車一圈；系統會依 8 個角度自動取圖。',
    '最近還車點在哪？': '最近可還車點是市民大道停車場，距離約 0.7 公里，預計 6 分鐘可以抵達。',
  };
  assistantResponse.textContent = responses[prompt];
}

searchInput.addEventListener('input', renderVehicleList);
menuToggle.addEventListener('click', () => setMenuOpen(true));
menuCloseButtons.forEach((button) => button.addEventListener('click', () => setMenuOpen(false)));
menuActionButtons.forEach((button) => button.addEventListener('click', () => {
  setActiveView(button.dataset.view);
  setMenuOpen(false);
}));
navigationButtons.forEach((button) => button.addEventListener('click', () => setActiveView(button.dataset.navView)));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenuOpen(false); });
scanButton.addEventListener('click', () => { scanProgress = Math.min(scanProgress + 1, scanAngles.length); updateScanProgress(); });
feedbackSubmit.addEventListener('click', () => setActiveView('nearby'));
assistantPrompts.forEach((button) => button.addEventListener('click', () => updateAssistantResponse(button.dataset.assistantPrompt)));
setActiveView('nearby');
updateScanProgress();
renderVehicleList();
initMap();
fetchVehicleMapSummary();
