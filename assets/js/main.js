(() => {
  'use strict';

  const header = document.querySelector('.site-header');
  const nav = document.querySelector('.primary-nav');
  const navToggle = document.querySelector('.nav-toggle');
  const toTop = document.querySelector('.to-top');
  const toast = document.querySelector('.toast');
  const viewport = document.querySelector('.property-viewport');
  const track = document.querySelector('.property-track');
  const progress = document.querySelector('.slider-progress span');
  let toastTimeout;

  // Header scroll state and back-to-top button.
  const handleScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    header?.classList.toggle('scrolled', y > 30);
    toTop?.classList.toggle('is-visible', y > 480);
  };
  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });

  // Mobile menu.
  const closeMenu = () => {
    nav?.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.setAttribute('aria-label', 'باز کردن منو');
    document.body.classList.remove('menu-open');
    if (navToggle) navToggle.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-menu"></use></svg>';
  };
  navToggle?.addEventListener('click', () => {
    const isOpen = nav?.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
    navToggle.setAttribute('aria-label', isOpen ? 'بستن منو' : 'باز کردن منو');
    document.body.classList.toggle('menu-open', Boolean(isOpen));
    navToggle.innerHTML = isOpen
      ? '<svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>'
      : '<svg class="icon" aria-hidden="true"><use href="#i-menu"></use></svg>';
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
  document.addEventListener('click', event => {
    if (!nav?.classList.contains('is-open')) return;
    if (nav.contains(event.target) || navToggle?.contains(event.target)) return;
    closeMenu();
  });

  // Smooth top action.
  toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Section reveal animations with a safe fallback for older browsers.
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    revealItems.forEach(item => revealObserver.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('is-revealed'));
  }

  // Keep the current section reflected in the desktop/mobile menu.
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const sectionTargets = navLinks
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  if ('IntersectionObserver' in window && sectionTargets.length) {
    const activeObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const currentId = `#${entry.target.id}`;
        navLinks.forEach(link => {
          const active = link.getAttribute('href') === currentId;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-38% 0px -52% 0px', threshold: 0 });
    sectionTargets.forEach(section => activeObserver.observe(section));
  }

  // Small accessible toast for controls whose backend will be connected later.
  const showToast = message => {
    if (!toast || !message) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 3300);
  };
  document.querySelectorAll('[data-toast]').forEach(control => {
    control.addEventListener('click', event => {
      event.preventDefault();
      showToast(control.getAttribute('data-toast'));
    });
  });

  // Property filters. These are front-end filters until a real property feed is connected.
  const filterButtons = Array.from(document.querySelectorAll('.filter-chip'));
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const selectedFilter = button.dataset.filter || 'all';
      filterButtons.forEach(item => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      document.querySelectorAll('.property-card').forEach(card => {
        const visible = selectedFilter === 'all' || card.dataset.category === selectedFilter;
        card.classList.toggle('is-hidden', !visible);
        card.setAttribute('aria-hidden', String(!visible));
      });
      if (viewport) viewport.scrollTo({ left: 0, behavior: 'smooth' });
      updateSliderProgress();
    });
  });

  // Horizontal featured-property carousel.
  const updateSliderProgress = () => {
    if (!viewport || !progress) return;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const current = Math.min(maxScroll, Math.abs(viewport.scrollLeft));
    const ratio = maxScroll === 0 ? 1 : current / maxScroll;
    const visibleCards = Array.from(document.querySelectorAll('.property-card')).filter(card => !card.classList.contains('is-hidden'));
    const visibleRatio = visibleCards.length ? Math.min(1, 4 / visibleCards.length) : 1;
    progress.style.width = `${Math.max(visibleRatio * 100, ratio * 100, 10)}%`;
  };
  const moveCarousel = direction => {
    if (!viewport) return;
    const amount = Math.max(240, viewport.clientWidth * 0.78);
    viewport.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };
  document.querySelector('.slider-prev')?.addEventListener('click', () => moveCarousel(1));
  document.querySelector('.slider-next')?.addEventListener('click', () => moveCarousel(-1));
  viewport?.addEventListener('scroll', updateSliderProgress, { passive: true });
  window.addEventListener('resize', updateSliderProgress, { passive: true });
  updateSliderProgress();

  // Delegate card actions because featured listings can be refreshed from the admin panel.
  track?.addEventListener('click', event => {
    const button = event.target.closest('.save-property');
    if (!button) return;
    event.preventDefault();
    showToast(button.dataset.toast || 'برای ذخیره املاک، اتصال حساب کاربری لازم است.');
  });
  document.addEventListener('amlakbashi:listings-rendered', updateSliderProgress);

  // Localize the copyright year when supported by the browser.
  const yearNode = document.getElementById('year');
  if (yearNode) {
    try { yearNode.textContent = new Intl.DateTimeFormat('fa-IR-u-nu-arabext', { year: 'numeric' }).format(new Date()); }
    catch { yearNode.textContent = String(new Date().getFullYear()); }
  }
})();
