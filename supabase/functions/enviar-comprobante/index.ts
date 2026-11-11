import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Envía la boleta o factura al correo del cliente cuando el equipo aprueba su pago (Yape, Lemon o contra entrega).
// La llama el panel de administración justo después de aprobar. Usa Resend (https://resend.com) para el envío.
// Configúralo con:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set COMPROBANTE_FROM="MSJ Fashion Store <boletas@tu-dominio.com>"   (dominio verificado en Resend)
// Despliega con: supabase functions deploy enviar-comprobante
// Requiere database/campaigns.sql (comprobante_pedido y marcar_comprobante_enviado).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const money = (value: unknown) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
const wallets: Record<string, string> = { yape: "Yape", lemon: "Lemon", cash_on_delivery: "Contra entrega" };
// Datos del emisor que manda el panel (los mismos de config.js, que son públicos). Se limitan en largo.
const clean = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

type Comprobante = {
  tipo: string; codigo: string; emitido: string; pedido: string; cliente: string; documento: string; direccion: string;
  correo: string; metodo: string; operacion: string; subtotal: number; descuento: number; envio: number;
  total: number; gravada: number; igv: number;
  items: { producto: string; variante: string; cantidad: number; precio: number }[];
};

function emailHtml(doc: Comprobante, emisor: { legalName: string; ruc: string; address: string }) {
  const factura = doc.tipo === "factura";
  const title = factura ? "FACTURA" : "BOLETA DE VENTA";
  const date = new Date(doc.emitido).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Lima" });
  const row = (label: string, value: string) =>
    value ? `<tr><td style="padding:3px 0;color:#79766f;font-size:12px;width:140px">${label}</td><td style="padding:3px 0;font-size:13px">${escapeHtml(value)}</td></tr>` : "";
  const items = doc.items.map((item) => `<tr>
      <td style="padding:8px 6px;border-bottom:1px solid #e2ddd3">${Number(item.cantidad)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e2ddd3">${escapeHtml(item.producto)}<br><span style="color:#79766f;font-size:11px">${escapeHtml(item.variante)}</span></td>
      <td style="padding:8px 6px;border-bottom:1px solid #e2ddd3;text-align:right;white-space:nowrap">${money(item.precio)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e2ddd3;text-align:right;white-space:nowrap">${money(item.precio * item.cantidad)}</td></tr>`).join("");
  const total = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:3px 0;${strong ? "font-weight:700;font-size:15px;border-top:2px solid #171715;padding-top:8px" : "color:#4a4740"}">${label}</td><td style="padding:3px 0;text-align:right;${strong ? "font-weight:700;font-size:15px;border-top:2px solid #171715;padding-top:8px" : ""}">${value}</td></tr>`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f3f0e9;font-family:Arial,Helvetica,sans-serif;color:#171715">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px">
    <p style="font-size:15px;margin:0 0 16px">Hola ${escapeHtml(doc.cliente.split(" ")[0])}, verificamos tu pago y aquí tienes tu ${factura ? "factura" : "boleta"}. ¡Gracias por comprar en MSJ!</p>
    <div style="background:#fff;border:1px solid #e2ddd3;padding:24px">
      <table role="presentation" width="100%" style="border-collapse:collapse;border-bottom:2px solid #171715;margin-bottom:14px"><tr>
        <td style="padding-bottom:14px;vertical-align:top"><div style="font:600 28px Georgia,serif;letter-spacing:2px">MSJ</div><div style="font-size:9px;letter-spacing:3px">FASHION STORE</div>
          <div style="font-size:12px;color:#4a4740;margin-top:8px">${escapeHtml(emisor.legalName || "MSJ Fashion Store")}${emisor.ruc ? `<br>RUC ${escapeHtml(emisor.ruc)}` : ""}${emisor.address ? `<br>${escapeHtml(emisor.address)}` : ""}</div></td>
        <td style="padding-bottom:14px;text-align:right;vertical-align:top"><div style="display:inline-block;border:2px solid #171715;padding:10px 14px;text-align:center"><div style="font-size:12px;font-weight:700;letter-spacing:1.4px">${title}</div><div style="font-size:16px;font-weight:700;margin-top:6px">${escapeHtml(doc.codigo)}</div></div></td>
      </tr></table>
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:14px">
        ${row("Fecha de emisión", date)}${row(factura ? "Razón social" : "Cliente", doc.cliente)}${row(factura ? "RUC" : "DNI", doc.documento)}${row("Dirección fiscal", doc.direccion)}
        ${row("Pedido", String(doc.pedido).slice(0, 8).toUpperCase())}${row("Pago", `${wallets[doc.metodo] || doc.metodo}${doc.operacion ? ` · operación ${doc.operacion}` : ""} · verificado`)}
      </table>
      <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:14px">
        <tr><th style="text-align:left;padding:6px;border-bottom:1px solid #171715;font-size:10px;letter-spacing:1px">CANT.</th><th style="text-align:left;padding:6px;border-bottom:1px solid #171715;font-size:10px;letter-spacing:1px">DESCRIPCIÓN</th><th style="text-align:right;padding:6px;border-bottom:1px solid #171715;font-size:10px;letter-spacing:1px">P. UNIT.</th><th style="text-align:right;padding:6px;border-bottom:1px solid #171715;font-size:10px;letter-spacing:1px">IMPORTE</th></tr>
        ${items}
      </table>
      <table role="presentation" style="border-collapse:collapse;margin-left:auto;min-width:260px;font-size:13px">
        ${total("Subtotal", money(doc.subtotal))}${Number(doc.descuento) ? total("Descuentos", `−${money(doc.descuento)}`) : ""}
        ${total("Envío", Number(doc.envio) ? money(doc.envio) : "Gratis")}${total("Op. gravada", money(doc.gravada))}${total("IGV (18 %)", money(doc.igv))}${total("Importe total", money(doc.total), true)}
      </table>
      <p style="font-size:11px;color:#79766f;margin:18px 0 0;line-height:1.6">Comprobante emitido por MSJ Fashion Store después de verificar tu pago. También lo encuentras en Mi cuenta › Mis pedidos.</p>
    </div>
  </div></body></html>`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("COMPROBANTE_FROM") || "MSJ Fashion Store <onboarding@resend.dev>";
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !authorization) return respond({ error: "Configuración o sesión incompleta." }, 401);
  if (!resendKey) return respond({ error: "Falta configurar el envío de correos (RESEND_API_KEY)." }, 500);

  // Todo se consulta con la sesión de quien llama: las funciones SQL verifican que sea del equipo (admin o personal).
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
    caller.rpc("has_role", { p_role_key: "admin" }),
    caller.rpc("has_role", { p_role_key: "staff" }),
  ]);
  if (!isAdmin && !isStaff) return respond({ error: "Solo el equipo de MSJ puede enviar comprobantes." }, 403);

  let body: { order_id?: string; emisor?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return respond({ error: "Solicitud no válida." }, 400);
  }
  const orderId = String(body.order_id ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return respond({ error: "Pedido no válido." }, 400);

  const { data: doc, error: docError } = await caller.rpc("comprobante_pedido", { p_order: orderId });
  if (docError) return respond({ error: "No se pudo leer el comprobante." }, 500);
  if (!doc) return respond({ error: "El comprobante aún no se emitió: primero aprueba el pago." }, 409);
  const comprobante = doc as Comprobante;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(comprobante.correo || "")) return respond({ error: "El pedido no tiene un correo válido." }, 422);

  const emisor = { legalName: clean(body.emisor?.legalName), ruc: clean(body.emisor?.ruc, 11), address: clean(body.emisor?.address) };
  const kind = comprobante.tipo === "factura" ? "Factura" : "Boleta";
  let sent: Response;
  try {
    sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [comprobante.correo],
        subject: `${kind} ${comprobante.codigo} · MSJ Fashion Store`,
        html: emailHtml(comprobante, emisor),
        text: `${kind} ${comprobante.codigo}\nPedido ${String(comprobante.pedido).slice(0, 8).toUpperCase()} · Total ${money(comprobante.total)}\nTambién la encuentras en Mi cuenta › Mis pedidos.`,
      }),
    });
  } catch {
    return respond({ error: "No se pudo conectar con el servicio de correo." }, 502);
  }
  if (!sent.ok) {
    const detail = await sent.json().catch(() => ({})) as { message?: string };
    return respond({ error: `El servicio de correo rechazó el envío${detail.message ? `: ${detail.message}` : "."}` }, 502);
  }
  await caller.rpc("marcar_comprobante_enviado", { p_order: orderId, p_email: comprobante.correo });
  return respond({ sent: true, to: comprobante.correo, codigo: comprobante.codigo });
});
