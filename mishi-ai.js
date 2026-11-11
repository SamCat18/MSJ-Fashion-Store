// M.I.S.H.I. con IA (Claude, vía la Edge Function «mishi-ai»). Se activa con config.js → features.mishiAI: true
// cuando la función está desplegada y el secreto ANTHROPIC_API_KEY está guardado en Supabase.
// Las preguntas de envíos, pagos, cambios y tallas siguen respondiéndose con las reglas locales (exactas y gratis);
// la IA entra en preguntas abiertas («¿qué me pongo para una boda de día?») o cuando el motor local no encontró nada.
window.MSJMishiAI = (() => {
  const config = window.STORE_CONFIG || {};
  const app = () => window.MSJApp || {};
  let failures = 0;
  const enabled = () => config.features?.mishiAI === true && Boolean(app().client) && failures < 3;
  const genericLocal = answer => !answer?.products?.length && !answer?.link && !answer?.action;
  const faq = /envio|delivery|despacho|pago|pagar|yape|plin|tarjeta|contra entrega|cambio|devol|reembolso|reclam|queja|talla|medida|cupon|mi pedido|seguimiento|horario|whatsapp|humano|asesor/;
  const norm = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function shouldUse(question, local) {
    const text = norm(question);
    if (faq.test(text) || /^(hola|buenas|gracias|ok|chau)\b/.test(text)) return false;
    const words = text.split(/\s+/).filter(Boolean).length;
    return genericLocal(local) || words >= 7 || /\?|recomiend|combina|que me pongo|diferencia|cual es mejor|ayudame|ocasion|boda|cumpleanos|cita|entrevista/.test(text);
  }
  function candidates(question) {
    const products = app().visibleProducts?.() || [];
    const found = window.MSJSearch ? window.MSJSearch.search(question, {products, limit: 14}).map(hit => hit.product) : [];
    const extra = products.filter(product => !found.includes(product) && (product.is_new || Number(product.discount_percent) > 0)).slice(0, 24 - found.length);
    return [...found, ...extra].slice(0, 24).map(product => ({
      slug: product.slug, name: product.name, category: product.category_name || '', audience: product.audience || '',
      price: app().memberPrice ? app().memberPrice(product) : product.price, colors: product.colors || [],
      collections: product.collections || [], in_stock: product.purchasable !== false, vip_only: Boolean(product.vip_only)
    }));
  }
  function history() {
    try { return (JSON.parse(sessionStorage.getItem('msj-mishi-history') || '[]') || []).slice(-7, -1).map(entry => ({role: entry.role, text: entry.text})); } catch { return []; }
  }
  async function ask(question, local) {
    try {
      const {data, error} = await app().client.functions.invoke('mishi-ai', {body: {question, history: history(), candidates: candidates(question), context: {vip_level: app().vipLevel?.()?.short || ''}}});
      if (error || !data?.answer) { failures++; return null; }
      failures = 0;
      const products = (data.products || []).filter(slug => app().findProduct?.(slug));
      return {text: data.answer, products, chips: data.follow_up || [], ai: true, link: products.length ? null : local?.link || null};
    } catch {
      failures++;
      return null;
    }
  }
  return {enabled, shouldUse, ask};
})();
