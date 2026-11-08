(() => {
  'use strict';

  const LISTINGS_STORAGE_KEY = 'amlakbashi_listings_v1';
  const seedListings = window.AMLAKBASHI_DEFAULT_LISTINGS || [];
  function loadListings() {
    try {
      const stored = localStorage.getItem(LISTINGS_STORAGE_KEY);
      if (stored) { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) return parsed; }
      localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(seedListings));
    } catch (error) { console.warn('Unable to access the demo listing store.', error); }
    return JSON.parse(JSON.stringify(seedListings));
  }
  let listings = loadListings();

  const $ = (selector, root = document) => root.querySelector(selector);
  const grid = $('#listing-grid');
  const form = $('#listing-filters');
  const count = $('#results-count');
  const noResults = $('#no-results');
  const dialog = $('#property-dialog');
  const dialogContent = $('#dialog-content');
  const toast = $('.toast');
  let toastTimer;
  let lastTrigger = null;

  const toFa = value => new Intl.NumberFormat('fa-IR').format(value);
  const typeLabel = kind => ({ apartment:'آپارتمان', villa:'ویلا و خانه', office:'اداری', commercial:'تجاری', land:'زمین' }[kind] || 'ملک');
  const dealLabel = deal => deal === 'rent' ? 'رهن و اجاره' : 'خرید / فروش';
  const priceNumber = item => item.deal === 'rent' ? item.monthly : item.price;
  const displayPrice = item => item.deal === 'rent'
    ? `${toFa(item.monthly)} میلیون تومان`
    : item.price >= 1000 ? `${toFa(Number((item.price / 1000).toFixed(2)))} میلیارد تومان` : `${toFa(item.price)} میلیون تومان`;
  const displayDeposit = item => item.deal === 'rent' ? `${toFa(item.deposit)} میلیون تومان` : '—';
  const moneyShort = item => item.deal === 'rent' ? `${toFa(item.monthly)} م.ت / ماه` : `${toFa(Number((item.price / 1000).toFixed(2)))} میلیارد`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icon = id => `<svg class="icon" aria-hidden="true"><use href="#${id}"></use></svg>`;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3400);
  }

  function cardMarkup(item, index) {
    const deal = item.deal === 'rent' ? 'rent' : 'sale';
    const priceLabel = item.deal === 'rent' ? 'اجاره ماهانه' : 'قیمت کل';
    const subPrice = item.deal === 'rent' ? `ودیعه: ${toFa(item.deposit)} میلیون تومان` : `هر متر: ${toFa(Math.round(item.price * 1000000 / item.area / 1000000))} میلیون تومان`;
    const bedValue = item.bedrooms ? `${toFa(item.bedrooms)} خواب` : 'بدون خواب';
    return `<article class="listing-card" data-id="${esc(item.id)}" style="--card-index:${index}">
      <button class="listing-photo-button" type="button" data-open="${esc(item.id)}" aria-label="مشاهده جزئیات ${esc(item.title)}">
        <img class="listing-photo" src="${esc(item.images[0])}" alt="تصویر نمونه برای ${esc(item.title)}" loading="lazy" width="640" height="430">
        <span class="listing-photo-shade" aria-hidden="true"></span><span class="listing-badge ${deal}">${dealLabel(item.deal)}</span><span class="listing-id">${esc(item.id)}</span>
      </button>
      <div class="listing-body">
        <p class="listing-location">${icon('i-pin')} ${esc(item.city)}، ${esc(item.district)} <span aria-hidden="true">·</span> ${typeLabel(item.kind)}</p>
        <h3 class="listing-title">${esc(item.title)}</h3>
        <p class="listing-summary">${esc(item.summary)}</p>
        <div class="listing-specs"><div class="listing-spec"><span>متراژ</span><strong>${toFa(item.area)} متر</strong></div><div class="listing-spec"><span>اتاق خواب</span><strong>${bedValue}</strong></div><div class="listing-spec"><span>ساخت</span><strong>${esc(item.year)}</strong></div></div>
        <div class="listing-bottom"><div><span class="listing-price-label">${priceLabel}</span><strong class="listing-price">${displayPrice(item)}</strong><span class="listing-price-sub">${subPrice}</span></div><button class="details-button" type="button" data-open="${esc(item.id)}">جزئیات ملک ${icon('i-arrow')}</button></div>
      </div>
    </article>`;
  }

  function currentFilters() {
    const data = new FormData(form);
    const number = key => { const raw = String(data.get(key) || '').trim(); return raw === '' ? null : Number(raw); };
    return {
      q: String(data.get('q') || '').trim().toLocaleLowerCase('fa'),
      deal: String(data.get('deal') || 'all'), kind: String(data.get('kind') || 'all'), city: String(data.get('city') || 'all'),
      district: String(data.get('district') || '').trim().toLocaleLowerCase('fa'), bedrooms: String(data.get('bedrooms') || 'all'),
      priceMin: number('priceMin'), priceMax: number('priceMax'), areaMin: number('areaMin'), areaMax: number('areaMax')
    };
  }

  function filteredListings() {
    const f = currentFilters();
    let results = listings.filter(item => item.status !== 'draft').filter(item => {
      if (f.deal !== 'all' && item.deal !== f.deal) return false;
      if (f.kind !== 'all' && item.kind !== f.kind) return false;
      if (f.city !== 'all' && item.city !== f.city) return false;
      if (f.district && !item.district.toLocaleLowerCase('fa').includes(f.district)) return false;
      if (f.bedrooms === '0' && item.bedrooms !== 0) return false;
      if (f.bedrooms !== 'all' && f.bedrooms !== '0' && item.bedrooms < Number(f.bedrooms)) return false;
      const searchable = `${item.title} ${item.city} ${item.district} ${typeLabel(item.kind)} ${dealLabel(item.deal)} ${item.summary} ${item.id}`.toLocaleLowerCase('fa');
      if (f.q && !searchable.includes(f.q)) return false;
      const price = priceNumber(item);
      if (f.priceMin !== null && price < f.priceMin) return false;
      if (f.priceMax !== null && price > f.priceMax) return false;
      if (f.areaMin !== null && item.area < f.areaMin) return false;
      if (f.areaMax !== null && item.area > f.areaMax) return false;
      return true;
    });
    const sort = $('#sort').value;
    // Keep purchase prices and monthly rents in separate groups; their units are not directly comparable.
    if (sort === 'price-asc') results.sort((a,b) => a.deal !== b.deal ? (a.deal === 'sale' ? -1 : 1) : priceNumber(a) - priceNumber(b));
    if (sort === 'price-desc') results.sort((a,b) => a.deal !== b.deal ? (a.deal === 'sale' ? -1 : 1) : priceNumber(b) - priceNumber(a));
    if (sort === 'area-desc') results.sort((a,b) => b.area - a.area);
    if (sort === 'newest') results.sort((a,b) => b.updated.localeCompare(a.updated));
    return results;
  }

  function render() {
    const results = filteredListings();
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = results.map(cardMarkup).join('');
    count.textContent = toFa(results.length);
    noResults.hidden = results.length !== 0;
    grid.hidden = results.length === 0;
    grid.setAttribute('aria-busy', 'false');
    $('#clear-search').hidden = !$('#q').value;
  }

  function propertyFacts(item) {
    const facts = [
      ['نوع معامله', dealLabel(item.deal)], ['نوع ملک', typeLabel(item.kind)], ['شهر', item.city], ['محله', item.district],
      ['متراژ', `${toFa(item.area)} متر مربع`], ['اتاق خواب', item.bedrooms ? toFa(item.bedrooms) : 'ندارد'], ['سرویس بهداشتی', item.bathrooms ? toFa(item.bathrooms) : '—'],
      ['طبقه / تعداد طبقات', item.floor], ['سال ساخت', item.year], ['پارکینگ', item.parking], ['انباری', item.storage], ['آسانسور', item.elevator],
      ['وضعیت مبلمان', item.furnishing], ['مدرک / سند', item.document], ['جهت / موقعیت', item.direction], ['مشخصات بنا', item.building]
    ];
    return facts.map(([label,value]) => `<div class="dialog-fact"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
  }

  function openDetails(id, trigger) {
    const item = listings.find(candidate => candidate.id === id);
    if (!item) return;
    lastTrigger = trigger || document.activeElement;
    const priceCaption = item.deal === 'rent' ? 'اجاره ماهانه' : 'قیمت پیشنهادی';
    const priceSub = item.deal === 'rent' ? `ودیعه: ${toFa(item.deposit)} میلیون تومان` : 'مبلغ نمونه؛ پیش از انتشار باید تأیید شود';
    const pictures = item.images.map((image,index) => `<button class="dialog-thumb" type="button" data-gallery="${index}" aria-pressed="${index===0?'true':'false'}" aria-label="نمایش تصویر ${toFa(index+1)}"><img src="${esc(image)}" alt="" loading="lazy"></button>`).join('');
    dialogContent.innerHTML = `<div class="dialog-hero">
      <div class="dialog-gallery-main"><img id="dialog-main-image" src="${esc(item.images[0])}" alt="تصویر نمونه ${esc(item.title)}"><span class="dialog-gallery-label">تصاویر نمونه</span><div class="dialog-thumbnails">${pictures}</div></div>
      <div class="dialog-overview"><span class="listing-badge ${item.deal}">${dealLabel(item.deal)}</span><p class="dialog-code">${esc(item.id)} · SAMPLE LISTING</p><h2 id="dialog-title">${esc(item.title)}</h2><p class="dialog-location">${icon('i-pin')} ${esc(item.city)}، ${esc(item.district)}</p><div class="dialog-price"><span>${priceCaption}</span><strong>${displayPrice(item)}</strong><small>${priceSub}</small></div></div>
    </div>
    <div class="dialog-content"><p class="dialog-short">${esc(item.summary)}</p><h3 class="dialog-section-title">مشخصات کامل ملک</h3><dl class="dialog-facts">${propertyFacts(item)}</dl><h3 class="dialog-section-title">درباره این ملک</h3><p class="dialog-description">${esc(item.description)}</p><h3 class="dialog-section-title">امکانات و ویژگی‌ها</h3><ul class="dialog-feature-list">${item.features.map(feature => `<li>${esc(feature)}</li>`).join('')}</ul><div class="dialog-lower"><section class="dialog-contact" aria-labelledby="contact-property-title"><h3 id="contact-property-title">درخواست اطلاعات بیشتر</h3><p>برای استفاده واقعی، شماره تماس و اطلاعات مشاور این آگهی را وارد کنید.</p><button class="button button-primary" type="button" id="property-contact"><svg class="icon"><use href="#i-phone"/></svg> تماس با مشاور</button><p class="dialog-contact-note">اطلاعات تماس در نسخه نمایشی عمداً فعال نیست.</p></section><div class="dialog-meta"><span>شناسه آگهی: <strong>${esc(item.id)}</strong></span><span>آخرین به‌روزرسانی نمونه: <strong>${esc(item.updated)}</strong></span><span>وضعیت داده: <strong>نمایشی / نیازمند تأیید</strong></span><span>قیمت رهن در صورت اجاره: <strong>${displayDeposit(item)}</strong></span></div></div></div>`;
    dialog.showModal();
    document.body.classList.add('dialog-open');
    $('#dialog-close').focus();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  form.addEventListener('submit', event => { event.preventDefault(); render(); });
  form.addEventListener('input', event => {
    if (event.target.id === 'q') $('#clear-search').hidden = !event.target.value;
    render();
  });
  form.addEventListener('change', render);
  form.addEventListener('reset', () => window.setTimeout(() => { $('#sort').value = 'recommended'; render(); }, 0));
  $('#sort').addEventListener('change', render);
  $('#reset-filters').addEventListener('click', () => { window.setTimeout(() => { $('#sort').value = 'recommended'; render(); }, 0); });
  $('#empty-reset').addEventListener('click', () => { form.reset(); $('#sort').value = 'recommended'; render(); $('#q').focus(); });
  $('#clear-search').addEventListener('click', () => { $('#q').value = ''; $('#clear-search').hidden = true; render(); $('#q').focus(); });
  grid.addEventListener('click', event => {
    const trigger = event.target.closest('[data-open]');
    if (trigger) openDetails(trigger.dataset.open, trigger);
  });
  $('#dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    if (lastTrigger && typeof lastTrigger.focus === 'function' && document.contains(lastTrigger)) lastTrigger.focus();
  });
  dialogContent.addEventListener('click', event => {
    const thumb = event.target.closest('[data-gallery]');
    if (thumb) {
      const itemId = $('.dialog-code', dialogContent).textContent.split(' · ')[0];
      const item = listings.find(candidate => candidate.id === itemId);
      if (!item) return;
      const index = Number(thumb.dataset.gallery);
      $('#dialog-main-image').src = item.images[index];
      dialogContent.querySelectorAll('[data-gallery]').forEach(button => button.setAttribute('aria-pressed', String(button === thumb)));
    }
    if (event.target.closest('#property-contact')) showToast('این آگهی نمونه است؛ پس از ثبت شماره واقعی، دکمه تماس را به شماره مشاور متصل کنید.');
  });


  window.addEventListener('storage', event => {
    if (event.key !== LISTINGS_STORAGE_KEY) return;
    try { listings = JSON.parse(event.newValue || '[]'); } catch (_) { return; }
    render();
    if (dialog.open) closeDialog();
  });

  // Allow direct linking to an individual listing via ?id=AM-2401.
  const params = new URLSearchParams(window.location.search);
  if (params.has('q')) $('#q').value = params.get('q');
  if (params.has('deal') && ['sale','rent'].includes(params.get('deal'))) $('#deal').value = params.get('deal');
  render();
  if (params.has('id')) {
    const item = listings.find(candidate => candidate.id === params.get('id'));
    if (item && item.status !== 'draft') window.setTimeout(() => openDetails(item.id, document.body), 0);
  }
})();
