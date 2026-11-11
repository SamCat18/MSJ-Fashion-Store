import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// M.I.S.H.I. con IA generativa (Claude). La tienda manda la pregunta, las últimas líneas de la conversación y una lista
// corta de productos candidatos (los que encontró MSJ Search en el navegador). Claude responde SOLO con esos productos,
// así no inventa precios ni stock. Si esta función falla, la tienda responde con el motor local (reglas + búsqueda).
//
// Configuración (la clave NUNCA va en config.js ni en el navegador):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...      (Console de Anthropic → API Keys)
//   supabase secrets set MISHI_MODEL=claude-opus-5-5              (opcional; por defecto claude-opus-5-5)
//   supabase functions deploy mishi-ai --no-verify-jwt            (la usan también visitantes sin cuenta)
// Luego, en config.js: features.mishiAI = true. Requiere database/v2026.sql (ai_take_quota) para el límite de uso.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");

type Candidate = { slug: string; name: string; category: string; audience: string; price: number; colors: string[]; collections: string[]; in_stock: boolean; vip_only: boolean };

const SYSTEM = `Eres M.I.S.H.I. (Moda, Inteligencia y Estilo Hiperpersonalizado Integrado), la asesora de compras de MSJ Fashion Store, una tienda peruana de ropa, calzado, accesorios y perfumes.
Hablas en español de Perú, con calidez y cercanía, sin exagerar. Respuestas breves: máximo 3 oraciones (unas 70 palabras).
Reglas:
- Recomienda únicamente productos de la lista CANDIDATOS que te da el sistema, usando su "slug" exacto en el campo "products" (de 0 a 6, del más al menos recomendado). Nunca inventes productos, precios, tallas, stock ni descuentos.
- Si un candidato tiene "in_stock": false, no lo recomiendes como disponible.
- Si ningún candidato encaja, dilo con honestidad y sugiere cómo buscar (categoría, ocasión, presupuesto).
- Sobre envíos, pagos, cambios o reclamos da solo orientación general y deriva a las páginas de la tienda (Envíos, Cambios y devoluciones, Libro de Reclamaciones) o a "Hablar con el equipo". No prometas plazos ni montos.
- Puedes sugerir cómo combinar prendas (outfits) con los candidatos.
- No pidas ni aceptes datos sensibles (tarjetas, contraseñas, DNI). Si el mensaje no trata de moda o de la tienda, redirige amablemente a la compra.
- En "follow_up" propone hasta 3 preguntas cortas que el cliente podría tocar para seguir (máximo 40 caracteres cada una).`;

const SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    products: { type: "array", items: { type: "string" } },
    follow_up: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "products", "follow_up"],
  additionalProperties: false,
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey) return respond({ error: "La IA de M.I.S.H.I. no está configurada (falta ANTHROPIC_API_KEY)." }, 503);

  let body: { question?: unknown; history?: unknown; candidates?: unknown; context?: Record<string, unknown> };
  try { body = await request.json(); } catch { return respond({ error: "Solicitud no válida." }, 400); }
  const question = clean(body.question, 300);
  if (question.length < 2) return respond({ error: "Escribe tu consulta." }, 400);

  // Límite de uso: 20 consultas por hora por visitante sin cuenta y 60 con cuenta (evita gastar el saldo de la API).
  let userId = "";
  const authorization = request.headers.get("Authorization") || "";
  if (supabaseUrl && serviceKey) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id || "";
    }
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId || ip}|msj-mishi`));
    const key = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 40);
    const { data: allowed, error } = await admin.rpc("ai_take_quota", { p_key: key, p_limit: userId ? 60 : 20 });
    if (!error && allowed === false) return respond({ error: "Llegaste al límite de consultas por ahora. Vuelve en un rato o escribe al equipo." }, 429);
  }

  const candidates: Candidate[] = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 24).map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      slug: clean(row.slug, 120), name: clean(row.name, 120), category: clean(row.category, 60), audience: clean(row.audience, 20),
      price: Math.max(0, Number(row.price) || 0), colors: (Array.isArray(row.colors) ? row.colors : []).slice(0, 6).map((color) => clean(color, 30)),
      collections: (Array.isArray(row.collections) ? row.collections : []).slice(0, 6).map((name) => clean(name, 40)),
      in_stock: row.in_stock !== false, vip_only: row.vip_only === true,
    };
  }).filter((item) => item.slug && item.name);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map((entry) => {
    const row = (entry || {}) as Record<string, unknown>;
    return { role: row.role === "user" ? "user" as const : "assistant" as const, text: clean(row.text, 400) };
  }).filter((entry) => entry.text);
  const vipLevel = clean(body.context?.vip_level, 20);

  // La conversación previa va como texto de contexto dentro del turno del usuario (un solo turno, sin prefill).
  const userTurn = [
    history.length ? `CONVERSACIÓN RECIENTE:\n${history.map((entry) => `${entry.role === "user" ? "Cliente" : "M.I.S.H.I."}: ${entry.text}`).join("\n")}` : "",
    `CANDIDATOS (JSON):\n${JSON.stringify(candidates)}`,
    vipLevel ? `El cliente es socio ${vipLevel} del MSJ Privilège Club (ya ve su precio de socio en la tienda).` : "",
    `PREGUNTA DEL CLIENTE:\n${question}`,
  ].filter(Boolean).join("\n\n");

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 25_000 });
  try {
    const response = await client.beta.messages.create({
      model: Deno.env.get("MISHI_MODEL") || "claude-opus-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      // Chat de tienda: esfuerzo bajo = respuestas rápidas y económicas.
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      // Si el modelo declina por política, la API reintenta en el modelo recomendado (fallback del servidor).
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: userTurn }],
    });
    if (response.stop_reason === "refusal") {
      return respond({ answer: "Prefiero ayudarte con moda y con tu compra en MSJ. ¿Qué estás buscando hoy?", products: [], follow_up: ["Recomiéndame un outfit", "Perfume para regalo"] });
    }
    const text = response.content.filter((block) => block.type === "text").map((block) => (block as { text: string }).text).join("");
    let parsed: { answer?: unknown; products?: unknown; follow_up?: unknown };
    try { parsed = JSON.parse(text); } catch { return respond({ error: "Respuesta incompleta de la IA." }, 502); }
    const allowedSlugs = new Set(candidates.filter((item) => item.in_stock).map((item) => item.slug));
    return respond({
      answer: clean(parsed.answer, 700) || "¿Me cuentas un poco más de lo que buscas?",
      products: (Array.isArray(parsed.products) ? parsed.products : []).map((slug) => clean(slug, 120)).filter((slug) => allowedSlugs.has(slug)).slice(0, 6),
      follow_up: (Array.isArray(parsed.follow_up) ? parsed.follow_up : []).map((item) => clean(item, 60)).filter(Boolean).slice(0, 3),
      model: response.model,
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return respond({ error: "La clave de la IA no es válida. Revisa el secreto ANTHROPIC_API_KEY." }, 503);
    if (error instanceof Anthropic.RateLimitError) return respond({ error: "La IA está ocupada. Inténtalo en unos segundos." }, 429);
    if (error instanceof Anthropic.BadRequestError) return respond({ error: "La IA no pudo procesar la consulta." }, 502);
    if (error instanceof Anthropic.APIError) return respond({ error: `La IA respondió con error ${error.status ?? ""}.` }, 502);
    return respond({ error: "No se pudo conectar con la IA." }, 502);
  }
});
