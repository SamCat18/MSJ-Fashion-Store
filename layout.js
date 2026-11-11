// Cabecera con megamenú, menú móvil, pie de página y paneles compartidos por todas las páginas de la tienda.
// Se carga justo después de <div id="site-header"> para que la cabecera aparezca sin parpadeo.
window.MSJLayout = (() => {
  // Tema elegido por el cliente, aplicado antes de pintar la cabecera para evitar el destello claro→oscuro (campaigns.js lo gestiona después).
  try { const theme = localStorage.getItem('msj-theme'); document.documentElement.classList.toggle('msj-dark', theme === 'dark'); document.documentElement.classList.toggle('msj-bw', theme === 'bw'); } catch {}
  const data = window.MSJ_DATA;
  const nav = document.body.dataset.nav || '';
  const catName = slug => data.categories.find(category => category.slug === slug)?.name || slug;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const image = (id, width = 600) => data.imageUrl(id, width);
  const icon = paths => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const menus = [
    {key:'mujer',label:'Mujer',href:'mujer.html',columns:[
      ['Ropa',['polos','blusas','poleras','casacas','abrigos','chompas','blazers']],
      ['Pantalones y vestidos',['jeans','pantalones','joggers','shorts','vestidos','faldas','conjuntos']],
      ['Calzado',['zapatillas','botas','sandalias','tacones']],
      ['Accesorios',['bolsos','lentes','relojes','joyeria','gorras','perfumes']]],
      promo:{title:'Nueva temporada',text:'Vestidos y abrigos para cada ocasión.',href:'novedades.html?a=Mujer',image:'1595777457583-95e059d581b8'}},
    {key:'hombre',label:'Hombre',href:'hombre.html',columns:[
      ['Ropa',['polos','camisas','poleras','casacas','abrigos','chompas','blazers']],
      ['Pantalones',['jeans','pantalones','joggers','shorts','conjuntos']],
      ['Calzado',['zapatillas','zapatos','botas','sandalias']],
      ['Accesorios',['gorras','mochilas','lentes','relojes','cinturones','perfumes']]],
      promo:{title:'Casacas y capuchas',text:'Abrígate con estilo urbano.',href:'hombre.html?c=casacas',image:'1487222477894-8943e31ef7b2'}},
    {key:'calzado',label:'Calzado',href:'calzado.html',columns:[
      ['Por tipo',['zapatillas','zapatos','botas','sandalias','tacones']],
      ['Para',[['Mujer','calzado.html?a=Mujer'],['Hombre','calzado.html?a=Hombre'],['Unisex','calzado.html?a=Unisex']]],
      ['Estilos',[['Urbano','calzado.html?col=urbano'],['Deportivo','calzado.html?col=deportivo'],['Formal','calzado.html?col=oficina']]]],
      promo:{title:'Zapatillas',text:'Más de 10 modelos para tu día a día.',href:'calzado.html?c=zapatillas',image:'1491553895911-0055eca6402d'}},
    {key:'accesorios',label:'Accesorios',href:'accesorios.html',columns:[
      ['Complementos',['gorras','bolsos','mochilas','cinturones']],
      ['Detalles',['lentes','relojes','joyeria']]],
      promo:{title:'Relojes y lentes',text:'El toque final de tu look.',href:'accesorios.html?c=relojes',image:'1524592094714-0f0654e20314'}},
    {key:'perfumes',label:'Perfumes',href:'perfumes.html',columns:[
      ['Fragancias',[['Para ella','perfumes.html?a=Mujer'],['Para él','perfumes.html?a=Hombre'],['Unisex','perfumes.html?a=Unisex']]],
      ['Momentos',[['Noche','perfumes.html?col=noche'],['Verano','perfumes.html?col=verano'],['Oficina','perfumes.html?col=oficina']]]],
      promo:{title:'Maison MSJ',text:'Eau de parfum en 50 y 100 ml.',href:'perfumes.html',image:'1615634260167-c8cdede054de'}},
    {key:'colecciones',label:'Colecciones',href:'colecciones.html',columns:[
      ['Colecciones',data.collections.map(collection => [collection.name,`tienda.html?col=${collection.slug}`])],
      ['Marcas',data.brands.map(brand => [brand.name,`tienda.html?b=${brand.slug}`])]],
      promo:{title:'Estilo urbano',text:'Capuchas, casacas y zapatillas.',href:'tienda.html?col=urbano',image:'1509942774463-acf339cf87d5'}}
  ];
  // Temporada navideña en el menú: del 1 de noviembre al 6 de enero.
  const xmasNav = (() => { const today = new Date(); const month = today.getMonth(); return month === 10 || month === 11 || (month === 0 && today.getDate() <= 6); })();
  const menuLink = (menu, item) => Array.isArray(item) ? `<a href="${escape(item[1])}">${escape(item[0])}</a>` : `<a href="${item === 'perfumes' && menu.key !== 'perfumes' ? `perfumes.html?a=${menu.label}` : `${menu.href}?c=${item}`}">${escape(catName(item))}</a>`;
  const megaPanel = menu => `<div class="mega-panel" id="mega-${menu.key}" role="region" aria-label="${escape(menu.label)}"><div class="mega-columns">${menu.columns.map(([title, items]) => `<div class="mega-column"><h3>${escape(title)}</h3>${items.map(item => menuLink(menu, item)).join('')}</div>`).join('')}<a class="mega-all" href="${menu.href}">Ver todo ${escape(menu.label)} →</a></div><a class="mega-promo" href="${escape(menu.promo.href)}"><img src="${image(menu.promo.image)}" alt="" loading="lazy"><strong>${escape(menu.promo.title)}</strong><span>${escape(menu.promo.text)}</span></a></div>`;
  const header = `<a class="skip-link" href="#main">Saltar al contenido</a>
  <div class="announcement">ENVÍOS A TODO EL PERÚ <span>•</span> PAGO CONTRA ENTREGA <span>•</span> CUPÓN <strong>BIENVENIDA10</strong> EN TU PRIMERA COMPRA</div>
  <header class="topbar shop-topbar">
    <button class="menu-toggle" id="menu-toggle" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobile-menu"><span></span><span></span><span></span></button>
    <a class="wordmark" href="index.html" aria-label="MSJ Fashion Store, inicio">MSJ<small>FASHION STORE</small></a>
    <nav class="mega-nav" aria-label="Categorías principales"><ul>${menus.map(menu => `<li class="mega-item${nav === menu.key ? ' active' : ''}"><a class="mega-link" href="${menu.href}" aria-haspopup="true" aria-controls="mega-${menu.key}">${escape(menu.label)}</a>${megaPanel(menu)}</li>`).join('')}<li class="mega-item${nav === 'novedades' ? ' active' : ''}"><a class="mega-link" href="novedades.html">Novedades</a></li><li class="mega-item sale${nav === 'ofertas' ? ' active' : ''}"><a class="mega-link" href="ofertas.html">Ofertas</a></li>${xmasNav ? '<li class="mega-item xmas-link"><a class="mega-link" href="navidad.html">Navidad 🎄</a></li>' : ''}<li class="mega-item vip-link"><a class="mega-link" href="vip.html">✦ Privilège</a></li></ul></nav>
    <form class="header-search" id="header-search" role="search" action="tienda.html"><input id="search-input" name="q" type="search" placeholder="Buscar polos, casacas, perfumes…" aria-label="Buscar en la tienda" autocomplete="off"><button type="submit" aria-label="Buscar">Buscar</button></form>
    <div class="top-actions"><a class="vip-member-badge" id="vip-member-badge" href="cuenta.html#lounge" hidden>✦ MIEMBRO VIP</a><button class="icon-button account-button" id="account-button" aria-label="Abrir cuenta"><span class="account-glyph" aria-hidden="true">♙</span><span id="account-label">Mi cuenta</span></button><button class="icon-button fav-button" id="favorites-button" aria-label="Ver favoritos"><span aria-hidden="true">♡</span><span class="bag-count" id="fav-count" hidden>0</span></button><button class="icon-button bag-button" id="bag-button" aria-label="Abrir carrito">Bolsa <span class="bag-count" id="bag-count">0</span></button></div>
  </header>
  <aside class="mobile-menu" id="mobile-menu" aria-label="Menú" hidden><div class="mobile-menu-head"><a class="wordmark" href="index.html">MSJ<small>FASHION STORE</small></a><button class="close-button" id="menu-close" aria-label="Cerrar menú">×</button></div><nav>${menus.map(menu => `<details><summary>${escape(menu.label)}</summary><div>${menu.columns.map(([title, items]) => `<p>${escape(title)}</p>${items.map(item => menuLink(menu, item)).join('')}`).join('')}<a class="mega-all" href="${menu.href}">Ver todo ${escape(menu.label)}</a></div></details>`).join('')}<a class="mobile-link" href="novedades.html">Novedades</a><a class="mobile-link sale" href="ofertas.html">Ofertas</a>${xmasNav ? '<a class="mobile-link" href="navidad.html">Navidad 🎄</a>' : ''}<a class="mobile-link" href="vip.html">✦ Privilège Club</a><a class="mobile-link" href="studio.html">MSJ Studio</a><a class="mobile-link" href="tienda.html">Toda la tienda</a><a class="mobile-link" href="cuenta.html">Mi cuenta</a><button type="button" class="mobile-link" data-order-lookup>Consultar mi pedido</button><a class="mobile-link" href="reclamaciones.html">Libro de Reclamaciones</a></nav></aside>
  <nav class="bottom-nav" aria-label="Accesos rápidos">
    <a href="index.html"${document.body.dataset.page === 'home' ? ' class="active" aria-current="page"' : ''}>${icon('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>')}Inicio</a>
    <button type="button" data-bottom="menu" aria-controls="mobile-menu">${icon('<path d="M4 6h16M4 12h16M4 18h16"/>')}Categorías</button>
    <button type="button" data-bottom="search">${icon('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>')}Buscar</button>
    <button type="button" data-bottom="favorites">${icon('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>')}Favoritos</button>
    <button type="button" data-bottom="bag">${icon('<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')}Bolsa<b class="bottom-count" id="bottom-bag-count" hidden>0</b></button>
  </nav>`;
  const footer = `<section class="newsletter-band" aria-label="Boletín"><div><p class="eyebrow">CLUB MSJ</p><h2>Novedades y ofertas antes que nadie</h2><p>Suscríbete y entérate primero de lanzamientos y descuentos.</p></div><form id="newsletter-form"><input type="email" name="email" required maxlength="160" placeholder="Tu correo electrónico" aria-label="Correo electrónico" autocomplete="email"><button>Suscribirme</button><label class="consent-check"><input type="checkbox" name="consent" required> <span>Acepto recibir correos y la <a href="legal.html#privacidad">política de privacidad</a>.</span></label><p class="form-message" id="newsletter-message" role="status"></p></form></section>
  <footer class="site-footer" id="contacto"><div class="footer-brand"><a class="wordmark" href="index.html">MSJ<small>FASHION STORE</small></a><p>Moda, calzado, accesorios y perfumes para acompañarte todos los días.</p><div class="social-links" id="social-links" aria-label="Redes sociales" hidden></div></div><div><h2>Comprar</h2><a href="mujer.html">Mujer</a><a href="hombre.html">Hombre</a><a href="calzado.html">Calzado</a><a href="accesorios.html">Accesorios</a><a href="perfumes.html">Perfumes</a><a href="colecciones.html">Colecciones</a><a href="ofertas.html">Ofertas</a><a href="navidad.html">Navidad</a></div><div><h2>MSJ 2026</h2><a href="vip.html">✦ Privilège Club</a><a href="studio.html">MSJ Studio y logros</a><a href="cuenta.html#recompensas">Recompensas</a><a href="navidad.html">Guía de regalos</a></div><div><h2>Ayuda</h2><a href="cuenta.html">Mi cuenta</a><button class="footer-account" id="footer-account">Iniciar sesión</button><button class="footer-account" data-order-lookup>Consultar mi pedido</button><button class="footer-account" data-size-guide>Guía de tallas</button><a href="legal.html#envios">Envíos</a><a href="legal.html#cambios">Cambios y devoluciones</a><a href="legal.html#terminos">Términos y condiciones</a><a href="legal.html#privacidad">Política de privacidad</a></div><div><h2>Contacto</h2><div class="footer-contact" id="footer-contact"></div><a class="complaints-link" href="reclamaciones.html"><span aria-hidden="true">📖</span> Libro de Reclamaciones</a></div><p class="footer-legal"><span>© ${new Date().getFullYear()} MSJ Fashion Store.<span id="footer-company"></span> Todos los derechos reservados. <span class="footer-credits">Desarrollado por Samuel, Mayloo y Jordan.</span></span><a href="admin.html" rel="nofollow">Administración</a></p></footer>
  <div class="overlay" id="overlay" hidden></div>
  <aside class="drawer" id="cart-drawer" aria-label="Carrito" aria-hidden="true"><div class="panel-heading"><div><p class="eyebrow">TU SELECCIÓN</p><h2>Tu bolsa <span id="drawer-count"></span></h2></div><button class="close-button" data-close aria-label="Cerrar carrito">×</button></div><div class="cart-items" id="cart-items"></div><div class="cart-footer" id="cart-footer"></div></aside>
  <section class="dialog" id="dialog" role="dialog" aria-modal="true" aria-label="Detalle y cuenta" hidden></section>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <button class="mishi-launcher" id="mishi-open" aria-expanded="false" aria-controls="mishi-panel" aria-label="Abrir M.I.S.H.I., asistente de compras"><span class="mishi-spark" aria-hidden="true"><img class="mishi-face" src="michi-avatar.svg" alt="" width="40" height="40" data-michi></span><span class="mishi-launch-text"><strong>M.I.S.H.I.</strong> • Asistente IA</span></button>
  <section class="mishi-panel" id="mishi-panel" role="dialog" aria-label="M.I.S.H.I., asistente de compras de MSJ" hidden>
    <header class="mishi-head"><span class="mishi-avatar" aria-hidden="true"><img class="mishi-face" src="michi-avatar.svg" alt="" width="44" height="44" data-michi></span><div><strong>M.I.S.H.I.</strong><small><i aria-hidden="true"></i> En línea — Personal Shopper IA</small><span class="mishi-rank" id="mishi-rank" hidden></span></div><button id="mishi-close" aria-label="Cerrar asistente">×</button></header>
    <div class="mishi-messages" id="mishi-messages" aria-live="polite"></div>
    <div class="mishi-chips-wrap"><button type="button" class="mishi-chips-nav prev" data-chips-step="-1" aria-label="Ver preguntas anteriores" hidden>‹</button><div class="mishi-chips" id="mishi-chips" aria-label="Preguntas rápidas"></div><button type="button" class="mishi-chips-nav next" data-chips-step="1" aria-label="Ver más preguntas" hidden>›</button></div>
    <form class="mishi-form" id="mishi-form"><input id="mishi-input" placeholder="Pregúntame: “perfume dulce”, “regalo por menos de S/ 150”…" autocomplete="off" maxlength="300" aria-label="Escribe tu consulta"><button aria-label="Enviar">➤</button></form>
    <div class="mishi-foot"><a class="support-whatsapp" id="support-whatsapp" target="_blank" rel="noopener" hidden>WhatsApp ↗</a><details class="contact-request"><summary>Hablar con el equipo</summary><form id="contact-form"><input name="name" placeholder="Nombre" required maxlength="100" autocomplete="name" aria-label="Nombre"><input name="email" type="email" placeholder="Correo electrónico" required maxlength="160" autocomplete="email" aria-label="Correo electrónico"><textarea name="message" placeholder="¿En qué podemos ayudarte?" required minlength="5" maxlength="1000" aria-label="Mensaje"></textarea><label class="consent-check"><input type="checkbox" required> <span>Acepto el tratamiento de mis datos según la <a href="legal.html#privacidad" target="_blank">política de privacidad</a>.</span></label><p class="form-message" id="contact-message" role="status"></p><button>Enviar consulta</button></form></details></div>
  </section>`;
  const headerSlot = document.getElementById('site-header');
  if (headerSlot) headerSlot.outerHTML = header;
  let footerRendered = false;
  function renderFooter() {
    if (footerRendered) return;
    footerRendered = true;
    const slot = document.getElementById('site-footer');
    if (slot) slot.outerHTML = footer; else document.body.insertAdjacentHTML('beforeend', footer);
    // Avatar de M.I.S.H.I. (michi-avatar.svg, la cara de MICHI). Si no carga, se muestra la estrella ✦.
    document.querySelectorAll('img[data-michi]').forEach(image => {
      const fallback = () => image.replaceWith('✦');
      if (image.complete && !image.naturalWidth) fallback(); else image.addEventListener('error', fallback, { once: true });
    });
  }
  function openMenu() { const menu = document.getElementById('mobile-menu'); menu.hidden = false; requestAnimationFrame(() => menu.classList.add('open')); document.getElementById('menu-toggle').setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; document.getElementById('menu-close').focus(); }
  function closeMenu() { const menu = document.getElementById('mobile-menu'); if (menu.hidden) return; menu.classList.remove('open'); document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; setTimeout(() => { menu.hidden = true; }, 200); }
  document.getElementById('menu-toggle')?.addEventListener('click', openMenu);
  document.getElementById('menu-close')?.addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenu(); document.querySelectorAll('.mega-item.open').forEach(item => item.classList.remove('open')); } });
  // Megamenú accesible por teclado: se abre al enfocar y se cierra al salir.
  document.querySelectorAll('.mega-item').forEach(item => {
    item.addEventListener('focusin', () => item.classList.add('open'));
    item.addEventListener('focusout', event => { if (!item.contains(event.relatedTarget)) item.classList.remove('open'); });
    item.addEventListener('mouseleave', () => item.classList.remove('open'));
  });
  // Barra inferior del celular: reutiliza los botones de la cabecera (favoritos y bolsa) para no duplicar su lógica.
  document.querySelector('.bottom-nav')?.addEventListener('click', event => {
    const action = event.target.closest('[data-bottom]')?.dataset.bottom;
    if (action === 'menu') openMenu();
    if (action === 'search') document.getElementById('search-input')?.focus();
    if (action === 'favorites') document.getElementById('favorites-button')?.click();
    if (action === 'bag') document.getElementById('bag-button')?.click();
  });
  const bagCount = document.getElementById('bag-count'), bottomCount = document.getElementById('bottom-bag-count');
  if (bagCount && bottomCount) {
    const syncCount = () => { const count = Number(bagCount.textContent) || 0; bottomCount.textContent = count; bottomCount.hidden = !count; };
    new MutationObserver(syncCount).observe(bagCount, { childList: true, characterData: true, subtree: true });
    syncCount();
  }
  // Volver arriba en páginas largas (escritorio; en el celular la barra inferior ya da acceso rápido).
  document.body.insertAdjacentHTML('beforeend', '<button class="back-to-top" id="back-to-top" type="button" aria-label="Volver arriba" hidden>↑</button>');
  const backToTop = document.getElementById('back-to-top');
  addEventListener('scroll', () => { backToTop.hidden = scrollY < 900; }, { passive: true });
  backToTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  return {renderFooter, closeMenu, menus, catName};
})();
