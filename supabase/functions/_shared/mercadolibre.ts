// Utilidades de Mercado Libre para las Edge Functions (ml-oauth, ml-sync, ml-webhook).
// Secretos: ML_APP_ID, ML_CLIENT_SECRET (developers.mercadolibre.com.pe → Mis aplicaciones). Sitio de Perú: MPE.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const ML_API = "https://api.mercadolibre.com";
export const ML_AUTH = "https://auth.mercadolibre.com.pe/authorization";

export function mlConfig() {
  const appId = Deno.env.get("ML_APP_ID") || "";
  const secret = Deno.env.get("ML_CLIENT_SECRET") || "";
  const redirect = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ml-oauth`;
  return { appId, secret, redirect, ready: Boolean(appId && secret) };
}

// Token vigente: si vence en menos de 5 minutos se renueva con el refresh_token (los tokens de ML duran 6 horas).
export async function mlToken(admin: SupabaseClient): Promise<{ token: string; sellerId: string }> {
  const { data: row } = await admin.from("ml_oauth_tokens").select("*").eq("id", 1).maybeSingle();
  if (!row) throw new Error("Mercado Libre no está conectado.");
  if (new Date(row.expires_at).getTime() - Date.now() > 5 * 60 * 1000) return { token: row.access_token, sellerId: row.seller_id };
  const { appId, secret } = mlConfig();
  const response = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: appId, client_secret: secret, refresh_token: row.refresh_token }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || !data.access_token) {
    await admin.from("integrations").update({ status: "error", last_error: "No se pudo renovar el token de Mercado Libre: vuelve a conectar la cuenta." }).eq("provider", "mercado_libre");
    throw new Error("No se pudo renovar el token de Mercado Libre.");
  }
  await admin.from("ml_oauth_tokens").update({
    access_token: data.access_token, refresh_token: data.refresh_token || row.refresh_token,
    expires_at: new Date(Date.now() + Number(data.expires_in || 21600) * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return { token: data.access_token, sellerId: row.seller_id };
}

export async function mlFetch(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${ML_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    const cause = Array.isArray(data.cause) ? data.cause.map((item: Record<string, unknown>) => item.message).filter(Boolean).join("; ") : "";
    throw new Error(`ML ${response.status}: ${data.message || data.error || "error"}${cause ? ` (${cause})` : ""}`.slice(0, 480));
  }
  return data;
}

export const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
