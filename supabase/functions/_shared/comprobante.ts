// Comprobante (boleta o factura) por correo, compartido por las funciones que confirman pagos automáticamente.
// Usa Resend (RESEND_API_KEY, COMPROBANTE_FROM) igual que enviar-comprobante. Datos del emisor opcionales:
//   supabase secrets set BUSINESS_LEGAL_NAME="MSJ Fashion Store S.A.C." BUSINESS_RUC=20XXXXXXXXX BUSINESS_ADDRESS="..."
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const money = (value: unknown) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
const methods: Record<string, string> = { yape: "Yape", lemon: "Lemon", cash_on_delivery: "Contra entrega", mercado_pago: "Mercado Pago" };

export type Comprobante = {
  tipo: string; codigo: string; emitido: string; pedido: string; cliente: string; documento: string; direccion: string;
  correo: string; metodo: string; operacion: string; subtotal: number; descuento: number; envio: number;
  total: number; gravada: number; igv: number; enviado?: string | null;
  items: { producto: string; variante: string; cantidad: number; precio: number }[];
};

export function comprobanteHtml(doc: Comprobante) {
  const emisor = { legalName: Deno.env.get("BUSINESS_LEGAL_NAME") || "MSJ Fashion Store", ruc: Deno.env.get("BUSINESS_RUC") || "", address: Deno.env.get("BUSINESS_ADDRESS") || "" };
  const factura = doc.tipo === "factura";
  const date = new Date(doc.emitido).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Lima" });
  const row = (label: string, value: string) => value ? `<tr><td style="padding:3px 0;color:#79766f;font-size:12px;width:140px">${label}</td><td style="padding:3px 0;font-size:13px">${escapeHtml(value)}</td></tr>` : "";
  const items = doc.items.map((item) => `<tr><td style="padding:8px 6px;border-bottom:1px solid #e7e4dd">${Number(item.cantidad)}</td><td style="padding:8px 6px;border-bottom:1px solid #e7e4dd">${escapeHtml(item.producto)}<br><span style="color:#79766f;font-size:11px">${escapeHtml(item.variante)}</span></td><td style="padding:8px 6px;border-bottom:1px solid #e7e4dd;text-align:right">${money(item.precio)}</td><td style="padding:8px 6px;border-bottom:1px solid #e7e4dd;text-align:right">${money(item.precio * item.cantidad)}</td></tr>`).join("");
  const total = (label: string, value: string, strong = false) => `<tr><td style="padding:3px 0;${strong ? "font-weight:700;font-size:15px;border-top:2px solid #121211;padding-top:8px" : "color:#4a4740"}">${label}</td><td style="padding:3px 0;text-align:right;${strong ? "font-weight:700;font-size:15px;border-top:2px solid #121211;padding-top:8px" : ""}">${value}</td></tr>`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f3f0;font-family:Arial,Helvetica,sans-serif;color:#121211">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px">
    <p style="font-size:15px;margin:0 0 16px">Hola ${escapeHtml(doc.cliente.split(" ")[0])}, tu pago con ${escapeHtml(methods[doc.metodo] || doc.metodo)} se confirmó y aquí tienes tu ${factura ? "factura" : "boleta"}. ¡Gracias por comprar en MSJ!</p>
    <div style="background:#fff;border:1px solid #e7e4dd;border-radius:18px;padding:24px">
      <table role="presentation" width="100%" style="border-collapse:collapse;border-bottom:2px solid #121211;margin-bottom:14px"><tr>
        <td style="padding-bottom:14px;vertical-align:top"><div style="font:700 28px Arial,sans-serif;letter-spacing:-1px">MSJ</div><div style="font-size:9px;letter-spacing:3px">FASHION STORE</div>
          <div style="font-size:12px;color:#4a4740;margin-top:8px">${escapeHtml(emisor.legalName)}${emisor.ruc ? `<br>RUC ${escapeHtml(emisor.ruc)}` : ""}${emisor.address ? `<br>${escapeHtml(emisor.address)}` : ""}</div></td>
        <td style="padding-bottom:14px;text-align:right;vertical-align:top"><div style="display:inline-block;border:2px solid #121211;border-radius:12px;padding:10px 14px;text-align:center"><div style="font-size:12px;font-weight:700;letter-spacing:1.4px">${factura ? "FACTURA" : "BOLETA DE VENTA"}</div><div style="font-size:16px;font-weight:700;margin-top:6px">${escapeHtml(doc.codigo)}</div></div></td>
      </tr></table>
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:14px">
        ${row("Fecha de emisión", date)}${row(factura ? "Razón social" : "Cliente", doc.cliente)}${row(factura ? "RUC" : "DNI", doc.documento)}${row("Dirección fiscal", doc.direccion)}
        ${row("Pedido", String(doc.pedido).slice(0, 8).toUpperCase())}${row("Pago", `${methods[doc.metodo] || doc.metodo}${doc.operacion ? ` · operación ${doc.operacion}` : ""} · confirmado`)}
      </table>
      <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:14px"><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #121211;font-size:10px">CANT.</th><th style="text-align:left;padding:6px;border-bottom:1px solid #121211;font-size:10px">DESCRIPCIÓN</th><th style="text-align:right;padding:6px;border-bottom:1px solid #121211;font-size:10px">P. UNIT.</th><th style="text-align:right;padding:6px;border-bottom:1px solid #121211;font-size:10px">IMPORTE</th></tr>${items}</table>
      <table role="presentation" style="border-collapse:collapse;margin-left:auto;min-width:260px;font-size:13px">
        ${total("Subtotal", money(doc.subtotal))}${Number(doc.descuento) ? total("Descuentos", `−${money(doc.descuento)}`) : ""}${total("Envío", Number(doc.envio) ? money(doc.envio) : "Gratis")}${total("Op. gravada", money(doc.gravada))}${total("IGV (18 %)", money(doc.igv))}${total("Importe total", money(doc.total), true)}
      </table>
      <p style="font-size:11px;color:#79766f;margin:18px 0 0;line-height:1.6">También lo encuentras en Mi cuenta › Mis pedidos.</p>
    </div></div></body></html>`;
}

// Lee el comprobante con el service_role y lo envía. Devuelve el motivo si no se pudo (no lanza errores).
export async function sendComprobante(admin: SupabaseClient, orderId: string): Promise<{ sent: boolean; reason?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return { sent: false, reason: "sin RESEND_API_KEY" };
  const { data, error } = await admin.rpc("comprobante_pedido", { p_order: orderId });
  if (error || !data) return { sent: false, reason: "comprobante no emitido" };
  const doc = data as Comprobante;
  if (doc.enviado) return { sent: false, reason: "ya enviado" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.correo || "")) return { sent: false, reason: "sin correo válido" };
  const kind = doc.tipo === "factura" ? "Factura" : "Boleta";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("COMPROBANTE_FROM") || "MSJ Fashion Store <onboarding@resend.dev>",
      to: [doc.correo],
      subject: `${kind} ${doc.codigo} · MSJ Fashion Store`,
      html: comprobanteHtml(doc),
      text: `${kind} ${doc.codigo}\nPedido ${String(doc.pedido).slice(0, 8).toUpperCase()} · Total ${money(doc.total)}\nTambién la encuentras en Mi cuenta › Mis pedidos.`,
    }),
  }).catch(() => null);
  if (!response?.ok) return { sent: false, reason: "el servicio de correo rechazó el envío" };
  await admin.rpc("marcar_comprobante_enviado", { p_order: orderId, p_email: doc.correo });
  return { sent: true };
}
