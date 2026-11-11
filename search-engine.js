// MSJ Search: motor de búsqueda de la tienda y de M.I.S.H.I.
// - Nombre exacto primero («nube» → Camisa Denim Nube), luego palabras del nombre, categoría, marca, colección, color y descripción.
// - Sinónimos de Perú (polo = camiseta, casaca = chaqueta, zapatillas = tenis, lentes = gafas…).
// - Tolera errores de tipeo (distancia de edición) y propone «¿Quisiste decir…?».
// - «Referencias»: productos parecidos al resultado principal (misma categoría, colección, marca, público y precio).
// - Sugerencias en vivo bajo el buscador de la cabecera, con teclado (↑ ↓ Enter Esc) y búsquedas recientes.
window.MSJSearch = (() => {
  const data = window.MSJ_DATA || {products: [], categories: [], collections: [], brands: []};
  const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  // Palabras de relleno o de conversación que no describen un producto («a ver», «qué podemos comprar», «una cosa»…).
  const stop = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'uno', 'unos', 'unas', 'y', 'o', 'u', 'e', 'en', 'con', 'sin', 'para', 'por', 'pa', 'mi', 'mis', 'me', 'te', 'se', 'le', 'les', 'nos', 'yo', 'tu', 'tus', 'su', 'sus', 'al', 'lo', 'a', 'es', 'son', 'que', 'cual', 'cuales', 'como', 'donde', 'cuando', 'muy', 'mas', 'menos', 'tan', 'algo', 'alguna', 'alguno', 'cosa', 'cosas', 'ver', 'aver', 'quiero', 'quisiera', 'queria', 'busco', 'buscar', 'buscando', 'tienes', 'tienen', 'tiene', 'tenes', 'hay', 'dame', 'dime', 'muestrame', 'ensename', 'necesito', 'favor', 'porfa', 'porfavor', 'please', 'podemos', 'puedo', 'puedes', 'pueden', 'podria', 'comprar', 'compro', 'llevar', 'recomienda', 'recomiendas', 'recomiendame', 'sugiere', 'sugieres', 'estas', 'estos', 'este', 'esta', 'esto', 'ese', 'esa', 'eso', 'esos', 'esas', 'aqui', 'ahi', 'hola', 'gracias', 'ok', 'bueno', 'buena', 'bien', 'oye', 'mira', 'xd', 'jaja']);
  // Grupos de sinónimos: cualquier palabra del grupo encuentra a las demás (con algo menos de peso que la palabra exacta).
  const groups = [
    ['polo', 'polos', 'camiseta', 'camisetas', 'remera', 'tshirt', 't shirt', 'playera'],
    ['polera', 'poleras', 'hoodie', 'sudadera', 'capucha', 'buzo', 'canguro'],
    ['casaca', 'casacas', 'chaqueta', 'chamarra', 'campera', 'jacket', 'bomber', 'cortavientos', 'biker'],
    ['chompa', 'chompas', 'sueter', 'sweater', 'jersey', 'cardigan', 'tejido'],
    ['abrigo', 'abrigos', 'tapado', 'trench', 'coat', 'gaban'],
    ['blazer', 'blazers', 'saco', 'terno', 'ternos', 'sastre', 'sastrero'],
    ['jean', 'jeans', 'vaquero', 'denim', 'mezclilla'],
    ['pantalon', 'pantalones', 'jogger', 'joggers', 'palazzo', 'chino'],
    ['short', 'shorts', 'bermuda', 'bermudas'],
    ['vestido', 'vestidos', 'dress'],
    ['falda', 'faldas', 'pollera', 'skirt'],
    ['blusa', 'blusas', 'top', 'tops'],
    ['camisa', 'camisas', 'shirt'],
    ['zapatilla', 'zapatillas', 'tenis', 'sneaker', 'sneakers', 'deportivas'],
    ['zapato', 'zapatos', 'derby', 'mocasin', 'mocasines', 'oxford'],
    ['bota', 'botas', 'botin', 'botines'],
    ['sandalia', 'sandalias', 'chancla', 'chanclas', 'ojota', 'ojotas'],
    ['taco', 'tacos', 'tacon', 'tacones', 'stiletto'],
    ['gorra', 'gorras', 'gorro', 'gorros', 'jockey', 'cap'],
    ['bolso', 'bolsos', 'cartera', 'carteras', 'bag', 'tote'],
    ['mochila', 'mochilas', 'backpack'],
    ['lente', 'lentes', 'gafas', 'anteojos', 'sunglasses'],
    ['reloj', 'relojes', 'watch'],
    ['joya', 'joyas', 'joyeria', 'collar', 'aretes', 'pulsera', 'anillo', 'cadena'],
    ['cinturon', 'cinturones', 'correa', 'billetera', 'billeteras'],
    ['perfume', 'perfumes', 'fragancia', 'fragancias', 'colonia', 'aroma', 'parfum'],
    ['mujer', 'dama', 'damas', 'ella', 'femenino', 'chica'],
    ['hombre', 'caballero', 'varon', 'el', 'masculino', 'chico'],
    ['negro', 'negra', 'black', 'obsidiana'],
    ['blanco', 'blanca', 'white', 'marfil', 'crema'],
    ['azul', 'navy', 'marino', 'celeste'],
    ['rojo', 'roja', 'red', 'vino', 'burdeos'],
    ['frio', 'invierno', 'abrigador', 'abrigadora'],
    ['verano', 'playa', 'calor'],
    ['fiesta', 'noche', 'gala', 'evento'],
    ['oficina', 'formal', 'trabajo'],
    ['deporte', 'deportivo', 'gym', 'gimnasio', 'entrenar', 'running'],
    ['regalo', 'regalos', 'obsequio', 'navidad', 'detalle']
  ];
  const synonyms = new Map();
  groups.forEach(group => group.map(norm).forEach(word => synonyms.set(word, group.map(norm).filter(other => other !== word))));
  // Plurales simples: «casacas» → «casaca», «botines» → «botin».
  const stem = word => word.length > 4 && word.endsWith('es') && !word.endsWith('ces') ? word.slice(0, -2) : word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;

  function levenshtein(a, b, max = 2) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let previous = Array.from({length: b.length + 1}, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      let best = current[0];
      for (let j = 1; j <= b.length; j++) {
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (current[j] < best) best = current[j];
      }
      if (best > max) return max + 1;
      previous = current;
    }
    return previous[b.length];
  }
  const typoBudget = word => word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;

  // ---------- Productos: los de la tienda en vivo (app.js) o, si aún no cargó, los de catalog-data.js ----------
  function liveProducts() {
    const app = window.MSJApp;
    if (app?.visibleProducts) return app.visibleProducts();
    const categories = new Map(data.categories.map(category => [category.slug, category]));
    const brands = new Map((data.brands || []).map(brand => [brand.slug, brand.name]));
    return data.products.filter(product => !product.vip).map((product, order) => ({
      id: product.s, slug: product.s, name: product.n, category_slug: product.c, category_name: categories.get(product.c)?.name || product.c,
      department: categories.get(product.c)?.department || '', audience: product.a, brand_name: brands.get(product.b) || '', brand_slug: product.b,
      collections: product.cl || [], colors: product.co || [], description: product.de || '', price: product.p, discount_percent: product.d || 0,
      is_new: Boolean(product.nw), image_url: data.imageUrl ? data.imageUrl(product.i, 300) : '', order
    }));
  }
  const collectionName = new Map((data.collections || []).map(collection => [collection.slug, collection.name]));
  const indexCache = new WeakMap();
  function docFor(product) {
    let doc = indexCache.get(product);
    if (doc) return doc;
    const fields = {
      name: norm(product.name),
      category: norm(`${product.category_name || ''} ${product.category_slug || ''}`),
      brand: norm(product.brand_name),
      collection: norm((product.collections || []).map(slug => `${collectionName.get(slug) || ''} ${slug}`).join(' ')),
      color: norm((product.colors || []).join(' ')),
      audience: norm(`${product.audience || ''} ${product.department || ''}`),
      description: norm(product.description)
    };
    doc = {fields, tokens: Object.fromEntries(Object.entries(fields).map(([key, text]) => [key, [...new Set(text.split(' ').filter(Boolean))]]))};
    indexCache.set(product, doc);
    return doc;
  }
  const weights = {name: 10, category: 6, brand: 4, collection: 3, color: 3, audience: 2, description: 1.2};

  // Fonética del español: b/v, s/z/c suave, k/c fuerte/qu, ll/y y h muda suenan igual («nuve» = «nube», «sapato» = «zapato»).
  const phonCache = new Map();
  function phon(word) {
    let value = phonCache.get(word);
    if (value) return value;
    value = word.replace(/ch/g, '§').replace(/h/g, '').replace(/§/g, 'ch').replace(/ll/g, 'y').replace(/v/g, 'b').replace(/z/g, 's')
      .replace(/c([ei])/g, 's$1').replace(/qu([ei])/g, 'k$1').replace(/c([aou])/g, 'k$1').replace(/(.)\1+/g, '$1');
    phonCache.set(word, value);
    return value;
  }
  // Qué tan bien coincide una palabra de la búsqueda con una palabra del producto (1 = exacta).
  function tokenMatch(term, token) {
    if (term === token) return 1;
    if (stem(term) === stem(token)) return .95;
    if (term.length >= 3 && phon(stem(term)) === phon(stem(token))) return .88;
    if (term.length >= 3 && token.startsWith(term)) return .78;
    if (term.length >= 4 && token.includes(term)) return .55;
    const budget = typoBudget(term);
    if (budget && Math.abs(term.length - token.length) <= budget && levenshtein(phon(term), phon(token), budget) <= budget) return .62;
    return 0;
  }
  function termScore(term, doc) {
    let best = 0, field = '', quality = 0;
    for (const [key, tokens] of Object.entries(doc.tokens)) {
      for (const token of tokens) {
        const match = tokenMatch(term, token);
        const value = match * weights[key];
        if (value > best) { best = value; field = key; quality = match; }
      }
    }
    return {best, field, quality};
  }
  function parse(query) {
    const text = norm(query);
    // Un número suelto de una cifra («1 cosa») no describe nada; tallas y medidas (38, 100) sí se conservan.
    const terms = text.split(' ').filter(word => word && !stop.has(word) && (word.length > 1 || /\d/.test(word)) && !/^\d$/.test(word));
    return {text, terms};
  }

  // Busca y puntúa. Devuelve [{product, score, kind}] de mayor a menor.
  function search(query, {products = liveProducts(), limit = 60} = {}) {
    const {text, terms} = parse(query);
    if (!text || !terms.length) return [];
    const phrase = terms.join(' ');
    const results = [];
    for (const product of products) {
      const doc = docFor(product);
      let score = 0, matched = 0, nameHits = 0, weakest = 1;
      if (doc.fields.name === phrase || doc.fields.name === text) score += 220;
      else if ((` ${doc.fields.name} `).includes(` ${phrase} `)) score += terms.length > 1 ? 140 : 90;
      else if (doc.fields.name.startsWith(phrase)) score += 45;
      for (const term of terms) {
        let {best, field, quality} = termScore(term, doc);
        let viaSynonym = false;
        // Sinónimos (si la palabra exacta no está): «chaqueta» encuentra «casaca».
        if (best < weights.category) {
          for (const alt of synonyms.get(term) || synonyms.get(stem(term)) || []) {
            const synonymMatch = termScore(alt, doc);
            if (synonymMatch.best * .85 > best) { best = synonymMatch.best * .85; field = synonymMatch.field; quality = synonymMatch.quality * .85; viaSynonym = true; }
          }
        }
        // Solo cuenta como «está en el nombre» si es la palabra (o su sonido), no un parecido por error de tipeo.
        if (best > 0) { matched++; score += best; weakest = Math.min(weakest, quality); if (field === 'name' && quality >= .78 && !viaSynonym) nameHits++; }
      }
      if (!matched) continue;
      const coverage = matched / terms.length;
      if (terms.length > 1 && coverage < .5) continue;
      score *= .45 + .55 * coverage;
      if (product.purchasable !== false) score *= 1.03;
      if (product.is_new) score *= 1.02;
      const kind = score >= 200 ? 'exacto' : nameHits === terms.length ? 'nombre' : coverage === 1 && weakest >= .7 ? 'relacionado' : 'aproximado';
      results.push({product, score: Math.round(score * 10) / 10, kind});
    }
    return results.sort((a, b) => b.score - a.score || (a.product.order ?? 0) - (b.product.order ?? 0)).slice(0, limit);
  }
  const rank = (products, query) => search(query, {products, limit: 500}).map(result => result.product);

  // Productos parecidos a uno (para «Referencias»).
  function related(product, {products = liveProducts(), exclude = [], limit = 6} = {}) {
    const skip = new Set([product, ...exclude].map(item => item?.slug));
    const price = Number(product.price) || 0;
    return products.filter(item => !skip.has(item.slug)).map(item => {
      let score = 0;
      if (item.category_slug === product.category_slug) score += 5;
      score += (item.collections || []).filter(slug => (product.collections || []).includes(slug)).length * 2;
      if (item.brand_slug && item.brand_slug === product.brand_slug) score += 2;
      if (item.audience === product.audience || item.audience === 'Unisex' || product.audience === 'Unisex') score += 1;
      if (price && Math.abs((Number(item.price) || 0) - price) / price <= .3) score += 1;
      if (item.department === product.department) score += .5;
      return {item, score};
    }).filter(entry => entry.score >= 3).sort((a, b) => b.score - a.score).slice(0, limit).map(entry => entry.item);
  }

  // Vocabulario para «¿Quisiste decir…?»: solo palabras de productos (nombre, categoría, marca, colección, color),
  // no de descripciones; así no corrige frases de conversación («cosa» → «rosa»).
  let vocabulary = null;
  function didYouMean(query, products = liveProducts()) {
    if (!vocabulary) {
      vocabulary = new Set();
      products.forEach(product => { const {tokens} = docFor(product); [...tokens.name, ...tokens.category, ...tokens.brand, ...tokens.collection, ...tokens.color].forEach(word => word.length >= 4 && vocabulary.add(word)); });
      groups.flat().forEach(word => norm(word).length >= 4 && vocabulary.add(norm(word)));
    }
    const {terms} = parse(query);
    if (!terms.length || terms.length > 3) return '';
    let changed = false;
    const fixed = terms.map(term => {
      if (vocabulary.has(term) || term.length < 4) return term;
      let best = term, distance = 3;
      for (const word of vocabulary) {
        if (Math.abs(word.length - term.length) > 2) continue;
        const d = levenshtein(term, word, 2);
        if (d < distance) { distance = d; best = word; }
      }
      if (best !== term && distance <= Math.max(1, typoBudget(term))) { changed = true; return best; }
      return term;
    });
    return changed ? fixed.join(' ') : '';
  }

  // Resumen para M.I.S.H.I.: coincidencia por nombre + referencias parecidas.
  function lookup(query, products = liveProducts()) {
    const hits = search(query, {products, limit: 24});
    const strong = hits.filter(hit => hit.kind === 'exacto' || hit.kind === 'nombre');
    const top = strong[0]?.product || null;
    const references = top ? related(top, {products, exclude: strong.map(hit => hit.product), limit: 6}) : [];
    return {hits, strong: strong.map(hit => hit.product), top, references, didYouMean: hits.length ? '' : didYouMean(query, products)};
  }

  function highlight(text, query) {
    const {terms} = parse(query);
    const source = String(text ?? '');
    if (!terms.length) return escape(source);
    // Versión normalizada letra por letra (mismo largo que el original) para marcar «Nube» aunque escribas «nube».
    let plain = '';
    for (const char of source) {
      const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()[0] || ' ';
      plain += (/[a-z0-9]/.test(base) ? base : ' ').padEnd(char.length, ' ');
    }
    const marks = [];
    terms.forEach(term => { let from = 0; let index; while ((index = plain.indexOf(term, from)) !== -1) { marks.push([index, index + term.length]); from = index + term.length; } });
    if (!marks.length) return escape(source);
    marks.sort((a, b) => a[0] - b[0]);
    let html = '', cursor = 0;
    for (const [start, end] of marks) { if (start < cursor) continue; html += escape(source.slice(cursor, start)) + `<mark>${escape(source.slice(start, end))}</mark>`; cursor = end; }
    return html + escape(source.slice(cursor));
  }

  // ---------- Registro anónimo (panel → Búsquedas: lo más buscado y lo que no se encontró) ----------
  function log(query, results, source = 'tienda') {
    const client = window.MSJApp?.client;
    const text = norm(query);
    if (!client || text.length < 2) return;
    client.rpc('log_search', {p_query: text, p_results: results, p_source: source}).then(() => {}, () => {});
  }

  // ---------- Sugerencias en vivo bajo el buscador ----------
  const recentKey = 'msj-recent-searches';
  const readRecent = () => { try { const list = JSON.parse(localStorage.getItem(recentKey) || '[]'); return Array.isArray(list) ? list.slice(0, 6) : []; } catch { return []; } };
  const remember = query => { const text = String(query || '').trim().slice(0, 60); if (text.length < 2) return; try { localStorage.setItem(recentKey, JSON.stringify([text, ...readRecent().filter(item => norm(item) !== norm(text))].slice(0, 6))); } catch {} };
  const popular = ['Casacas', 'Zapatillas', 'Perfume dulce', 'Regalos de Navidad', 'Vestidos de fiesta', 'Jeans'];

  function attach() {
    const form = document.getElementById('header-search');
    const input = document.getElementById('search-input');
    if (!form || !input || form.dataset.suggest) return;
    form.dataset.suggest = '1';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'search-suggest');
    form.insertAdjacentHTML('beforeend', '<div class="search-suggest" id="search-suggest" role="listbox" aria-label="Sugerencias" hidden></div>');
    const box = document.getElementById('search-suggest');
    let timer = 0, activeIndex = -1;
    const price = product => window.MSJApp?.money ? window.MSJApp.money(window.MSJApp.memberPrice ? window.MSJApp.memberPrice(product) : product.price) : `S/ ${Number(product.price).toFixed(2)}`;
    const image = product => window.MSJApp?.productImage ? window.MSJApp.productImage(product) : product.image_url || '';
    const options = () => [...box.querySelectorAll('[data-s-option]')];
    function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); activeIndex = -1; }
    function setActive(index) {
      const list = options();
      list.forEach((node, i) => { node.classList.toggle('active', i === index); node.setAttribute('aria-selected', String(i === index)); });
      activeIndex = index;
      list[index]?.scrollIntoView({block: 'nearest'});
    }
    function render() {
      const query = input.value.trim();
      let html = '';
      if (query.length < 2) {
        const recent = readRecent();
        html = `${recent.length ? `<h4>Recientes</h4><div class="s-chip-row">${recent.map(item => `<button type="button" data-s-option data-s-query="${escape(item)}">↺ ${escape(item)}</button>`).join('')}</div>` : ''}<h4>Lo más buscado</h4><div class="s-chip-row">${popular.map(item => `<button type="button" data-s-option data-s-query="${escape(item)}">${escape(item)}</button>`).join('')}</div>`;
      } else {
        const products = liveProducts();
        const hits = search(query, {products, limit: 6});
        const categories = data.categories.filter(category => norm(category.name).includes(norm(query)) || (synonyms.get(norm(query)) || []).some(word => norm(category.name).includes(word) || category.slug === word)).slice(0, 4);
        if (hits.length) {
          html += `<h4>${hits[0].kind === 'exacto' || hits[0].kind === 'nombre' ? 'Productos' : 'Productos relacionados'}</h4>` + hits.map(({product}) => `<a href="#producto/${encodeURIComponent(product.slug)}" role="option" data-s-option data-s-product="${escape(product.slug)}"><img src="${escape(image(product))}" alt="" loading="lazy"><span class="s-meta"><span>${highlight(product.name, query)}</span><small>${escape(product.category_name || '')}${product.audience ? ` · ${escape(product.audience)}` : ''}</small></span><span class="s-price">${escape(price(product))}</span></a>`).join('');
        }
        if (categories.length) html += `<h4>Categorías</h4>` + categories.map(category => `<a href="tienda.html?c=${encodeURIComponent(category.slug)}" role="option" data-s-option>${escape(category.icon || '')} ${highlight(category.name, query)}</a>`).join('');
        if (!hits.length) {
          const suggestion = didYouMean(query, products);
          html += `<p class="s-did">No encontramos «${escape(query)}».${suggestion ? ` ¿Quisiste decir <button type="button" data-s-option data-s-query="${escape(suggestion)}">${escape(suggestion)}</button>?` : ' Prueba con otra palabra o pregúntale a M.I.S.H.I.'}</p>`;
        }
        html += `<button type="button" role="option" data-s-option data-s-submit>🔎 Ver todos los resultados de «${escape(query)}»</button>`;
        html += `<button type="button" role="option" data-s-option data-s-mishi="${escape(query)}">✦ Preguntarle a M.I.S.H.I.</button>`;
      }
      box.innerHTML = html;
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      activeIndex = -1;
    }
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 90); });
    input.addEventListener('focus', render);
    input.addEventListener('keydown', event => {
      if (box.hidden) return;
      const list = options();
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(list.length - 1, activeIndex + 1)); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(0, activeIndex - 1)); }
      else if (event.key === 'Escape') { close(); }
      else if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); list[activeIndex].click(); }
    });
    form.addEventListener('submit', () => { const query = input.value.trim(); remember(query); log(query, search(query, {limit: 60}).length, document.body.dataset.page === 'catalog' ? 'catalogo' : 'tienda'); close(); });
    box.addEventListener('mousedown', event => event.preventDefault());
    box.addEventListener('click', event => {
      const option = event.target.closest('[data-s-option]');
      if (!option) return;
      if (option.dataset.sQuery) { input.value = option.dataset.sQuery; input.dispatchEvent(new Event('input', {bubbles: true})); render(); input.focus(); return; }
      if (option.dataset.sSubmit !== undefined) { form.requestSubmit ? form.requestSubmit() : form.submit(); return; }
      if (option.dataset.sMishi) { event.preventDefault(); close(); window.MSJApp?.mishiOpen?.(option.dataset.sMishi); return; }
      if (option.dataset.sProduct) {
        event.preventDefault();
        remember(input.value);
        log(input.value, 1);
        close();
        input.blur();
        const product = window.MSJApp?.findProduct?.(option.dataset.sProduct);
        if (product && window.MSJApp?.showProduct) window.MSJApp.showProduct(product); else location.hash = `producto/${option.dataset.sProduct}`;
        return;
      }
      close();
    });
    document.addEventListener('click', event => { if (!form.contains(event.target)) close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();

  return {norm, search, rank, related, lookup, didYouMean, highlight, log, remember, synonyms, attach};
})();
