// MSJ 2026 · Interfaz: Liquid Glass interactivo, diseño de MSJ Studio aplicado sin parpadeo, cabecera al hacer scroll
// y animaciones de entrada. Se carga justo después de layout.js (la cabecera ya existe).
window.MSJUI = (() => {
  const root = document.documentElement;
  const studioKey = 'msj-studio';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduceTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const coarse = matchMedia('(pointer: coarse)');

  // ---------- MSJ Studio: diseño del cliente (local + cuenta) ----------
  const defaults = {accent: '#b08d57', surface: 'nieve', radius: 'suave', density: 'comodo', font: 'moderna', cards: 'limpia', motion: 'normal', glass: 'normal', header: 'fija', festive: true};
  const allowed = {
    surface: ['nieve', 'marfil', 'niebla', 'champan', 'pino', 'obsidiana'], radius: ['recto', 'suave', 'redondo'], density: ['comodo', 'compacto'],
    font: ['moderna', 'editorial', 'geometrica'], cards: ['limpia', 'enmarcada', 'flotante'], motion: ['normal', 'reducido'], glass: ['sutil', 'normal', 'intenso'],
    header: ['fija', 'auto']
  };
  // Debe coincidir con save_ui_theme (database/v2026.sql): estas opciones solo se guardan con membresía Privilège.
  const premium = {surface: ['champan', 'pino', 'obsidiana'], font: ['geometrica'], cards: ['flotante'], glass: ['intenso']};
  function clean(theme) {
    const result = {...defaults};
    if (theme && typeof theme === 'object') {
      if (/^#[0-9a-f]{6}$/i.test(theme.accent || '')) result.accent = theme.accent.toLowerCase();
      Object.keys(allowed).forEach(key => { if (allowed[key].includes(theme[key])) result[key] = theme[key]; });
      if (typeof theme.festive === 'boolean') result.festive = theme.festive;
    }
    return result;
  }
  function isPremium(theme) { return Object.entries(premium).some(([key, values]) => values.includes(theme[key])); }
  function read() { try { return clean(JSON.parse(localStorage.getItem(studioKey) || 'null')); } catch { return {...defaults}; } }
  function saveLocal(theme) { try { localStorage.setItem(studioKey, JSON.stringify(clean(theme))); } catch {} }
  function contrastInk(hex) {
    const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * b > .45 ? '#121211' : '#ffffff';
  }
  // Aplica el diseño al <html> (o a un contenedor, para la vista previa del Studio).
  function apply(theme, target = root, {vip = true} = {}) {
    const value = clean(theme);
    // Un cliente sin membresía no conserva opciones premium fuera de la vista previa.
    if (!vip && target === root) Object.entries(premium).forEach(([key, values]) => { if (values.includes(value[key])) value[key] = defaults[key]; });
    [...target.classList].filter(name => name.startsWith('studio-')).forEach(name => target.classList.remove(name));
    ['surface', 'radius', 'density', 'font', 'cards', 'motion', 'glass', 'header'].forEach(key => { if (value[key] !== defaults[key]) target.classList.add(`studio-${key}-${value[key]}`); });
    target.style.setProperty('--accent', value.accent);
    target.style.setProperty('--accent-ink', contrastInk(value.accent));
    target.classList.toggle('studio-festive-off', !value.festive);
    if (target === root) {
      // Obsidiana usa el modo oscuro de la tienda (el mismo del selector de tema).
      const wantsDark = value.surface === 'obsidiana';
      let current = null; try { current = localStorage.getItem('msj-theme'); } catch {}
      if (wantsDark && current !== 'dark') document.querySelector('[data-theme-option="dark"]')?.click();
      if (!wantsDark && current === 'dark' && read().surface === 'obsidiana') document.querySelector('[data-theme-option="color"]')?.click();
      document.dispatchEvent(new CustomEvent('msj:studio', {detail: value}));
    }
    return value;
  }
  apply(read(), root, {vip: true});

  // ---------- Refracción (Chromium, equipos con potencia y sin ahorro de datos) ----------
  const chromium = Boolean(navigator.userAgentData?.brands?.some(brand => /Chromium|Google Chrome|Microsoft Edge/i.test(brand.brand)));
  const strong = (navigator.hardwareConcurrency || 4) >= 6 && !navigator.connection?.saveData && (navigator.deviceMemory || 8) >= 4;
  if (chromium && strong && !reduceTransparency.matches && !coarse.matches) root.classList.add('lg-refract');
  document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true" focusable="false"><filter id="lg-refract" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves="2" seed="11" result="noise"/><feGaussianBlur in="noise" stdDeviation="2.2" result="soft"/><feDisplacementMap in="SourceGraphic" in2="soft" scale="34" xChannelSelector="R" yChannelSelector="G"/></filter></svg>');

  // ---------- Qué elementos son de vidrio ----------
  const glass = [
    ['.bottom-nav', 'lg lg-refractive'], ['.mishi-launcher', 'lg lg-dark lg-refractive'], ['.back-to-top', 'lg'], ['.fav-toggle', 'lg'],
    ['.carousel-btn', 'lg'], ['.hero-nav', 'lg lg-dark'], ['.hero-pause', 'lg lg-dark'], ['.hero-caption', 'lg lg-dark'],
    ['.studio-dock', 'lg lg-refractive'], ['.teaser-card', 'lg'], ['.season-ribbon', 'lg'], ['.dialog-close', 'lg'], ['.notif-panel', 'lg']
  ];
  function glassify(scope = document) {
    for (const [selector, classes] of glass) scope.querySelectorAll?.(selector).forEach(node => { if (!node.classList.contains('lg')) node.classList.add(...classes.split(' ')); });
  }
  glassify();
  document.querySelector('.shop-topbar')?.classList.add('lg-refractive');
  let pending = false;
  // Se ignoran los cambios de la franja superior (su cuenta regresiva cambia cada segundo).
  new MutationObserver(mutations => {
    if (pending || !mutations.some(mutation => mutation.addedNodes.length && !mutation.target.closest?.('.announcement, .promo-clock, .teaser-count'))) return;
    pending = true; requestAnimationFrame(() => { pending = false; glassify(); markReveal(); });
  })
    .observe(document.body, {childList: true, subtree: true});

  // ---------- Brillo que sigue al puntero (mouse, lápiz o dedo) ----------
  function track(node, event) {
    const box = node.getBoundingClientRect();
    if (!box.width) return;
    node.style.setProperty('--lx', `${((event.clientX - box.left) / box.width * 100).toFixed(1)}%`);
    node.style.setProperty('--ly', `${((event.clientY - box.top) / box.height * 100).toFixed(1)}%`);
  }
  let frame = 0, lastEvent = null;
  document.addEventListener('pointermove', event => {
    lastEvent = event;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const node = lastEvent.target.closest?.('.lg');
      if (node) track(node, lastEvent);
      if (pressed) stretch(lastEvent);
    });
  }, {passive: true});
  document.addEventListener('pointerover', event => { const node = event.target.closest?.('.lg'); if (node && !node.contains(event.relatedTarget)) node.classList.add('lg-hover'); }, {passive: true});
  document.addEventListener('pointerout', event => { const node = event.target.closest?.('.lg'); if (node && !node.contains(event.relatedTarget)) { node.classList.remove('lg-hover'); node.style.removeProperty('--lx'); node.style.removeProperty('--ly'); } }, {passive: true});

  // ---------- Toque: el vidrio se hunde y se estira hacia donde arrastras (efecto gelatina) ----------
  let pressed = null, startX = 0, startY = 0;
  function stretch(event) {
    if (!pressed || reduceMotion.matches) return;
    const dx = Math.max(-60, Math.min(60, event.clientX - startX)), dy = Math.max(-60, Math.min(60, event.clientY - startY));
    pressed.style.setProperty('--sx', (0.965 + Math.abs(dx) / 900 - Math.abs(dy) / 1800).toFixed(3));
    pressed.style.setProperty('--sy', (0.965 + Math.abs(dy) / 900 - Math.abs(dx) / 1800).toFixed(3));
  }
  function release() {
    if (!pressed) return;
    const node = pressed; pressed = null;
    node.classList.remove('lg-press');
    node.style.removeProperty('--sx'); node.style.removeProperty('--sy');
  }
  document.addEventListener('pointerdown', event => {
    const node = event.target.closest?.('.lg, .primary-button, .secondary-button, .size-button, .filter-chip, .icon-button');
    if (!node) return;
    pressed = node; startX = event.clientX; startY = event.clientY;
    if (node.classList.contains('lg')) { node.classList.add('lg-press'); track(node, event); }
    // Respuesta háptica breve en Android (iOS no la permite desde la web).
    if (event.pointerType === 'touch' && !reduceMotion.matches && node.classList.contains('lg')) navigator.vibrate?.(6);
  }, {passive: true});
  ['pointerup', 'pointercancel', 'dragstart'].forEach(type => document.addEventListener(type, release, {passive: true}));
  addEventListener('blur', release);

  // ---------- Cabecera de vidrio: fija siempre (por defecto) o, si el cliente lo elige en el Studio, se esconde al bajar
  // y vuelve al subir. Con menús o paneles abiertos nunca se esconde.
  const topbar = document.querySelector('.shop-topbar');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    topbar?.classList.toggle('is-scrolled', y > 8);
    const auto = root.classList.contains('studio-header-auto') && !document.body.classList.contains('panel-open') && !document.querySelector('.mega-item.open, .search-suggest:not([hidden])');
    if (!auto || y < 140) topbar?.classList.remove('header-hidden');
    else if (Math.abs(y - lastY) > 6) topbar?.classList.toggle('header-hidden', y > lastY);
    lastY = y;
  };
  addEventListener('scroll', onScroll, {passive: true});
  onScroll();

  // ---------- Animaciones de entrada (respetan «reducir movimiento») ----------
  const observer = 'IntersectionObserver' in window && !reduceMotion.matches ? new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
  }), {rootMargin: '0px 0px -8% 0px'}) : null;
  function markReveal() {
    if (!observer) return;
    document.querySelectorAll('#main > section:not(.hero), #home-rails > section, .product-rail, .collection-cards, .gift-guide, .lounge-section').forEach(node => {
      if (node.dataset.reveal) return;
      node.dataset.reveal = '1';
      const box = node.getBoundingClientRect();
      if (box.top < innerHeight) return; // lo que ya está a la vista no se anima (evita parpadeos)
      node.classList.add('reveal');
      observer.observe(node);
    });
  }
  markReveal();

  return {read, clean, apply, saveLocal, isPremium, defaults, allowed, premium, glassify};
})();
