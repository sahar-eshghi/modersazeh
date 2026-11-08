(() => {
  'use strict';
  const SETTINGS_KEY = 'amlakbashi_site_settings_v1';
  const LISTINGS_KEY = 'amlakbashi_listings_v1';
  const defaults = {
    tagline: 'انتخابی مطمئن برای آینده شما',
    heroEyebrow: 'با اطمینان، در بهترین موقعیت‌ها',
    heroDescription: 'از جست‌وجوی خانه دلخواه تا تصمیم‌گیری برای سرمایه‌گذاری؛ مسیر انتخاب ملک را شفاف‌تر و مطمئن‌تر طی کنید.',
    email: 'hello@example.com',
    phone: '',
    branchOne: 'نشانی شعبه اول را اینجا وارد کنید.',
    branchTwo: 'نشانی شعبه دوم را اینجا وارد کنید.'
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const toFa = value => new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
  const read = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      return stored && typeof stored === 'object' ? { ...defaults, ...stored } : defaults;
    } catch (_) { return defaults; }
  };
  function readListings() {
    try {
      const stored = JSON.parse(localStorage.getItem(LISTINGS_KEY) || 'null');
      if (Array.isArray(stored)) return stored;
    } catch (_) { /* use bundled sample listings below */ }
    return window.AMLAKBASHI_DEFAULT_LISTINGS || [];
  }
  const kindLabel = kind => ({ apartment:'آپارتمان', villa:'ویلا و خانه', office:'اداری', commercial:'تجاری', land:'زمین' }[kind] || 'ملک');
  const kindCategory = kind => ['apartment', 'villa'].includes(kind) ? 'residential' : kind;
  const moneyLabel = item => {
    if (item.deal === 'rent') return `رهن ${toFa(item.deposit)} میلیون · اجاره ${toFa(item.monthly)} میلیون`;
    const price = Number(item.price || 0);
    return price >= 1000 ? `${toFa(Number((price / 1000).toFixed(2)))} میلیارد تومان` : `${toFa(price)} میلیون تومان`;
  };
  function renderHomepageListings() {
    const track = document.querySelector('.property-track');
    if (!track) return;
    const listings = readListings().filter(item => item.status !== 'draft');
    track.innerHTML = listings.length ? listings.map(item => {
      const category = kindCategory(item.kind);
      const categoryLabel = kindLabel(item.kind);
      const image = Array.isArray(item.images) && item.images[0] ? item.images[0] : 'assets/images/property-apartment.jpg';
      const location = `${item.city || ''}${item.district ? `، ${item.district}` : ''}`;
      const meta = item.bedrooms ? `${toFa(item.bedrooms)} خواب` : categoryLabel;
      const title = item.title || 'آگهی ملک';
      return `<article class="property-card" data-category="${esc(category)}" data-listing-id="${esc(item.id)}">
        <div class="property-photo"><img src="${esc(image)}" alt="تصویر ${esc(title)}" loading="lazy" width="560" height="380"><span class="property-tag">${esc(categoryLabel)}</span><button class="save-property" type="button" aria-label="ذخیره ${esc(title)}" data-toast="برای ذخیره ملک، پس از راه‌اندازی حساب کاربری این امکان فعال می‌شود.">♡</button></div>
        <div class="property-info"><p class="property-location"><svg class="icon"><use href="#i-pin"/></svg>${esc(location)}</p><h3>${esc(title)}</h3><div class="property-meta"><span><svg class="icon"><use href="#i-ruler"/></svg>${toFa(item.area)} متر</span><span><svg class="icon"><use href="${item.bedrooms ? '#i-bed' : '#i-building'}"/></svg>${esc(meta)}</span></div><div class="property-bottom"><span class="property-price">${esc(moneyLabel(item))}</span><a href="listings.html?id=${encodeURIComponent(item.id || '')}" class="text-link">جزئیات <svg class="icon"><use href="#i-arrow"/></svg></a></div></div>
      </article>`;
    }).join('') : '<p class="home-listings-empty">در حال حاضر آگهی منتشرشده‌ای وجود ندارد.</p>';
    document.dispatchEvent(new CustomEvent('amlakbashi:listings-rendered'));
  }
  const apply = () => {
    const settings = read();
    document.querySelectorAll('[data-site-setting]').forEach(element => {
      const key = element.dataset.siteSetting;
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        const eyebrowLine = key === 'heroEyebrow' ? element.querySelector('.eyebrow-line') : null;
        element.textContent = settings[key];
        if (eyebrowLine) element.prepend(eyebrowLine);
      }
    });
    const email = settings.email || defaults.email;
    const emailLink = document.getElementById('contact-main-cta');
    if (emailLink) emailLink.href = `mailto:${email}?subject=${encodeURIComponent('تماس با مدرن سازه')}`;
    document.querySelectorAll('[data-site-email]').forEach(element => { element.textContent = email; element.href = `mailto:${email}`; });
    document.querySelectorAll('[data-site-phone]').forEach(element => {
      const phone = settings.phone || '';
      element.textContent = phone || 'شماره تماس را در پنل ثبت کنید';
      if (element.tagName === 'A') element.href = phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : '#contact';
    });
    renderHomepageListings();
  };
  apply();
  window.addEventListener('storage', event => {
    if (event.key === SETTINGS_KEY || event.key === LISTINGS_KEY) apply();
  });
  window.AMLAKBASHI_SITE_SETTINGS = { key: SETTINGS_KEY, defaults, read, apply };
})();
