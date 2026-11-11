// Mercado Pago (Checkout Pro) en la tienda. OCULTO hasta que existan las credenciales:
//   1) config.js → features.mercadoPago: true
//   2) Panel → Centro 2026 → Integraciones → Mercado Pago activado (public key guardada)
// El cobro y la confirmación pasan SIEMPRE por el servidor: la Edge Function mp-create-preference crea el pago y
// mp-webhook (firmado por Mercado Pago) marca el pedido como pagado, emite la boleta y la envía por correo.
// El navegador solo redirige y muestra el estado: nunca decide si un pago está aprobado.
window.MSJMercadoPago = (() => {
  const config = window.STORE_CONFIG || {};
  const flag = config.features?.mercadoPago === true;
  const pendingKey = 'msj-mp-pending';
  let serverEnabled = false;
  const app = () => window.MSJApp || {};
  const escape = value => (app().escapeHtml || (text => String(text ?? '')))(value);
  const money = value => (app().money || (amount => `S/ ${Number(amount || 0).toFixed(2)}`))(value);
  const available = () => flag && serverEnabled;

  async function init() {
    const client = app().client;
    if (!flag || !client) return;
    const {data, error} = await client.rpc('store_integrations');
    serverEnabled = !error && Boolean(data?.mercado_pago?.enabled);
    if (serverEnabled) { handleReturn(); decorateOrders(); }
  }
  function returnBase() {
    const site = String(config.siteUrl || '').trim();
    if (/^https:\/\//i.test(site)) return `${site.replace(/\/+$/, '')}/cuenta.html`;
    return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}cuenta.html`;
  }
  function busy(title, text) {
    app().openDialog?.(`<div class="order-success mp-wait"><span class="mp-spinner" aria-hidden="true"></span><h2 class="dialog-heading">${escape(title)}</h2><p class="dialog-subtitle">${escape(text)}</p></div>`, 'auth-dialog');
  }

  async function pay(orderId, {code = String(orderId).slice(0, 8).toUpperCase(), total = null} = {}) {
    const client = app().client;
    if (!client || !available()) { app().showToast?.('Mercado Pago aún no está disponible.'); return; }
    busy('Conectando con Mercado Pago…', `Pedido ${code}${total !== null ? ` · ${money(total)}` : ''}. Te llevamos a la página segura de pago.`);
    const {data, error} = await client.functions.invoke('mp-create-preference', {body: {order_id: orderId, return_url: returnBase()}});
    if (error || !data?.init_point) {
      let message = 'No pudimos abrir el pago. Tu pedido quedó reservado: puedes pagarlo desde Mis pedidos.';
      try { const detail = await error?.context?.json?.(); if (detail?.error) message = detail.error; } catch {}
      app().openDialog?.(`<button class="dialog-close" data-close aria-label="Cerrar">×</button><div class="order-success"><h2 class="dialog-heading">Pedido ${escape(code)} reservado</h2><p class="dialog-subtitle">${escape(message)}</p><button class="primary-button" data-mp-retry="${escape(orderId)}">Intentar de nuevo</button><a class="secondary-button" href="cuenta.html">Ver mis pedidos</a></div>`, 'auth-dialog');
      return;
    }
    try { sessionStorage.setItem(pendingKey, JSON.stringify({orderId, code, at: Date.now()})); } catch {}
    location.href = data.init_point;
  }

  // Vuelta desde Mercado Pago: cuenta.html?mp=success|pending|failure&external_reference=<pedido>&payment_id=…
  // Se espera la confirmación del webhook leyendo el pedido (hasta ~75 s); el navegador no marca nada como pagado.
  async function handleReturn() {
    const params = new URLSearchParams(location.search);
    const result = params.get('mp');
    if (!result) return;
    let saved = {}; try { saved = JSON.parse(sessionStorage.getItem(pendingKey) || '{}'); } catch {}
    const orderId = params.get('external_reference') || saved.orderId;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch {}
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return;
    const code = orderId.slice(0, 8).toUpperCase();
    if (result === 'failure') {
      app().openDialog?.(`<button class="dialog-close" data-close aria-label="Cerrar">×</button><div class="order-success"><h2 class="dialog-heading">El pago no se completó</h2><p class="dialog-subtitle">Tu pedido ${escape(code)} sigue reservado por un tiempo. Puedes intentarlo con otra tarjeta o método.</p><button class="primary-button" data-mp-retry="${escape(orderId)}">Intentar de nuevo</button><a class="secondary-button" href="cuenta.html">Ver mis pedidos</a></div>`, 'auth-dialog');
      return;
    }
    busy('Confirmando tu pago…', `Mercado Pago nos está avisando del pedido ${code}. Esto toma unos segundos.`);
    const client = app().client;
    if (!app().user) await new Promise(resolve => { const done = () => resolve(); document.addEventListener('msj:session', done, {once: true}); setTimeout(done, 6000); });
    let order = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      const {data} = await client.from('orders').select('id,status,payment_status,total').eq('id', orderId).maybeSingle();
      order = data;
      if (order?.payment_status === 'paid' || order?.status === 'cancelled') break;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    try { sessionStorage.removeItem(pendingKey); } catch {}
    if (order?.payment_status === 'paid') {
      app().openDialog?.(`<button class="dialog-close" data-close aria-label="Cerrar">×</button><div class="order-success"><span class="success-mark" aria-hidden="true">✓</span><h2 class="dialog-heading">¡Pago aprobado!</h2><p class="dialog-subtitle">Pedido <strong>${escape(code)}</strong> confirmado por ${money(order.total)}. Tu boleta llega a tu correo y la ves en Mis pedidos. Sumaste puntos MSJ ✦</p><a class="primary-button" href="cuenta.html#pedidos">Ver mi pedido</a></div>`, 'auth-dialog order-done-dialog');
    } else if (result === 'pending') {
      app().openDialog?.(`<button class="dialog-close" data-close aria-label="Cerrar">×</button><div class="order-success"><h2 class="dialog-heading">Pago pendiente</h2><p class="dialog-subtitle">Si elegiste pagar en agente o banca por internet, completa el pago con el código de Mercado Pago. Apenas se acredite, tu pedido ${escape(code)} se confirma solo y te avisamos.</p><a class="primary-button" href="cuenta.html#pedidos">Ver mis pedidos</a></div>`, 'auth-dialog');
    } else {
      app().openDialog?.(`<button class="dialog-close" data-close aria-label="Cerrar">×</button><div class="order-success"><h2 class="dialog-heading">Seguimos esperando la confirmación</h2><p class="dialog-subtitle">Mercado Pago aún no nos confirma el pago del pedido ${escape(code)}. No pagues dos veces: en unos minutos lo verás confirmado en Mis pedidos y te llegará un aviso.</p><a class="primary-button" href="cuenta.html#pedidos">Ver mis pedidos</a></div>`, 'auth-dialog');
    }
  }

  // Mis pedidos: botón «Pagar con Mercado Pago» en pedidos online pendientes que aún no vencen.
  let decorating = false;
  async function decorateOrders() {
    if (decorating || !available() || document.body.dataset.page !== 'account') return;
    const cards = [...document.querySelectorAll('.order-card:not([data-mp-checked])')];
    if (!cards.length || !app().user) return;
    decorating = true;
    cards.forEach(card => { card.dataset.mpChecked = '1'; });
    const {data} = await app().client.from('orders').select('id,status,payment_status,payment_expires_at')
      .eq('payment_method', 'mercado_pago').eq('status', 'pending').neq('payment_status', 'paid');
    decorating = false;
    (data || []).filter(order => !order.payment_expires_at || new Date(order.payment_expires_at) > new Date()).forEach(order => {
      const code = order.id.slice(0, 8).toUpperCase();
      const card = cards.find(node => node.querySelector('header strong')?.textContent.includes(code));
      if (!card || card.querySelector('[data-mp-retry]')) return;
      const until = order.payment_expires_at ? new Intl.DateTimeFormat('es-PE', {timeStyle: 'short'}).format(new Date(order.payment_expires_at)) : '';
      card.insertAdjacentHTML('beforeend', `<div class="mp-pay-row"><button type="button" class="primary-button" data-mp-retry="${escape(order.id)}">Pagar con Mercado Pago</button>${until ? `<small>Reservado hasta las ${escape(until)}</small>` : ''}</div>`);
    });
  }
  new MutationObserver(() => { if (available()) decorateOrders(); }).observe(document.body, {childList: true, subtree: true});

  document.addEventListener('click', event => {
    const retry = event.target.closest('[data-mp-retry]');
    if (retry) { event.preventDefault(); pay(retry.dataset.mpRetry); }
  });
  document.addEventListener('change', event => {
    if (event.target.matches?.('#checkout-form [name="payment"]')) {
      const button = document.getElementById('place-order');
      if (button && button.textContent !== 'Procesando…') button.textContent = event.target.value === 'mercado_pago' ? 'Pagar con Mercado Pago' : button.textContent === 'Pagar con Mercado Pago' ? 'Confirmar pedido' : button.textContent;
    }
  });
  init();
  return {available, pay, init};
})();
