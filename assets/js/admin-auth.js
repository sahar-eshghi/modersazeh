(() => {
  'use strict';
  const SESSION_KEY = 'amlakbashi_demo_session';
  const accounts = [
    { username: 'admin', password: 'BashiAdmin#1405', name: 'مدیر کل', role: 'admin', roleLabel: 'دسترسی کامل' },
    { username: 'listings', password: 'MelkManager#1405', name: 'مدیر آگهی‌ها', role: 'listings', roleLabel: 'مدیریت آگهی‌ها' },
    { username: 'editor', password: 'SiteEditor#1405', name: 'ویرایشگر سایت', role: 'editor', roleLabel: 'تنظیمات محتوای سایت' }
  ];
  const form = document.getElementById('login-form');
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  const error = document.getElementById('login-error');
  const toggle = document.getElementById('toggle-password');
  if (!form) return;

  try {
    const existing = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (existing && accounts.some(account => account.username === existing.username && account.role === existing.role)) {
      window.location.replace('admin.html');
      return;
    }
  } catch (_) { /* A fresh demo session will be created on successful login. */ }

  toggle?.addEventListener('click', () => {
    const showing = password.type === 'text';
    password.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? 'نمایش' : 'پنهان';
    toggle.setAttribute('aria-pressed', String(!showing));
    toggle.setAttribute('aria-label', showing ? 'نمایش رمز عبور' : 'پنهان کردن رمز عبور');
  });

  document.querySelector('[data-fill-user="admin"]')?.addEventListener('click', () => {
    username.value = 'admin';
    password.value = 'BashiAdmin#1405';
    error.hidden = true;
    password.focus();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;
    const enteredUser = username.value.trim();
    const account = accounts.find(item => item.username === enteredUser && item.password === password.value);
    if (!account) {
      error.hidden = false;
      password.select();
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: account.username, name: account.name, role: account.role, roleLabel: account.roleLabel, issuedAt: Date.now() }));
      window.location.assign('admin.html');
    } catch (_) {
      error.textContent = 'مرورگر اجازهٔ ذخیرهٔ وضعیت ورود را نمی‌دهد. تنظیمات ذخیره‌سازی مرورگر را بررسی کنید.';
      error.hidden = false;
    }
  });
})();
