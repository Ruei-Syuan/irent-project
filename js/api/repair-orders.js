(function repairOrderApi(globalObject) {
  'use strict';

  const request = (...args) => globalObject.IRentApi.request(...args);

  globalObject.IRentRepairOrderApi = {
    list: ({ page = 1, pageSize = 5, search = '', status = '', month = '' } = {}) => {
      const params = new URLSearchParams({ page, pageSize });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (month) params.set('month', month);
      return request(`/repair-orders?${params.toString()}`);
    },
    accept: id => request(`/repair-orders/${id}/accept`, { method: 'PATCH' }),
    bulkAccept: ids => request('/repair-orders/bulk-accept', {
      method: 'POST',
      body: JSON.stringify({ ids }),
      headers: { 'content-type': 'application/json' }
    })
  };
})(window);
