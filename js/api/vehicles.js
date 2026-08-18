(function vehicleApi(globalObject) {
  'use strict';

  const request = (...args) => globalObject.IRentApi.request(...args);

  globalObject.IRentVehicleApi = {
    list: async () => (await request('/vehicles')).items,
    create: payload => request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  };

  globalObject.IRentStationApi = {
    list: async () => (await request('/stations')).items
  };
})(window);
