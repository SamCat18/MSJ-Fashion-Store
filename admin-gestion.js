// Gestión del panel: ganancias, proveedores e ingresos de mercadería, movimientos de inventario,
// avisos de pagos con Yape/Lemon y modo oscuro. Requiere database/gestion.sql (y campaigns.sql para los pagos QR).
(() => {
  const config = window.STORE_CONFIG || {};
  // Reutiliza el cliente de admin.js para compartir la sesión del administrador sin duplicar la renovación del token.
  const client = window.MSJAdminClient || (window.supabase && config.supabaseUrl ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('es-PE', {style: 'currency', currency: 'PEN'}).format(Number(value || 0));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[char]));
  const dateTime = value => value ? new Intl.DateTimeFormat('es-PE', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value)) : '—';
  const dateOnly = value => value ? new Intl.DateTimeFormat('es-PE', {day: 'numeric', month: 'short', year: 'numeric'}).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : '—';
  const isDemo = () => !$('#demo-banner')?.hidden;
  const missing = text => `<div class="notice-line">${escapeHtml(text)}</div>`;
  const wallets = {yape: 'Yape', lemon: 'Lemon'};
  const state = {variants: [], suppliers: [], deliveries: [], movements: [], profit: null, seen: new Set(), fixed: 400};
  try { state.seen = new Set(JSON.parse(localStorage.getItem('msj-admin-seen-payments') || '[]')); state.fixed = Number(localStorage.getItem('msj-admin-fixed-costs')) || 400; } catch {}

  // ---------- Modo oscuro del panel ----------
  const themeKey = 'msj-admin-theme';
  function applyTheme() { let dark = false; try { dark = localStorage.getItem(themeKey) === 'dark'; } catch {} document.documentElement.classList.toggle('msj-dark', dark); const button = $('#admin-theme'); if (button) { button.textContent = dark ? '☀ Claro' : '☾ Oscuro'; button.setAttribute('aria-pressed', String(dark)); } }
  const user = $('.admin-user');
  if (user) user.insertAdjacentHTML('afterbegin', '<button class="admin-bell" id="admin-bell" type="button" aria-label="Pagos por verificar" hidden>🔔 <b id="admin-bell-count">0</b></button><button class="admin-theme" id="admin-theme" type="button" aria-pressed="false">☾ Oscuro</button>');
  $('#admin-theme')?.addEventListener('click', () => { const dark = !document.documentElement.classList.contains('msj-dark'); try { localStorage.setItem(themeKey, dark ? 'dark' : 'light'); } catch {} applyTheme(); });
  applyTheme();

  // ---------- Vistas nuevas ----------
  const ordersLink = $('.side-link[data-view="orders"]');
  if (ordersLink) ordersLink.insertAdjacentHTML('afterend', '<button class="side-link" data-view="profit"><span>📈</span>Ganancias</button><button class="side-link" data-view="suppliers"><span>🚚</span>Proveedores e ingresos</button><button class="side-link" data-view="movements"><span>⇅</span>Movimientos de stock</button>');
  const main = $('.admin-main');
  if (main) main.insertAdjacentHTML('beforeend', `
    <section class="admin-view" id="view-profit"><div class="page-heading"><div><p class="eyebrow">RENTABILIDAD</p><h1>Ganancias</h1></div><div class="table-tools compact-tools"><select id="profit-range" aria-label="Periodo"><option value="7">Últimos 7 días</option><option value="30" selected>Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="month">Este mes</option></select><button class="secondary-button compact" id="refresh-profit">Actualizar</button></div></div><div id="profit-body"></div></section>
    <section class="admin-view" id="view-suppliers"><div class="page-heading"><div><p class="eyebrow">ABASTECIMIENTO</p><h1>Proveedores e ingresos de mercadería</h1></div><button class="secondary-button compact" id="refresh-suppliers">Actualizar</button></div><div id="suppliers-body"></div></section>
    <section class="admin-view" id="view-movements"><div class="page-heading"><div><p class="eyebrow">TRAZABILIDAD DEL INVENTARIO</p><h1>Movimientos de stock</h1></div><div class="table-tools compact-tools"><select id="movement-filter" aria-label="Filtrar movimientos"><option value="all">Todos</option><option value="venta">Ventas</option><option value="compra">Compras a proveedores</option><option value="ajuste">Ajustes</option><option value="alta">Altas</option></select><button class="secondary-button compact" id="export-movements">Exportar CSV</button></div></div><div id="movements-body"></div></section>`);

  function exportCsv(rows, name) { const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['﻿' + csv], {type: 'text/csv;charset=utf-8'})); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }

  // ---------- Ganancias ----------
  function profitRange() { const value = $('#profit-range')?.value || '30'; const to = new Date(); const from = new Date(); if (value === 'month') { from.setDate(1); from.setHours(0, 0, 0, 0); } else from.setDate(from.getDate() - Number(value)); return {from, to}; }
  function demoProfit() { const days = Array.from({length: 14}, (_, index) => { const day = new Date(); day.setDate(day.getDate() - 13 + index); const orders = 2 + (index * 7 % 5); return {day: day.toISOString().slice(0, 10), orders, sales: orders * 148}; }); const sales = days.reduce((sum, day) => sum + day.sales, 0); const cost = Math.round(sales * 0.55); const orders = days.reduce((sum, day) => sum + day.orders, 0); return {demo: true, orders, units: orders * 2, sales, paid_sales: Math.round(sales * 0.8), shipping: orders * 9, donations: orders * 1.5, cost, store_donation: Math.round(sales) / 100, profit: Math.round(sales - cost - sales / 100), margin: Math.round((sales - cost - sales / 100) / sales * 1000) / 10, ticket: Math.round(sales / orders), daily: days, top: [{name: 'Polo Essential Oversize', units: 18, revenue: 1062, profit: 478}, {name: 'Casaca Bomber Urban', units: 7, revenue: 1393, profit: 627}, {name: 'Perfume Maison Noir 100 ml', units: 6, revenue: 1194, profit: 537}, {name: 'Zapatillas Runner Pro', units: 5, revenue: 995, profit: 448}]}; }
  async function loadProfit() {
    const body = $('#profit-body'); if (!body) return; body.innerHTML = '<p class="notice-line">Calculando…</p>';
    let data = null;
    if (isDemo() || !client) data = demoProfit();
    else { const {from, to} = profitRange(); const result = await client.rpc('admin_profit_report', {p_from: from.toISOString(), p_to: to.toISOString()}); if (result.error) { body.innerHTML = missing('El reporte se activa al ejecutar database/gestion.sql en Supabase (requiere rol administrador).'); return; } data = result.data; }
    state.profit = data; renderProfit();
  }
  function renderProfit() {
    const data = state.profit, body = $('#profit-body'); if (!data || !body) return;
    const net = Number(data.profit) - state.fixed; const max = Math.max(1, ...(data.daily || []).map(day => Number(day.sales)));
    body.innerHTML = `${data.demo ? '<div class="notice-line">Modo demostración: cifras de ejemplo para mostrar cómo se calcula la ganancia.</div>' : ''}
      <div class="metric-grid profit-grid">
        <article class="metric"><span>Ventas de mercadería</span><strong>${money(data.sales)}</strong><small>${data.orders} pedidos · ticket ${money(data.ticket)}</small></article>
        <article class="metric"><span>Costo de mercadería</span><strong>${money(data.cost)}</strong><small>${data.units} unidades vendidas</small></article>
        <article class="metric highlight"><span>Ganancia bruta</span><strong>${money(data.profit)}</strong><small>Margen ${Number(data.margin).toFixed(1)} % · tras el 1 % solidario</small></article>
        <article class="metric ${net >= 0 ? 'good' : 'bad'}"><span>Ganancia neta estimada</span><strong>${money(net)}</strong><small>Menos costos fijos de ${money(state.fixed)}</small></article>
      </div>
      <div class="overview-columns">
        <section class="data-panel"><div class="panel-title"><h2>Ventas por día</h2></div><div class="profit-chart">${(data.daily || []).map(day => `<div class="profit-bar" title="${escapeHtml(dateOnly(day.day))}: ${money(day.sales)} · ${day.orders} pedidos"><i style="height:${Math.max(4, Math.round(Number(day.sales) / max * 100))}%"></i><small>${escapeHtml(String(day.day).slice(8, 10))}</small></div>`).join('') || '<p class="notice-line">Sin ventas en el periodo.</p>'}</div></section>
        <section class="data-panel"><div class="panel-title"><h2>Cómo se calcula</h2></div><ul class="profit-formula">
          <li><span>Ventas (sin envío, con descuentos)</span><b>${money(data.sales)}</b></li>
          <li><span>− Costo de mercadería</span><b>−${money(data.cost)}</b></li>
          <li><span>− Aporte solidario MSJ (1 %)</span><b>−${money(data.store_donation)}</b></li>
          <li class="total"><span>= Ganancia bruta</span><b>${money(data.profit)}</b></li>
          <li><span>− Costos fijos del mes <input id="fixed-costs" type="number" min="0" step="10" value="${state.fixed}" aria-label="Costos fijos mensuales"></span><b>−${money(state.fixed)}</b></li>
          <li class="total"><span>= Ganancia neta estimada</span><b>${money(net)}</b></li>
          <li class="aside"><span>Cobrado y verificado</span><b>${money(data.paid_sales)}</b></li>
          <li class="aside"><span>Envíos cobrados (cubren el delivery)</span><b>${money(data.shipping)}</b></li>
          <li class="aside"><span>Donaciones de clientes (no son ingreso)</span><b>${money(data.donations)}</b></li>
        </ul><p class="notice-line">El costo usa el «costo unitario» de cada producto (se actualiza al recibir mercadería). Si no tiene, se estima en 55 % del precio.</p></section>
      </div>
      <section class="data-panel"><div class="panel-title"><h2>Productos más rentables</h2></div><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Unidades</th><th>Ventas</th><th>Ganancia</th></tr></thead><tbody>${(data.top || []).map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${item.units}</td><td>${money(item.revenue)}</td><td><strong>${money(item.profit)}</strong></td></tr>`).join('') || '<tr><td colspan="4">Sin ventas en el periodo.</td></tr>'}</tbody></table></div></section>`;
  }

  // ---------- Proveedores e ingresos ----------
  function demoSuppliers() { const day = offset => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); }; state.suppliers = [{id: 'd1', name: 'Textiles Gamarra (ejemplo)', contact: 'Ventas mayoristas', category: 'Polos, poleras y casacas', lead_days: 5, is_active: true}, {id: 'd2', name: 'Calzado Trujillo (ejemplo)', contact: 'Área comercial', category: 'Zapatillas y zapatos', lead_days: 7, is_active: true}]; state.deliveries = [{id: 'x1', supplier_id: 'd1', suppliers: {name: 'Textiles Gamarra (ejemplo)'}, product_variants: {size: 'M', color: 'Negro', products: {name: 'Polo Essential Oversize'}}, quantity: 40, unit_cost: 22, status: 'pendiente', expected_at: day(2)}, {id: 'x2', supplier_id: 'd2', suppliers: {name: 'Calzado Trujillo (ejemplo)'}, product_variants: {size: '40', color: 'Blanco', products: {name: 'Zapatillas Runner Pro'}}, quantity: 12, unit_cost: 95, status: 'pendiente', expected_at: day(-1)}, {id: 'x3', supplier_id: 'd1', suppliers: {name: 'Textiles Gamarra (ejemplo)'}, product_variants: {size: 'L', color: 'Beige', products: {name: 'Casaca Bomber Urban'}}, quantity: 15, unit_cost: 89, status: 'recibido', expected_at: day(-6), received_at: new Date(Date.now() - 5 * 864e5).toISOString()}]; }
  async function loadSuppliers() {
    const body = $('#suppliers-body'); if (!body) return; body.innerHTML = '<p class="notice-line">Cargando…</p>';
    if (isDemo() || !client) { demoSuppliers(); renderSuppliers(true); return; }
    const [suppliers, deliveries, variants] = await Promise.all([
      client.from('suppliers').select('*').order('name'),
      client.from('supplier_deliveries').select('id,supplier_id,quantity,unit_cost,status,expected_at,received_at,notes,created_at,suppliers(name),product_variants(size,color,products(name))').order('created_at', {ascending: false}).limit(200),
      state.variants.length ? {data: state.variants} : client.from('product_variants').select('id,size,color,stock,products(name)').eq('is_active', true).limit(3000)
    ]);
    if (suppliers.error) { body.innerHTML = missing('Proveedores se activa al ejecutar database/gestion.sql en Supabase (requiere rol administrador).'); return; }
    state.suppliers = suppliers.data || []; state.deliveries = deliveries.data || []; state.variants = (variants.data || []).sort((a, b) => String(a.products?.name).localeCompare(String(b.products?.name)));
    renderSuppliers(false);
  }
  function arrival(delivery) { if (delivery.status === 'recibido') return `<span class="status-pill delivered">Recibido ${escapeHtml(dateOnly(delivery.received_at))}</span>`; if (delivery.status === 'cancelado') return '<span class="status-pill cancelled">Cancelado</span>'; const days = Math.round((new Date(`${delivery.expected_at}T12:00:00`) - new Date()) / 864e5); return days < 0 ? `<span class="status-pill cancelled">Atrasado ${-days} d</span>` : `<span class="status-pill pending">${days === 0 ? 'Llega hoy' : `Llega en ${days} d`}</span>`; }
  function renderSuppliers(demo) {
    const body = $('#suppliers-body'); const pending = state.deliveries.filter(item => item.status === 'pendiente'); const late = pending.filter(item => new Date(`${item.expected_at}T23:59:59`) < new Date()); const invested = pending.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
    body.innerHTML = `${demo ? '<div class="notice-line">Modo demostración: proveedores e ingresos de ejemplo.</div>' : ''}
      <div class="metric-grid"><article class="metric"><span>Proveedores activos</span><strong>${state.suppliers.filter(item => item.is_active).length}</strong><small>Con datos de contacto</small></article><article class="metric"><span>Ingresos por llegar</span><strong>${pending.length}</strong><small>${pending.reduce((sum, item) => sum + item.quantity, 0)} unidades</small></article><article class="metric ${late.length ? 'bad' : ''}"><span>Atrasados</span><strong>${late.length}</strong><small>Pasaron su fecha de llegada</small></article><article class="metric"><span>Inversión en camino</span><strong>${money(invested)}</strong><small>Costo de lo pendiente</small></article></div>
      <section class="data-panel"><div class="panel-title"><h2>Ingresos de mercadería</h2></div>
        ${demo ? '' : `<form class="gestion-form" id="delivery-form"><select name="supplier_id" required aria-label="Proveedor"><option value="">Proveedor…</option>${state.suppliers.filter(item => item.is_active).map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select><select name="variant_id" required aria-label="Producto y variante"><option value="">Producto · talla · color…</option>${state.variants.map(item => `<option value="${item.id}">${escapeHtml(item.products?.name)} · ${escapeHtml(item.size)} · ${escapeHtml(item.color)} (stock ${item.stock})</option>`).join('')}</select><input name="quantity" type="number" min="1" max="10000" required placeholder="Cantidad" aria-label="Cantidad"><input name="unit_cost" type="number" min="0" step="0.01" required placeholder="Costo unit. S/" aria-label="Costo unitario"><input name="expected_at" type="date" required aria-label="Fecha de llegada"><button class="primary-button compact">+ Registrar ingreso</button></form><p class="form-message" id="delivery-message" role="status"></p>`}
        <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Proveedor</th><th>Cantidad</th><th>Costo</th><th>Llegada</th><th></th></tr></thead><tbody>${state.deliveries.map(item => `<tr><td>${escapeHtml(item.product_variants?.products?.name || 'Producto')}<small>${escapeHtml(item.product_variants?.size || '')} · ${escapeHtml(item.product_variants?.color || '')}</small></td><td>${escapeHtml(item.suppliers?.name || '')}</td><td>${item.quantity}</td><td>${money(item.unit_cost)}<small>Total ${money(item.quantity * item.unit_cost)}</small></td><td>${arrival(item)}<small>${escapeHtml(dateOnly(item.expected_at))}</small></td><td>${item.status === 'pendiente' && !demo ? `<button class="secondary-button compact" data-receive="${item.id}">✓ Recibir</button> <button class="text-button" data-cancel-delivery="${item.id}">Cancelar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Aún no registras ingresos.</td></tr>'}</tbody></table></div></section>
      <section class="data-panel"><div class="panel-title"><h2>Proveedores</h2></div>
        ${demo ? '' : '<form class="gestion-form" id="supplier-form"><input name="name" required minlength="2" maxlength="120" placeholder="Nombre o razón social" aria-label="Nombre"><input name="ruc" maxlength="11" inputmode="numeric" placeholder="RUC (opcional)" aria-label="RUC"><input name="contact" maxlength="120" placeholder="Contacto" aria-label="Contacto"><input name="phone" maxlength="30" placeholder="Teléfono" aria-label="Teléfono"><input name="category" maxlength="80" placeholder="Qué provee" aria-label="Qué provee"><input name="lead_days" type="number" min="0" max="120" value="7" aria-label="Días de entrega"><button class="primary-button compact">+ Agregar proveedor</button></form><p class="form-message" id="supplier-message" role="status"></p>'}
        <div class="table-wrap"><table><thead><tr><th>Proveedor</th><th>Provee</th><th>Contacto</th><th>Entrega</th><th>Estado</th></tr></thead><tbody>${state.suppliers.map(item => `<tr><td>${escapeHtml(item.name)}${item.ruc ? `<small>RUC ${escapeHtml(item.ruc)}</small>` : ''}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.contact)}${item.phone ? `<small>☎ ${escapeHtml(item.phone)}</small>` : ''}</td><td>${item.lead_days} días</td><td>${demo ? 'Activo' : `<button class="text-button" data-toggle-supplier="${item.id}">${item.is_active ? 'Activo · desactivar' : 'Inactivo · activar'}</button>`}</td></tr>`).join('')}</tbody></table></div></section>`;
    const expected = $('#delivery-form [name="expected_at"]'); if (expected) { const date = new Date(); date.setDate(date.getDate() + 7); expected.value = date.toISOString().slice(0, 10); }
  }

  // ---------- Movimientos de stock ----------
  const reasons = {venta: 'Venta', compra: 'Compra a proveedor', ajuste: 'Ajuste manual', alta: 'Alta de producto'};
  async function loadMovements() {
    const body = $('#movements-body'); if (!body) return; body.innerHTML = '<p class="notice-line">Cargando…</p>';
    if (isDemo() || !client) { const ago = hours => new Date(Date.now() - hours * 36e5).toISOString(); state.movements = [{created_at: ago(1), delta: -2, stock_after: 18, reason: 'venta', product_variants: {size: 'M', color: 'Negro', products: {name: 'Polo Essential Oversize'}}}, {created_at: ago(5), delta: 40, stock_after: 20, reason: 'compra', product_variants: {size: 'M', color: 'Negro', products: {name: 'Polo Essential Oversize'}}}, {created_at: ago(26), delta: -1, stock_after: 4, reason: 'venta', product_variants: {size: '40', color: 'Blanco', products: {name: 'Zapatillas Runner Pro'}}}, {created_at: ago(50), delta: 3, stock_after: 5, reason: 'ajuste', product_variants: {size: '40', color: 'Blanco', products: {name: 'Zapatillas Runner Pro'}}}]; renderMovements(true); return; }
    const result = await client.from('inventory_movements').select('id,delta,stock_after,reason,created_at,actor_id,product_variants(size,color,products(name))').order('created_at', {ascending: false}).limit(300);
    if (result.error) { body.innerHTML = missing('No se pudieron leer los movimientos. Requiere rol administrador y el database/schema.sql actualizado.'); return; }
    state.movements = result.data || []; renderMovements(false);
  }
  function renderMovements(demo) {
    const filter = $('#movement-filter')?.value || 'all'; const rows = state.movements.filter(item => filter === 'all' || item.reason === filter);
    const sum = reason => state.movements.filter(item => item.reason === reason).reduce((total, item) => total + Math.abs(item.delta), 0);
    $('#movements-body').innerHTML = `${demo ? '<div class="notice-line">Modo demostración: movimientos de ejemplo.</div>' : ''}<div class="metric-grid"><article class="metric"><span>Unidades vendidas</span><strong>${sum('venta')}</strong><small>Salidas por pedidos</small></article><article class="metric"><span>Unidades compradas</span><strong>${sum('compra')}</strong><small>Ingresos de proveedores</small></article><article class="metric"><span>Ajustes</span><strong>${state.movements.filter(item => item.reason === 'ajuste').length}</strong><small>Cambios manuales de stock</small></article><article class="metric"><span>Registros</span><strong>${state.movements.length}</strong><small>Últimos 300 movimientos</small></article></div>
      <section class="data-panel"><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Motivo</th><th>Cambio</th><th>Stock final</th></tr></thead><tbody>${rows.map(item => `<tr><td>${dateTime(item.created_at)}</td><td>${escapeHtml(item.product_variants?.products?.name || 'Producto')}<small>${escapeHtml(item.product_variants?.size || '')} · ${escapeHtml(item.product_variants?.color || '')}</small></td><td><span class="move-tag ${escapeHtml(item.reason)}">${escapeHtml(reasons[item.reason] || item.reason)}</span></td><td class="${item.delta < 0 ? 'neg' : 'pos'}"><strong>${item.delta > 0 ? '+' : ''}${item.delta}</strong></td><td>${item.stock_after}</td></tr>`).join('') || '<tr><td colspan="5">Sin movimientos.</td></tr>'}</tbody></table></div></section>`;
  }

  // ---------- Avisos de pagos con Yape / Lemon ----------
  let pollTimer = 0, audio = null;
  function beep() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); [0, .18].forEach(delay => { const osc = audio.createOscillator(), gain = audio.createGain(); osc.frequency.value = 880; gain.gain.setValueAtTime(.12, audio.currentTime + delay); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + delay + .16); osc.connect(gain).connect(audio.destination); osc.start(audio.currentTime + delay); osc.stop(audio.currentTime + delay + .17); }); } catch {} }
  function toast(html) { const node = document.createElement('div'); node.className = 'pay-toast'; node.innerHTML = html; document.body.append(node); setTimeout(() => node.classList.add('show'), 20); setTimeout(() => { node.classList.remove('show'); setTimeout(() => node.remove(), 400); }, 9000); node.addEventListener('click', () => { document.querySelector('[data-view="orders"]')?.click(); node.remove(); }); }
  async function checkPayments(first) {
    if (!client || isDemo() || $('#admin-shell')?.hidden) return;
    const result = await client.from('orders').select('id,total,payment_method,yape_operation,recipient,created_at').in('payment_method', ['yape', 'lemon']).eq('payment_status', 'pending').order('created_at', {ascending: false}).limit(30);
    if (result.error) return;
    const pending = result.data || []; const bell = $('#admin-bell'); if (bell) { bell.hidden = !pending.length; $('#admin-bell-count').textContent = pending.length; bell.title = pending.map(item => `${wallets[item.payment_method]} · op. ${item.yape_operation} · ${money(item.total)}`).join('\n'); }
    const link = $('.side-link[data-view="orders"]'); if (link) link.dataset.badge = pending.length ? String(pending.length) : '';
    const fresh = pending.filter(item => !state.seen.has(item.id));
    fresh.forEach(item => state.seen.add(item.id)); try { localStorage.setItem('msj-admin-seen-payments', JSON.stringify([...state.seen].slice(-300))); } catch {}
    if (first || !fresh.length) return;
    beep();
    fresh.slice(0, 3).forEach(item => { toast(`<strong>💸 Nuevo pago con ${escapeHtml(wallets[item.payment_method])}</strong><span>Operación <b>${escapeHtml(item.yape_operation)}</b> · ${money(item.total)}</span><small>${escapeHtml(item.recipient)} · pedido ${escapeHtml(item.id.slice(0, 8).toUpperCase())} — verifícalo en tu app y apruébalo o recházalo en Pedidos</small>`); if ('Notification' in window && Notification.permission === 'granted') new Notification(`Nuevo pago ${wallets[item.payment_method]}: ${money(item.total)}`, {body: `Operación ${item.yape_operation} · ${item.recipient}`}); });
  }
  function startPolling() { if (pollTimer || !client) return; checkPayments(true); pollTimer = setInterval(() => checkPayments(false), 20000); if ('Notification' in window && Notification.permission === 'default') document.addEventListener('click', () => Notification.requestPermission(), {once: true}); }
  new MutationObserver(() => { if (!$('#admin-shell')?.hidden) startPolling(); }).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['hidden']});
  if (!$('#admin-shell')?.hidden) startPolling();

  // ---------- Eventos ----------
  const loaders = {profit: loadProfit, suppliers: loadSuppliers, movements: loadMovements};
  document.addEventListener('click', async event => {
    const target = event.target;
    const nav = target.closest('[data-view]'); if (nav && loaders[nav.dataset.view]) setTimeout(() => { if ($(`#view-${nav.dataset.view}`)?.classList.contains('active')) loaders[nav.dataset.view](); }, 0);
    if (target.closest('#admin-bell')) { document.querySelector('.side-link[data-view="orders"]')?.click(); return; }
    if (target.closest('#refresh-profit')) loadProfit();
    if (target.closest('#refresh-suppliers')) { state.variants = []; loadSuppliers(); }
    if (target.closest('#export-movements')) exportCsv([['Fecha', 'Producto', 'Talla', 'Color', 'Motivo', 'Cambio', 'Stock final'], ...state.movements.map(item => [item.created_at, item.product_variants?.products?.name, item.product_variants?.size, item.product_variants?.color, reasons[item.reason] || item.reason, item.delta, item.stock_after])], 'msj-movimientos-stock.csv');
    const receive = target.closest('[data-receive]'); if (receive) { if (!confirm('¿Confirmas que llegó esta mercadería? Se sumará al stock.')) return; receive.disabled = true; const {error} = await client.rpc('receive_delivery', {p_delivery: receive.dataset.receive}); if (error) { alert(error.message); receive.disabled = false; return; } state.variants = []; loadSuppliers(); }
    const cancel = target.closest('[data-cancel-delivery]'); if (cancel) { if (!confirm('¿Cancelar este ingreso?')) return; await client.from('supplier_deliveries').update({status: 'cancelado'}).eq('id', cancel.dataset.cancelDelivery); loadSuppliers(); }
    const toggle = target.closest('[data-toggle-supplier]'); if (toggle) { const supplier = state.suppliers.find(item => item.id === toggle.dataset.toggleSupplier); await client.from('suppliers').update({is_active: !supplier.is_active}).eq('id', supplier.id); loadSuppliers(); }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'profit-range') loadProfit();
    if (event.target.id === 'movement-filter') renderMovements(isDemo());
    if (event.target.id === 'fixed-costs') { state.fixed = Math.max(0, Number(event.target.value) || 0); try { localStorage.setItem('msj-admin-fixed-costs', String(state.fixed)); } catch {} renderProfit(); }
  });
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id === 'supplier-form') { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const ruc = String(values.ruc || '').replace(/\D/g, ''); if (ruc && !/^(10|20)\d{9}$/.test(ruc)) { $('#supplier-message').textContent = 'El RUC debe tener 11 dígitos y empezar con 10 o 20.'; return; } const {error} = await client.from('suppliers').insert({name: values.name.trim(), ruc: ruc || null, contact: values.contact.trim(), phone: values.phone.trim(), category: values.category.trim(), lead_days: Number(values.lead_days) || 7}); if (error) { $('#supplier-message').textContent = error.message; return; } loadSuppliers(); }
    if (form.id === 'delivery-form') { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const {error} = await client.from('supplier_deliveries').insert({supplier_id: values.supplier_id, variant_id: values.variant_id, quantity: Number(values.quantity), unit_cost: Number(values.unit_cost), expected_at: values.expected_at}); if (error) { $('#delivery-message').textContent = error.message; return; } loadSuppliers(); }
  });
})();
