(() => {
  'use strict';

  const form = document.querySelector('[data-login-form]');
  const message = document.querySelector('[data-login-message]');

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    button.disabled = true;
    message.textContent = '登入驗證中…';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeNo: formData.get('employeeNo'),
          password: formData.get('password')
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '登入失敗');
      window.location.replace('/dashboard.html');
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
})();
