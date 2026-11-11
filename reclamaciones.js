(() => {
  const config = window.STORE_CONFIG || {};
  // Cliente anónimo y sin sesión propia, creado solo al enviar: así no compite con el de app.js por renovar el token del cliente conectado.
  let client;
  const getClient = () => client ??= window.supabase && config.supabaseUrl && config.supabaseAnonKey ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'msj-reclamaciones' } }) : null;
  const $ = selector => document.querySelector(selector);
  const now = new Date();
  const formatDate = value => new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short' }).format(value);
  $('#complaint-date').textContent = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(now);
  const labels = { kind: 'Tipo', consumer_name: 'Consumidor', document: 'Documento', address: 'Domicilio', email: 'Correo', phone: 'Teléfono', guardian_name: 'Padre, madre o apoderado', item: 'Bien contratado', amount: 'Monto reclamado', order_reference: 'N.º de pedido', detail: 'Detalle', consumer_request: 'Pedido del consumidor' };

  function renderReceipt(code, data) {
    const rows = {
      kind: data.kind === 'queja' ? 'Queja' : 'Reclamo',
      consumer_name: data.consumer_name,
      document: `${data.document_type} ${data.document_number}`,
      address: data.address,
      email: data.email,
      phone: data.phone,
      guardian_name: data.guardian_name,
      item: `${data.item_type === 'servicio' ? 'Servicio' : 'Producto'}: ${data.item_description}`,
      amount: data.amount ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(data.amount)) : '',
      order_reference: data.order_reference,
      detail: data.detail,
      consumer_request: data.consumer_request
    };
    const list = $('#receipt-details');
    list.replaceChildren();
    const append = (term, value) => {
      const dt = document.createElement('dt'); dt.textContent = term;
      const dd = document.createElement('dd'); dd.textContent = value;
      list.append(dt, dd);
    };
    append('Fecha de registro', formatDate(new Date()));
    Object.entries(rows).forEach(([key, value]) => { if (value) append(labels[key], value); });
    $('#receipt-code').textContent = code;
    $('#complaint-form').hidden = true;
    $('#complaint-receipt').hidden = false;
    $('#complaint-receipt').focus();
    window.scrollTo({ top: 0 });
  }

  $('#complaint-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorNode = $('#complaint-error');
    errorNode.textContent = '';
    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid');
      errorNode.textContent = invalid?.name === 'accepted' ? 'Debes aceptar la declaración para enviar la hoja.' : 'Revisa los campos marcados como obligatorios.';
      invalid?.focus();
      return;
    }
    if (!getClient()) { errorNode.textContent = 'No se pudo conectar con el servicio. Inténtalo de nuevo en unos minutos.'; return; }
    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach(key => { if (typeof data[key] === 'string') data[key] = data[key].trim(); });
    data.accepted = data.accepted === 'on' ? 'true' : 'false';
    const button = $('#complaint-submit');
    button.disabled = true;
    button.textContent = 'Enviando…';
    const { data: code, error } = await client.rpc('submit_complaint', { p_data: data });
    button.disabled = false;
    button.textContent = 'Enviar hoja de reclamación';
    if (error) {
      errorNode.textContent = /function|schema/i.test(error.message)
        ? 'El Libro de Reclamaciones aún no está activado en la base de datos. Ejecuta database/schema.sql.'
        : `No se pudo registrar la hoja: ${error.message}`;
      return;
    }
    renderReceipt(code, data);
  });
  $('#print-receipt').addEventListener('click', () => window.print());
})();
