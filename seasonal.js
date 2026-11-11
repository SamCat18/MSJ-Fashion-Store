// Temporada (Navidad MSJ) y ventana «2027 · Coming soon».
// Se controla desde el panel → Centro 2026 → Personalización (tabla store_settings: season y teaser_2027);
// sin base de datos usa los valores de config.js. Vista previa: ?season=navidad · ?teaser=1
// El cliente puede apagar la decoración en MSJ Studio («Decoración navideña»).
window.MSJSeason = (() => {
  const app = () => window.MSJApp || {};
  const data = window.MSJ_DATA;
  const params = new URLSearchParams(location.search);
  const page = document.body.dataset.page || '';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const image = (id, width) => data?.imageUrl ? data.imageUrl(id, width) : '';
  const festiveAllowed = () => window.MSJUI?.read().festive !== false;
  const inWindow = cfg => { const now = Date.now(); return (!cfg.starts_at || now >= Date.parse(cfg.starts_at)) && (!cfg.ends_at || now < Date.parse(cfg.ends_at)); };
  let snow = null;

  function countdownParts(target) {
    const ms = Math.max(0, Date.parse(target) - Date.now());
    return {days: Math.floor(ms / 864e5), hours: Math.floor(ms % 864e5 / 36e5), minutes: Math.floor(ms % 36e5 / 6e4), seconds: Math.floor(ms % 6e4 / 1e3), done: ms === 0};
  }
  const pad = value => String(value).padStart(2, '0');

  // ---------- Nieve ligera: canvas fijo, solo arriba de la página, se detiene al bajar o con la pestaña oculta ----------
  function startSnow() {
    if (snow || reduceMotion || !festiveAllowed()) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'season-snow';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    const context = canvas.getContext('2d');
    const ratio = Math.min(2, devicePixelRatio || 1);
    let width = 0, height = 0, flakes = [], frame = 0, running = true;
    const count = () => innerWidth < 700 ? 34 : 70;
    function resize() {
      width = innerWidth; height = innerHeight;
      canvas.width = width * ratio; canvas.height = height * ratio;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      flakes = Array.from({length: count()}, () => ({x: Math.random() * width, y: Math.random() * height, r: .8 + Math.random() * 2.4, s: .25 + Math.random() * .7, d: Math.random() * Math.PI * 2}));
    }
    function draw() {
      if (!running) return;
      context.clearRect(0, 0, width, height);
      context.fillStyle = document.documentElement.classList.contains('msj-dark') ? 'rgba(40,40,40,.55)' : 'rgba(255,255,255,.85)';
      for (const flake of flakes) {
        flake.y += flake.s; flake.d += .01; flake.x += Math.sin(flake.d) * .35;
        if (flake.y > height + 4) { flake.y = -4; flake.x = Math.random() * width; }
        context.beginPath(); context.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2); context.fill();
      }
      frame = requestAnimationFrame(draw);
    }
    function sync() {
      const visible = !document.hidden && scrollY < innerHeight * 1.3 && festiveAllowed();
      canvas.style.opacity = visible ? '1' : '0';
      if (visible && !running) { running = true; draw(); }
      if (!visible && running) { running = false; cancelAnimationFrame(frame); }
    }
    resize(); draw();
    addEventListener('resize', resize, {passive: true});
    addEventListener('scroll', sync, {passive: true});
    document.addEventListener('visibilitychange', sync);
    snow = {canvas, stop() { running = false; cancelAnimationFrame(frame); canvas.remove(); snow = null; }};
  }

  // ---------- Portada navideña + guía de regalos ----------
  function seasonHero(cfg) {
    const anchor = document.getElementById('season-hero-slot') || document.getElementById('home-promo-calendar');
    if (!anchor || document.getElementById('season-hero')) return;
    const christmas = `${new Date().getFullYear()}-12-25T00:00:00-05:00`;
    anchor.insertAdjacentHTML('beforebegin', `<section class="season-hero" id="season-hero" aria-labelledby="season-title">
      <img src="${image('1513297887119-d46091b24bfa', 1600)}" alt="" loading="lazy">
      <div class="season-copy"><p class="eyebrow">TEMPORADA ${new Date().getFullYear()}</p><h2 id="season-title">${escape(cfg.headline || 'Navidad MSJ')}</h2><p>${escape(cfg.subline || '')}</p>
        <div class="season-count lg lg-dark" data-season-count="${christmas}" aria-label="Cuenta regresiva para Navidad"></div>
        <div class="season-ctas"><a class="hero-link" href="#gift-guide">Guía de regalos</a><button type="button" class="season-teaser-chip lg" data-open-teaser>2027 · Coming soon →</button></div>
        ${cfg.gift_wrap ? '<span class="season-wrap">🎁 Envolvemos gratis cada pedido de diciembre</span>' : ''}</div>
    </section>`);
    tickCounts();
  }
  const giftTabs = [
    ['ella', 'Para ella', product => product.audience === 'Mujer' || (product.audience === 'Unisex' && ['perfumes', 'joyeria', 'bolsos'].includes(product.category_slug))],
    ['el', 'Para él', product => product.audience === 'Hombre' || (product.audience === 'Unisex' && ['relojes', 'lentes', 'mochilas'].includes(product.category_slug))],
    ['100', 'Menos de S/ 100', product => (app().memberPrice ? app().memberPrice(product) : product.price) < 100],
    ['premium', 'Detalles premium', product => (app().memberPrice ? app().memberPrice(product) : product.price) >= 199 || ['perfumes', 'relojes', 'joyeria'].includes(product.category_slug)]
  ];
  let giftTab = 'ella';
  function giftGuide() {
    const anchor = document.getElementById('gift-guide-slot') || document.getElementById('home-rails');
    if (!anchor || !app().visibleProducts || !app().productCard) return;
    let node = document.getElementById('gift-guide');
    if (!node) {
      anchor.insertAdjacentHTML('beforebegin', `<section class="gift-guide home-section" id="gift-guide" aria-labelledby="gift-title"><div class="gift-head"><div><p class="eyebrow">🎄 NAVIDAD MSJ</p><h2 id="gift-title">Guía de regalos</h2><p>Ideas elegidas por M.I.S.H.I. según a quién quieras sorprender.</p></div><div class="gift-tabs" role="tablist">${giftTabs.map(([key, label]) => `<button type="button" role="tab" data-gift-tab="${key}">${label}</button>`).join('')}</div></div><div class="gift-layout"><a class="gift-feature" href="tienda.html?q=regalo"><img src="${image('1607344645866-009c320b63e0', 900)}" alt="Regalos envueltos en negro con lazo dorado" loading="lazy"><span class="lg lg-dark"><small>Envoltura MSJ</small><strong>Regala elegancia</strong></span></a><div class="product-grid gift-grid" id="gift-grid"></div></div><button type="button" class="secondary-button gift-mishi" data-mishi-ask="Ideas de regalo de Navidad por menos de S/ 150">✦ Pídele ideas a M.I.S.H.I.</button></section>`);
      node = document.getElementById('gift-guide');
    }
    const [, , filter] = giftTabs.find(([key]) => key === giftTab) || giftTabs[0];
    const products = app().visibleProducts().filter(product => product.purchasable !== false && !product.vip_only).filter(filter)
      .sort((a, b) => Number(Boolean(b.is_new)) - Number(Boolean(a.is_new)) || Number(b.discount_percent || 0) - Number(a.discount_percent || 0)).slice(0, 8);
    node.querySelector('#gift-grid').innerHTML = products.map(app().productCard).join('');
    node.querySelectorAll('[data-gift-tab]').forEach(button => { const on = button.dataset.giftTab === giftTab; button.classList.toggle('active', on); button.setAttribute('aria-selected', String(on)); });
  }

  // ---------- Guirnalda de luces bajo la cabecera ----------
  function lights() {
    if (document.querySelector('.season-lights') || !festiveAllowed()) return;
    const header = document.querySelector('.shop-topbar');
    if (!header) return;
    const colors = ['#e63946', '#f4d35e', '#2a9d8f', '#f1faee', '#e76f51'];
    header.insertAdjacentHTML('beforeend', `<div class="season-lights" aria-hidden="true">${Array.from({length: 42}, (_, index) => `<i style="--c:${colors[index % colors.length]};--d:${(index % 7) * .35}s"></i>`).join('')}</div>`);
  }

  // ---------- Ventana «2027 · Coming soon» ----------
  function teaser(cfg, force = false) {
    if (!cfg?.enabled && !force) return;
    if (cfg.launch_at && Date.now() > Date.parse(cfg.launch_at) && !force) return;
    if (document.getElementById('teaser-2027')) return;
    const key = 'msj-teaser-2027';
    if (!force) {
      try {
        const last = localStorage.getItem(key);
        const today = new Date().toISOString().slice(0, 10);
        if (cfg.frequency === 'once' ? last : last === today) return;
        if (sessionStorage.getItem(key)) return;
      } catch {}
    }
    const open = () => {
      if (!force && (!document.getElementById('dialog')?.hidden || document.body.classList.contains('studio-open') || document.body.classList.contains('mishi-active'))) return;
      try { localStorage.setItem(key, new Date().toISOString().slice(0, 10)); sessionStorage.setItem(key, '1'); } catch {}
      document.body.insertAdjacentHTML('beforeend', `<div class="teaser-backdrop" id="teaser-backdrop"></div><section class="teaser-2027" id="teaser-2027" role="dialog" aria-modal="true" aria-labelledby="teaser-title">
        <div class="teaser-orbs" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="teaser-card lg">
          <button type="button" class="teaser-close dialog-close" data-teaser-close aria-label="Cerrar">×</button>
          <p class="eyebrow">MSJ FASHION STORE</p>
          <h2 id="teaser-title"><span>2027</span> ${escape((cfg.title || 'Coming soon').replace(/^2027\s*·?\s*/i, ''))}</h2>
          <p class="teaser-sub">${escape(cfg.subtitle || '')}</p>
          <div class="teaser-count" data-season-count="${escape(cfg.launch_at || '2027-01-01T00:00:00-05:00')}" data-count-style="blocks"></div>
          <form class="teaser-form" id="teaser-form"><input type="email" name="email" required maxlength="160" placeholder="Tu correo" aria-label="Tu correo" autocomplete="email"><button class="primary-button">${escape(cfg.cta || 'Avísame primero')}</button><label class="consent-check"><input type="checkbox" name="consent" required> <span>Acepto recibir correos de MSJ y la <a href="legal.html#privacidad">política de privacidad</a>.</span></label><p class="form-message" id="teaser-message" role="status"></p></form>
          <p class="teaser-note">Acceso anticipado para socios <strong>✦ Privilège</strong> y suscriptores.</p>
        </div></section>`);
      tickCounts();
      requestAnimationFrame(() => { document.getElementById('teaser-2027')?.classList.add('open'); document.getElementById('teaser-backdrop')?.classList.add('open'); });
      document.querySelector('#teaser-2027 input[type=email]')?.focus({preventScroll: true});
      window.MSJUI?.glassify();
    };
    if (force) open(); else setTimeout(open, page === 'home' ? 6500 : 12000);
  }
  function closeTeaser() {
    const node = document.getElementById('teaser-2027'), back = document.getElementById('teaser-backdrop');
    if (!node) return;
    node.classList.remove('open'); back?.classList.remove('open');
    setTimeout(() => { node.remove(); back?.remove(); }, 320);
  }
  async function subscribeTeaser(form) {
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim().toLowerCase();
    const message = document.getElementById('teaser-message');
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) { message.textContent = 'Escribe un correo válido.'; return; }
    if (!values.get('consent')) { message.textContent = 'Marca la casilla de consentimiento.'; return; }
    const client = app().client;
    if (!client) { message.textContent = '¡Listo! Te avisaremos (modo demostración).'; return; }
    const {error} = await client.from('newsletter_subscribers').insert({email, source: 'teaser-2027', consent: true});
    message.textContent = !error || /duplicate|unique/i.test(error.message) ? '¡Listo! Serás de los primeros en ver la colección 2027 ✦' : 'No pudimos guardarte ahora. Inténtalo más tarde.';
    if (!error || /duplicate|unique/i.test(error.message)) setTimeout(closeTeaser, 2200);
  }

  // ---------- Cuentas regresivas (portada y teaser) ----------
  let countTimer = 0;
  function tickCounts() {
    clearInterval(countTimer);
    const paint = () => {
      const nodes = document.querySelectorAll('[data-season-count]');
      if (!nodes.length) { clearInterval(countTimer); return; }
      nodes.forEach(node => {
        const parts = countdownParts(node.dataset.seasonCount);
        node.innerHTML = node.dataset.countStyle === 'blocks'
          ? [['días', parts.days], ['horas', parts.hours], ['min', parts.minutes], ['seg', parts.seconds]].map(([label, value]) => `<span><b>${label === 'días' ? value : pad(value)}</b><small>${label}</small></span>`).join('')
          : parts.done ? '¡Feliz Navidad! 🎄' : `<b>${parts.days}</b> días · <b>${pad(parts.hours)}</b> h · <b>${pad(parts.minutes)}</b> min <small>para Navidad</small>`;
      });
    };
    paint();
    countTimer = setInterval(paint, 1000);
  }

  // ---------- Cada evento viste la tienda (color de acento + franja + detalles) ----------
  // Si el cliente eligió su propio color en MSJ Studio, se respeta el suyo; si no, la tienda toma el del evento.
  const eventSkins = {
    'NAVIDAD': {className: 'event-navidad', accent: '#9f1239', label: '🎄 Navidad MSJ'},
    'BLACK-FRIDAY': {className: 'event-black-friday', accent: '#121211', label: '◐ Black & White Friday'},
    'FIESTAS-PATRIAS': {className: 'event-fiestas-patrias', accent: '#c8102e', label: '🇵🇪 Felices Fiestas Patrias'},
    'DIA-MADRE': {className: 'event-dia-madre', accent: '#be185d', label: '💐 Mes de mamá'},
    'SEMANA-CRIOLLA': {className: 'event-semana-criolla', accent: '#6b21a8', label: '🎶 Semana Criolla'},
    'CHRISTMAS-SEASON': {className: 'event-navidad-season', accent: '#9f1239', label: '🎄 Temporada navideña'}
  };
  function applyEventSkin(christmas) {
    const root = document.documentElement;
    Object.values(eventSkins).forEach(skin => root.classList.remove(skin.className));
    const active = window.MSJCampaigns?.active;
    const skin = eventSkins[active?.code] || (christmas ? eventSkins['CHRISTMAS-SEASON'] : null);
    const studio = window.MSJUI?.read() || {};
    const customAccent = studio.accent && studio.accent !== window.MSJUI?.defaults.accent;
    if (!skin || studio.festive === false) { if (!customAccent) root.style.setProperty('--accent', studio.accent || '#b08d57'); return; }
    root.classList.add(skin.className);
    if (!customAccent) root.style.setProperty('--accent', skin.accent);
    root.dataset.event = skin.label;
  }

  // ---------- Arranque ----------
  let christmasActive = false;
  async function init() {
    const settings = await (window.MSJSettings?.load() || Promise.resolve({}));
    const season = settings.season || {};
    const forcedSeason = /navidad|christmas/i.test(params.get('season') || '') || page === 'season';
    const christmas = forcedSeason || (season.enabled !== false && season.mode === 'christmas' && inWindow(season));
    document.documentElement.classList.toggle('season-christmas', christmas && festiveAllowed());
    christmasActive = christmas;
    applyEventSkin(christmas);
    if (christmas) {
      if (season.lights !== false) lights();
      if (season.snow !== false) startSnow();
      if (page === 'home' || page === 'season') { seasonHero(season); giftGuide(); }
      const chips = document.getElementById('mishi-chips');
      if (chips && !chips.querySelector('[data-season-chip]')) chips.insertAdjacentHTML('afterbegin', '<button type="button" data-season-chip data-mishi-chip="Ideas de regalo de Navidad por menos de S/ 150">🎄 Regalos de Navidad</button>');
    }
    // Mensaje propio de la franja superior (solo si no hay una campaña con cuenta regresiva en curso).
    const announcement = settings.announcement || {};
    if (announcement.enabled && announcement.text && !window.MSJCampaigns?.active) {
      const bar = document.querySelector('.announcement');
      if (bar) bar.textContent = announcement.text;
    }
    teaser(settings.teaser_2027 || {}, params.get('teaser') === '1');
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-gift-tab]');
    if (tab) { giftTab = tab.dataset.giftTab; giftGuide(); return; }
    if (event.target.closest('[data-open-teaser]')) { window.MSJSettings?.load().then(settings => teaser({...(settings.teaser_2027 || {}), enabled: true}, true)); return; }
    if (event.target.closest('[data-teaser-close]') || event.target.id === 'teaser-backdrop') closeTeaser();
  });
  document.addEventListener('submit', event => { if (event.target.id === 'teaser-form') { event.preventDefault(); subscribeTeaser(event.target); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeTeaser(); });
  // Los productos reales llegan después: se repinta la guía de regalos con el catálogo de Supabase.
  document.addEventListener('msj:catalog', () => { if (document.getElementById('gift-guide')) giftGuide(); });
  document.addEventListener('msj:vip', () => { if (document.getElementById('gift-guide')) giftGuide(); });
  document.addEventListener('msj:studio', event => {
    const on = event.detail?.festive !== false;
    if (!on) { snow?.stop(); document.querySelector('.season-lights')?.remove(); document.documentElement.classList.remove('season-christmas'); }
    applyEventSkin(christmasActive);
  });
  document.addEventListener('msj:promo', () => applyEventSkin(christmasActive));
  init();
  return {teaser, closeTeaser, startSnow};
})();
