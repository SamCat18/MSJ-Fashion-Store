// Explorador de categorías y búsqueda a pantalla completa (estilo marketplace 2026).
// - «Categorías» (cabecera, menú y barra inferior del celular): departamentos a la izquierda y círculos con foto a la
//   derecha, con etiquetas HOT (ofertas), NUEVO y el % de descuento más alto.
// - «Buscar» (barra inferior del celular o el botón 🔎): resultados en vivo con MSJ Search, recientes y tendencias.
window.MSJExplorer = (() => {
  const data = window.MSJ_DATA;
  if (!data) return {};
  const app = () => window.MSJApp || {};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const image = (id, width = 240) => data.imageUrl ? data.imageUrl(id, width) : '';
  const products = () => app().visibleProducts?.() || [];
  const departments = [
    {key: 'destacado', label: 'Destacado', icon: '✦'},
    {key: 'mujer', label: 'Mujer', href: 'mujer.html', audience: 'Mujer'},
    {key: 'hombre', label: 'Hombre', href: 'hombre.html', audience: 'Hombre'},
    {key: 'calzado', label: 'Calzado', href: 'calzado.html', department: 'calzado'},
    {key: 'accesorios', label: 'Accesorios', href: 'accesorios.html', department: 'accesorios'},
    {key: 'perfumes', label: 'Perfumes', href: 'perfumes.html', department: 'perfumes'},
    {key: 'colecciones', label: 'Colecciones', href: 'colecciones.html'},
    {key: 'navidad', label: 'Navidad 🎄', href: 'navidad.html'},
    {key: 'ofertas', label: 'Ofertas', href: 'ofertas.html'},
    {key: 'novedades', label: 'Novedades', href: 'novedades.html'}
  ];
  let current = 'destacado', mode = 'categories', lastFocus = null;

  // Etiqueta de cada categoría según el catálogo en vivo: mayor descuento, novedades o más vendidos.
  function stats(filter = () => true) {
    const map = new Map();
    products().filter(filter).forEach(product => {
      const entry = map.get(product.category_slug) || {count: 0, maxOff: 0, fresh: 0};
      entry.count++; entry.maxOff = Math.max(entry.maxOff, Number(product.discount_percent) || 0); if (product.is_new) entry.fresh++;
      map.set(product.category_slug, entry);
    });
    return map;
  }
  const badge = entry => !entry ? '' : entry.maxOff >= 15 ? `<b class="cx-badge hot">-${entry.maxOff}%</b>` : entry.maxOff > 0 ? '<b class="cx-badge hot">HOT</b>' : entry.fresh ? '<b class="cx-badge new">NUEVO</b>' : '';
  const circle = (href, img, label, extra = '') => `<a class="cx-circle" href="${escape(href)}"><span class="cx-img">${img ? `<img src="${escape(img)}" alt="" loading="lazy">` : ''}${extra}</span><span class="cx-name">${escape(label)}</span></a>`;

  function grid(key) {
    const dept = departments.find(item => item.key === key) || departments[0];
    const categories = data.categories;
    if (key === 'colecciones') return {title: 'Todas las colecciones', href: 'colecciones.html', html: data.collections.map(collection => circle(`tienda.html?col=${collection.slug}`, image(collection.image), collection.name)).join('')};
    if (key === 'navidad') return {title: 'Regalos de Navidad', href: 'navidad.html', html: [['perfumes', 'Perfumes'], ['joyeria', 'Joyería'], ['relojes', 'Relojes'], ['bolsos', 'Bolsos'], ['chompas', 'Chompas'], ['lentes', 'Lentes']].map(([slug, label]) => { const category = categories.find(item => item.slug === slug); return circle(`tienda.html?c=${slug}&q=regalo`, image(category?.image), label, '<b class="cx-badge xmas">🎁</b>'); }).join('') + circle('navidad.html', image('1607344645866-009c320b63e0'), 'Guía de regalos', '<b class="cx-badge hot">HOT</b>')};
    if (key === 'destacado') {
      const info = stats();
      const ranked = [...info.entries()].sort((a, b) => (b[1].maxOff + b[1].fresh * 5) - (a[1].maxOff + a[1].fresh * 5)).slice(0, 15).map(([slug]) => slug);
      const list = (ranked.length ? ranked : categories.map(category => category.slug)).map(slug => categories.find(category => category.slug === slug)).filter(Boolean);
      return {title: 'Lo más buscado ahora', href: 'tienda.html', html: list.map(category => circle(`tienda.html?c=${category.slug}`, image(category.image), category.name, badge(info.get(category.slug)))).join('')};
    }
    if (key === 'ofertas' || key === 'novedades') {
      const filter = key === 'ofertas' ? product => Number(product.discount_percent) > 0 : product => product.is_new;
      const info = stats(filter);
      const list = categories.filter(category => info.has(category.slug));
      return {title: key === 'ofertas' ? 'Ofertas por categoría' : 'Novedades por categoría', href: dept.href, html: list.map(category => circle(`${dept.href}?c=${category.slug}`, image(category.image), category.name, badge(info.get(category.slug)))).join('') || '<p class="cx-empty">Pronto habrá más.</p>'};
    }
    const filter = dept.audience ? product => product.audience === dept.audience || product.audience === 'Unisex' : product => product.department === dept.department;
    const info = stats(filter);
    // Todas las categorías del departamento (las del megamenú) aunque hoy no tengan stock, más las que sí tienen productos.
    const menu = window.MSJLayout?.menus?.find(item => item.key === key);
    const menuSlugs = new Set((menu?.columns || []).flatMap(([, items]) => items).filter(item => typeof item === 'string'));
    const list = categories.filter(category => info.has(category.slug) || menuSlugs.has(category.slug) || (dept.department && category.department === dept.department));
    return {title: `Todo ${dept.label}`, href: dept.href, html: list.map(category => circle(`${dept.href}?c=${category.slug}`, image(category.image), category.name, badge(info.get(category.slug)))).join('')};
  }

  // ---------- Panel ----------
  document.body.insertAdjacentHTML('beforeend', '<div class="cx-backdrop" id="cx-backdrop" hidden></div><section class="cx-panel" id="cx-panel" role="dialog" aria-modal="true" aria-label="Explorar categorías" hidden></section>');
  const panel = document.getElementById('cx-panel');
  const backdrop = document.getElementById('cx-backdrop');

  function render() {
    if (mode === 'search') return renderSearch();
    const view = grid(current);
    panel.innerHTML = `<header class="cx-head"><div class="cx-search-mini"><button type="button" class="cx-search-open" data-cx-mode="search">🔎 Busca productos, marcas y más</button></div><button type="button" class="dialog-close" data-cx-close aria-label="Cerrar">×</button></header>
      <div class="cx-body"><nav class="cx-rail" aria-label="Departamentos">${departments.map(dept => `<button type="button" data-cx-dept="${dept.key}" class="${dept.key === current ? 'active' : ''}" aria-current="${dept.key === current}">${escape(dept.label)}<span aria-hidden="true">›</span></button>`).join('')}</nav>
      <div class="cx-content"><a class="cx-title" href="${escape(view.href)}">${escape(view.title)} <span aria-hidden="true">↗</span></a><div class="cx-grid">${view.html}</div></div></div>`;
  }
  const trending = ['Casacas', 'Perfume dulce', 'Zapatillas blancas', 'Regalos de Navidad', 'Vestidos de fiesta', 'Relojes'];
  function renderSearch(query = '') {
    const recent = (() => { try { return JSON.parse(localStorage.getItem('msj-recent-searches') || '[]').slice(0, 6); } catch { return []; } })();
    panel.innerHTML = `<header class="cx-head"><button type="button" class="cx-back" data-cx-mode="categories" aria-label="Volver a categorías">‹</button><form class="cx-search-form" id="cx-search-form" role="search"><input id="cx-search-input" type="search" placeholder="¿Qué buscas hoy?" value="${escape(query)}" autocomplete="off" aria-label="Buscar en MSJ"><button aria-label="Buscar">🔎</button></form><button type="button" class="dialog-close" data-cx-close aria-label="Cerrar">×</button></header>
      <div class="cx-search-body" id="cx-search-body">${recent.length ? `<h3>Recientes</h3><div class="cx-chips">${recent.map(item => `<button type="button" data-cx-query="${escape(item)}">↺ ${escape(item)}</button>`).join('')}</div>` : ''}<h3>Tendencias</h3><div class="cx-chips">${trending.map(item => `<button type="button" data-cx-query="${escape(item)}">${escape(item)}</button>`).join('')}</div><h3>Categorías</h3><div class="cx-grid small">${grid('destacado').html}</div></div>`;
    const input = document.getElementById('cx-search-input');
    input.focus();
    if (query) results(query);
  }
  let timer = 0;
  function results(query) {
    const body = document.getElementById('cx-search-body');
    if (!body || !window.MSJSearch) return;
    const text = query.trim();
    if (text.length < 2) { renderSearch(text); return; }
    const hits = window.MSJSearch.search(text, {products: products(), limit: 24}).map(hit => hit.product);
    const suggestion = hits.length ? '' : window.MSJSearch.didYouMean(text, products());
    body.innerHTML = hits.length
      ? `<p class="cx-count">${hits.length} resultado${hits.length === 1 ? '' : 's'} para «${escape(text)}» · <a href="tienda.html?q=${encodeURIComponent(text)}">ver con filtros →</a></p><div class="product-grid cx-results">${hits.map(app().productCard).join('')}</div>`
      : `<div class="cx-empty"><p>No encontramos «${escape(text)}».</p>${suggestion ? `<button type="button" class="secondary-button" data-cx-query="${escape(suggestion)}">¿Quisiste decir «${escape(suggestion)}»?</button>` : ''}<button type="button" class="secondary-button" data-mishi-ask="${escape(text)}">✦ Pregúntale a M.I.S.H.I.</button></div>`;
  }

  function open(nextMode = 'categories', department = null) {
    mode = nextMode;
    if (department) current = department;
    lastFocus = document.activeElement;
    window.MSJLayout?.closeMenu?.();
    panel.hidden = false; backdrop.hidden = false;
    render();
    requestAnimationFrame(() => { panel.classList.add('open'); backdrop.classList.add('open'); });
    document.body.classList.add('cx-open');
    if (mode === 'categories') panel.querySelector('.cx-rail .active')?.focus({preventScroll: true});
  }
  function close() {
    if (panel.hidden) return;
    panel.classList.remove('open'); backdrop.classList.remove('open');
    document.body.classList.remove('cx-open');
    setTimeout(() => { panel.hidden = true; backdrop.hidden = true; }, 260);
    lastFocus?.focus?.({preventScroll: true});
  }

  // Botón «Categorías» en la cabecera (escritorio) y atajos.
  const navList = document.querySelector('.mega-nav ul');
  if (navList && !document.getElementById('cx-nav-button')) navList.insertAdjacentHTML('afterbegin', '<li class="mega-item cx-nav-item"><button type="button" class="mega-link cx-nav-button" id="cx-nav-button" aria-haspopup="dialog">☰ Categorías</button></li>');

  // Captura: se adelanta al menú clásico de la barra inferior para abrir el explorador.
  document.addEventListener('click', event => {
    const bottom = event.target.closest?.('[data-bottom="menu"], [data-bottom="search"]');
    if (bottom) { event.preventDefault(); event.stopPropagation(); open(bottom.dataset.bottom === 'search' ? 'search' : 'categories'); }
  }, true);
  document.addEventListener('click', event => {
    const target = event.target;
    if (target.closest('#cx-nav-button') || target.closest('[data-open-explorer]')) { open('categories', target.closest('[data-open-explorer]')?.dataset.openExplorer || null); return; }
    if (target === backdrop || target.closest('[data-cx-close]')) { close(); return; }
    if (!panel.contains(target)) return;
    const dept = target.closest('[data-cx-dept]');
    if (dept) { current = dept.dataset.cxDept; render(); panel.querySelector(`[data-cx-dept="${current}"]`)?.focus({preventScroll: true}); return; }
    const switcher = target.closest('[data-cx-mode]');
    if (switcher) { mode = switcher.dataset.cxMode; render(); return; }
    const query = target.closest('[data-cx-query]');
    if (query) { const input = document.getElementById('cx-search-input'); if (input) { input.value = query.dataset.cxQuery; results(input.value); window.MSJSearch?.remember(input.value); } return; }
    if (target.closest('[data-product]') || target.closest('a[href]') || target.closest('[data-mishi-ask]')) setTimeout(close, 0);
  });
  // En escritorio, pasar el mouse por los departamentos cambia la vista (como en los marketplaces).
  panel.addEventListener('pointerover', event => {
    const dept = event.target.closest?.('[data-cx-dept]');
    if (!dept || event.pointerType !== 'mouse' || dept.dataset.cxDept === current) return;
    current = dept.dataset.cxDept;
    const view = grid(current);
    panel.querySelectorAll('[data-cx-dept]').forEach(button => { const on = button.dataset.cxDept === current; button.classList.toggle('active', on); button.setAttribute('aria-current', String(on)); });
    panel.querySelector('.cx-title').outerHTML = `<a class="cx-title" href="${escape(view.href)}">${escape(view.title)} <span aria-hidden="true">↗</span></a>`;
    panel.querySelector('.cx-grid').innerHTML = view.html;
  });
  panel.addEventListener('input', event => { if (event.target.id === 'cx-search-input') { clearTimeout(timer); timer = setTimeout(() => results(event.target.value), 120); } });
  panel.addEventListener('submit', event => {
    if (event.target.id !== 'cx-search-form') return;
    event.preventDefault();
    const value = document.getElementById('cx-search-input').value.trim();
    if (!value) return;
    window.MSJSearch?.remember(value);
    window.MSJSearch?.log(value, window.MSJSearch.search(value, {limit: 60}).length);
    location.href = `tienda.html?q=${encodeURIComponent(value)}`;
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { close(); } if (event.key === 'Escape') closeChipMenu(); });

  // ---------- Barra de filtros en cápsulas sobre los resultados (catálogo y búsqueda) ----------
  const params = new URLSearchParams(location.search);
  const sorts = [['featured', params.get('q') ? 'Relevancia' : 'Destacados'], ['newest', 'Lo nuevo'], ['discount', 'Mayor descuento'], ['price-asc', 'Precio: menor a mayor'], ['price-desc', 'Precio: mayor a menor'], ['rating', 'Mejor valorados']];
  const colors = [['negro', '#121211'], ['blanco', '#f5f5f4'], ['azul', '#1d4ed8'], ['rojo', '#b91c1c'], ['beige', '#d6c3a5'], ['marron', '#7c4a2d'], ['verde', '#166534'], ['rosa', '#f472b6'], ['gris', '#9ca3af']];
  const chipMenus = {
    para: {label: 'Para', param: 'a', options: [['', 'Todos'], ['Mujer', 'Mujer'], ['Hombre', 'Hombre'], ['Unisex', 'Unisex']]},
    ocasion: {label: 'Ocasión', param: 'col', options: [['', 'Todas'], ...data.collections.map(collection => [collection.slug, collection.name])]},
    precio: {label: 'Precio', param: 'max', options: [['', 'Cualquier precio'], ['50', 'Hasta S/ 50'], ['100', 'Hasta S/ 100'], ['200', 'Hasta S/ 200'], ['300', 'Hasta S/ 300']]},
    marca: {label: 'Marca', param: 'b', options: [['', 'Todas'], ...data.brands.map(brand => [brand.slug, brand.name])]},
    color: {label: 'Color', param: 'q', options: [['', 'Todos'], ...colors.map(([name]) => [name, name[0].toUpperCase() + name.slice(1)])]}
  };
  function chipLabel(key) {
    const menu = chipMenus[key];
    const value = key === 'color' ? colors.map(([name]) => name).find(name => (params.get('q') || '').toLowerCase().split(/\s+/).includes(name)) || '' : params.get(menu.param) || '';
    const option = menu.options.find(([optionValue]) => optionValue === value);
    return value && option ? `${menu.label}: ${option[1]}` : menu.label;
  }
  function chipBar() {
    if (document.body.dataset.page !== 'catalog' || document.getElementById('catalog-chips')) return;
    const toolbar = document.querySelector('.catalog-toolbar');
    if (!toolbar) return;
    const sort = document.getElementById('sort-select')?.value || params.get('sort') || 'featured';
    toolbar.insertAdjacentHTML('afterend', `<div class="catalog-chips" id="catalog-chips" role="toolbar" aria-label="Filtros rápidos">
      <button type="button" class="cc-chip" data-cc="filtros">⚙ Filtros</button>
      <button type="button" class="cc-chip strong" data-cc="ordenar" aria-haspopup="menu">Ordenar por: ${escape((sorts.find(([value]) => value === sort) || sorts[0])[1])} ▾</button>
      ${Object.keys(chipMenus).map(key => `<button type="button" class="cc-chip${chipLabel(key) !== chipMenus[key].label ? ' on' : ''}" data-cc="${key}" aria-haspopup="menu">${escape(chipLabel(key))} ▾</button>`).join('')}
      <a class="cc-chip festive" href="navidad.html">🎄 Día festivo</a>
      ${['a', 'col', 'max', 'b', 'q', 'c'].some(key => params.get(key)) ? '<a class="cc-chip clear" href="tienda.html">✕ Limpiar</a>' : ''}
    </div>`);
  }
  let chipMenu = null;
  function closeChipMenu() { chipMenu?.remove(); chipMenu = null; }
  function openChipMenu(chip) {
    closeChipMenu();
    const key = chip.dataset.cc;
    let items;
    if (key === 'ordenar') {
      const sort = document.getElementById('sort-select')?.value || 'featured';
      items = sorts.map(([value, label]) => `<button type="button" role="menuitemradio" aria-checked="${value === sort}" data-cc-sort="${value}">${escape(label)}</button>`).join('');
    } else {
      const menu = chipMenus[key];
      items = menu.options.map(([value, label]) => `<button type="button" role="menuitemradio" data-cc-key="${key}" data-cc-value="${escape(value)}">${key === 'color' && value ? `<i class="cc-dot" style="background:${colors.find(([name]) => name === value)[1]}"></i>` : ''}${escape(label)}</button>`).join('');
    }
    // Menú flotante fuera de la barra (la barra se desplaza en horizontal y recortaría el menú).
    document.body.insertAdjacentHTML('beforeend', `<div class="cc-menu lg" role="menu" data-for="${escape(key)}">${items}</div>`);
    chipMenu = document.body.lastElementChild;
    const box = chip.getBoundingClientRect();
    chipMenu.style.left = `${Math.max(8, Math.min(box.left, innerWidth - 248))}px`;
    chipMenu.style.top = `${box.bottom + 8}px`;
    chipMenu.querySelector('button')?.focus({preventScroll: true});
  }
  addEventListener('scroll', closeChipMenu, {passive: true});
  function applyChip(key, value) {
    const next = new URLSearchParams(location.search);
    const menu = chipMenus[key];
    if (key === 'color') {
      const words = (next.get('q') || '').split(/\s+/).filter(word => word && !colors.some(([name]) => name === word.toLowerCase()));
      if (value) words.push(value);
      words.length ? next.set('q', words.join(' ')) : next.delete('q');
    } else if (value) next.set(menu.param, value); else next.delete(menu.param);
    location.search = next.toString();
  }
  document.addEventListener('click', event => {
    const chip = event.target.closest('.cc-chip[data-cc]');
    if (chip) {
      if (chip.dataset.cc === 'filtros') { const toggle = document.getElementById('filters-toggle'); if (toggle && getComputedStyle(toggle).display !== 'none') toggle.click(); else document.getElementById('filters')?.scrollIntoView({behavior: 'smooth', block: 'start'}); return; }
      if (chipMenu && chipMenu.dataset.for === chip.dataset.cc) { closeChipMenu(); return; }
      openChipMenu(chip); return;
    }
    const sortOption = event.target.closest('[data-cc-sort]');
    if (sortOption) {
      const select = document.getElementById('sort-select');
      if (select) { select.value = sortOption.dataset.ccSort; select.dispatchEvent(new Event('change', {bubbles: true})); }
      const label = document.querySelector('.cc-chip[data-cc="ordenar"]');
      if (label) label.textContent = `Ordenar por: ${(sorts.find(([value]) => value === sortOption.dataset.ccSort) || sorts[0])[1]} ▾`;
      closeChipMenu(); return;
    }
    const option = event.target.closest('[data-cc-key]');
    if (option) { applyChip(option.dataset.ccKey, option.dataset.ccValue); return; }
    if (!event.target.closest('.cc-menu')) closeChipMenu();
  });
  if (document.body.dataset.page === 'catalog') {
    chipBar();
    new MutationObserver(() => chipBar()).observe(document.getElementById('main') || document.body, {childList: true});
  }
  return {open, close};
})();
