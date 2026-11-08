(() => {
  'use strict';

  const SESSION_KEY = 'amlakbashi_demo_session';
  const LISTINGS_KEY = 'amlakbashi_listings_v1';
  const SETTINGS_KEY = 'amlakbashi_site_settings_v1';
  const SITE_SETTINGS = window.AMLAKBASHI_SITE_SETTINGS || {
    key: SETTINGS_KEY,
    defaults: { tagline: 'انتخابی مطمئن برای آینده شما', heroEyebrow: 'با اطمینان، در بهترین موقعیت‌ها', heroDescription: 'از جست‌وجوی خانه دلخواه تا تصمیم‌گیری برای سرمایه‌گذاری؛ مسیر انتخاب ملک را شفاف‌تر و مطمئن‌تر طی کنید.', email: 'hello@example.com', phone: '', branchOne: 'نشانی شعبه اول را اینجا وارد کنید.', branchTwo: 'نشانی شعبه دوم را اینجا وارد کنید.' },
    read() { try { return { ...this.defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (_) { return { ...this.defaults }; } },
    apply() {}
  };
  const accounts = [
    { username: 'admin', password: 'BashiAdmin#1405', name: 'مدیر کل', role: 'admin', roleLabel: 'دسترسی کامل' },
    { username: 'listings', password: 'MelkManager#1405', name: 'مدیر آگهی‌ها', role: 'listings', roleLabel: 'مدیریت آگهی‌ها' },
    { username: 'editor', password: 'SiteEditor#1405', name: 'ویرایشگر سایت', role: 'editor', roleLabel: 'تنظیمات محتوای سایت' }
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const toFa = value => new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const typeLabel = kind => ({ apartment: 'آپارتمان', villa: 'ویلا و خانه', office: 'اداری', commercial: 'تجاری', land: 'زمین' }[kind] || 'ملک');
  const dealLabel = deal => deal === 'rent' ? 'رهن و اجاره' : 'خرید / فروش';
  let toastTimer = 0;
  let listings = [];
  let currentEditId = null;
  let imageDataFromUpload = '';
  let lastEditorTrigger = null;
  let pendingDeleteId = null;
  let lastDeleteTrigger = null;
  let session;

  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!value || !accounts.some(item => item.username === value.username && item.role === value.role)) return null;
      return value;
    } catch (_) { return null; }
  }
  session = readSession();
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  const canManageListings = session.role === 'admin' || session.role === 'listings';
  const canManageSettings = session.role === 'admin' || session.role === 'editor';

  function persistListings() {
    try {
      localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
      return true;
    } catch (error) {
      console.error('Unable to persist demo listings', error);
      showToast('ذخیره انجام نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.', true);
      return false;
    }
  }
  function loadListings() {
    try {
      const raw = localStorage.getItem(LISTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(item => ({ status: 'published', ...item }));
      }
      const defaults = (window.AMLAKBASHI_DEFAULT_LISTINGS || []).map(item => ({ ...item, images: Array.isArray(item.images) ? item.images.slice() : [], features: Array.isArray(item.features) ? item.features.slice() : [], status: 'published' }));
      localStorage.setItem(LISTINGS_KEY, JSON.stringify(defaults));
      return defaults;
    } catch (error) {
      console.error('Unable to load demo listings', error);
      return (window.AMLAKBASHI_DEFAULT_LISTINGS || []).map(item => ({ ...item, status: 'published' }));
    }
  }
  function showToast(message, isError = false) {
    const toast = $('#admin-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('is-error', isError);
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3000);
  }
  function priceLabel(item) {
    if (item.deal === 'rent') return `${toFa(item.deposit)} م.ت ودیعه · ${toFa(item.monthly)} م.ت / ماه`;
    const price = Number(item.price || 0);
    return price >= 1000 ? `${toFa((price / 1000).toFixed(2))} میلیارد تومان` : `${toFa(price)} میلیون تومان`;
  }
  function shortPrice(item) {
    if (item.deal === 'rent') return `${toFa(item.monthly)} م.ت / ماه`;
    const price = Number(item.price || 0);
    return price >= 1000 ? `${toFa((price / 1000).toFixed(2))} میلیارد` : `${toFa(price)} م.ت`;
  }
  function itemImage(item) { return Array.isArray(item.images) && item.images[0] ? item.images[0] : 'assets/images/property-apartment.jpg'; }

  function renderStats() {
    const published = listings.filter(item => item.status !== 'draft').length;
    const drafts = listings.length - published;
    const sales = listings.filter(item => item.status !== 'draft' && item.deal === 'sale').length;
    const rents = listings.filter(item => item.status !== 'draft' && item.deal === 'rent').length;
    $('#metric-total').textContent = toFa(listings.length);
    $('#metric-published').textContent = toFa(published);
    $('#metric-draft').textContent = toFa(drafts);
    $('#metric-deals').innerHTML = `${toFa(sales)} <small> / </small> ${toFa(rents)}`;
    $('#nav-listing-count').textContent = toFa(listings.length);
  }

  function renderRecent() {
    const recent = [...listings].sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || ''))).slice(0, 5);
    $('#recent-listings').innerHTML = recent.length ? recent.map(item => `
      <article class="recent-item">
        <img class="recent-thumb" src="${esc(itemImage(item))}" alt="" loading="lazy" width="62" height="53">
        <div class="recent-copy"><strong>${esc(item.title)}</strong><small>${esc(item.city)}، ${esc(item.district)} · ${toFa(item.area)} متر</small></div>
        <div class="recent-price-wrap"><strong class="recent-price">${esc(shortPrice(item))}</strong><span class="recent-status ${item.status === 'draft' ? 'draft' : 'published'}">${item.status === 'draft' ? 'پیش‌نویس' : 'منتشر شده'}</span></div>
      </article>`).join('') : '<p class="login-intro">هنوز آگهی‌ای ثبت نشده است.</p>';
  }

  function filteredAdminListings() {
    const query = ($('#admin-search').value || '').trim().toLocaleLowerCase('fa');
    const deal = $('#admin-deal-filter').value;
    const status = $('#admin-status-filter').value;
    return listings.filter(item => {
      if (deal !== 'all' && item.deal !== deal) return false;
      if (status !== 'all' && (item.status || 'published') !== status) return false;
      const haystack = `${item.id} ${item.title} ${item.city} ${item.district} ${typeLabel(item.kind)}`.toLocaleLowerCase('fa');
      return !query || haystack.includes(query);
    }).sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
  }
  function renderListings() {
    const results = filteredAdminListings();
    $('#admin-results-count').textContent = `${toFa(results.length)} آگهی از ${toFa(listings.length)}`;
    $('#clear-admin-search').hidden = !$('#admin-search').value;
    $('#admin-no-listings').hidden = results.length > 0;
    $('.listing-table-wrap').hidden = results.length === 0;
    $('#admin-listings-body').innerHTML = results.map(item => `
      <tr>
        <td><div class="table-property"><img src="${esc(itemImage(item))}" alt="" loading="lazy" width="55" height="47"><div><strong>${esc(item.title)}</strong><small>${esc(item.id)} · ${esc(item.city)}، ${esc(item.district)}</small></div></div></td>
        <td><span class="deal-cell ${item.deal === 'rent' ? 'rent' : ''}">${dealLabel(item.deal)}</span><div style="margin-top:4px;color:#a18e7e;font-size:9px">${typeLabel(item.kind)}</div></td>
        <td>${toFa(item.area)} متر <div style="margin-top:4px;color:#9c8979;font-size:9px">${item.bedrooms ? `${toFa(item.bedrooms)} خواب` : 'بدون خواب'}</div></td>
        <td>${esc(priceLabel(item))}</td>
        <td><span class="status-pill ${item.status === 'draft' ? 'draft' : 'published'}">${item.status === 'draft' ? 'پیش‌نویس' : 'منتشر شده'}</span></td>
        <td><div class="table-actions">${canManageListings ? `<button class="table-action" type="button" data-edit="${esc(item.id)}">ویرایش</button><button class="table-action delete" type="button" data-delete="${esc(item.id)}">حذف</button>` : '<span style="color:#9a8a7a;font-size:9px">فقط مشاهده</span>'}</div></td>
      </tr>`).join('');
  }
  function renderAll() { renderStats(); renderRecent(); renderListings(); }

  function setView(view) {
    const allowed = new Set(['overview', 'listings', 'settings', 'accounts']);
    if (!allowed.has(view)) return;
    if (view === 'settings' && !canManageSettings) { showToast('نقش فعلی اجازهٔ تغییر تنظیمات سایت را ندارد.', true); return; }
    if (view === 'accounts' && session.role !== 'admin') { showToast('این بخش فقط برای مدیر کل قابل مشاهده است.', true); return; }
    $$('.admin-view').forEach(panel => panel.classList.toggle('is-visible', panel.dataset.panel === view));
    $$('.admin-nav-item').forEach(button => button.classList.toggle('is-active', button.dataset.view === view));
    const titles = { overview: 'نمای کلی', listings: 'مدیریت آگهی‌ها', settings: 'تنظیمات سایت', accounts: 'حساب‌های نمایشی' };
    $('#view-title').textContent = titles[view];
    $('#admin-sidebar').classList.remove('is-open');
    $('#admin-sidebar-scrim')?.remove();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fillSettingsForm() {
    const values = SITE_SETTINGS.read();
    Object.entries({ tagline: 'setting-tagline', heroEyebrow: 'setting-eyebrow', heroDescription: 'setting-description', email: 'setting-email', phone: 'setting-phone', branchOne: 'setting-branch-one', branchTwo: 'setting-branch-two' }).forEach(([key, id]) => { $('#' + id).value = values[key] || ''; });
    $('#settings-feedback').textContent = '';
  }
  function saveSettings(event) {
    event.preventDefault();
    if (!canManageSettings) { showToast('اجازهٔ تغییر تنظیمات را ندارید.', true); return; }
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid');
      showToast('فیلدهای لازم را بررسی کنید.', true);
      invalid?.focus();
      return;
    }
    const data = new FormData(form);
    const values = Object.fromEntries(['tagline', 'heroEyebrow', 'heroDescription', 'email', 'phone', 'branchOne', 'branchTwo'].map(key => [key, String(data.get(key) || '').trim()]));
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
      SITE_SETTINGS.apply();
      const message = $('#settings-feedback');
      message.classList.remove('is-error');
      message.textContent = 'تنظیمات ذخیره شد؛ در صفحهٔ عمومی اعمال می‌شود.';
      showToast('تنظیمات سایت با موفقیت ذخیره شد.');
    } catch (error) {
      const message = $('#settings-feedback');
      message.classList.add('is-error');
      message.textContent = 'ذخیره‌سازی انجام نشد. فضای مرورگر را بررسی کنید.';
      showToast('ذخیره‌سازی انجام نشد.', true);
    }
  }

  function nextId() {
    const largest = listings.reduce((max, item) => Math.max(max, Number(String(item.id || '').replace(/\D/g, '')) || 2400), 2400);
    return `AM-${largest + 1}`;
  }
  function openEditor(id = null, trigger = document.activeElement) {
    if (!canManageListings) { showToast('نقش فعلی امکان ویرایش آگهی را ندارد.', true); return; }
    currentEditId = id;
    lastEditorTrigger = trigger;
    imageDataFromUpload = '';
    $('#editor-error').hidden = true;
    $('#listing-editor-form').reset();
    $('#edit-image-upload').value = '';
    const item = id ? listings.find(candidate => candidate.id === id) : null;
    $('#editor-title').textContent = item ? 'ویرایش مشخصات آگهی' : 'ثبت آگهی جدید';
    $('#edit-id').value = item?.id || nextId();
    const defaults = {
      title: '', deal: 'sale', kind: 'apartment', city: '', district: '', price: 0, deposit: 0, monthly: 0, area: '', bedrooms: 0, bathrooms: 0, floor: '', year: '', parking: '', storage: '', elevator: '', furnishing: '', document: '', direction: '', building: '', summary: '', description: '', features: [], images: ['assets/images/property-apartment.jpg'], status: 'published', updated: '۱۴۰۵/۰۷/۲۴'
    };
    const data = { ...defaults, ...(item || {}) };
    const fields = ['title','deal','kind','city','district','price','deposit','monthly','area','bedrooms','bathrooms','floor','year','parking','storage','elevator','furnishing','document','direction','building','summary','description','status','updated'];
    fields.forEach(key => { const input = $(`#edit-${key}`); if (input) input.value = data[key] ?? ''; });
    $('#edit-features').value = Array.isArray(data.features) ? data.features.join('، ') : String(data.features || '');
    const dataImages = Array.isArray(data.images) ? data.images : String(data.images || '').split(',').map(value => value.trim()).filter(Boolean);
    const hasInlineImage = dataImages.some(path => String(path).startsWith('data:image/'));
    const editableImages = dataImages.filter(path => !String(path).startsWith('data:image/'));
    $('#edit-images').value = [hasInlineImage ? '[تصویر بارگذاری‌شده]' : '', ...editableImages].filter(Boolean).join(', ');
    $('#listing-edit-dialog').showModal();
    $('#edit-title').focus();
  }
  function closeEditor() {
    const dialog = $('#listing-edit-dialog');
    if (dialog.open) dialog.close();
  }
  async function compressImage(file) {
    if (!file) return '';
    if (!file.type.startsWith('image/')) throw new Error('فقط فایل تصویری مجاز است.');
    if (file.size > 12 * 1024 * 1024) throw new Error('حجم تصویر باید کمتر از ۱۲ مگابایت باشد.');
    const bitmap = await createImageBitmap(file);
    const maxWidth = 1500;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('پردازش تصویر در این مرورگر ممکن نیست.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.78);
  }
  async function saveListing(event) {
    event.preventDefault();
    if (!canManageListings) return;
    const form = event.currentTarget;
    const errorBox = $('#editor-error');
    errorBox.hidden = true;
    if (!form.checkValidity()) {
      errorBox.textContent = 'عنوان، شهر، محله، متراژ و خلاصهٔ آگهی را کامل کنید.';
      errorBox.hidden = false;
      form.querySelector(':invalid')?.focus();
      return;
    }
    const saveButton = $('#save-listing');
    saveButton.disabled = true;
    saveButton.textContent = 'در حال ذخیره...';
    try {
      const data = new FormData(form);
      const id = String(data.get('id') || nextId()).trim();
      if (listings.some(item => item.id === id && id !== currentEditId)) {
        errorBox.textContent = 'شناسهٔ آگهی تکراری است. صفحه را ببندید و دوباره تلاش کنید.';
        errorBox.hidden = false;
        return;
      }
      const imagePaths = String(data.get('images') || '').split(',').map(value => value.trim()).filter(Boolean);
      const oldItem = currentEditId ? listings.find(item => item.id === currentEditId) : null;
      const preserveInline = imagePaths.includes('[تصویر بارگذاری‌شده]');
      let images = preserveInline
        ? [...(oldItem?.images || []).filter(path => String(path).startsWith('data:image/')).slice(0, 1), ...imagePaths.filter(path => path !== '[تصویر بارگذاری‌شده]')]
        : (imagePaths.length ? imagePaths : (oldItem?.images || ['assets/images/property-apartment.jpg']));
      const upload = $('#edit-image-upload').files?.[0];
      if (upload) {
        try {
          const dataUrl = await compressImage(upload);
          images = [dataUrl, ...images.filter(path => !String(path).startsWith('data:image/') && path !== '[تصویر بارگذاری‌شده]')].slice(0, 3);
        } catch (imageError) {
          errorBox.textContent = imageError.message || 'بارگذاری تصویر ناموفق بود.';
          errorBox.hidden = false;
          return;
        }
      } else if (imageDataFromUpload) {
        images = [imageDataFromUpload, ...images.filter(path => !path.startsWith('data:image/'))].slice(0, 3);
      }
      const number = key => Math.max(0, Number(data.get(key) || 0));
      const newItem = {
        id, title: String(data.get('title') || '').trim(), deal: String(data.get('deal') || 'sale'), kind: String(data.get('kind') || 'apartment'),
        city: String(data.get('city') || '').trim(), district: String(data.get('district') || '').trim(), price: number('price'), deposit: number('deposit'), monthly: number('monthly'),
        area: number('area'), bedrooms: number('bedrooms'), bathrooms: number('bathrooms'), floor: String(data.get('floor') || '').trim(), year: String(data.get('year') || '').trim(),
        parking: String(data.get('parking') || '').trim(), storage: String(data.get('storage') || '').trim(), elevator: String(data.get('elevator') || '').trim(), furnishing: String(data.get('furnishing') || '').trim(),
        document: String(data.get('document') || '').trim(), direction: String(data.get('direction') || '').trim(), building: String(data.get('building') || '').trim(),
        summary: String(data.get('summary') || '').trim(), description: String(data.get('description') || '').trim(), features: String(data.get('features') || '').split(/[،,]/).map(value => value.trim()).filter(Boolean),
        images, status: String(data.get('status') || 'published'), updated: String(data.get('updated') || '').trim() || '۱۴۰۵/۰۷/۲۴'
      };
      const previous = listings;
      listings = currentEditId ? listings.map(item => item.id === currentEditId ? newItem : item) : [newItem, ...listings];
      if (!persistListings()) { listings = previous; return; }
      renderAll();
      closeEditor();
      showToast(currentEditId ? 'مشخصات آگهی به‌روزرسانی شد.' : 'آگهی جدید ثبت شد.');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'ذخیرهٔ آگهی';
    }
  }

  function requestDelete(id, trigger) {
    if (!canManageListings) return;
    const item = listings.find(candidate => candidate.id === id);
    if (!item) return;
    pendingDeleteId = id;
    lastDeleteTrigger = trigger;
    $('#delete-confirm-title').textContent = 'حذف آگهی';
    $('#delete-confirm-copy').textContent = `آیا از حذف «${item.title}» مطمئن هستید؟ این تغییر در نسخهٔ نمایشی قابل بازگشت خودکار نیست.`;
    $('#delete-confirm-dialog').showModal();
    $('#cancel-delete').focus();
  }
  function closeDeleteDialog() {
    const dialog = $('#delete-confirm-dialog');
    if (dialog.open) dialog.close();
  }
  function confirmDelete() {
    if (!pendingDeleteId) return;
    const item = listings.find(candidate => candidate.id === pendingDeleteId);
    const previous = listings;
    listings = listings.filter(candidate => candidate.id !== pendingDeleteId);
    if (!persistListings()) { listings = previous; return; }
    renderAll();
    closeDeleteDialog();
    showToast(item ? `آگهی «${item.title}» حذف شد.` : 'آگهی حذف شد.');
    pendingDeleteId = null;
    lastDeleteTrigger = null;
  }

  // User identity and role gates.
  $('#current-user-name').textContent = session.name || 'کاربر پنل';
  $('#current-user-role').textContent = session.roleLabel || 'کاربر';
  $('#user-avatar').textContent = String(session.name || 'م').charAt(0);
  if (!canManageListings) {
    $$('[data-action="new-listing"]').forEach(button => { button.hidden = true; });
  }
  if (!canManageSettings) {
    $$('[data-view="settings"]').forEach(button => { button.hidden = true; });
  }
  if (session.role !== 'admin') {
    $$('[data-view="accounts"]').forEach(button => { button.hidden = true; });
    $('#view-accounts').remove();
  }
  if (!canManageListings) $('.admin-warning strong')?.setAttribute('data-role-note', 'readonly');
  // Add the mobile drawer scrim only while the drawer is open.
  function openMobileMenu() {
    const sidebar = $('#admin-sidebar');
    sidebar.classList.add('is-open');
    if (!$('#admin-sidebar-scrim')) {
      const scrim = document.createElement('button');
      scrim.type = 'button'; scrim.id = 'admin-sidebar-scrim'; scrim.className = 'admin-sidebar-scrim'; scrim.setAttribute('aria-label', 'بستن منو');
      scrim.addEventListener('click', () => { sidebar.classList.remove('is-open'); scrim.remove(); });
      document.body.appendChild(scrim);
    }
  }

  $$('.admin-nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('[data-go-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.goView)));
  $$('[data-action="new-listing"]').forEach(button => button.addEventListener('click', () => openEditor(null, button)));
  $('#admin-search').addEventListener('input', renderListings);
  $('#admin-deal-filter').addEventListener('change', renderListings);
  $('#admin-status-filter').addEventListener('change', renderListings);
  $('#clear-admin-search').addEventListener('click', () => { $('#admin-search').value = ''; renderListings(); $('#admin-search').focus(); });
  $('#clear-manager-filters').addEventListener('click', () => { $('#admin-search').value = ''; $('#admin-deal-filter').value = 'all'; $('#admin-status-filter').value = 'all'; renderListings(); $('#admin-search').focus(); });
  $('#admin-listings-body').addEventListener('click', event => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    if (edit) openEditor(edit.dataset.edit, edit);
    if (del) requestDelete(del.dataset.delete, del);
  });
  $('#close-editor').addEventListener('click', closeEditor);
  $('#cancel-editor').addEventListener('click', closeEditor);
  $('#listing-edit-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) closeEditor(); });
  $('#listing-edit-dialog').addEventListener('close', () => { if (lastEditorTrigger?.isConnected) lastEditorTrigger.focus(); });
  $('#listing-editor-form').addEventListener('submit', saveListing);
  $('#site-settings-form').addEventListener('submit', saveSettings);
  $('#reset-settings').addEventListener('click', () => {
    if (!canManageSettings) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(SITE_SETTINGS.defaults));
      fillSettingsForm(); SITE_SETTINGS.apply();
      $('#settings-feedback').textContent = 'تنظیمات به مقدار اولیه برگشت.';
      showToast('تنظیمات به مقدار اولیه برگشت.');
    } catch (_) { showToast('بازگردانی تنظیمات انجام نشد.', true); }
  });
  $('#mobile-menu').addEventListener('click', openMobileMenu);
  $('#logout-button').addEventListener('click', logout);
  $('#top-logout').addEventListener('click', logout);
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('login.html');
  }
  $('#admin-listings-body').addEventListener('dblclick', event => { const row = event.target.closest('tr'); const button = row?.querySelector('[data-edit]'); if (button) button.click(); });
  $('#listing-editor-form').addEventListener('change', event => {
    if (event.target.id === 'edit-image-upload' && event.target.files?.[0]) imageDataFromUpload = '';
  });
  $('#delete-confirm-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) closeDeleteDialog(); });
  $('#cancel-delete').addEventListener('click', closeDeleteDialog);
  $('#confirm-delete').addEventListener('click', confirmDelete);
  $('#delete-confirm-dialog').addEventListener('close', () => { if (lastDeleteTrigger?.isConnected) lastDeleteTrigger.focus(); });
  window.addEventListener('storage', event => {
    if (event.key === LISTINGS_KEY) { listings = loadListings(); renderAll(); }
    if (event.key === SETTINGS_KEY) { fillSettingsForm(); }
  });

  listings = loadListings();
  fillSettingsForm();
  renderAll();
})();
