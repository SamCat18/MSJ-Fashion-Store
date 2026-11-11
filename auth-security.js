// Métodos de acceso de MSJ (tienda y panel): contraseña, passkeys (huella / rostro del dispositivo) y 2FA con código de 6 dígitos.
// Passkeys: WebAuthn nativo (navigator.credentials). La biometría se valida en el propio teléfono o laptop; MSJ solo recibe una firma.
// 2FA: Supabase Auth MFA (TOTP). El servidor exige el nivel AAL2 a las cuentas que lo activan (ver public.mfa_ok en schema.sql).
window.MSJAuth = (() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const toBuffer = value => { const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/'); const padded = base64 + '='.repeat((4 - base64.length % 4) % 4); return Uint8Array.from(atob(padded), character => character.charCodeAt(0)).buffer; };
  const toBase64Url = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // Interruptor en config.js (features.passkeys): apagado oculta huella/rostro en la tienda y el panel.
  function passkeysEnabled() { return window.STORE_CONFIG?.features?.passkeys === true; }
  function passkeysSupported() { return Boolean(window.PublicKeyCredential && navigator.credentials && window.isSecureContext); }
  // Algunos navegadores nunca responden esta consulta: se limita a 1,5 s para no bloquear el panel.
  async function platformAvailable() { try { if (!passkeysEnabled() || !passkeysSupported() || location.protocol === 'file:') return false; return await Promise.race([PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(), new Promise(resolve => setTimeout(() => resolve(false), 1500))]); } catch { return false; } }
  // Nombre orientativo del autenticador según el sistema (WebAuthn no revela si se usó huella o rostro).
  function deviceName() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad/.test(ua)) return 'iPhone · Face ID / Touch ID';
    if (/Android/.test(ua)) return 'Android · huella o bloqueo de pantalla';
    if (/Windows/.test(ua)) return 'Windows Hello (PIN, huella o rostro)';
    if (/Mac OS X/.test(ua)) return 'Mac · Touch ID';
    return 'Llave de acceso';
  }
  async function functionError(error, fallback) {
    let detail = '';
    try { const response = error?.context; if (response && typeof response.json === 'function') detail = (await response.json()).error || ''; } catch {}
    if (detail) return detail;
    if (/Failed to send|fetch|404|not found/i.test(String(error?.message || ''))) return 'Las passkeys se activan al desplegar la función «passkeys» en Supabase.';
    return fallback;
  }
  function credentialError(error) {
    if (error?.name === 'NotAllowedError') return 'Se canceló o venció la verificación en el dispositivo.';
    if (error?.name === 'InvalidStateError') return 'Este dispositivo ya está registrado.';
    if (error?.name === 'SecurityError') return 'Las passkeys requieren la tienda publicada con HTTPS en su dominio.';
    return error?.message || 'No se pudo usar la passkey.';
  }

  // ----- Modo local (file:// o localhost sin la Edge Function «passkeys») -----
  // Solo para probar y demostrar en tu PC. En localhost usa la biometría real del equipo (Windows Hello / huella),
  // pero la verificación ocurre en el navegador, así que NO protege la cuenta: se guarda solo en este navegador
  // y no aparece en el inspector de seguridad. En file:// el navegador prohíbe WebAuthn, así que se simula.
  const isLocal = () => location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const realWebAuthnLocally = () => location.protocol !== 'file:' && passkeysSupported();
  const localKey = userId => `msj-local-passkeys:${userId}`;
  function readLocal(userId) { try { const list = JSON.parse(localStorage.getItem(localKey(userId)) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; } }
  function writeLocal(userId, list) { try { localStorage.setItem(localKey(userId), JSON.stringify(list)); } catch {} }
  const randomBytes = size => crypto.getRandomValues(new Uint8Array(size));
  const methods = { huella: { icon: '👆', label: 'Huella', done: 'Huella reconocida' }, rostro: { icon: '🙂', label: 'Rostro', done: 'Rostro reconocido' }, pin: { icon: '🔢', label: 'PIN del dispositivo', done: 'PIN correcto' } };
  // Modal de demostración: elige Huella / Rostro / PIN y simula el escaneo.
  function demoDialog(kind, preset = 'huella') {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-label', 'Demostración de acceso biométrico');
      dialog.style.cssText = 'border:1px solid #c9ab6a;padding:26px;max-width:380px;width:calc(100% - 32px);background:#fbf8f1;color:#171715;font-family:inherit;text-align:center';
      dialog.innerHTML = `<p style="margin:0 0 6px;font-size:10px;letter-spacing:1.6px;font-weight:700;color:#8a7140">MODO DEMOSTRACIÓN LOCAL</p><h2 style="margin:0 0 8px;font:500 24px 'Playfair Display',Georgia,serif">${kind === 'registro' ? 'Registrar biometría' : 'Verificar identidad'}</h2><p style="margin:0 0 14px;font-size:12.5px;line-height:1.55;color:#5c564b">${location.protocol === 'file:' ? 'Abriste la tienda como archivo (file://) y el navegador no permite passkeys reales aquí.' : 'La función «passkeys» de Supabase aún no está desplegada.'} Esta simulación sirve para probar y demostrar el flujo; no protege la cuenta.</p><div data-methods style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px">${Object.entries(methods).map(([key, item]) => `<button type="button" data-method="${key}" style="padding:9px 4px;border:1px solid #d7d1c5;background:#fff;font-family:inherit;font-weight:600;font-size:11.5px;cursor:pointer">${item.icon} ${escapeHtml(item.label)}</button>`).join('')}</div><div data-scan style="display:grid;place-items:center;width:92px;height:92px;margin:0 auto 10px;border-radius:50%;font-size:40px;background:radial-gradient(circle,#fbf6ea,#f0e3c4);box-shadow:0 0 0 2px #c9ab6a"></div><p data-status role="status" style="min-height:18px;margin:0 0 14px;font-size:12.5px;font-weight:600"></p><div style="display:flex;gap:8px"><button type="button" data-cancel style="flex:1;padding:11px;border:1px solid #171715;background:transparent;cursor:pointer">Cancelar</button><button type="button" data-go style="flex:1;padding:11px;border:1px solid #171715;background:#171715;color:#fff;cursor:pointer">Escanear</button></div>`;
      document.body.append(dialog);
      let method = methods[preset] ? preset : 'huella';
      const scan = dialog.querySelector('[data-scan]'); const status = dialog.querySelector('[data-status]');
      const select = key => { method = key; scan.textContent = methods[key].icon; dialog.querySelectorAll('[data-method]').forEach(button => { const active = button.dataset.method === key; button.style.borderColor = active ? '#171715' : '#d7d1c5'; button.setAttribute('aria-pressed', String(active)); }); status.textContent = ''; };
      const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
      select(method);
      dialog.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click', () => select(button.dataset.method)));
      dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
      dialog.querySelector('[data-go]').addEventListener('click', event => {
        event.currentTarget.disabled = true; status.style.color = '#5c564b'; status.textContent = method === 'pin' ? 'Comprobando PIN…' : 'Escaneando…';
        scan.animate?.([{ boxShadow: '0 0 0 2px #c9ab6a,0 0 0 0 #c9ab6a55' }, { boxShadow: '0 0 0 2px #c9ab6a,0 0 0 16px #c9ab6a00' }], { duration: 800, iterations: 2 });
        setTimeout(() => { status.style.color = '#3d6b4a'; status.textContent = `✓ ${methods[method].done}`; setTimeout(() => finish(method), 650); }, 1600);
      });
      dialog.showModal();
    });
  }
  async function registerLocal(userId, name) {
    if (!userId) throw new Error('Inicia sesión para registrar tu biometría.');
    let entry;
    if (realWebAuthnLocally()) {
      try {
        const credential = await navigator.credentials.create({ publicKey: { rp: { name: 'MSJ Fashion Store (demo local)', id: location.hostname }, user: { id: randomBytes(16), name: `local-${userId.slice(0, 8)}`, displayName: 'Cliente MSJ' }, challenge: randomBytes(32), pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' }, timeout: 60000, attestation: 'none' } });
        entry = { id: credential.id, mode: 'webauthn-local', method: 'dispositivo', device_name: `${name} · demo local` };
      } catch (error) {
        if (error?.name === 'NotAllowedError') throw new Error(credentialError(error));
      }
    }
    if (!entry) {
      const method = await demoDialog('registro');
      if (!method) throw new Error('Registro cancelado.');
      entry = { id: `sim-${toBase64Url(randomBytes(9))}`, mode: 'simulado', method, device_name: `${methods[method].label} · demo local` };
    }
    entry.created_at = new Date().toISOString();
    writeLocal(userId, [...readLocal(userId), entry]);
    return { registered: true, local: true, deviceName: entry.device_name };
  }
  async function verifyLocal(userId, id) {
    const list = readLocal(userId); const entry = list.find(item => item.id === id);
    if (!entry) throw new Error('No se encontró ese registro local.');
    let ok = false;
    if (entry.mode === 'webauthn-local' && realWebAuthnLocally()) {
      try { await navigator.credentials.get({ publicKey: { challenge: randomBytes(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: toBuffer(entry.id) }], userVerification: 'required', timeout: 60000 } }); ok = true; }
      catch (error) { throw new Error(credentialError(error)); }
    } else ok = Boolean(await demoDialog('acceso', entry.method));
    if (!ok) throw new Error('Verificación cancelada.');
    entry.last_used_at = new Date().toISOString(); writeLocal(userId, list);
    return entry;
  }

  async function registerPasskey(client, name = deviceName(), userId = '') {
    if (location.protocol === 'file:') return registerLocal(userId, name);
    if (!passkeysSupported()) { if (isLocal()) return registerLocal(userId, name); throw new Error('Este navegador no admite passkeys. Actualízalo o usa Chrome, Safari o Edge.'); }
    const { data: start, error: startError } = await client.functions.invoke('passkeys', { body: { action: 'register-options' } });
    if (startError) { if (isLocal()) return registerLocal(userId, name); throw new Error(await functionError(startError, 'No se pudo iniciar el registro.')); }
    const options = start.options;
    let credential;
    try {
      credential = await navigator.credentials.create({ publicKey: {
        ...options,
        challenge: toBuffer(options.challenge),
        user: { ...options.user, id: toBuffer(options.user.id) },
        excludeCredentials: (options.excludeCredentials || []).map(item => ({ ...item, id: toBuffer(item.id) }))
      } });
    } catch (error) { throw new Error(credentialError(error)); }
    const response = credential.response;
    const payload = { id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type, authenticatorAttachment: credential.authenticatorAttachment || undefined,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: { clientDataJSON: toBase64Url(response.clientDataJSON), attestationObject: toBase64Url(response.attestationObject), transports: typeof response.getTransports === 'function' ? response.getTransports() : [] } };
    const { data, error } = await client.functions.invoke('passkeys', { body: { action: 'register-verify', challengeId: start.challengeId, response: payload, deviceName: name } });
    if (error) throw new Error(await functionError(error, 'No se pudo guardar la passkey.'));
    return data;
  }

  const localLoginMessage = 'Modo local: aquí la huella o el rostro solo se registran y se prueban (Mi cuenta → Seguridad → «Probar»). Iniciar sesión con ellos requiere la tienda publicada con HTTPS y la función «passkeys» desplegada. Mientras tanto, entra con tu contraseña.';
  async function loginWithPasskey(client, email = '') {
    if (location.protocol === 'file:') throw new Error(localLoginMessage);
    if (!passkeysSupported()) throw new Error('Este navegador no admite passkeys. Entra con tu contraseña.');
    const { data: start, error: startError } = await client.functions.invoke('passkeys', { body: { action: 'login-options', email: String(email || '').trim().toLowerCase() } });
    if (startError) throw new Error(isLocal() ? localLoginMessage : await functionError(startError, 'No se pudo iniciar el acceso.'));
    const options = start.options;
    let credential;
    try {
      credential = await navigator.credentials.get({ publicKey: { ...options, challenge: toBuffer(options.challenge), allowCredentials: (options.allowCredentials || []).map(item => ({ ...item, id: toBuffer(item.id) })) } });
    } catch (error) { throw new Error(credentialError(error)); }
    const response = credential.response;
    const payload = { id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type, authenticatorAttachment: credential.authenticatorAttachment || undefined,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: { clientDataJSON: toBase64Url(response.clientDataJSON), authenticatorData: toBase64Url(response.authenticatorData), signature: toBase64Url(response.signature), userHandle: response.userHandle ? toBase64Url(response.userHandle) : undefined } };
    const { data, error } = await client.functions.invoke('passkeys', { body: { action: 'login-verify', challengeId: start.challengeId, response: payload } });
    if (error) throw new Error(await functionError(error, 'No se pudo verificar tu identidad.'));
    let result = await client.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (result.error) result = await client.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' });
    if (result.error) throw new Error('No se pudo iniciar la sesión con la passkey.');
    return result.data;
  }

  // ----- 2FA (TOTP) -----
  async function mfaState(client) {
    try {
      const [{ data: level }, { data: factors }] = await Promise.all([client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors()]);
      const totp = (factors?.totp || []).find(factor => factor.status === 'verified') || null;
      return { required: level?.nextLevel === 'aal2' && level?.currentLevel !== 'aal2', current: level?.currentLevel || 'aal1', totp };
    } catch { return { required: false, current: 'aal1', totp: null }; }
  }
  async function verifyCode(client, factorId, code) {
    const clean = String(code || '').replace(/\D/g, '');
    if (clean.length !== 6) throw new Error('Escribe los 6 dígitos de tu app autenticadora.');
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: clean });
    if (error) throw new Error(/invalid|expired/i.test(error.message) ? 'Código incorrecto o vencido. Usa el código actual de tu app.' : 'No se pudo verificar el código.');
  }
  // Formulario de código de 6 dígitos (paso 2 del acceso).
  function mfaPrompt(container, client, { onSuccess, onCancel, cancelLabel = 'Cancelar y cerrar sesión' } = {}) {
    container.innerHTML = `<form class="mfa-step" novalidate><p class="eyebrow">VERIFICACIÓN EN DOS PASOS</p><h2 class="dialog-heading">Escribe tu código</h2><p class="dialog-subtitle">Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator u otra) y escribe el código de 6 dígitos de MSJ.</p><label class="form-field"><span>Código</span><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required class="mfa-code"></label><p class="form-error" role="alert"></p><button class="primary-button">Verificar y entrar</button><button type="button" class="text-button" data-mfa-cancel>${escapeHtml(cancelLabel)}</button></form>`;
    const form = container.querySelector('form'); const errorNode = form.querySelector('.form-error');
    form.code.focus();
    form.addEventListener('submit', async event => {
      event.preventDefault(); errorNode.textContent = ''; const button = form.querySelector('.primary-button'); button.disabled = true;
      try { const state = await mfaState(client); if (!state.totp) throw new Error('No encontramos tu 2FA. Vuelve a iniciar sesión.'); await verifyCode(client, state.totp.id, form.code.value); onSuccess?.(); }
      catch (error) { errorNode.textContent = error.message; button.disabled = false; form.code.select(); }
    });
    form.querySelector('[data-mfa-cancel]').addEventListener('click', async () => { await client.auth.signOut(); onCancel?.(); });
  }

  // ----- Panel de métodos de acceso (Mi cuenta → Seguridad y Panel → Ciberseguridad) -----
  function renderSecurityControls(container, client, { userId, onChange, log } = {}) {
    if (!container) return;
    if (!client || !userId) { container.innerHTML = '<p class="auth-msg">Inicia sesión para administrar tus métodos de acceso.</p>'; return; }
    let enrolling = null;
    const message = (text, isError = false) => { const node = container.querySelector('.auth-msg'); if (node) { node.textContent = text; node.classList.toggle('error', isError); } };
    async function paint(note = '') {
      const [state, keys, platform] = await Promise.all([mfaState(client), client.from('passkeys').select('id,device_name,created_at,last_used_at').eq('user_id', userId).order('created_at'), platformAvailable()]);
      const passkeys = keys.error ? null : keys.data || []; const local = readLocal(userId);
      const date = value => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(value)) : '';
      container.innerHTML = `<div class="auth-methods">
        <article class="auth-method"><span class="auth-icon" aria-hidden="true">🔑</span><div><strong>Contraseña</strong><small>Siempre disponible como respaldo.</small></div><span class="auth-state on">Activa</span></article>
        ${passkeysEnabled() ? `<article class="auth-method"><span class="auth-icon" aria-hidden="true">👆</span><div><strong>Huella digital o rostro (passkey)</strong><small>Huella de Android, Face ID o Touch ID en iPhone y Mac, Windows Hello (PIN, huella o rostro). Tu biometría nunca sale del dispositivo.</small>${passkeys?.length ? `<ul class="passkey-list">${passkeys.map(key => `<li><span>${escapeHtml(key.device_name)}<small>Registrada el ${date(key.created_at)}${key.last_used_at ? ` · último uso ${date(key.last_used_at)}` : ''}</small></span><button type="button" class="text-button danger" data-passkey-delete="${escapeHtml(key.id)}">Quitar</button></li>`).join('')}</ul>` : ''}${local.length ? `<ul class="passkey-list">${local.map(key => `<li><span>${escapeHtml(key.device_name)} <em class="auth-warn">Demo local</em><small>Registrada el ${date(key.created_at)}${key.last_used_at ? ` · probada ${date(key.last_used_at)}` : ''}</small></span><span><button type="button" class="text-button" data-passkey-test="${escapeHtml(key.id)}">Probar</button> <button type="button" class="text-button danger" data-passkey-local-delete="${escapeHtml(key.id)}">Quitar</button></span></li>`).join('')}</ul>` : ''}${isLocal() ? `<small class="auth-warn">Modo local (${location.protocol === 'file:' ? 'archivo' : 'localhost'}): ${location.protocol === 'file:' ? 'el navegador no permite passkeys reales en file://, así que se simula el escaneo.' : 'se usa la biometría real de este equipo, verificada solo en el navegador.'} Sirve para probar y demostrar; se guarda solo en este navegador y no protege la cuenta.</small>` : passkeys === null ? '<small class="auth-warn">Las passkeys se activan al ejecutar el database/schema.sql actualizado.</small>' : passkeysSupported() ? (platform ? '' : '<small class="auth-warn">Este equipo no tiene lector biométrico configurado; puedes usar una llave de seguridad o tu teléfono.</small>') : '<small class="auth-warn">Este navegador no admite passkeys o la página no usa HTTPS.</small>'}</div>${passkeys?.length ? '<span class="auth-state on">Activa</span>' : local.length ? '<span class="auth-state on">Demo</span>' : ''}<button type="button" class="secondary-button" data-passkey-add ${isLocal() || (passkeysSupported() && passkeys !== null) ? '' : 'disabled'}>${passkeys?.length || local.length ? 'Agregar otro dispositivo' : 'Activar en este dispositivo'}</button></article>` : ''}
        <article class="auth-method"><span class="auth-icon" aria-hidden="true">🔢</span><div><strong>Verificación en dos pasos (2FA)</strong><small>Código de 6 dígitos de Google Authenticator, Microsoft Authenticator o similar. Con 2FA activo, el servidor exige el código para usar tu cuenta.</small><div class="totp-setup" hidden></div></div>${state.totp ? '<span class="auth-state on">Activa</span><button type="button" class="secondary-button" data-totp-disable>Desactivar</button>' : '<button type="button" class="secondary-button" data-totp-enable>Activar 2FA</button>'}</article>
        <p class="auth-msg" role="status">${escapeHtml(note)}</p></div>`;
      onChange?.({ totp: Boolean(state.totp), passkeys: passkeys?.length || 0 });
    }
    container.onclick = async event => {
      const target = event.target;
      if (target.closest('[data-passkey-add]')) {
        const button = target.closest('[data-passkey-add]'); button.disabled = true; message('Sigue las instrucciones de tu dispositivo…');
        try { const result = await registerPasskey(client, deviceName(), userId); await paint(result.local ? `Listo (demo local): ${result.deviceName}. Pulsa «Probar» para verificarla en vivo.` : `Listo: ${result.deviceName} ya puede iniciar sesión con huella o rostro.`); }
        catch (error) { message(error.message, true); button.disabled = false; }
        return;
      }
      const test = target.closest('[data-passkey-test]');
      if (test) {
        try { const entry = await verifyLocal(userId, test.dataset.passkeyTest); await paint(`✓ Identidad verificada con ${entry.device_name}.`); }
        catch (error) { message(error.message, true); }
        return;
      }
      const removeLocal = target.closest('[data-passkey-local-delete]');
      if (removeLocal) { writeLocal(userId, readLocal(userId).filter(item => item.id !== removeLocal.dataset.passkeyLocalDelete)); await paint('Registro local eliminado.'); return; }
      const remove = target.closest('[data-passkey-delete]');
      if (remove) {
        if (!confirm('¿Quitar esta passkey? Ese dispositivo ya no podrá iniciar sesión con huella o rostro.')) return;
        const { error } = await client.from('passkeys').delete().eq('id', remove.dataset.passkeyDelete);
        if (error) { message('No se pudo quitar. Si tienes 2FA, vuelve a iniciar sesión con tu código.', true); return; }
        await log?.('passkey_eliminada'); await paint('Passkey eliminada.'); return;
      }
      if (target.closest('[data-totp-enable]')) {
        target.closest('[data-totp-enable]').disabled = true;
        const { data: stale } = await client.auth.mfa.listFactors();
        for (const factor of (stale?.all || []).filter(item => item.factor_type === 'totp' && item.status !== 'verified')) await client.auth.mfa.unenroll({ factorId: factor.id });
        const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `MSJ ${new Date().toISOString().slice(0, 10)}` });
        if (error) { message(/disabled|not enabled/i.test(error.message) ? 'Activa «TOTP» en Supabase → Authentication → Multi-Factor.' : 'No se pudo iniciar la activación del 2FA.', true); target.closest('[data-totp-enable]').disabled = false; return; }
        enrolling = data.id;
        const setup = container.querySelector('.totp-setup'); setup.hidden = false;
        setup.innerHTML = `<ol><li>Escanea este código QR con tu app autenticadora.</li><li>Escribe el código de 6 dígitos que aparece.</li></ol><img class="totp-qr" src="${escapeHtml(data.totp.qr_code)}" alt="Código QR para tu app autenticadora" width="180" height="180"><p class="totp-secret">¿No puedes escanear? Clave: <code>${escapeHtml(data.totp.secret)}</code></p><form class="totp-confirm" novalidate><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" aria-label="Código de 6 dígitos" class="mfa-code"><button class="primary-button">Confirmar</button><button type="button" class="text-button" data-totp-cancel>Cancelar</button></form>`;
        setup.querySelector('input').focus();
        return;
      }
      if (target.closest('[data-totp-cancel]')) { if (enrolling) await client.auth.mfa.unenroll({ factorId: enrolling }); enrolling = null; await paint(); return; }
      if (target.closest('[data-totp-disable]')) {
        if (!confirm('¿Desactivar la verificación en dos pasos? Tu cuenta quedará protegida solo con la contraseña.')) return;
        const state = await mfaState(client);
        if (state.current !== 'aal2') { message('Por seguridad, cierra sesión y vuelve a entrar con tu código antes de desactivar el 2FA.', true); return; }
        const { error } = await client.auth.mfa.unenroll({ factorId: state.totp.id });
        if (error) { message('No se pudo desactivar el 2FA.', true); return; }
        await client.auth.refreshSession(); await log?.('2fa_desactivado'); await paint('Verificación en dos pasos desactivada.'); return;
      }
    };
    container.onsubmit = async event => {
      if (!event.target.matches('.totp-confirm')) return;
      event.preventDefault(); const button = event.target.querySelector('.primary-button'); button.disabled = true;
      try { await verifyCode(client, enrolling, event.target.code.value); enrolling = null; await log?.('2fa_activado'); await paint('2FA activado. Desde ahora te pediremos el código al iniciar sesión.'); }
      catch (error) { message(error.message, true); button.disabled = false; }
    };
    paint();
  }

  return { passkeysEnabled, passkeysSupported, platformAvailable, deviceName, registerPasskey, loginWithPasskey, mfaState, verifyCode, mfaPrompt, renderSecurityControls };
})();
