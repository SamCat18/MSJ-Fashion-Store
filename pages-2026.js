// Páginas exclusivas 2026: studio.html (MSJ Studio, logros y niveles), navidad.html (temporada y regalos)
// y vip.html (MSJ Privilège Club). Se apoyan en app.js, engage.js y seasonal.js; aquí solo se arma su contenido.
(() => {
  const page = document.body.dataset.page || '';
  const app = () => window.MSJApp || {};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const price = product => app().memberPrice ? app().memberPrice(product) : Number(product.price);
  const buyable = () => (app().visibleProducts?.() || []).filter(product => product.purchasable !== false && !product.vip_only);

  // ---------- studio.html ----------
  function renderStudio() {
    const engage = window.MSJEngage;
    const progress = document.getElementById('studio-progress');
    if (progress && engage?.achievementsMarkup) progress.innerHTML = engage.achievementsMarkup();
  }

  // ---------- navidad.html ----------
  function renderSeason() {
    const node = document.getElementById('season-budgets');
    if (!node || !app().productCard) return;
    const bands = [['Detalles hasta S/ 50', 0, 50], ['De S/ 50 a S/ 100', 50, 100], ['De S/ 100 a S/ 200', 100, 200], ['Regalos premium', 200, Infinity]];
    const products = buyable();
    node.innerHTML = bands.map(([title, min, max]) => {
      const list = products.filter(product => price(product) > min && price(product) <= max)
        .sort((a, b) => Number(Boolean(b.is_new)) - Number(Boolean(a.is_new)) || Number(b.discount_percent || 0) - Number(a.discount_percent || 0)).slice(0, 8);
      return list.length ? app().railMarkup(title, list, `tienda.html?q=regalo`, 'AMIGO SECRETO E INTERCAMBIOS') : '';
    }).join('');
    app().initCarousels?.();
    const calendar = document.getElementById('season-calendar');
    const promos = (window.MSJCampaigns?.calendar || []).filter(promo => Date.parse(promo.ends_at) > Date.now()).slice(0, 4);
    const day = value => new Intl.DateTimeFormat('es-PE', {day: 'numeric', month: 'short'}).format(new Date(value));
    if (calendar) calendar.innerHTML = promos.map(promo => `<article class="season-promo lg"><small>${escape(day(promo.starts_at))} – ${escape(day(Date.parse(promo.ends_at) - 864e5))}</small><strong>${escape(promo.name)}</strong><span>${escape(promo.tagline)}</span><a href="?promo=${encodeURIComponent(promo.code)}">Ver vista previa →</a></article>`).join('') || '<p class="c26-empty">Pronto anunciamos nuevas fechas.</p>';
  }

  // ---------- vip.html ----------
  function renderVip() {
    const club = document.getElementById('vip-page-club');
    if (club && app().vipClubMarkup) club.innerHTML = app().vipClubMarkup('home');
    const lounge = document.getElementById('vip-lounge');
    if (lounge && app().renderLounge) app().renderLounge(lounge);
    const compare = document.getElementById('vip-compare');
    const levels = app().vipLevels;
    if (compare && levels) {
      const rows = [
        ['Descuento en toda la tienda', '—', `${levels.gold.pct} %`, `${levels.black.pct} %`],
        ['Envío gratis', 'Según tu zona', 'Lima y Callao', 'Todo el Perú'],
        ['Puntos MSJ por compra', 'x1', 'x1.5', 'x2'],
        ['MSJ Studio: fondos, letras y Liquid Glass premium', 'Básico', '✓', '✓'],
        ['Catálogo secreto y Early Access', '—', '✓', '✓'],
        ['Cupón de regalo mensual', '—', 'S/ 15', 'S/ 30'],
        ['Concierge M.I.S.H.I. prioritario', '—', '—', '✓'],
        ['Precio', 'Gratis', `S/ ${levels.gold.mensual} al mes`, `S/ ${levels.black.mensual} al mes`]
      ];
      compare.innerHTML = `<table><thead><tr><th>Beneficio</th><th>Cuenta MSJ</th><th>Gold Pass</th><th>Black Sovereign</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, index) => index ? `<td>${escape(cell)}</td>` : `<th scope="row">${escape(cell)}</th>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td></td><td><button type="button" class="secondary-button" data-open-studio="logros">Ver mis logros</button></td><td><button type="button" class="primary-button" data-vip-join="gold">Unirme a Gold</button></td><td><button type="button" class="primary-button" data-vip-join="black">Unirme a Black</button></td></tr></tfoot></table>`;
    }
  }

  const render = () => { if (page === 'studio') renderStudio(); if (page === 'season') renderSeason(); if (page === 'vip') renderVip(); };
  ['msj:catalog', 'msj:vip', 'msj:session', 'msj:engagement'].forEach(name => document.addEventListener(name, () => setTimeout(render, 50)));
  document.addEventListener('msj:studio', () => { if (page === 'studio') setTimeout(renderStudio, 50); });
  render();
  setTimeout(render, 1200);
})();
