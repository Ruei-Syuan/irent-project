(function dashboardModule(globalObject) {
  "use strict";

  let trendChart = null;
  let regionMap = null;
  let rentalCityChart = null;
  let dashboardResizeBound = false;

  const FLEET_METRIC_FIELDS = {
    total: "totalVehicles",
    available: "availableVehicles",
    rented: "rentedVehicles",
    cleaning: "cleaningVehicles",
    maintenance: "maintenanceVehicles",
  };

  function parseDashboardDate(value) {
    const [year, month, day] = String(value ?? "")
      .split("-")
      .map(Number);
    if (![year, month, day].every(Number.isFinite)) return null;
    return new Date(year, month - 1, day);
  }

  function formatWeekRangeDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function updateDashboardWeekRange(items) {
    const elements = [
      ...document.querySelectorAll("[data-dashboard-week-range]"),
    ];
    if (!elements.length || !items?.length) return;

    const start = parseDashboardDate(items[0].date);
    const end = parseDashboardDate(items[items.length - 1].date);
    if (!start || !end) return;

    end.setDate(end.getDate() + 1);
    const rangeText = `${formatWeekRangeDate(start)} 00:00 ~ ${formatWeekRangeDate(end)} 00:00`;
    elements.forEach((element) => {
      element.textContent = rangeText;
    });
    document
      .querySelector("[data-region-overview-chart]")
      ?.setAttribute(
        "aria-label",
        `台灣縣市一周（${rangeText}）租借數量氣泡地圖`,
      );
    document
      .querySelector("[data-fleet-trend-chart]")
      ?.setAttribute("aria-label", `一周（${rangeText}）租用趨勢圖`);
  }

  function renderFleetSummary(summary) {
    for (const [status, field] of Object.entries(FLEET_METRIC_FIELDS)) {
      const element = document.querySelector(
        `[data-fleet-metric="${status}"] strong`,
      );
      if (element) element.textContent = String(Number(summary[field]) || 0);
    }
  }

  async function loadFleetSummary() {
    if (
      !document.querySelector(".dashboard-metrics") ||
      !globalObject.IRentDashboardApi
    )
      return;

    try {
      renderFleetSummary(await globalObject.IRentDashboardApi.fleetSummary());
    } catch (error) {
      console.error("[iRent dashboard fleet summary]", error);
    }
  }

  function normalizeCountyName(value) {
    return String(value ?? "")
      .trim()
      .replace(/^台/, "臺");
  }

  function ringCenter(ring) {
    let crossTotal = 0;
    let longitudeTotal = 0;
    let latitudeTotal = 0;

    for (let index = 0; index < ring.length - 1; index += 1) {
      const [longitude, latitude] = ring[index];
      const [nextLongitude, nextLatitude] = ring[index + 1];
      const cross = longitude * nextLatitude - nextLongitude * latitude;
      crossTotal += cross;
      longitudeTotal += (longitude + nextLongitude) * cross;
      latitudeTotal += (latitude + nextLatitude) * cross;
    }

    if (Math.abs(crossTotal) < Number.EPSILON) {
      const points = ring.slice(0, -1);
      if (!points.length) return null;
      return {
        area: 0,
        coordinates: [
          points.reduce((sum, point) => sum + point[0], 0) / points.length,
          points.reduce((sum, point) => sum + point[1], 0) / points.length,
        ],
      };
    }

    return {
      area: Math.abs(crossTotal / 2),
      coordinates: [
        longitudeTotal / (3 * crossTotal),
        latitudeTotal / (3 * crossTotal),
      ],
    };
  }

  function geometryCenter(geometry) {
    const polygons =
      geometry?.type === "Polygon"
        ? [geometry.coordinates]
        : geometry?.type === "MultiPolygon"
          ? geometry.coordinates
          : [];
    return (
      polygons
        .map((polygon) => ringCenter(polygon[0] || []))
        .filter(Boolean)
        .sort((left, right) => right.area - left.area)[0]?.coordinates || null
    );
  }

  function createRentalBubbleCollection(counties, rentalItems) {
    const rentalsByCounty = new Map(
      rentalItems.map((item) => [
        normalizeCountyName(item.city),
        Number(item.rentalCount) || 0,
      ]),
    );
    const features = counties.features.flatMap((county) => {
      const countyName = county.properties?.COUNTYNAME;
      const rentalCount =
        rentalsByCounty.get(normalizeCountyName(countyName)) || 0;
      const coordinates = geometryCenter(county.geometry);
      if (!rentalCount || !coordinates) return [];
      return [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates },
          properties: { county: countyName, rentalCount },
        },
      ];
    });

    return { type: "FeatureCollection", features };
  }

  function createRegionMapStyle(counties, rentalBubbles) {
    return {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        "taiwan-counties": {
          type: "geojson",
          data: counties,
        },
        "dashboard-rentals": {
          type: "geojson",
          data: rentalBubbles,
        },
      },
      layers: [
        {
          id: "dashboard-map-background",
          type: "background",
          paint: { "background-color": "#EAF5F7" },
        },
        {
          id: "taiwan-counties-fill",
          type: "fill",
          source: "taiwan-counties",
          paint: { "fill-color": "#D9EBCC" },
        },
        {
          id: "taiwan-counties-line",
          type: "line",
          source: "taiwan-counties",
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 1.4,
          },
        },
        {
          id: "dashboard-rental-bubbles",
          type: "circle",
          source: "dashboard-rentals",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "rentalCount"],
              0,
              10,
              20,
              18,
              100,
              30,
              500,
              44,
            ],
            "circle-color": "#3B82F6",
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": 2,
          },
        },
        {
          id: "dashboard-rental-counts",
          type: "symbol",
          source: "dashboard-rentals",
          layout: {
            "text-field": ["to-string", ["get", "rentalCount"]],
            "text-font": ["Open Sans Bold"],
            "text-size": 11,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": "#FFFFFF" },
        },
      ],
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setRegionMapMessage(message, isError = false) {
    const element = document.querySelector("[data-region-map-message]");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", isError);
    element.hidden = !message;
  }

  function rentalPopupHtml(properties) {
    return `
      <div class="dashboard-map-popup">
        <strong>${escapeHtml(properties.county)}</strong>
          <span>一周總租借數量：${escapeHtml(properties.rentalCount)} 筆</span>
      </div>
    `;
  }

  async function renderRegionOverview() {
    const element = document.querySelector("[data-region-overview-chart]");
    if (!element) return;

    if (!globalObject.maplibregl || !globalObject.IRentDashboardApi) {
      setRegionMapMessage("地圖元件或資料模組載入失敗", true);
      return;
    }

    setRegionMapMessage("載入縣市租借氣泡資料中…");
    try {
      const [countyResponse, rentalItems] = await Promise.all([
        globalObject.fetch("data/taiwan-counties.geojson"),
        globalObject.IRentDashboardApi.rentalCountByCity(),
      ]);
      if (!countyResponse.ok) throw new Error("無法載入台灣縣市邊界");
      const counties = await countyResponse.json();
      const rentalBubbles = createRentalBubbleCollection(counties, rentalItems);

      regionMap?.remove();
      regionMap = new globalObject.maplibregl.Map({
        container: element,
        style: createRegionMapStyle(counties, rentalBubbles),
        center: [120.25, 24.05],
        zoom: 5.1,
        minZoom: 4.5,
        maxZoom: 12,
        dragRotate: false,
        touchPitch: false,
        attributionControl: false,
      });
      regionMap.addControl(
        new globalObject.maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      regionMap.on("load", () => {
        regionMap.fitBounds(
          [
            [118.05, 21.75],
            [122.15, 26.45],
          ],
          { padding: 24, duration: 0 },
        );
        setRegionMapMessage("");
      });
      regionMap.on("click", "dashboard-rental-bubbles", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        new globalObject.maplibregl.Popup({ offset: 12 })
          .setLngLat(feature.geometry.coordinates)
          .setHTML(rentalPopupHtml(feature.properties))
          .addTo(regionMap);
      });
      regionMap.on("mouseenter", "dashboard-rental-bubbles", () => {
        regionMap.getCanvas().style.cursor = "pointer";
      });
      regionMap.on("mouseleave", "dashboard-rental-bubbles", () => {
        regionMap.getCanvas().style.cursor = "";
      });
    } catch (error) {
      console.error("[iRent dashboard map]", error);
      setRegionMapMessage(error.message || "無法載入區域車輛資料", true);
    }
  }

  function createRentalCityPieOption(items) {
    return {
      color: ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"],
      tooltip: {
        trigger: "item",
        formatter: "{b}<br>租借數量：{c} 筆（{d}%）",
      },
      legend: {
        type: "scroll",
        bottom: 8,
        left: "center",
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#475569", fontSize: 10, fontWeight: 600 },
      },
      series: [
        {
          name: "租借數量",
          type: "pie",
          radius: ["40%", "66%"],
          center: ["50%", "43%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: "#fff",
            borderWidth: 3,
            borderRadius: 5,
          },
          label: {
            color: "#475569",
            fontSize: 10,
            fontWeight: 600,
            formatter: "{b}\n{c} 筆",
          },
          labelLine: {
            length: 8,
            length2: 6,
            lineStyle: { color: "#475569" },
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
          },
          data: items.map((item) => ({
            name: item.city,
            value: item.rentalCount,
          })),
        },
      ],
    };
  }

  function setRentalCityMessage(message, isError = false) {
    const element = document.querySelector("[data-rental-city-message]");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", isError);
    element.hidden = !message;
  }

  function renderRentalCityPie(items) {
    const element = document.querySelector("[data-rental-city-chart]");
    if (!element || !globalObject.echarts) {
      setRentalCityMessage("圖表套件載入失敗", true);
      return;
    }

    if (!items.length) {
      rentalCityChart?.dispose();
      rentalCityChart = null;
      setRentalCityMessage("一周無租借資料");
      return;
    }

    rentalCityChart?.dispose();
    rentalCityChart = globalObject.echarts.init(element, null, {
      renderer: "canvas",
    });
    rentalCityChart.setOption(createRentalCityPieOption(items));
    setRentalCityMessage("");
  }

  function setChartMessage(message, isError = false) {
    const element = document.querySelector("[data-fleet-trend-message]");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", isError);
    element.hidden = !message;
  }

  function formatDate(date) {
    return date.slice(5).replace("-", "/");
  }

  function createFleetTrendOption(items) {
    return {
      color: ["#10B981", "#3B82F6"],
      animationDuration: 600,
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => `${value} 輛`,
      },
      grid: { left: 48, right: 22, top: 28, bottom: 36 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: items.map((item) => formatDate(item.date)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        axisLabel: { color: "#475569", fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: "#475569", fontSize: 11 },
        splitLine: { lineStyle: { color: "#E2E8F0" } },
      },
      series: [
        {
          name: "總車輛",
          type: "line",
          data: items.map((item) => item.totalVehicles),
          smooth: true,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { color: "#10B981", width: 3 },
          itemStyle: { color: "#10B981" },
          label: {
            show: true,
            color: "#475569",
            fontSize: 10,
            fontWeight: 600,
            position: "top",
          },
        },
        {
          name: "當日租用車輛",
          type: "line",
          data: items.map((item) => item.rentedVehicles),
          smooth: true,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { color: "#3B82F6", width: 3 },
          itemStyle: { color: "#3B82F6" },
          label: {
            show: true,
            color: "#475569",
            fontSize: 10,
            fontWeight: 600,
            position: "top",
          },
        },
      ],
    };
  }

  function renderTrend(items) {
    const element = document.querySelector("[data-fleet-trend-chart]");
    if (!element || !globalObject.echarts) {
      setChartMessage("圖表套件載入失敗", true);
      return;
    }

    trendChart?.dispose();
    trendChart = globalObject.echarts.init(element, null, {
      renderer: "canvas",
    });
    trendChart.setOption(createFleetTrendOption(items));
    setChartMessage("");
  }

  async function loadTrend() {
    if (!document.querySelector("[data-fleet-trend-chart]")) return;
    if (!globalObject.IRentDashboardApi) {
      setChartMessage("缺少趨勢資料模組", true);
      return;
    }

    setChartMessage("載入趨勢資料中…");
    try {
      const items = await globalObject.IRentDashboardApi.fleetTrend();
      if (items.length !== 7) throw new Error("趨勢資料天數不正確");
      updateDashboardWeekRange(items);
      renderTrend(items);
    } catch (error) {
      console.error("[iRent dashboard]", error);
      setChartMessage(error.message || "無法載入趨勢資料", true);
    }
  }

  async function loadRentalCityPie() {
    if (!document.querySelector("[data-rental-city-chart]")) return;
    if (!globalObject.IRentDashboardApi) {
      setRentalCityMessage("缺少租借統計資料模組", true);
      return;
    }

    setRentalCityMessage("載入縣市租借資料中…");
    try {
      const items = await globalObject.IRentDashboardApi.rentalCountByCity();
      renderRentalCityPie(items);
    } catch (error) {
      console.error("[iRent dashboard rental city]", error);
      setRentalCityMessage(error.message || "無法載入縣市租借資料", true);
    }
  }

  function bindDashboardResize() {
    if (dashboardResizeBound) return;
    globalObject.addEventListener("resize", () => {
      trendChart?.resize();
      regionMap?.resize();
      rentalCityChart?.resize();
    });
    dashboardResizeBound = true;
  }

  async function init() {
    bindDashboardResize();
    await Promise.all([
      loadFleetSummary(),
      renderRegionOverview(),
      loadTrend(),
      loadRentalCityPie(),
    ]);
  }

  globalObject.IRentDashboard = {
    createRentalBubbleCollection,
    createRegionMapStyle,
    createFleetTrendOption,
    createRentalCityPieOption,
    renderFleetSummary,
    init,
  };
})(window);
