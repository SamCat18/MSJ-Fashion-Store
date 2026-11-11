import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendComprobante } from "../_shared/comprobante.ts";

// Webhook de Mercado Pago: confirma el pago SOLO si la firma es válida y el pago consultado a la API de Mercado Pago
// está «approved» por el monto exacto del pedido. Entonces el pedido pasa a pagado y confirmado, se emite la boleta,
// se suman los puntos, se avisa al cliente y se le envía el comprobante por correo.
// Secretos: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET (Mercado Pago → Tu integración → Webhooks → «Clave secreta»).
// Despliegue (Mercado Pago no envía sesión de Supabase): supabase functions deploy mp-webhook --no-verify-jwt
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}
// x-signature: "ts=1704908010,v1=618c85..." · plantilla: "id:{data.id};request-id:{x-request-id};ts:{ts};" (se omite lo que falte).
async function validSignature(request: Request, dataId: string, secret: string) {
  const header = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2)).filter((pair) => pair.length === 2));
  const ts = parts.ts, v1 = parts.v1;
  if (!ts || !v1) return false;
  const seconds = Number(ts) > 1e12 ? Number(ts) / 1000 : Number(ts);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 600) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `${id ? `id:${id};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  return safeEqual(await hmacHex(secret, manifest), v1.toLowerCase());
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: true });
  const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!accessToken || !secret) return json({ error: "Mercado Pago no está configurado." }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const url = new URL(request.url);
  const raw = await request.text();
  let body: Record<string, any> = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { /* cuerpo vacío o no JSON */ }
  const dataId = String(url.searchParams.get("data.id") || url.searchParams.get("id") || body?.data?.id || "");
  const topic = String(url.searchParams.get("type") || url.searchParams.get("topic") || body?.type || body?.topic || "");
  const requestId = request.headers.get("x-request-id") || null;
  const signatureOk = await validSignature(request, dataId, secret);

  // Bandeja de eventos: idempotencia por x-request-id (un reintento del mismo aviso no se procesa dos veces).
  let eventId: number | null = null;
  const inserted = await admin.from("integration_events").insert({
    provider: "mercado_pago", topic: topic.slice(0, 60), resource_id: dataId.slice(0, 200), request_id: requestId, signature_ok: signatureOk, payload: body,
  }).select("id").maybeSingle();
  if (inserted.error) {
    const { data: previous } = await admin.from("integration_events").select("id,status").eq("provider", "mercado_pago").eq("request_id", requestId ?? "").maybeSingle();
    if (previous && ["procesado", "ignorado"].includes(previous.status)) return json({ ok: true, duplicate: true });
    eventId = previous?.id ?? null;
  } else {
    eventId = inserted.data?.id ?? null;
  }
  const finish = async (status: string, error: string | null = null) => {
    if (eventId) await admin.from("integration_events").update({ status, error: error?.slice(0, 500) ?? null, processed_at: new Date().toISOString() }).eq("id", eventId);
  };

  if (!signatureOk) { await finish("error", "Firma inválida o vencida"); return json({ error: "Firma inválida." }, 401); }
  if (!/^payment/.test(topic) || !dataId) { await finish("ignorado"); return json({ ok: true, ignored: true }); }

  // Nunca se confía en el cuerpo del aviso: se consulta el pago a Mercado Pago.
  let payment: Record<string, any>;
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 404) { await finish("error", "Pago no encontrado en Mercado Pago"); return json({ ok: true }); }
    if (!response.ok) { await finish("error", `Mercado Pago respondió ${response.status}`); return json({ error: "Reintentar" }, 502); }
    payment = await response.json();
  } catch {
    await finish("error", "Sin conexión con Mercado Pago");
    return json({ error: "Reintentar" }, 502);
  }
  const orderId = String(payment.external_reference || payment.metadata?.order_id || "");
  if (!uuid.test(orderId)) { await finish("ignorado", "El pago no corresponde a un pedido de MSJ"); return json({ ok: true }); }

  const { data: result, error } = await admin.rpc("mp_apply_payment", {
    p_order: orderId, p_payment_id: String(payment.id), p_status: String(payment.status || ""), p_status_detail: String(payment.status_detail || ""),
    p_amount: Number(payment.transaction_amount || 0), p_currency: String(payment.currency_id || ""), p_method: String(payment.payment_method_id || ""),
  });
  if (error) { await finish("error", error.message); return json({ error: "Reintentar" }, 500); }
  let mail = "";
  if (result?.reason === "pagado") { const sent = await sendComprobante(admin, orderId); mail = sent.sent ? " · comprobante enviado" : ` · correo: ${sent.reason}`; }
  await finish(result?.ok ? "procesado" : "error", result?.ok ? null : `${result?.reason || "sin aplicar"}${mail}`);
  await admin.from("integrations").update({ last_event_at: new Date().toISOString(), status: "conectado" }).eq("provider", "mercado_pago");
  return json({ ok: true, result: result?.reason });
});
