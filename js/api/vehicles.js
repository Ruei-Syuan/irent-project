(function vehicleApi(globalObject) {
  'use strict';

  const request = (...args) => globalObject.IRentApi.request(...args);

  globalObject.IRentVehicleApi = {
    list: async () => (await request('/vehicles')).items,
    cleaningList: async () => (await request('/vehicles/cleaning-list')).items,
    mapSummary: () => request('/vehicles/map-summary'),
    getHistory: id => request(`/vehicles/${id}/history`),
    createRentalHistory: (id, payload) => request(`/vehicles/${id}/history/rentals`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    updateRentalHistory: (id, recordId, payload) => request(`/vehicles/${id}/history/rentals/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
    createServiceHistory: (id, payload) => request(`/vehicles/${id}/history/services`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    updateServiceHistory: (id, recordId, payload) => request(`/vehicles/${id}/history/services/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
    create: payload => request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    update: (id, payload) => request(`/vehicles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  };

  globalObject.IRentStationApi = {
    list: async () => (await request('/stations')).items
  };
})(window);
