// MSJ Studio + Recompensas + Avisos (para que el cliente vuelva y se quede):
// - Studio: el cliente diseña cómo se ve su tienda (color, fondo, esquinas, Liquid Glass, letra, tarjetas) con vista previa
//   en vivo. Todos prueban; guardar opciones premium es exclusivo de socios Privilège (también lo valida save_ui_theme).
// - Recompensas: racha diaria, puntos por compra/reseña, canje por cupones personales (daily_checkin, redeem_points).
// - Avisos: bajó de precio tu favorito, volvió el stock, tu pedido avanzó (tabla notifications).
// Requiere database/v2026.sql para guardar en la cuenta; sin él, el Studio funciona solo en este dispositivo.
window.MSJSettings = (() => {
  const config = window.STORE_CONFIG || {};
  const fallback = {season: config.season || {}, teaser_2027: config.teaser2027 || {}, loyalty: config.loyalty || {}, studio: {enabled: true}, announcement: {enabled: false}};
  let promise = null;
  const api = {load, fallback, current: fallback};
  function load() {
    if (promise) return promise;
    const client = window.MSJApp?.client;
    promise = !client ? Promise.resolve(fallback) : client.from('store_settings').select('key,value').then(({data, error}) => {
      if (error || !data) return fallback;
      const map = {...fallback};
      data.forEach(row => { map[row.key] = {...(fallback[row.key] || {}), ...row.value}; });
      return map;
    }, () => fallback);
    promise.then(map => { api.current = map; });
    return promise;
  }
  return api;
})();

window.MSJEngage = (() => {
  const UI = window.MSJUI;
  const app = () => window.MSJApp || {};
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const money = value => new Intl.NumberFormat('es-PE', {style: 'currency', currency: 'PEN'}).format(Number(value || 0));
  const data = window.MSJ_DATA;
  if (!UI) return {};
  const state = {tab: 'studio', draft: UI.read(), engagement: null, notifications: [], loyalty: null, loading: false, missing: false};
  const accents = [['#b08d57', 'Champán'], ['#121211', 'Grafito'], ['#7f1d1d', 'Burdeos'], ['#166534', 'Pino'], ['#1d4ed8', 'Océano'], ['#7c3aed', 'Lavanda'], ['#e2553f', 'Coral'], ['#c1121f', 'Navidad']];
  const groups = [
    ['surface', 'Fondo', [['nieve', 'Nieve'], ['marfil', 'Marfil'], ['niebla', 'Niebla'], ['champan', 'Champán'], ['pino', 'Pino'], ['obsidiana', 'Obsidiana']]],
    ['radius', 'Esquinas', [['recto', 'Sutil'], ['suave', 'Suave'], ['redondo', 'Redondas']]],
    ['glass', 'Liquid Glass', [['sutil', 'Sutil'], ['normal', 'Normal'], ['intenso', 'Intenso']]],
    ['font', 'Tipografía', [['moderna', 'Moderna'], ['editorial', 'Editorial'], ['geometrica', 'Geométrica']]],
    ['cards', 'Tarjetas', [['limpia', 'Limpias'], ['enmarcada', 'Enmarcadas'], ['flotante', 'Flotantes']]],
    ['density', 'Densidad', [['comodo', 'Cómoda'], ['compacto', 'Compacta']]],
    ['header', 'Cabecera de vidrio', [['fija', 'Fija arriba'], ['auto', 'Se esconde al bajar']]],
    ['motion', 'Movimiento', [['normal', 'Normal'], ['reducido', 'Reducido']]]
  ];
  // ---------- Logros y niveles del Studio (gratis para todos; con cuenta se guardan y suman más) ----------
  const achievementList = [
    ['bienvenida', '👋', 'Bienvenida/o', 'Crea tu cuenta MSJ'],
    ['primer_diseno', '🎨', 'Primer diseño', 'Aplica tu propio diseño en el Studio'],
    ['explorador', '🧭', 'Explorador/a', 'Mira 10 productos distintos'],
    ['coleccionista', '♡', 'Coleccionista', 'Guarda 5 favoritos'],
    ['racha_3', '🔥', 'Racha de 3', 'Entra 3 días seguidos y reclama tu racha'],
    ['racha_7', '🔥', 'Semana perfecta', '7 días seguidos'],
    ['primera_compra', '🛍️', 'Primera compra', 'Tu primer pedido pagado'],
    ['critico', '★', 'Crítico/a de moda', 'Publica una reseña'],
    ['solidario', '♥', 'Corazón solidario', 'Dona en una compra'],
    ['cliente_fiel', '💎', 'Cliente fiel', '3 compras pagadas'],
    ['puntos_1000', '🏆', 'Mil puntos', 'Gana 1 000 puntos en total'],
    ['racha_30', '🌟', 'Constancia de leyenda', '30 días seguidos'],
    ['socio_vip', '✦', 'Privilège', 'Hazte socio del MSJ Privilège Club']
  ];
  const levels = [
    {min: 0, name: 'Explorador/a', reward: 'Studio con 8 colores, 6 fondos y Liquid Glass'},
    {min: 2, name: 'Estilista', reward: 'Paleta extendida: Oliva, Arena, Cielo y Fucsia'},
    {min: 4, name: 'Diseñador/a', reward: 'Looks de autor «Arena Minimal» y «Cielo Editorial»'},
    {min: 6, name: 'Ícono MSJ', reward: 'Color libre: elige cualquier tono para tu tienda'},
    {min: 9, name: 'Leyenda', reward: 'Look «Leyenda Oro» e insignia dorada en tu cabecera'}
  ];
  const extraAccents = [['#4d7c0f', 'Oliva'], ['#c2a878', 'Arena'], ['#0ea5e9', 'Cielo'], ['#db2777', 'Fucsia']];
  const authorLooks = [
    ['Arena Minimal', {accent: '#c2a878', surface: 'marfil', radius: 'redondo', font: 'moderna', cards: 'enmarcada', glass: 'sutil'}, 2],
    ['Cielo Editorial', {accent: '#0ea5e9', surface: 'niebla', radius: 'suave', font: 'editorial', cards: 'limpia', glass: 'normal'}, 2],
    ['Leyenda Oro', {accent: '#b08d57', surface: 'marfil', radius: 'redondo', font: 'editorial', cards: 'enmarcada', glass: 'normal'}, 4]
  ];
  const readLocal = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch { return fallback; } };
  function achievements() {
    const server = state.engagement?.achievements || {};
    const local = {
      primer_diseno: Boolean(localStorage.getItem('msj-studio')),
      explorador: (readLocal('msj-recent', []) || []).length >= 10,
      coleccionista: (readLocal('msj-favorites', []) || []).length >= 5,
      socio_vip: isVip()
    };
    const unlocked = new Set(achievementList.map(([key]) => key).filter(key => server[key] || local[key]));
    const levelIndex = levels.reduce((best, level, index) => unlocked.size >= level.min ? index : best, 0);
    return {unlocked, levelIndex, level: levels[levelIndex], next: levels[levelIndex + 1] || null};
  }
  // Avisa (una vez) cuando se desbloquea un logro o se sube de nivel.
  function celebrate() {
    const {unlocked, level, levelIndex} = achievements();
    const seen = new Set(readLocal('msj-achievements-seen', []));
    const fresh = [...unlocked].filter(key => !seen.has(key));
    if (!fresh.length) return;
    try { localStorage.setItem('msj-achievements-seen', JSON.stringify([...unlocked])); } catch {}
    if (!seen.size) return; // primera vez en este dispositivo: no se llena de avisos
    const [, icon, title] = achievementList.find(([key]) => key === fresh[0]) || [];
    const previousLevel = levels.reduce((best, item, index) => seen.size >= item.min ? index : best, 0);
    app().showToast?.(levelIndex > previousLevel ? `🏅 ¡Subiste a nivel ${level.name}! Desbloqueaste: ${level.reward}.` : `${icon} Logro desbloqueado: ${title}`);
  }
  const looks = [
    ['Minimal Nieve', {accent: '#121211', surface: 'nieve', radius: 'suave', font: 'moderna', cards: 'limpia', glass: 'normal'}],
    ['Editorial Marfil', {accent: '#b08d57', surface: 'marfil', radius: 'suave', font: 'editorial', cards: 'enmarcada', glass: 'sutil'}],
    ['Niebla Océano', {accent: '#1d4ed8', surface: 'niebla', radius: 'redondo', font: 'moderna', cards: 'limpia', glass: 'normal'}],
    ['Navidad Pino ✦', {accent: '#c1121f', surface: 'pino', radius: 'redondo', font: 'editorial', cards: 'flotante', glass: 'intenso', festive: true}],
    ['Gala Champán ✦', {accent: '#7f1d1d', surface: 'champan', radius: 'suave', font: 'geometrica', cards: 'flotante', glass: 'intenso'}],
    ['Noche Obsidiana ✦', {accent: '#b08d57', surface: 'obsidiana', radius: 'redondo', font: 'moderna', cards: 'flotante', glass: 'intenso'}]
  ];
  const isVip = () => Boolean(app().vipLevel?.());
  const premium = (key, value) => (UI.premium[key] || []).includes(value);

  // ---------- Botones en la cabecera y en el menú del celular ----------
  const actions = document.querySelector('.top-actions');
  if (actions && !document.getElementById('studio-button')) {
    actions.insertAdjacentHTML('afterbegin', '<button class="icon-button studio-button" id="studio-button" type="button" aria-haspopup="dialog" aria-controls="studio-sheet" title="MSJ Studio: diseña tu tienda y gana puntos"><span aria-hidden="true">✦</span><span class="studio-label">Studio</span></button><button class="icon-button notif-button" id="notif-button" type="button" aria-label="Avisos" hidden><span aria-hidden="true">🔔</span><b class="bag-count" id="notif-count" hidden>0</b></button>');
  }
  document.querySelector('#mobile-menu nav')?.insertAdjacentHTML('afterbegin', '<button type="button" class="mobile-link studio-mobile-link" data-open-studio="studio">✦ MSJ Studio · diseña tu tienda</button><button type="button" class="mobile-link" data-open-studio="rewards">🔥 Recompensas y racha diaria</button>');
  document.body.insertAdjacentHTML('beforeend', '<div class="studio-backdrop" id="studio-backdrop" hidden></div><aside class="studio-sheet" id="studio-sheet" role="dialog" aria-modal="true" aria-labelledby="studio-title" hidden></aside>');
  const sheet = document.getElementById('studio-sheet');
  const backdrop = document.getElementById('studio-backdrop');
  let lastFocus = null;

  function open(tab = state.tab) {
    state.tab = tab;
    state.draft = UI.read();
    lastFocus = document.activeElement;
    window.MSJLayout?.closeMenu?.();
    sheet.hidden = false; backdrop.hidden = false;
    requestAnimationFrame(() => { sheet.classList.add('open'); backdrop.classList.add('open'); });
    document.body.classList.add('studio-open');
    render();
    if (tab !== 'studio') refresh();
    sheet.querySelector(`[data-studio-tab="${tab}"]`)?.focus();
  }
  function close() {
    if (sheet.hidden) return;
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    document.body.classList.remove('studio-open');
    // La vista previa no cambia la tienda: al cerrar sin aplicar, se vuelve al diseño guardado.
    setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 280);
    lastFocus?.focus?.({preventScroll: true});
  }

  // ---------- Pintado ----------
  function render() {
    const user = app().user;
    const unread = state.engagement?.unread || 0;
    sheet.innerHTML = `
      <header class="studio-head"><div><p class="eyebrow">MSJ STUDIO ${isVip() ? '· ✦ PRIVILÈGE' : `· NIVEL ${escape(achievements().level.name.toUpperCase())}`}</p><h2 id="studio-title">${{rewards: 'Recompensas', alerts: 'Tus avisos', logros: 'Logros y niveles'}[state.tab] || 'Diseña tu tienda'}</h2></div><button class="dialog-close" type="button" data-studio-close aria-label="Cerrar">×</button></header>
      <nav class="studio-tabs" role="tablist">${[['studio', '✦ Diseña'], ['perfil', '💎 Perfil'], ['logros', '🏅 Logros'], ['rewards', '🔥 Recompensas'], ['alerts', `🔔 Avisos${unread ? ` <b>${unread}</b>` : ''}`]].map(([key, label]) => `<button type="button" role="tab" data-studio-tab="${key}" aria-selected="${state.tab === key}" class="${state.tab === key ? 'active' : ''}">${label}</button>`).join('')}</nav>
      <div class="studio-body">${state.tab === 'studio' ? studioMarkup() : state.tab === 'perfil' ? profileMarkup() : state.tab === 'logros' ? achievementsMarkup() : !user ? guestMarkup() : state.tab === 'rewards' ? rewardsMarkup() : alertsMarkup()}</div>`;
    if (state.tab === 'studio') paintPreview();
  }
  function guestMarkup() {
    return `<div class="rw-guest"><span class="rw-big-icon" aria-hidden="true">✦</span><h3>Crea tu cuenta y gana desde hoy</h3><p>50 puntos de bienvenida, racha diaria, cupones por tus compras y avisos cuando baje de precio tu favorito.</p><button type="button" class="primary-button" data-studio-login>Crear cuenta / Ingresar</button></div>`;
  }
  // ---------- Perfil Privilège (estilo «Nitro»): marco animado, banner, efecto del nombre, insignia y frase ----------
  const profileOptions = {
    frame: [['ninguno', 'Sin marco'], ['oro', 'Oro'], ['aurora', 'Aurora'], ['neon', 'Neón'], ['nieve', 'Nieve']],
    banner: [['champan', 'Champán'], ['aurora', 'Aurora'], ['noche', 'Noche estrellada'], ['navidad', 'Navidad']],
    name_effect: [['ninguno', 'Normal'], ['oro', 'Oro líquido'], ['arcoiris', 'Arcoíris'], ['brillo', 'Brillo']]
  };
  const profileDefaults = {frame: 'oro', banner: 'champan', name_effect: 'oro', bio: '', badge: true};
  function profileCard(profile, name) {
    const level = app().vipLevel?.();
    const initial = (name || 'M').trim().charAt(0).toUpperCase();
    const {level: studioLevel} = achievements();
    return `<div class="pp-card"><div class="pp-banner ${escape(profile.banner)}"></div><div class="pp-avatar frame-${escape(profile.frame)}">${escape(initial)}</div>
      <div class="pp-body"><span class="pp-name fx-${escape(profile.name_effect)}">${escape(name || 'Tu nombre')}</span>
      <div class="pp-badges">${profile.badge !== false ? `<span class="vip">✦ ${escape(level?.short || 'Privilège')}</span>` : ''}<span>🏅 ${escape(studioLevel.name)}</span>${state.engagement?.streak ? `<span>🔥 ${state.engagement.streak} días</span>` : ''}</div>
      ${profile.bio ? `<p class="pp-bio">${escape(profile.bio)}</p>` : ''}</div></div>`;
  }
  function profileMarkup() {
    const vip = isVip();
    const name = (app().state?.profile?.full_name || app().user?.user_metadata?.full_name || '').split(' ').slice(0, 2).join(' ');
    const draft = state.profileDraft || {...profileDefaults, ...(state.profile || {})};
    state.profileDraft = draft;
    const group = (key, title) => `<section class="st-group"><h3>${title}</h3><div class="st-opts">${profileOptions[key].map(([value, label]) => `<button type="button" class="st-opt${draft[key] === value ? ' on' : ''}" data-pp-key="${key}" data-pp-value="${value}" aria-pressed="${draft[key] === value}">${escape(label)}</button>`).join('')}</div></section>`;
    return `${profileCard(draft, name || (vip ? '' : 'Valeria R.'))}
      ${vip ? `${group('frame', 'Marco del avatar')}${group('banner', 'Banner')}${group('name_effect', 'Efecto del nombre')}
        <label class="st-switch"><input type="checkbox" data-pp-badge ${draft.badge !== false ? 'checked' : ''}> <span>Mostrar mi insignia de socio</span></label>
        <label class="pp-options st-group"><h3>Tu frase (80 caracteres)</h3><input class="pp-bio-input" maxlength="80" value="${escape(draft.bio || '')}" placeholder="Ej.: Amante de los abrigos y los perfumes ✦" data-pp-bio></label>
        <div class="st-actions"><button type="button" class="primary-button" data-pp-save>Guardar mi perfil</button></div>`
      : `<p class="st-note">💎 El <strong>Perfil Privilège</strong> es como tu identidad premium en MSJ: marco animado para tu avatar, banner, nombre con efecto oro o arcoíris e insignia de socio en tu cuenta. Además: <strong>acceso anticipado</strong> a las novedades, hasta 25 % de descuento, envío gratis y el Studio premium.</p>
        <div class="st-actions"><a class="secondary-button" href="vip.html">Ver todos los beneficios</a><button type="button" class="primary-button" data-vip-join="gold">Unirme a Privilège</button></div>`}`;
  }
  // Avatar con marco en la cabecera (socios con Perfil Privilège).
  function headerAvatar() {
    const button = document.getElementById('account-button');
    if (!button) return;
    button.querySelector('.account-avatar')?.remove();
    const glyph = button.querySelector('.account-glyph');
    const profile = state.profile;
    if (!app().user || !isVip() || !profile || !Object.keys(profile).length) { if (glyph) glyph.hidden = false; return; }
    const name = app().state?.profile?.full_name || app().user?.user_metadata?.full_name || app().user?.email || 'M';
    if (glyph) glyph.hidden = true;
    button.insertAdjacentHTML('afterbegin', `<span class="account-avatar frame-${escape(profile.frame || 'oro')}" aria-hidden="true">${escape(name.trim().charAt(0).toUpperCase())}</span>`);
  }
  function levelCard() {
    const {unlocked, level, next, levelIndex} = achievements();
    const progress = next ? Math.round((unlocked.size - level.min) / (next.min - level.min) * 100) : 100;
    return `<button type="button" class="st-level lg" data-studio-tab="logros"><span class="st-level-badge">${levelIndex + 1}</span><span class="st-level-copy"><strong>Nivel ${escape(level.name)}</strong><small>${unlocked.size} de ${achievementList.length} logros${next ? ` · ${next.min - unlocked.size} para ${escape(next.name)}` : ' · ¡nivel máximo!'}</small><i class="st-level-bar"><b style="width:${Math.max(4, progress)}%"></b></i></span><span aria-hidden="true">›</span></button>`;
  }
  function achievementsMarkup() {
    const {unlocked, levelIndex} = achievements();
    const user = app().user;
    return `${levelCard()}
      <section class="st-group"><h3>Niveles y lo que desbloquean (gratis)</h3><ol class="ach-levels">${levels.map((level, index) => `<li class="${index <= levelIndex ? 'done' : ''}"><b>${index + 1}</b><span><strong>${escape(level.name)}</strong><small>${level.min} logros · ${escape(level.reward)}</small></span>${index <= levelIndex ? '<i>✓</i>' : '<i>🔒</i>'}</li>`).join('')}<li class="vip-row ${isVip() ? 'done' : ''}"><b>✦</b><span><strong>Privilège (VIP)</strong><small>Fondos Champán, Pino y Obsidiana, letra Geométrica, tarjetas Flotantes, Liquid Glass intenso y tu diseño en todos tus dispositivos</small></span>${isVip() ? '<i>✓</i>' : '<button type="button" class="text-button" data-vip-join="gold">Unirme</button>'}</li></ol></section>
      <section class="st-group"><h3>Tus logros</h3><div class="ach-grid">${achievementList.map(([key, icon, title, text]) => `<article class="ach ${unlocked.has(key) ? 'on' : ''}"><span aria-hidden="true">${icon}</span><strong>${escape(title)}</strong><small>${escape(text)}</small></article>`).join('')}</div></section>
      ${user ? '' : '<p class="st-note">Sin cuenta igual puedes diseñar tu tienda y ganar logros en este dispositivo. <button type="button" class="text-button" data-studio-login>Crea tu cuenta</button> para guardar todo y desbloquear los logros de compras, rachas y reseñas.</p>'}`;
  }
  function studioMarkup() {
    const draft = state.draft;
    const vip = isVip();
    const {levelIndex} = achievements();
    const palette = levelIndex >= 1 || vip ? [...accents, ...extraAccents] : accents;
    const freeColor = vip || levelIndex >= 3;
    const allLooks = [...looks.map(([name, look]) => [name, look, 0]), ...authorLooks];
    const option = (key, value, label) => {
      const locked = premium(key, value) && !vip;
      return `<button type="button" class="st-opt${draft[key] === value ? ' on' : ''}${locked ? ' locked' : ''}" data-st-key="${key}" data-st-value="${value}" aria-pressed="${draft[key] === value}">${escape(label)}${premium(key, value) ? ' <i aria-label="premium">✦</i>' : ''}</button>`;
    };
    return `
      <div class="studio-preview" id="studio-preview" aria-label="Vista previa de tu diseño">
        <div class="sp-bar"><b>MSJ</b><span class="sp-search">Buscar…</span><i></i><i></i></div>
        <div class="sp-hero"><small>NUEVA TEMPORADA</small><strong>Tu estilo, tu tienda.</strong><span class="sp-btn">Comprar ahora</span></div>
        <div class="sp-chips"><span>Mujer</span><span class="on">Hombre</span><span>Perfumes</span></div>
        <div class="sp-grid">${['1551028719-00167b16eac5', '1595777457583-95e059d581b8', '1615634260167-c8cdede054de'].map((id, index) => `<div class="sp-card"><span class="sp-img" style="background-image:url('${data?.imageUrl ? data.imageUrl(id, 300) : ''}')"></span><em>${['Casaca Biker', 'Vestido Gala', 'Maison Noir'][index]}</em><b>${['S/ 263', 'S/ 159', 'S/ 189'][index]}</b></div>`).join('')}</div>
      </div>
      ${levelCard()}
      <section class="st-group"><h3>Looks listos</h3><div class="st-looks">${allLooks.map(([name, look, needed], index) => { const locked = !vip && levelIndex < needed; return `<button type="button" class="st-look${locked ? ' locked' : ''}" data-st-look="${index}" style="--look:${look.accent}" ${locked ? `title="Se desbloquea en el nivel ${escape(levels[needed].name)}"` : ''}>${locked ? '🔒 ' : ''}${escape(name)}</button>`; }).join('')}</div></section>
      <section class="st-group"><h3>Color de acento</h3><div class="st-swatches">${palette.map(([hex, name]) => `<button type="button" class="st-swatch${draft.accent === hex ? ' on' : ''}" data-st-key="accent" data-st-value="${hex}" style="--sw:${hex}" aria-label="${escape(name)}" title="${escape(name)}" aria-pressed="${draft.accent === hex}"></button>`).join('')}<label class="st-custom${freeColor ? '' : ' locked'}" title="${freeColor ? 'Elige cualquier color' : 'Color libre: nivel Ícono MSJ o socio Privilège'}"><input type="color" value="${escape(draft.accent)}" data-st-color ${freeColor ? '' : 'disabled'} aria-label="Color libre"><span>${freeColor ? '+' : '🔒'}</span></label></div>${levelIndex < 1 && !vip ? '<p class="st-note">Sube a nivel Estilista para desbloquear 4 colores más.</p>' : ''}</section>
      ${groups.map(([key, title, values]) => `<section class="st-group"><h3>${title}</h3><div class="st-opts">${values.map(([value, label]) => option(key, value, label)).join('')}</div></section>`).join('')}
      <label class="st-switch"><input type="checkbox" data-st-festive ${draft.festive ? 'checked' : ''}> <span>Decoración navideña (nieve y luces)</span></label>
      <p class="st-note">${vip ? '✦ Como socio Privilège guardas cualquier diseño en tu cuenta y lo ves en todos tus dispositivos.' : 'Las opciones con ✦ las puedes probar aquí; para usarlas en tu tienda, únete al <button type="button" class="text-button" data-vip-join="gold">MSJ Privilège Club</button>.'}</p>
      <div class="st-actions"><button type="button" class="secondary-button" data-st-reset>Restablecer</button><button type="button" class="primary-button" data-st-apply>Aplicar a mi tienda</button></div>`;
  }
  function paintPreview() {
    const preview = document.getElementById('studio-preview');
    if (preview) UI.apply(state.draft, preview);
  }
  function rewardsMarkup() {
    if (state.loading && !state.engagement) return '<p class="st-note">Cargando tus recompensas…</p>';
    if (state.missing) return '<div class="rw-guest"><span class="rw-big-icon" aria-hidden="true">⏳</span><h3>Recompensas muy pronto</h3><p>Estamos activando los puntos y la racha diaria. ¡Vuelve en unos días!</p></div>';
    const engagement = state.engagement || {points: 0, streak: 0, history: [], coupons: []};
    const loyalty = state.loyalty || {};
    const rewards = loyalty.rewards || [];
    const every = Number(loyalty.streak_every) || 7;
    const streak = Number(engagement.streak) || 0;
    const multiplier = Number(engagement.multiplier) || 1;
    const level = app().vipLevel?.();
    const checkinPoints = Math.round((Number(loyalty.checkin_points) || 5) * multiplier);
    const reasons = {bienvenida: 'Bienvenida', racha: 'Racha diaria', compra: 'Compra', canje: 'Canje', ajuste: 'Ajuste', resena: 'Reseña', reversion: 'Pedido anulado'};
    return `
      <div class="rw-card lg"><div><small>Tus puntos MSJ</small><strong class="rw-points">${Number(engagement.points || 0).toLocaleString('es-PE')}</strong><span>${engagement.lifetime ? `${Number(engagement.lifetime).toLocaleString('es-PE')} ganados en total` : 'Empieza hoy tu racha'}</span></div>${multiplier > 1 ? `<span class="rw-mult">x${multiplier} ${escape(level?.short || 'VIP')}</span>` : ''}</div>
      <section class="rw-streak"><div class="rw-flame"><span aria-hidden="true">🔥</span><b>${streak}</b><small>${streak === 1 ? 'día seguido' : 'días seguidos'}</small></div>
        <ol class="rw-week" aria-label="Progreso hacia el bonus">${Array.from({length: every}, (_, index) => `<li class="${index < (streak % every || (streak && engagement.checked_today && streak % every === 0 ? every : 0)) ? 'done' : ''}">${index + 1 === every ? '🎁' : ''}</li>`).join('')}</ol>
        ${engagement.checked_today ? `<p class="rw-done">✓ Racha de hoy reclamada. Vuelve mañana${engagement.next_bonus_in ? ` · bonus de +${Number(loyalty.streak_bonus) || 25} en ${engagement.next_bonus_in} ${engagement.next_bonus_in === 1 ? 'día' : 'días'}` : ''}.</p>` : `<button type="button" class="primary-button rw-checkin" data-rw-checkin>Reclamar +${checkinPoints} puntos de hoy</button>`}
      </section>
      <section class="st-group"><h3>Canjea tus puntos</h3><div class="rw-rewards">${rewards.map(reward => { const enough = Number(engagement.points || 0) >= Number(reward.points); return `<article class="rw-reward${enough ? ' ready' : ''}"><strong>${money(reward.amount)}</strong><span>${Number(reward.points).toLocaleString('es-PE')} puntos</span><small>Compra mínima ${money(reward.min || 0)}</small><button type="button" class="${enough ? 'primary-button' : 'secondary-button'}" data-rw-redeem="${Number(reward.points)}" ${enough ? '' : 'disabled'}>${enough ? 'Canjear' : `Te faltan ${(Number(reward.points) - Number(engagement.points || 0)).toLocaleString('es-PE')}`}</button></article>`; }).join('')}</div></section>
      ${engagement.coupons?.length ? `<section class="st-group"><h3>Tus cupones</h3><div class="rw-coupons">${engagement.coupons.map(coupon => `<button type="button" class="rw-coupon" data-copy-coupon="${escape(coupon.code)}"><b>${escape(coupon.code)}</b><span>${money(coupon.amount)} · desde ${money(coupon.min)}${coupon.ends_at ? ` · vence ${new Intl.DateTimeFormat('es-PE', {day: 'numeric', month: 'short'}).format(new Date(coupon.ends_at))}` : ''}</span><i>Copiar</i></button>`).join('')}</div></section>` : ''}
      <section class="st-group"><h3>Cómo ganar puntos</h3><ul class="rw-how"><li><b>${Number(loyalty.points_per_sol || 1) * multiplier} pt</b> por cada S/ 1 en compras pagadas</li><li><b>+${checkinPoints}</b> por entrar cada día · <b>+${Number(loyalty.streak_bonus) || 25}</b> cada ${every} días seguidos</li><li><b>+${Number(loyalty.review_points) || 20}</b> por cada reseña publicada</li><li>Socios Privilège: puntos x${(loyalty.multipliers?.gold) || 1.5} (Gold) y x${(loyalty.multipliers?.black) || 2} (Black)</li></ul></section>
      ${engagement.history?.length ? `<section class="st-group"><h3>Movimientos</h3><ul class="rw-history">${engagement.history.map(row => `<li><span>${escape(reasons[row.reason] || row.reason)}</span><small>${new Intl.DateTimeFormat('es-PE', {day: 'numeric', month: 'short'}).format(new Date(row.created_at))}</small><b class="${row.points > 0 ? 'plus' : 'minus'}">${row.points > 0 ? '+' : ''}${row.points}</b></li>`).join('')}</ul></section>` : ''}`;
  }
  function alertsMarkup() {
    if (state.missing) return '<p class="st-note">Los avisos se activarán muy pronto.</p>';
    if (!state.notifications.length) return `<div class="rw-guest"><span class="rw-big-icon" aria-hidden="true">🔔</span><h3>Todo al día</h3><p>Guarda productos en favoritos (♡) y te avisamos cuando bajen de precio o vuelvan a tener stock.</p></div>`;
    const icons = {precio: '🏷️', stock: '📦', pedido: '🚚', pago: '✓', vip: '✦', puntos: '🔥', sistema: 'ℹ️'};
    const ago = value => { const minutes = Math.round((Date.now() - new Date(value)) / 60000); return minutes < 60 ? `hace ${Math.max(1, minutes)} min` : minutes < 1440 ? `hace ${Math.round(minutes / 60)} h` : new Intl.DateTimeFormat('es-PE', {day: 'numeric', month: 'short'}).format(new Date(value)); };
    return `<div class="nt-tools"><button type="button" class="text-button" data-nt-read>Marcar todo como leído</button></div><ul class="nt-list">${state.notifications.map(item => `<li class="${item.read_at ? '' : 'unread'}"><span class="nt-icon" aria-hidden="true">${icons[item.kind] || '•'}</span><a href="${escape(item.link || '#')}"><strong>${escape(item.title)}</strong>${item.body ? `<span>${escape(item.body)}</span>` : ''}<small>${ago(item.created_at)}</small></a></li>`).join('')}</ul>`;
  }

  // ---------- Datos del cliente ----------
  async function refresh() {
    const client = app().client;
    const user = app().user;
    document.getElementById('notif-button').hidden = !user;
    if (!client || !user) { state.engagement = null; updateBadge(); if (!sheet.hidden) render(); return; }
    state.loading = true;
    if (!sheet.hidden && state.tab !== 'studio') render();
    const [engagement, notifications, settings] = await Promise.all([
      client.rpc('my_engagement'),
      client.from('notifications').select('id,kind,title,body,link,read_at,created_at').order('created_at', {ascending: false}).limit(30),
      window.MSJSettings.load()
    ]);
    state.loading = false;
    state.loyalty = settings.loyalty || {};
    state.missing = Boolean(engagement.error && /function|does not exist|schema cache/i.test(engagement.error.message || ''));
    state.engagement = engagement.error ? null : engagement.data;
    state.notifications = notifications.error ? [] : notifications.data || [];
    // El diseño guardado en la cuenta manda sobre el del dispositivo.
    if (state.engagement?.theme && Object.keys(state.engagement.theme).length) {
      const saved = UI.clean(state.engagement.theme);
      UI.saveLocal(saved);
      UI.apply(saved, document.documentElement, {vip: isVip()});
    }
    if (isVip()) {
      const style = await client.rpc('my_profile_style');
      state.profile = style.error ? null : style.data;
      if (state.profile && Object.keys(state.profile).length && !state.profileDraft) state.profileDraft = {...profileDefaults, ...state.profile};
    } else state.profile = null;
    headerAvatar();
    updateBadge();
    if (!sheet.hidden) render();
    nudge();
    celebrate();
    legendBadge();
    document.dispatchEvent(new CustomEvent('msj:engagement', {detail: state.engagement}));
  }
  // Insignia dorada en la cabecera para el nivel Leyenda (o socios).
  function legendBadge() {
    const {levelIndex} = achievements();
    const button = document.getElementById('studio-button');
    if (button) button.classList.toggle('legend', levelIndex >= 4);
  }
  function updateBadge() {
    const count = Number(state.engagement?.unread || 0);
    const badge = document.getElementById('notif-count');
    if (badge) { badge.textContent = count > 9 ? '9+' : String(count); badge.hidden = !count; }
  }
  // Recordatorio amable de la racha (una vez al día, solo con sesión).
  function nudge() {
    const engagement = state.engagement;
    if (!engagement || engagement.checked_today || !sheet.hidden) return;
    const key = `msj-nudge-${new Date().toISOString().slice(0, 10)}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { return; }
    setTimeout(() => {
      if (document.querySelector('.rw-nudge')) return;
      document.body.insertAdjacentHTML('beforeend', `<div class="rw-nudge lg" role="status"><span aria-hidden="true">🔥</span><p><strong>${engagement.streak ? `Racha de ${engagement.streak} ${engagement.streak === 1 ? 'día' : 'días'}` : 'Empieza tu racha'}</strong><small>Reclama tus puntos de hoy</small></p><button type="button" class="primary-button" data-open-studio="rewards">Reclamar</button><button type="button" class="rw-nudge-close" aria-label="Cerrar">×</button></div>`);
      setTimeout(() => document.querySelector('.rw-nudge')?.classList.add('show'), 30);
      setTimeout(() => dismissNudge(), 12000);
    }, 3500);
  }
  function dismissNudge() { const node = document.querySelector('.rw-nudge'); if (!node) return; node.classList.remove('show'); setTimeout(() => node.remove(), 400); }

  async function checkin(button) {
    button.disabled = true;
    button.textContent = 'Sumando…';
    const {data: result, error} = await app().client.rpc('daily_checkin');
    if (error) { app().showToast?.(/racha|sesi|pausa/i.test(error.message) ? error.message : 'No pudimos sumar tu racha. Inténtalo en un momento.'); button.disabled = false; render(); return; }
    burst(button);
    app().showToast?.(result.already ? 'Ya reclamaste tu racha de hoy.' : `🔥 +${result.earned} puntos${result.bonus ? ` (incluye bonus de +${result.bonus})` : ''} · racha de ${result.streak} ${result.streak === 1 ? 'día' : 'días'}`);
    await refresh();
  }
  async function redeem(points, button) {
    if (!confirm(`¿Canjear ${points.toLocaleString('es-PE')} puntos por un cupón?`)) return;
    button.disabled = true;
    const {data: result, error} = await app().client.rpc('redeem_points', {p_points: points});
    if (error) { app().showToast?.(error.message || 'No se pudo canjear.'); button.disabled = false; return; }
    try { await navigator.clipboard?.writeText(result.code); } catch {}
    app().showToast?.(`Cupón ${result.code} de ${money(result.amount)} listo (copiado). Úsalo en tu próxima compra.`);
    burst(button);
    await refresh();
  }
  function burst(node) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !node) return;
    const box = node.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'rw-burst';
    layer.style.left = `${box.left + box.width / 2}px`; layer.style.top = `${box.top + box.height / 2}px`;
    layer.innerHTML = Array.from({length: 14}, (_, index) => `<i style="--a:${index * 360 / 14}deg;--d:${50 + (index % 3) * 18}px"></i>`).join('');
    document.body.append(layer);
    setTimeout(() => layer.remove(), 900);
  }

  async function applyDraft() {
    const draft = UI.clean(state.draft);
    const vip = isVip();
    if (!vip && UI.isPremium(draft)) {
      app().showToast?.('Ese diseño usa opciones ✦ exclusivas de socios. Únete al Privilège Club para usarlo.');
      sheet.querySelector('.st-note')?.classList.add('flash');
      return;
    }
    UI.saveLocal(draft);
    UI.apply(draft, document.documentElement, {vip});
    setTimeout(celebrate, 600);
    const client = app().client;
    if (client && app().user) {
      const {error} = await client.rpc('save_ui_theme', {p_theme: draft});
      app().showToast?.(error ? (/exclusiva/i.test(error.message) ? error.message : 'Diseño aplicado en este dispositivo.') : '✦ Diseño guardado en tu cuenta.');
    } else {
      app().showToast?.('Diseño aplicado. Inicia sesión para guardarlo en tu cuenta.');
    }
    close();
  }

  // ---------- Eventos ----------
  document.addEventListener('click', event => {
    const target = event.target;
    const opener = target.closest('[data-open-studio]');
    if (opener) { event.preventDefault(); dismissNudge(); open(opener.dataset.openStudio || 'studio'); return; }
    if (target.closest('#studio-button')) { open('studio'); return; }
    if (target.closest('#notif-button')) { open('alerts'); return; }
    if (target.closest('.rw-nudge-close')) { dismissNudge(); return; }
    if (!sheet.contains(target) && target !== backdrop) return;
    if (target === backdrop || target.closest('[data-studio-close]')) { close(); return; }
    const tab = target.closest('[data-studio-tab]');
    if (tab) { state.tab = tab.dataset.studioTab; render(); if (state.tab !== 'studio') refresh(); return; }
    if (target.closest('[data-studio-login]')) { close(); app().renderAccount?.(); return; }
    const ppOption = target.closest('[data-pp-key]');
    if (ppOption) { state.profileDraft = {...(state.profileDraft || profileDefaults), [ppOption.dataset.ppKey]: ppOption.dataset.ppValue}; render(); return; }
    if (target.closest('[data-pp-save]')) { saveProfile(target.closest('[data-pp-save]')); return; }
    const opt = target.closest('[data-st-key]');
    if (opt) { state.draft = {...state.draft, [opt.dataset.stKey]: opt.dataset.stValue}; render(); return; }
    const look = target.closest('[data-st-look]');
    if (look) {
      const allLooks = [...looks.map(([name, value]) => [name, value, 0]), ...authorLooks];
      const [name, value, needed] = allLooks[Number(look.dataset.stLook)] || [];
      if (!value) return;
      if (!isVip() && achievements().levelIndex < needed) { app().showToast?.(`🔒 «${name}» se desbloquea en el nivel ${levels[needed].name}. Mira cómo subir en Logros.`); return; }
      state.draft = {...UI.defaults, ...value, header: state.draft.header, festive: state.draft.festive}; render(); return;
    }
    if (target.closest('[data-st-reset]')) { state.draft = {...UI.defaults}; render(); return; }
    if (target.closest('[data-st-apply]')) { applyDraft(); return; }
    const checkinButton = target.closest('[data-rw-checkin]');
    if (checkinButton) { checkin(checkinButton); return; }
    const redeemButton = target.closest('[data-rw-redeem]');
    if (redeemButton) { redeem(Number(redeemButton.dataset.rwRedeem), redeemButton); return; }
    if (target.closest('[data-nt-read]')) {
      app().client?.rpc('notifications_mark_read', {p_ids: null}).then(() => refresh());
      return;
    }
    if (target.closest('[data-vip-join]')) close();
  });
  sheet.addEventListener('input', event => {
    if (event.target.matches('[data-st-color]')) { state.draft = {...state.draft, accent: event.target.value}; paintPreview(); }
    if (event.target.matches('[data-pp-bio]')) { state.profileDraft = {...(state.profileDraft || profileDefaults), bio: event.target.value.slice(0, 80)}; const bio = sheet.querySelector('.pp-bio'); if (bio) bio.textContent = state.profileDraft.bio; }
  });
  sheet.addEventListener('change', event => {
    if (event.target.matches('[data-st-festive]')) { state.draft = {...state.draft, festive: event.target.checked}; }
    if (event.target.matches('[data-pp-badge]')) { state.profileDraft = {...(state.profileDraft || profileDefaults), badge: event.target.checked}; render(); }
  });
  async function saveProfile(button) {
    const client = app().client;
    if (!client || !app().user) { app().showToast?.('Inicia sesión para guardar tu perfil.'); return; }
    button.disabled = true;
    const {data, error} = await client.rpc('save_profile_style', {p_style: state.profileDraft || profileDefaults});
    button.disabled = false;
    if (error) { app().showToast?.(/exclusivo|Privil/i.test(error.message) ? error.message : 'No se pudo guardar tu perfil. Inténtalo otra vez.'); return; }
    state.profile = data; state.profileDraft = {...data};
    headerAvatar(); burst(button);
    app().showToast?.('💎 Perfil Privilège guardado.');
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !sheet.hidden) { close(); return; }
    // Mantiene el foco dentro del panel mientras está abierto.
    if (event.key === 'Tab' && !sheet.hidden) {
      const focusable = [...sheet.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    }
  });
  document.addEventListener('msj:session', refresh);
  document.addEventListener('msj:vip', () => { UI.apply(UI.read(), document.documentElement, {vip: isVip()}); if (!sheet.hidden) render(); });
  // cuenta.html#recompensas abre directo las recompensas.
  const hashTabs = {'#recompensas': 'rewards', '#studio': 'studio', '#avisos': 'alerts', '#logros': 'logros'};
  const fromHash = () => { if (hashTabs[location.hash]) setTimeout(() => open(hashTabs[location.hash]), 400); };
  addEventListener('hashchange', fromHash);
  fromHash();
  window.MSJSettings.load().then(settings => { state.loyalty = settings.loyalty || {}; if (settings.studio?.enabled === false) document.getElementById('studio-button')?.setAttribute('hidden', ''); });
  if (app().user) refresh(); else setTimeout(() => { celebrate(); legendBadge(); }, 1500);
  // Más vendidos reales (public_bestsellers): alimentan las etiquetas «🔥 #1 más vendido en…» de las tarjetas.
  let bestsellersLoaded = false;
  async function loadBestsellers() {
    const client = app().client;
    if (bestsellersLoaded || !client) return;
    bestsellersLoaded = true;
    const {data, error} = await client.rpc('public_bestsellers', {p_days: 60});
    if (error || !data?.length) return;
    window.MSJBestsellers = new Map(data.map(row => [String(row.product_id), {rank: row.rank_in_category, units: row.units}]));
    if (document.body.dataset.page !== 'account') app().refreshPage?.();
  }
  // Acceso anticipado Privilège (products.early_access_until) y stock en tiempo real desde Supabase.
  let earlyLoaded = false, stockChannel = null, stockTimer = 0;
  async function loadEarlyAccess() {
    const client = app().client;
    if (earlyLoaded || !client) return;
    earlyLoaded = true;
    const {data, error} = await client.from('products').select('id,early_access_until').gt('early_access_until', new Date().toISOString());
    if (error || !data?.length) return;
    window.MSJEarlyAccess = new Map(data.map(row => [String(row.id), row.early_access_until]));
    if (document.body.dataset.page !== 'account') app().refreshPage?.();
  }
  function subscribeStock() {
    const client = app().client;
    if (stockChannel || !client?.channel) return;
    // Cada cambio de stock en Supabase (venta, reposición, ajuste en el panel o Mercado Libre) llega a la tienda abierta.
    stockChannel = client.channel('msj-stock').on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'product_variants'}, payload => {
      const row = payload.new || {};
      const product = (app().state?.products || []).find(item => (item.product_variants || []).some(variant => String(variant.id) === String(row.id)));
      const variant = product?.product_variants.find(item => String(item.id) === String(row.id));
      if (!variant) return;
      variant.stock = Number(row.stock); variant.is_active = row.is_active !== false;
      clearTimeout(stockTimer);
      stockTimer = setTimeout(() => { if (document.body.dataset.page !== 'account') app().refreshPage?.(); }, 400);
    }).subscribe();
  }
  document.addEventListener('msj:catalog', () => { loadEarlyAccess(); subscribeStock(); });
  document.addEventListener('msj:catalog', () => { loadBestsellers(); window.MSJSettings.load().then(() => { if (document.body.dataset.page !== 'account') app().refreshPage?.(); }); });

  // Explorador de categorías y búsqueda (categories-2026.js): se carga aquí para estar en todas las páginas.
  if (!window.MSJExplorer && !document.querySelector('script[src^="categories-2026.js"]')) {
    const script = document.createElement('script');
    script.src = 'categories-2026.js?v=20261111';
    document.body.append(script);
  }
  return {open, close, refresh, achievements, achievementsMarkup, levelCard, achievementList, levels};
})();
