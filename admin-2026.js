// Centro 2026 del panel: resumen en vivo, automatizaciones e inventario inteligente, personalización de la tienda
// (Navidad, teaser 2027, franja, recompensas), integraciones (Mercado Pago y Mercado Libre, apagadas hasta tener
// credenciales) y lo que buscan los clientes. Requiere database/v2026.sql; sin él, cada vista explica qué falta.
(() => {
  const config = window.STORE_CONFIG || {};
  const client = window.MSJAdminClient || (window.supabase && config.supabaseUrl ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null);
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[char]));
  const money = value => new Intl.NumberFormat('es-PE', {style: 'currency', currency: 'PEN'}).format(Number(value || 0));
  const number = value => Number(value || 0).toLocaleString('es-PE');
  const dateTime = value => value ? new Intl.DateTimeFormat('es-PE', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value)) : '—';
  const isDemo = () => !$('#demo-banner')?.hidden;
  const missingSql = error => /function|does not exist|schema cache|relation/i.test(error?.message || '');
  const sqlNotice = '<div class="notice-line warn">Ejecuta <strong>database/v2026.sql</strong> en Supabase → SQL Editor para activar esta sección.</div>';
  const toLocalInput = value => { if (!value) return ''; const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date - offset * 6e4).toISOString().slice(0, 16); };
  const fromLocalInput = value => value ? new Date(value).toISOString() : null;
  function flash(node, text, ok = true) { if (!node) return; node.textContent = text; node.className = `form-message ${ok ? 'ok' : 'error'}`; }
  function exportCsv(rows, name) {
    const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`﻿${csv}`], {type: 'text/csv;charset=utf-8'}));
    link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  // ---------- Menú y vistas ----------
  const overview = $('.side-link[data-view="overview"]');
  if (overview) overview.insertAdjacentHTML('afterend', `<p class="sidebar-label center-label">CENTRO 2026</p>
    <button class="side-link" data-view="insights"><span>📊</span>Resumen en vivo</button>
    <button class="side-link" data-view="automation"><span>⚙️</span>Automatización y stock</button>
    <button class="side-link" data-view="personalize"><span>🎨</span>Personalización</button>
    <button class="side-link" data-view="integrations"><span>🔌</span>Integraciones</button>
    <button class="side-link" data-view="searches"><span>🔎</span>Búsquedas</button>
    <p class="sidebar-label">OPERACIÓN</p>`);
  $('.admin-main')?.insertAdjacentHTML('beforeend', `
    <section class="admin-view" id="view-insights"><div class="page-heading"><div><p class="eyebrow">CENTRO 2026</p><h1>Resumen en vivo</h1></div><button class="secondary-button compact" data-c26-refresh="insights">Actualizar</button></div><div id="insights-body"></div></section>
    <section class="admin-view" id="view-automation"><div class="page-heading"><div><p class="eyebrow">INVENTARIO INTELIGENTE</p><h1>Automatización y stock</h1></div><button class="primary-button compact" id="run-automations">▶ Ejecutar ahora</button></div><div id="automation-body"></div></section>
    <section class="admin-view" id="view-personalize"><div class="page-heading"><div><p class="eyebrow">TIENDA</p><h1>Personalización</h1></div><a class="secondary-button compact" href="index.html?season=navidad&amp;teaser=1" target="_blank" rel="noopener">Ver en la tienda ↗</a></div><div id="personalize-body"></div></section>
    <section class="admin-view" id="view-integrations"><div class="page-heading"><div><p class="eyebrow">MERCADO PAGO · MERCADO LIBRE</p><h1>Integraciones</h1></div><button class="secondary-button compact" data-c26-refresh="integrations">Actualizar</button></div><div id="integrations-body"></div></section>
    <section class="admin-view" id="view-searches"><div class="page-heading"><div><p class="eyebrow">M.I.S.H.I. Y BUSCADOR</p><h1>Lo que buscan tus clientes</h1></div><select id="search-range" aria-label="Periodo"><option value="7">Últimos 7 días</option><option value="30" selected>Últimos 30 días</option><option value="90">Últimos 90 días</option></select></div><div id="searches-body"></div></section>`);

  // ---------- Resumen en vivo ----------
  const demoInsights = {ventas_hoy: 1289.4, pedidos_hoy: 9, ventas_7d: 8420.5, ventas_7d_previos: 6910, ticket_promedio: 214.3, pagos_por_verificar: 3, por_despachar: 5, alertas_stock: 7, agotados: 2, clientes_nuevos_7d: 18, socios_activos: 6, puntos_emitidos: 15420, rachas_hoy: 41,
    por_dia: Array.from({length: 14}, (_, index) => ({dia: new Date(Date.now() - (13 - index) * 864e5).toISOString().slice(0, 10), total: Math.round(500 + Math.sin(index / 2) * 300 + index * 60)})),
    top_productos: [{nombre: 'Casaca Biker Negra', unidades: 14, total: 3686.8}, {nombre: 'Perfume Vainilla Coco', unidades: 11, total: 1958}, {nombre: 'Polo Clásico Premium', unidades: 9, total: 801}],
    integraciones: {mercado_pago: {enabled: false, status: 'pendiente_credenciales'}, mercado_libre: {enabled: false, status: 'pendiente_credenciales'}}, ultima_automatizacion: {ran_at: new Date().toISOString(), details: {pagos_vencidos: 1, avisos_vip: 2}}};
  async function loadInsights() {
    const body = $('#insights-body');
    if (!body) return;
    let data = demoInsights;
    if (!isDemo() && client) {
      const result = await client.rpc('admin_insights_2026');
      if (result.error) { body.innerHTML = missingSql(result.error) ? sqlNotice : `<div class="notice-line warn">${escapeHtml(result.error.message)}</div>`; return; }
      data = result.data;
    }
    const delta = data.ventas_7d_previos > 0 ? Math.round((data.ventas_7d - data.ventas_7d_previos) / data.ventas_7d_previos * 100) : null;
    const max = Math.max(1, ...data.por_dia.map(day => Number(day.total)));
    const bars = data.por_dia.map((day, index) => { const height = Math.max(2, Math.round(Number(day.total) / max * 120)); return `<g><title>${escapeHtml(day.dia)}: ${money(day.total)}</title><rect x="${index * 34 + 4}" y="${130 - height}" width="24" height="${height}" rx="7"></rect><text x="${index * 34 + 16}" y="148">${escapeHtml(day.dia.slice(8, 10))}</text></g>`; }).join('');
    const status = {pendiente_credenciales: 'Esperando credenciales', configurado: 'Configurado', conectado: 'Conectado', error: 'Con error', pausado: 'Pausado'};
    body.innerHTML = `
      <div class="c26-kpis">
        <article class="c26-kpi hero"><span>Ventas de hoy</span><strong>${money(data.ventas_hoy)}</strong><small>${number(data.pedidos_hoy)} pedidos</small></article>
        <article class="c26-kpi"><span>Últimos 7 días</span><strong>${money(data.ventas_7d)}</strong><small class="${delta === null ? '' : delta >= 0 ? 'up' : 'down'}">${delta === null ? 'Sin semana anterior' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs. semana anterior`}</small></article>
        <article class="c26-kpi"><span>Ticket promedio</span><strong>${money(data.ticket_promedio)}</strong><small>30 días</small></article>
        <article class="c26-kpi ${data.pagos_por_verificar ? 'attention' : ''}"><span>Pagos por verificar</span><strong>${number(data.pagos_por_verificar)}</strong><small><button class="text-button" data-view="orders">Ir a pedidos →</button></small></article>
        <article class="c26-kpi"><span>Por despachar</span><strong>${number(data.por_despachar)}</strong><small>Pedidos confirmados</small></article>
        <article class="c26-kpi ${data.agotados ? 'attention' : ''}"><span>Alertas de stock</span><strong>${number(data.alertas_stock)}</strong><small>${number(data.agotados)} agotadas · <button class="text-button" data-view="automation">ver</button></small></article>
        <article class="c26-kpi"><span>Clientes nuevos</span><strong>${number(data.clientes_nuevos_7d)}</strong><small>7 días</small></article>
        <article class="c26-kpi"><span>Engagement</span><strong>${number(data.rachas_hoy)}</strong><small>rachas hoy · ${number(data.socios_activos)} socios VIP</small></article>
      </div>
      <div class="c26-grid">
        <article class="c26-card"><h2>Ventas de los últimos 14 días</h2><svg class="c26-bars" viewBox="0 0 ${data.por_dia.length * 34} 152" role="img" aria-label="Ventas por día">${bars}</svg></article>
        <article class="c26-card"><h2>Más vendidos (30 días)</h2>${data.top_productos.length ? `<ol class="c26-top">${data.top_productos.map(item => `<li><span>${escapeHtml(item.nombre)}</span><b>${number(item.unidades)} u.</b><small>${money(item.total)}</small></li>`).join('')}</ol>` : '<p class="c26-empty">Aún no hay ventas en este periodo.</p>'}</article>
        <article class="c26-card"><h2>Integraciones</h2><ul class="c26-status">${Object.entries(data.integraciones || {}).map(([key, value]) => `<li><span>${key === 'mercado_pago' ? 'Mercado Pago' : 'Mercado Libre'}</span><b class="pill ${value.enabled ? 'ok' : 'wait'}">${escapeHtml(status[value.status] || value.status)}</b></li>`).join('')}</ul><button class="text-button" data-view="integrations">Configurar →</button></article>
        <article class="c26-card"><h2>Última automatización</h2>${data.ultima_automatizacion ? `<p class="c26-muted">${dateTime(data.ultima_automatizacion.ran_at)}</p><ul class="c26-status">${Object.entries(data.ultima_automatizacion.details || {}).map(([key, value]) => `<li><span>${escapeHtml(key.replace(/_/g, ' '))}</span><b>${number(value)}</b></li>`).join('')}</ul>` : '<p class="c26-empty">Todavía no se ejecutó.</p>'}<button class="text-button" data-view="automation">Ver automatizaciones →</button></article>
      </div>`;
  }

  // ---------- Automatización y stock ----------
  const rules = [
    ['📉', 'Alerta de stock bajo', 'Cada variante que baja del umbral (o llega a 0) entra aquí al instante y se cierra sola cuando repones.'],
    ['↩️', 'Stock de vuelta al cancelar', 'Si un pedido se cancela (rechazo de pago, vencimiento o desde Pedidos) el stock y el uso del cupón vuelven una sola vez.'],
    ['⏱️', 'Pagos online vencidos', 'Pedidos con Mercado Pago sin pagar a tiempo se cancelan y liberan el stock (cada 15 min con pg_cron).'],
    ['🔥', 'Puntos y racha', 'Puntos al pagar un pedido (x1.5 Gold, x2 Black), por reseña aprobada y por racha diaria; se revierten si el pedido se anula.'],
    ['🔔', 'Avisos a clientes', 'Bajó de precio un favorito, volvió el stock, el pedido avanzó o el pago se verificó.'],
    ['✦', 'Membresías', 'Aviso 7 días antes de vencer y cierre automático de membresías vencidas.'],
    ['🔄', 'Mercado Libre', 'Cambios de stock y precio se encolan para sincronizar las publicaciones (cuando esté conectado).'],
    ['🧹', 'Limpieza', 'Búsquedas, webhooks y avisos antiguos se depuran solos.']
  ];
  const demoAlerts = [{kind: 'agotado', stock: 0, threshold: 3, created_at: new Date().toISOString(), products: {name: 'Casaca Biker Negra', sku: 'MSJ-CAS-001'}, product_variants: {size: 'M', color: 'Negro'}}, {kind: 'bajo', stock: 2, threshold: 3, created_at: new Date().toISOString(), products: {name: 'Polo Clásico Premium', sku: 'MSJ-POL-001'}, product_variants: {size: 'L', color: 'Blanco'}}];
  const demoSuggestions = [{product_name: 'Casaca Biker Negra', sku: 'MSJ-CAS-001', variant: 'M / Negro', stock: 0, vendidos: 12, por_dia: .4, dias_cobertura: 0, sugerido: 15, prioridad: 'urgente'}, {product_name: 'Perfume Vainilla Coco', sku: 'MSJ-PER-004', variant: '50 ml / Único', stock: 3, vendidos: 9, por_dia: .3, dias_cobertura: 10, sugerido: 8, prioridad: 'alta'}];
  let suggestionsCache = [];
  async function loadAutomation() {
    const body = $('#automation-body');
    if (!body) return;
    let alerts = demoAlerts, suggestions = demoSuggestions, runs = [], threshold = 3;
    if (!isDemo() && client) {
      const [alertResult, suggestionResult, runResult, settingResult] = await Promise.all([
        client.from('stock_alerts').select('id,kind,stock,threshold,created_at,products(name,sku),product_variants(size,color)').is('resolved_at', null).order('kind').order('stock').limit(100),
        client.rpc('admin_restock_suggestions', {p_days: 30, p_cover_days: 30}),
        client.from('automation_runs').select('job,affected,details,trigger_source,ran_at').order('ran_at', {ascending: false}).limit(8),
        client.from('store_settings').select('value').eq('key', 'automation').maybeSingle()
      ]);
      if (alertResult.error && missingSql(alertResult.error)) { body.innerHTML = sqlNotice; return; }
      alerts = alertResult.data || []; suggestions = suggestionResult.data || []; runs = runResult.data || [];
      threshold = Number(settingResult.data?.value?.low_stock_threshold ?? 3);
    }
    suggestionsCache = suggestions;
    const priority = {urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja'};
    body.innerHTML = `
      <div class="c26-rules">${rules.map(([icon, title, text]) => `<article><span aria-hidden="true">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><b class="pill ok">Activa</b></article>`).join('')}</div>
      <div class="c26-grid two">
        <article class="c26-card"><div class="c26-card-head"><h2>Alertas de stock (${alerts.length})</h2><form class="c26-inline" id="threshold-form"><label>Umbral <input type="number" name="threshold" min="0" max="100" value="${threshold}"></label><button class="secondary-button compact">Guardar</button></form></div>
          ${alerts.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Variante</th><th>Stock</th><th>Desde</th></tr></thead><tbody>${alerts.map(alert => `<tr><td>${escapeHtml(alert.products?.name)}<br><small>${escapeHtml(alert.products?.sku || '')}</small></td><td>${escapeHtml(`${alert.product_variants?.size || ''} / ${alert.product_variants?.color || ''}`)}</td><td><b class="pill ${alert.kind === 'agotado' ? 'bad' : 'wait'}">${alert.kind === 'agotado' ? 'Agotado' : `${alert.stock} u.`}</b></td><td>${dateTime(alert.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="c26-empty">Todo el stock está sobre el umbral. 🎉</p>'}
          <p class="form-message" id="threshold-message" role="status"></p></article>
        <article class="c26-card"><div class="c26-card-head"><h2>Qué reponer (30 días de ventas)</h2><button class="secondary-button compact" id="export-restock">Exportar CSV</button></div>
          ${suggestions.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Stock</th><th>Venta/día</th><th>Cobertura</th><th>Pedir</th><th>Prioridad</th></tr></thead><tbody>${suggestions.slice(0, 40).map(row => `<tr><td>${escapeHtml(row.product_name)}<br><small>${escapeHtml(row.variant)}</small></td><td>${number(row.stock)}</td><td>${Number(row.por_dia || 0).toFixed(2)}</td><td>${row.dias_cobertura === null || row.dias_cobertura === undefined ? '—' : `${Number(row.dias_cobertura).toFixed(0)} d`}</td><td><b>${number(row.sugerido)}</b></td><td><b class="pill ${row.prioridad === 'urgente' ? 'bad' : row.prioridad === 'alta' ? 'wait' : 'ok'}">${priority[row.prioridad] || row.prioridad}</b></td></tr>`).join('')}</tbody></table></div><p class="c26-muted">Sugerido = venta diaria × (30 días + 7 de seguridad) − stock actual.</p>` : '<p class="c26-empty">Sin ventas recientes ni stock bajo.</p>'}</article>
      </div>
      <form class="c26-card c26-form" id="early-access-form"><h2>✦ Acceso anticipado Privilège</h2>
        <p class="c26-muted">Hasta la fecha elegida, solo los socios Privilège pueden comprar ese producto (el servidor lo exige al crear el pedido). Los demás ven la etiqueta «✦ Anticipado».</p>
        <div class="c26-row"><label>Producto<select name="product" id="early-product"><option value="">Cargando productos…</option></select></label><label>Exclusivo hasta<input type="datetime-local" name="until"></label></div>
        <div class="c26-row"><button class="primary-button compact">Guardar</button><button type="button" class="secondary-button compact" data-early-clear>Quitar acceso anticipado</button></div><p class="form-message" id="early-message" role="status"></p></form>
      <article class="c26-card"><h2>Últimas ejecuciones</h2>${runs.length ? `<ul class="c26-runs">${runs.map(run => `<li><span>${dateTime(run.ran_at)} · ${run.trigger_source === 'cron' ? 'automático' : 'panel'}</span><small>${Object.entries(run.details || {}).filter(([, value]) => Number(value)).map(([key, value]) => `${escapeHtml(key.replace(/_/g, ' '))}: ${number(value)}`).join(' · ') || 'sin cambios'}</small></li>`).join('')}</ul>` : '<p class="c26-empty">Aún no hay ejecuciones. Pulsa «Ejecutar ahora» o activa pg_cron (Database → Extensions).</p>'}<p class="form-message" id="automation-message" role="status"></p></article>`;
  }

  async function fillEarlyProducts() {
    const select = $('#early-product');
    if (!select) return;
    if (isDemo() || !client) { select.innerHTML = '<option value="">Casaca Biker Negra (demo)</option>'; return; }
    const {data, error} = await client.from('products').select('id,name,sku,early_access_until').eq('is_active', true).order('name').limit(500);
    if (error) { select.innerHTML = `<option value="">${missingSql(error) ? 'Ejecuta database/v2026.sql' : 'No se pudieron leer los productos'}</option>`; return; }
    select.innerHTML = '<option value="">Elige un producto</option>' + (data || []).map(product => `<option value="${escapeHtml(product.id)}">${product.early_access_until && new Date(product.early_access_until) > new Date() ? '✦ ' : ''}${escapeHtml(product.name)} · ${escapeHtml(product.sku)}${product.early_access_until && new Date(product.early_access_until) > new Date() ? ` (hasta ${dateTime(product.early_access_until)})` : ''}</option>`).join('');
  }
  async function saveEarly(until) {
    const message = $('#early-message');
    const id = $('#early-product')?.value;
    if (!id) { flash(message, 'Elige un producto.', false); return; }
    if (isDemo()) { flash(message, 'Modo demostración.'); return; }
    const {error} = await client.from('products').update({early_access_until: until}).eq('id', id);
    flash(message, error ? (missingSql(error) ? 'Ejecuta database/v2026.sql primero.' : error.message) : until ? `Listo: exclusivo para socios hasta ${dateTime(until)}.` : 'Acceso anticipado retirado: ya lo puede comprar cualquiera.', !error);
    if (!error) fillEarlyProducts();
  }
  document.addEventListener('submit', event => {
    if (event.target.id !== 'early-access-form') return;
    event.preventDefault();
    const until = fromLocalInput(new FormData(event.target).get('until'));
    if (!until || new Date(until) <= new Date()) { flash($('#early-message'), 'Elige una fecha futura.', false); return; }
    saveEarly(until);
  });
  document.addEventListener('click', event => { if (event.target.closest('[data-early-clear]')) saveEarly(null); });
  new MutationObserver(() => { const select = $('#early-product'); if (select && !select.dataset.filled) { select.dataset.filled = '1'; fillEarlyProducts(); } }).observe(document.body, {childList: true, subtree: true});

  // ---------- Personalización ----------
  const defaults = {
    season: config.season || {}, teaser_2027: config.teaser2027 || {}, announcement: {enabled: false, text: ''}, loyalty: config.loyalty || {}, studio: {enabled: true}
  };
  let settings = {...defaults};
  async function loadPersonalize() {
    const body = $('#personalize-body');
    if (!body) return;
    settings = JSON.parse(JSON.stringify(defaults));
    if (!isDemo() && client) {
      const {data, error} = await client.from('store_settings').select('key,value');
      if (error && missingSql(error)) { body.innerHTML = sqlNotice; return; }
      (data || []).forEach(row => { settings[row.key] = {...(settings[row.key] || {}), ...row.value}; });
    }
    const season = settings.season, teaser = settings.teaser_2027, loyalty = settings.loyalty, announcement = settings.announcement;
    const rewards = loyalty.rewards || [];
    const check = (name, value, label) => `<label class="c26-switch"><input type="checkbox" name="${name}" ${value ? 'checked' : ''}> <span>${label}</span></label>`;
    body.innerHTML = `
      <div class="c26-grid two">
        <form class="c26-card c26-form" data-setting="season"><h2>🎄 Temporada (Navidad)</h2>
          ${check('enabled', season.enabled !== false, 'Activar decoración de temporada')}
          <div class="c26-row"><label>Tipo<select name="mode"><option value="christmas" ${season.mode === 'christmas' ? 'selected' : ''}>Navidad</option><option value="none" ${season.mode === 'none' ? 'selected' : ''}>Ninguna</option></select></label>
          <label>Desde<input type="datetime-local" name="starts_at" value="${toLocalInput(season.starts_at)}"></label><label>Hasta<input type="datetime-local" name="ends_at" value="${toLocalInput(season.ends_at)}"></label></div>
          <label>Título<input name="headline" maxlength="60" value="${escapeHtml(season.headline || '')}"></label>
          <label>Texto<input name="subline" maxlength="160" value="${escapeHtml(season.subline || '')}"></label>
          <div class="c26-row">${check('snow', season.snow !== false, 'Nieve')}${check('lights', season.lights !== false, 'Luces')}${check('gift_wrap', Boolean(season.gift_wrap), 'Envoltura gratis')}</div>
          <button class="primary-button compact">Guardar temporada</button><p class="form-message" role="status"></p></form>
        <form class="c26-card c26-form" data-setting="teaser_2027"><h2>✨ Ventana «2027 · Coming soon»</h2>
          ${check('enabled', teaser.enabled !== false, 'Mostrar la ventana')}
          <label>Título<input name="title" maxlength="60" value="${escapeHtml(teaser.title || '')}"></label>
          <label>Texto<input name="subtitle" maxlength="160" value="${escapeHtml(teaser.subtitle || '')}"></label>
          <div class="c26-row"><label>Lanzamiento<input type="datetime-local" name="launch_at" value="${toLocalInput(teaser.launch_at)}"></label><label>Botón<input name="cta" maxlength="30" value="${escapeHtml(teaser.cta || '')}"></label>
          <label>Frecuencia<select name="frequency"><option value="daily" ${teaser.frequency !== 'once' ? 'selected' : ''}>Una vez al día</option><option value="once" ${teaser.frequency === 'once' ? 'selected' : ''}>Solo una vez</option></select></label></div>
          <p class="c26-muted">Los correos que deja la gente llegan a <strong>Boletín</strong> con origen «teaser-2027».</p>
          <button class="primary-button compact">Guardar ventana</button><p class="form-message" role="status"></p></form>
        <form class="c26-card c26-form" data-setting="announcement"><h2>📣 Franja superior</h2>
          ${check('enabled', Boolean(announcement.enabled), 'Usar mi propio mensaje (cuando no haya una campaña con cuenta regresiva)')}
          <label>Mensaje<input name="text" maxlength="140" value="${escapeHtml(announcement.text || '')}" placeholder="ENVÍO GRATIS EN LIMA DESDE S/ 199 · NAVIDAD MSJ"></label>
          <button class="primary-button compact">Guardar franja</button><p class="form-message" role="status"></p></form>
        <form class="c26-card c26-form" data-setting="loyalty"><h2>🔥 MSJ Recompensas</h2>
          ${check('enabled', loyalty.enabled !== false, 'Programa de puntos activo')}
          <div class="c26-row"><label>Puntos por S/ 1<input type="number" step="0.5" min="0" max="10" name="points_per_sol" value="${Number(loyalty.points_per_sol ?? 1)}"></label><label>Bienvenida<input type="number" min="0" max="1000" name="welcome_points" value="${Number(loyalty.welcome_points ?? 50)}"></label><label>Reseña<input type="number" min="0" max="500" name="review_points" value="${Number(loyalty.review_points ?? 20)}"></label></div>
          <div class="c26-row"><label>Racha diaria<input type="number" min="0" max="100" name="checkin_points" value="${Number(loyalty.checkin_points ?? 5)}"></label><label>Bonus de racha<input type="number" min="0" max="1000" name="streak_bonus" value="${Number(loyalty.streak_bonus ?? 25)}"></label><label>Cada (días)<input type="number" min="2" max="30" name="streak_every" value="${Number(loyalty.streak_every ?? 7)}"></label></div>
          <div class="c26-row"><label>Multiplicador Gold<input type="number" step="0.1" min="1" max="5" name="mult_gold" value="${Number(loyalty.multipliers?.gold ?? 1.5)}"></label><label>Multiplicador Black<input type="number" step="0.1" min="1" max="5" name="mult_black" value="${Number(loyalty.multipliers?.black ?? 2)}"></label></div>
          <h3>Canjes (puntos → cupón)</h3>${[0, 1, 2].map(index => `<div class="c26-row"><label>Puntos<input type="number" min="50" max="100000" name="r${index}_points" value="${Number(rewards[index]?.points ?? '')}"></label><label>Cupón S/<input type="number" min="1" max="1000" name="r${index}_amount" value="${Number(rewards[index]?.amount ?? '')}"></label><label>Compra mín. S/<input type="number" min="0" max="10000" name="r${index}_min" value="${Number(rewards[index]?.min ?? 0)}"></label></div>`).join('')}
          <button class="primary-button compact">Guardar recompensas</button><p class="form-message" role="status"></p></form>
      </div>`;
  }
  function readForm(form) {
    const key = form.dataset.setting;
    const values = new FormData(form);
    const bool = name => values.get(name) === 'on';
    const text = (name, max = 200) => String(values.get(name) || '').trim().slice(0, max);
    const num = name => Number(values.get(name));
    if (key === 'season') return {...settings.season, enabled: bool('enabled'), mode: text('mode'), starts_at: fromLocalInput(values.get('starts_at')), ends_at: fromLocalInput(values.get('ends_at')), headline: text('headline', 60), subline: text('subline', 160), snow: bool('snow'), lights: bool('lights'), gift_wrap: bool('gift_wrap')};
    if (key === 'teaser_2027') return {...settings.teaser_2027, enabled: bool('enabled'), title: text('title', 60), subtitle: text('subtitle', 160), launch_at: fromLocalInput(values.get('launch_at')), cta: text('cta', 30), frequency: text('frequency')};
    if (key === 'announcement') return {enabled: bool('enabled'), text: text('text', 140)};
    if (key === 'loyalty') {
      const rewards = [0, 1, 2].map(index => ({points: num(`r${index}_points`), amount: num(`r${index}_amount`), min: num(`r${index}_min`) || 0})).filter(reward => reward.points > 0 && reward.amount > 0).sort((a, b) => a.points - b.points);
      return {...settings.loyalty, enabled: bool('enabled'), points_per_sol: num('points_per_sol'), welcome_points: num('welcome_points'), review_points: num('review_points'), checkin_points: num('checkin_points'), streak_bonus: num('streak_bonus'), streak_every: num('streak_every'), multipliers: {gold: num('mult_gold'), black: num('mult_black')}, rewards};
    }
    return {};
  }

  // ---------- Integraciones ----------
  const steps = {
    mercado_pago: ['Cuenta de Mercado Pago verificada con tu DNI (RENIEC)', 'Crear la aplicación en Mercado Pago Developers → «Checkout Pro»', 'Guardar el Access Token y la clave secreta del webhook en los secretos de Supabase', 'Desplegar mp-create-preference y mp-webhook', 'Pegar la URL del webhook en Mercado Pago (eventos: Pagos)', 'Escribir aquí la Public Key y activar', 'En config.js: features.mercadoPago = true'],
    mercado_libre: ['Cuenta de vendedor en Mercado Libre Perú', 'Crear la aplicación en developers.mercadolibre.com.pe con la URL de retorno', 'Guardar App ID y Secret en los secretos de Supabase', 'Desplegar ml-oauth, ml-sync y ml-webhook', 'Pulsar «Conectar cuenta» y autorizar', 'Mapear categorías y preparar publicaciones', 'Activar la sincronización']
  };
  async function loadIntegrations() {
    const body = $('#integrations-body');
    if (!body) return;
    let rows = [{provider: 'mercado_pago', enabled: false, mode: 'sandbox', status: 'pendiente_credenciales', public_config: {public_key: ''}}, {provider: 'mercado_libre', enabled: false, mode: 'sandbox', status: 'pendiente_credenciales', public_config: {site_id: 'MPE'}}];
    let events = [], listings = [], queue = [], products = [];
    if (!isDemo() && client) {
      const [integrations, eventResult, listingResult, queueResult, productResult] = await Promise.all([
        client.from('integrations').select('*').order('provider'),
        client.from('integration_events').select('provider,topic,resource_id,status,error,received_at,signature_ok').order('received_at', {ascending: false}).limit(15),
        client.from('ml_listings').select('product_id,ml_item_id,status,permalink,last_synced_at,last_error,products(name)').order('updated_at', {ascending: false}).limit(50),
        client.from('sync_queue').select('status').in('status', ['pendiente', 'error']).limit(500),
        client.from('products').select('id,name,sku').eq('is_active', true).eq('vip_only', false).order('name').limit(200)
      ]);
      if (integrations.error && missingSql(integrations.error)) { body.innerHTML = sqlNotice; return; }
      rows = integrations.data?.length ? integrations.data : rows;
      events = eventResult.data || []; listings = listingResult.data || []; queue = queueResult.data || []; products = productResult.data || [];
    }
    const webhook = `${String(config.supabaseUrl || 'https://TU-PROYECTO.supabase.co').replace(/\/$/, '')}/functions/v1`;
    const flags = config.features || {};
    const status = {pendiente_credenciales: 'Esperando credenciales', configurado: 'Configurado', conectado: 'Conectado', error: 'Con error', pausado: 'Pausado'};
    const card = row => {
      const mp = row.provider === 'mercado_pago';
      const visible = mp ? flags.mercadoPago === true : flags.mercadoLibre === true;
      return `<form class="c26-card c26-form c26-integration" data-integration="${row.provider}">
        <div class="c26-card-head"><h2>${mp ? '💳 Mercado Pago' : '🛒 Mercado Libre'}</h2><b class="pill ${row.enabled ? 'ok' : 'wait'}">${escapeHtml(status[row.status] || row.status)}</b></div>
        <p class="c26-muted">${mp ? 'Cobro con tarjeta, Yape y PagoEfectivo. El pedido se confirma solo cuando Mercado Pago avisa (webhook firmado), se emite la boleta y llega al correo del cliente.' : 'Publica tu catálogo en Mercado Libre, sincroniza stock y precio, y descuenta el stock de MSJ cuando vendes allá.'}</p>
        <p class="c26-visibility ${visible && row.enabled ? 'on' : ''}">${visible && row.enabled ? '● Visible en la tienda' : '○ Oculto en la tienda'} <small>(config.js: features.${mp ? 'mercadoPago' : 'mercadoLibre'} = ${visible})</small></p>
        <ol class="c26-steps">${steps[row.provider].map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        ${mp ? `<label>Public Key (pública, empieza con APP_USR- o TEST-)<input name="public_key" maxlength="120" value="${escapeHtml(row.public_config?.public_key || '')}" placeholder="APP_USR-xxxxxxxx-xxxx-…" autocomplete="off"></label>
          <label>URL del webhook (pégala en Mercado Pago)<span class="c26-copy"><code>${escapeHtml(webhook)}/mp-webhook</code><button type="button" class="text-button" data-copy="${escapeHtml(webhook)}/mp-webhook">Copiar</button></span></label>`
        : `<label>URL de retorno OAuth (pégala en tu aplicación de Mercado Libre)<span class="c26-copy"><code>${escapeHtml(webhook)}/ml-oauth</code><button type="button" class="text-button" data-copy="${escapeHtml(webhook)}/ml-oauth">Copiar</button></span></label>
          <label>URL de notificaciones<span class="c26-copy"><code>${escapeHtml(webhook)}/ml-webhook</code><button type="button" class="text-button" data-copy="${escapeHtml(webhook)}/ml-webhook">Copiar</button></span></label>
          <p class="c26-muted">Vendedor: <strong>${escapeHtml(row.public_config?.nickname || 'sin conectar')}</strong> · Sitio ${escapeHtml(row.public_config?.site_id || 'MPE')} · Cola: ${queue.filter(item => item.status === 'pendiente').length} pendientes, ${queue.filter(item => item.status === 'error').length} con error</p>
          <button type="button" class="secondary-button compact" data-ml-connect>🔗 Conectar cuenta de Mercado Libre</button>`}
        <div class="c26-row"><label>Modo<select name="mode"><option value="sandbox" ${row.mode !== 'production' ? 'selected' : ''}>Pruebas (sandbox)</option><option value="production" ${row.mode === 'production' ? 'selected' : ''}>Producción</option></select></label>
          <label class="c26-switch"><input type="checkbox" name="enabled" ${row.enabled ? 'checked' : ''}> <span>Activar integración</span></label></div>
        <button class="primary-button compact">Guardar</button><p class="form-message" role="status"></p></form>`;
    };
    body.innerHTML = `<div class="notice-line">🔒 Las claves secretas (Access Token, Client Secret, clave del webhook) <strong>nunca</strong> se escriben aquí ni en config.js: van en <code>supabase secrets set</code>. Guía completa: <strong>docs/integraciones-mercado-pago-libre.md</strong>.</div>
      <div class="c26-grid two">${rows.map(card).join('')}</div>
      <div class="c26-grid two">
        <article class="c26-card"><div class="c26-card-head"><h2>Publicaciones de Mercado Libre</h2><button type="button" class="secondary-button compact" data-ml-prepare>Preparar borradores</button></div>
          <details class="c26-picker"><summary>Elegir productos (${products.length})</summary><div class="c26-picker-list">${products.map(product => `<label><input type="checkbox" value="${escapeHtml(product.id)}"> ${escapeHtml(product.name)} <small>${escapeHtml(product.sku)}</small></label>`).join('') || '<p class="c26-empty">Carga el catálogo en Productos e inventario.</p>'}</div></details>
          ${listings.length ? `<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Estado</th><th>Ítem ML</th><th>Sincronizado</th></tr></thead><tbody>${listings.map(item => `<tr><td>${escapeHtml(item.products?.name)}</td><td><b class="pill ${item.status === 'activo' ? 'ok' : item.status === 'error' ? 'bad' : 'wait'}">${escapeHtml(item.status)}</b>${item.last_error ? `<br><small>${escapeHtml(item.last_error)}</small>` : ''}</td><td>${item.permalink ? `<a href="${escapeHtml(item.permalink)}" target="_blank" rel="noopener">${escapeHtml(item.ml_item_id)}</a>` : escapeHtml(item.ml_item_id || '—')}</td><td>${dateTime(item.last_synced_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="c26-empty">Sin publicaciones todavía. Puedes dejarlas listas como borrador desde ya.</p>'}
          <p class="form-message" id="ml-message" role="status"></p></article>
        <article class="c26-card"><h2>Últimos avisos recibidos (webhooks)</h2>${events.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Origen</th><th>Evento</th><th>Estado</th></tr></thead><tbody>${events.map(event => `<tr><td>${dateTime(event.received_at)}</td><td>${event.provider === 'mercado_pago' ? 'Mercado Pago' : 'Mercado Libre'}</td><td>${escapeHtml(event.topic)} <small>${escapeHtml(event.resource_id)}</small></td><td><b class="pill ${event.status === 'procesado' ? 'ok' : event.status === 'error' ? 'bad' : 'wait'}">${escapeHtml(event.status)}</b>${event.signature_ok === false ? ' <small>firma inválida</small>' : ''}${event.error ? `<br><small>${escapeHtml(event.error)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="c26-empty">Aún no llegan avisos. Aparecerán aquí cuando conectes Mercado Pago o Mercado Libre.</p>'}</article>
      </div>`;
  }

  // ---------- Búsquedas ----------
  async function loadSearches() {
    const body = $('#searches-body');
    if (!body) return;
    let data = {total: 128, top: [{query: 'casaca negra', veces: 18, resultados: 9}, {query: 'perfume dulce', veces: 12, resultados: 6}, {query: 'nube', veces: 7, resultados: 1}], sin_resultados: [{query: 'bikini', veces: 5, ultima: new Date().toISOString()}, {query: 'pijama', veces: 3, ultima: new Date().toISOString()}]};
    if (!isDemo() && client) {
      const result = await client.rpc('admin_search_insights', {p_days: Number($('#search-range')?.value || 30)});
      if (result.error) { body.innerHTML = missingSql(result.error) ? sqlNotice : `<div class="notice-line warn">${escapeHtml(result.error.message)}</div>`; return; }
      data = result.data;
    }
    body.innerHTML = `<div class="c26-kpis"><article class="c26-kpi hero"><span>Búsquedas</span><strong>${number(data.total)}</strong><small>buscador + M.I.S.H.I.</small></article><article class="c26-kpi ${data.sin_resultados.length ? 'attention' : ''}"><span>Sin resultados</span><strong>${number(data.sin_resultados.reduce((sum, row) => sum + Number(row.veces), 0))}</strong><small>oportunidades de venta</small></article></div>
      <div class="c26-grid two">
        <article class="c26-card"><h2>Lo más buscado</h2>${data.top.length ? `<ol class="c26-top">${data.top.map(row => `<li><span>${escapeHtml(row.query)}</span><b>${number(row.veces)}×</b><small>${Number(row.resultados).toFixed(0)} resultados prom.</small></li>`).join('')}</ol>` : '<p class="c26-empty">Aún no hay búsquedas registradas.</p>'}</article>
        <article class="c26-card"><h2>Lo que buscan y no encuentran</h2>${data.sin_resultados.length ? `<ol class="c26-top">${data.sin_resultados.map(row => `<li><span>${escapeHtml(row.query)}</span><b>${number(row.veces)}×</b><small>última: ${dateTime(row.ultima)}</small></li>`).join('')}</ol><p class="c26-muted">Idea: agrega esos productos o usa esas palabras en nombres y descripciones.</p>` : '<p class="c26-empty">¡Todo lo que buscan lo encuentran!</p>'}</article>
      </div><p class="c26-muted">Las búsquedas se guardan sin nombre ni IP (solo un código anónimo) y se borran solas a los 180 días.</p>`;
  }

  // ---------- Eventos ----------
  const loaders = {insights: loadInsights, automation: loadAutomation, personalize: loadPersonalize, integrations: loadIntegrations, searches: loadSearches};
  document.addEventListener('click', async event => {
    const target = event.target;
    const nav = target.closest('[data-view]');
    if (nav && loaders[nav.dataset.view]) setTimeout(() => { if ($(`#view-${nav.dataset.view}`)?.classList.contains('active')) loaders[nav.dataset.view](); }, 0);
    const refresh = target.closest('[data-c26-refresh]');
    if (refresh) { loaders[refresh.dataset.c26Refresh]?.(); return; }
    const copy = target.closest('[data-copy]');
    if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = 'Copiado ✓'; } catch {} return; }
    if (target.closest('#export-restock')) { exportCsv([['Producto', 'SKU', 'Variante', 'Stock', 'Vendidos 30d', 'Venta/día', 'Días de cobertura', 'Pedir', 'Prioridad'], ...suggestionsCache.map(row => [row.product_name, row.sku, row.variant, row.stock, row.vendidos, row.por_dia, row.dias_cobertura, row.sugerido, row.prioridad])], `reposicion-msj-${new Date().toISOString().slice(0, 10)}.csv`); return; }
    if (target.closest('#run-automations')) {
      const button = target.closest('#run-automations');
      if (isDemo()) { flash($('#automation-message'), 'Modo demostración: en vivo se ejecutan las reglas en el servidor.'); return; }
      button.disabled = true;
      const {data, error} = await client.rpc('run_automations');
      button.disabled = false;
      if (error) { alert(missingSql(error) ? 'Ejecuta database/v2026.sql primero.' : error.message); return; }
      await loadAutomation();
      flash($('#automation-message'), `Listo: ${Object.entries(data || {}).map(([key, value]) => `${key.replace(/_/g, ' ')} ${value}`).join(' · ')}`);
      return;
    }
    if (target.closest('[data-ml-connect]')) {
      if (isDemo() || !client) { alert('Disponible con Supabase y la función ml-oauth desplegada.'); return; }
      const {data, error} = await client.functions.invoke('ml-oauth', {body: {action: 'start'}});
      if (error || !data?.url) { alert('Aún no se puede conectar: despliega ml-oauth y guarda ML_APP_ID / ML_CLIENT_SECRET (ver la guía).'); return; }
      window.open(data.url, '_blank', 'noopener');
      return;
    }
    if (target.closest('[data-ml-prepare]')) {
      const ids = [...document.querySelectorAll('.c26-picker-list input:checked')].map(input => input.value);
      const message = $('#ml-message');
      if (!ids.length) { flash(message, 'Elige al menos un producto en «Elegir productos».', false); document.querySelector('.c26-picker')?.setAttribute('open', ''); return; }
      if (isDemo()) { flash(message, `Modo demostración: ${ids.length} borradores.`); return; }
      const {data, error} = await client.rpc('ml_admin_prepare', {p_product_ids: ids, p_publish: false});
      flash(message, error ? error.message : `${data} borrador(es) nuevo(s). Se publicarán cuando conectes Mercado Libre.`, !error);
      if (!error) loadIntegrations();
    }
  });
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id === 'threshold-form') {
      event.preventDefault();
      const value = Math.max(0, Math.min(100, Number(new FormData(form).get('threshold')) || 0));
      if (isDemo()) { flash($('#threshold-message'), 'Modo demostración.'); return; }
      const {data: current} = await client.from('store_settings').select('value').eq('key', 'automation').maybeSingle();
      const {error} = await client.rpc('admin_save_setting', {p_key: 'automation', p_value: {...(current?.value || {}), low_stock_threshold: value}});
      flash($('#threshold-message'), error ? error.message : `Umbral guardado: ${value} unidades. Las alertas nuevas lo usarán.`, !error);
      return;
    }
    if (form.dataset.setting) {
      event.preventDefault();
      const message = form.querySelector('.form-message');
      const value = readForm(form);
      if (isDemo()) { flash(message, 'Modo demostración: no se guarda.'); return; }
      const {error} = await client.rpc('admin_save_setting', {p_key: form.dataset.setting, p_value: value});
      if (!error) settings[form.dataset.setting] = value;
      flash(message, error ? (missingSql(error) ? 'Ejecuta database/v2026.sql primero.' : error.message) : 'Guardado ✓ Ya se ve en la tienda.', !error);
      return;
    }
    if (form.dataset.integration) {
      event.preventDefault();
      const message = form.querySelector('.form-message');
      const values = new FormData(form);
      if (isDemo()) { flash(message, 'Modo demostración.'); return; }
      const publicConfig = form.dataset.integration === 'mercado_pago' ? {public_key: String(values.get('public_key') || '').trim()} : {};
      if (publicConfig.public_key && !/^(APP_USR|TEST)-[\w-]{10,}$/.test(publicConfig.public_key)) { flash(message, 'La Public Key empieza con APP_USR- o TEST-. No pegues el Access Token aquí.', false); return; }
      const {error} = await client.rpc('admin_set_integration', {p_provider: form.dataset.integration, p_enabled: values.get('enabled') === 'on', p_mode: String(values.get('mode')), p_public_config: publicConfig});
      flash(message, error ? (missingSql(error) ? 'Ejecuta database/v2026.sql primero.' : error.message) : 'Guardado ✓', !error);
      if (!error) setTimeout(loadIntegrations, 600);
    }
  });
  document.addEventListener('change', event => { if (event.target.id === 'search-range') loadSearches(); });
})();
