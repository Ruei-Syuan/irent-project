(function cleaningOrderApi(globalObject) {
  'use strict';

  const request = (...args) => globalObject.IRentApi.request(...args);

  globalObject.IRentCleaningOrderApi = {
    list: ({ page = 1, pageSize = 5, condition = '', status = '', search = '', month = '' } = {}) => {
      const parameters = new URLSearchParams({ page, pageSize });
      if (status || condition) parameters.set('status', status || condition);
      if (search) parameters.set('search', search);
      if (month) parameters.set('month', month);
      return request(`/cleaning-orders?${parameters}`);
    },
    summary: ({ month = '' } = {}) => {
      const parameters = new URLSearchParams();
      if (month) parameters.set('month', month);
      const query = parameters.toString();
      return request(`/cleaning-orders/summary${query ? `?${query}` : ''}`);
    },
    accept: id => request(`/cleaning-orders/${id}/accept`, { method: 'PATCH' }),
    bulkAccept: ids => request('/cleaning-orders/bulk-accept', {
      method: 'POST',
      body: JSON.stringify({ ids }),
      headers: { 'content-type': 'application/json' }
    }),
    create: payload => request('/cleaning-orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  };
})(window);
