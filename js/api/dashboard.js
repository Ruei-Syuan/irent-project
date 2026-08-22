(function dashboardApi(globalObject) {
  'use strict';

  const request = (...args) => globalObject.IRentApi.request(...args);

  globalObject.IRentDashboardApi = {
    fleetSummary: () => request('/dashboard/fleet-summary'),
    fleetTrend: async () => (await request('/dashboard/fleet-trend')).items,
    rentalCountByCity: async () => (await request('/dashboard/rental-count-by-city')).items
  };
})(window);
