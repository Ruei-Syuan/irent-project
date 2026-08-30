(function pointsApi(globalObject) {
  'use strict';

  const request = (...args) => globalObject.IRentApi.request(...args);

  globalObject.IRentPointsApi = {
    list: ({ page = 1, pageSize = 20, search = '' } = {}) => {
      const params = new URLSearchParams({ page, pageSize });
      if (search.trim()) params.set('search', search.trim());
      return request(`/points?${params.toString()}`);
    },
    transactions: memberNo => request(`/points/${encodeURIComponent(memberNo)}/transactions`),
    create: data => request('/points', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  };
})(window);
