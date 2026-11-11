import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Crea el pago de Mercado Pago (Checkout Pro) para un pedido ya registrado con checkout_cart (payment_method = mercado_pago).
// El monto sale SIEMPRE del pedido en la base de datos (nunca del navegador). Devuelve la URL de pago (init_point).
// Secretos: MP_ACCESS_TOKEN (APP_USR-... de producción o TEST-... de pruebas) y, opcional, SITE_URL=https://tu-dominio.pe
// Despliegue: supabase functions deploy mp-create-preference
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405);
  const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!accessToken) return respond({ error: "Mercado Pago todavía no está configurado." }, 503);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const jwt = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const user = auth.user;
  if (!user) return respond({ error: "Inicia sesión para pagar." }, 401);

  let body: { order_id?: string; return_url?: string };
  try { body = await request.json(); } catch { return respond({ error: "Solicitud no válida." }, 400); }
  const orderId = String(body.order_id || "");
  if (!uuid.test(orderId)) return respond({ error: "Pedido no válido." }, 400);

  const { data: integration } = await admin.from("integrations").select("enabled,mode,public_config").eq("provider", "mercado_pago").maybeSingle();
  if (!integration?.enabled) return respond({ error: "Mercado Pago aún no está disponible." }, 503);

  const { data: order } = await admin.from("orders")
    .select("id,user_id,status,payment_status,payment_method,total,payment_expires_at,recipient,phone")
    .eq("id", orderId).maybeSingle();
  if (!order || order.user_id !== user.id) return respond({ error: "No encontramos ese pedido en tu cuenta." }, 404);
  if (order.payment_method !== "mercado_pago") return respond({ error: "Este pedido usa otro método de pago." }, 409);
  if (order.payment_status === "paid") return respond({ error: "Este pedido ya está pagado." }, 409);
  if (order.status === "cancelled" || (order.payment_expires_at && new Date(order.payment_expires_at) < new Date())) {
    return respond({ error: "La reserva de este pedido venció. Vuelve a agregar los productos a tu bolsa." }, 409);
  }
  const { data: items } = await admin.from("order_items").select("product_name,variant_label,quantity").eq("order_id", orderId);
  const code = orderId.slice(0, 8).toUpperCase();
  const description = (items || []).map((item) => `${item.quantity}× ${item.product_name} (${item.variant_label})`).join(", ").slice(0, 250);

  // A dónde vuelve el cliente: SITE_URL (recomendado) o la página que mandó la tienda, solo si es http(s).
  const site = (Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  let base = site ? `${site}/cuenta.html` : "";
  if (!base) {
    try { const url = new URL(String(body.return_url || "")); if (/^https?:$/.test(url.protocol)) base = `${url.origin}${url.pathname}`; } catch { /* sin URL de retorno */ }
  }
  const preference: Record<string, unknown> = {
    items: [{ id: orderId, title: `Pedido MSJ ${code}`, description: description || `Pedido ${code}`, quantity: 1, currency_id: "PEN", unit_price: Number(order.total) }],
    payer: { email: user.email, name: order.recipient },
    external_reference: orderId,
    metadata: { order_id: orderId },
    notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
    statement_descriptor: String(integration.public_config?.statement_descriptor || "MSJ FASHION").slice(0, 22),
    expires: Boolean(order.payment_expires_at),
    ...(order.payment_expires_at ? { expiration_date_to: new Date(order.payment_expires_at).toISOString().replace("Z", "-00:00") } : {}),
  };
  if (base) {
    preference.back_urls = { success: `${base}?mp=success`, pending: `${base}?mp=pending`, failure: `${base}?mp=failure` };
    if (base.startsWith("https://")) preference.auto_return = "approved";
  }

  let response: Response;
  try {
    response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(preference),
    });
  } catch {
    return respond({ error: "No se pudo conectar con Mercado Pago. Inténtalo en un momento." }, 502);
  }
  const result = await response.json().catch(() => ({})) as { id?: string; init_point?: string; sandbox_init_point?: string; message?: string };
  if (!response.ok || !result.id) return respond({ error: `Mercado Pago no aceptó el pago${result.message ? `: ${result.message}` : "."}` }, 502);
  await admin.from("orders").update({ mp_preference_id: result.id }).eq("id", orderId);
  const url = integration.mode === "sandbox" && result.sandbox_init_point ? result.sandbox_init_point : result.init_point;
  return respond({ init_point: url, preference_id: result.id });
});
