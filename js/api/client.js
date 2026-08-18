(function apiClient(globalObject) {
  'use strict';

  async function request(path, options = {}) {
    const response = await fetch(`/api/v1${path}`, {
      ...options,
      headers: options.body
        ? { 'content-type': 'application/json', ...options.headers }
        : options.headers
    });

    if (response.status === 401) {
      window.location.replace('/login.html');
      throw new Error('請先登入');
    }
    if (response.status === 204) return null;

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '操作失敗');
    return result;
  }

  globalObject.IRentApi = { request };
})(window);
