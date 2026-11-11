import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mlConfig, mlFetch, mlToken } from "../_shared/mercadolibre.ts";

// Notificaciones de Mercado Libre (temas: orders_v2, items, questions). Responde 200 de inmediato y procesa en segundo
// plano. Solo acepta avisos de TU aplicación y TU cuenta de vendedor; los datos se vuelven a consultar a la API de ML.
//  · orders_v2 → ml_register_order: descuenta el stock de MSJ al pagarse (y lo devuelve si se cancela).
//  · items     → actualiza estado y enlace de la publicación.
//  · questions → guarda la pregunta para responderla desde Mercado Libre.
// Despliegue: supabase functions deploy ml-webhook --no-verify-jwt
const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return ok();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = await request.json().catch(() => ({})) as Record<string, any>;
  const { appId } = mlConfig();
  const { data: tokens } = await admin.from("ml_oauth_tokens").select("seller_id").eq("id", 1).maybeSingle();
  const trusted = Boolean(appId) && String(body.application_id) === appId && tokens && String(body.user_id) === String(tokens.seller_id);
  const topic = String(body.topic || "");
  const resource = String(body.resource || "");
  const inserted = await admin.from("integration_events").insert({
    provider: "mercado_libre", topic: topic.slice(0, 60), resource_id: resource.slice(0, 200), request_id: body._id ? String(body._id).slice(0, 120) : null,
    signature_ok: trusted, status: trusted ? "recibido" : "ignorado", error: trusted ? null : "Aplicación o vendedor no coinciden", payload: body,
  }).select("id").maybeSingle();
  if (!trusted || inserted.error || !/^\/[\w/.-]+$/.test(resource)) return ok();
  const eventId = inserted.data?.id;

  const work = (async () => {
    try {
      const { token } = await mlToken(admin);
      const data = await mlFetch(token, resource);
      if (topic === "orders_v2") {
        await admin.rpc("ml_register_order", { p_ml_order_id: String(data.id), p_status: String(data.status || ""), p_payload: data });
      } else if (topic === "items") {
        const status = { active: "activo", paused: "pausado", closed: "cerrado" }[String(data.status)] || null;
        if (status) await admin.from("ml_listings").update({ status, permalink: data.permalink, last_synced_at: new Date().toISOString() }).eq("ml_item_id", String(data.id));
      } else if (topic === "questions") {
        const { data: listing } = await admin.from("ml_listings").select("product_id").eq("ml_item_id", String(data.item_id)).maybeSingle();
        await admin.from("ml_questions").upsert({
          ml_question_id: String(data.id), ml_item_id: String(data.item_id || ""), product_id: listing?.product_id || null, question: String(data.text || "").slice(0, 2000),
          status: String(data.status || ""), answer: data.answer?.text || null, asked_at: data.date_created || null, answered_at: data.answer?.date_created || null, payload: data, updated_at: new Date().toISOString(),
        });
      }
      await admin.from("integration_events").update({ status: "procesado", processed_at: new Date().toISOString() }).eq("id", eventId);
      await admin.from("integrations").update({ last_event_at: new Date().toISOString() }).eq("provider", "mercado_libre");
    } catch (error) {
      await admin.from("integration_events").update({ status: "error", error: (error as Error).message.slice(0, 500), processed_at: new Date().toISOString() }).eq("id", eventId);
    }
  })();
  // Mercado Libre espera respuesta en menos de 500 ms: el trabajo sigue en segundo plano.
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work); else await work;
  return ok();
});
