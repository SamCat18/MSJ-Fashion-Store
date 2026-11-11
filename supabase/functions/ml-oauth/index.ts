import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { base64url, ML_API, ML_AUTH, mlConfig } from "../_shared/mercadolibre.ts";

// Conexión de la cuenta de vendedor de Mercado Libre (OAuth 2.0 con PKCE).
//  1) El panel llama POST {action:"start"} con la sesión de un administrador → devuelve la URL de autorización.
//  2) Mercado Libre vuelve a esta misma función (GET ?code&state) → se guardan los tokens (solo service_role los lee).
// En tu aplicación de Mercado Libre, la «URI de redirect» debe ser exactamente: https://<proyecto>.supabase.co/functions/v1/ml-oauth
// Despliegue: supabase functions deploy ml-oauth --no-verify-jwt   (la vuelta desde Mercado Libre no trae sesión)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const page = (title: string, text: string, ok = true) => new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f3f0;font-family:system-ui,sans-serif;color:#121211"><div style="max-width:440px;margin:16px;padding:32px;background:#fff;border:1px solid #e4e1da;border-radius:24px;text-align:center">
<div style="font-size:44px">${ok ? "✓" : "⚠️"}</div><h1 style="font-size:22px;letter-spacing:-.02em">${title}</h1><p style="color:#6f6c65;line-height:1.5">${text}</p><p style="color:#6f6c65;font-size:13px">Ya puedes cerrar esta pestaña y volver al panel de MSJ.</p></div></body></html>`,
  { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { appId, secret, redirect, ready } = mlConfig();

  if (request.method === "POST") {
    if (!ready) return json({ error: "Faltan ML_APP_ID y ML_CLIENT_SECRET en los secretos de Supabase." }, 503);
    const authorization = request.headers.get("Authorization") || "";
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const [{ data: isAdmin }, { data: auth }] = await Promise.all([caller.rpc("has_role", { p_role_key: "admin" }), caller.auth.getUser()]);
    if (!isAdmin || !auth.user) return json({ error: "Solo administración puede conectar Mercado Libre." }, 403);
    const state = base64url(crypto.getRandomValues(new Uint8Array(24)));
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const { error } = await admin.from("oauth_states").insert({ state, provider: "mercado_libre", code_verifier: verifier, created_by: auth.user.id });
    if (error) return json({ error: "Ejecuta database/v2026.sql antes de conectar." }, 500);
    const url = `${ML_AUTH}?${new URLSearchParams({ response_type: "code", client_id: appId, redirect_uri: redirect, state, code_challenge: challenge, code_challenge_method: "S256" })}`;
    return json({ url });
  }

  // Vuelta desde Mercado Libre
  const params = new URL(request.url).searchParams;
  const code = params.get("code"), state = params.get("state");
  if (!code || !state) return page("Conexión cancelada", "Mercado Libre no envió la autorización.", false);
  const { data: saved } = await admin.from("oauth_states").select("*").eq("state", state).maybeSingle();
  await admin.from("oauth_states").delete().eq("state", state);
  if (!saved || Date.now() - new Date(saved.created_at).getTime() > 60 * 60 * 1000) return page("Enlace vencido", "Vuelve a pulsar «Conectar cuenta» en el panel.", false);
  const response = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: appId, client_secret: secret, code, redirect_uri: redirect, code_verifier: saved.code_verifier }),
  });
  const token = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || !token.access_token) return page("No se pudo conectar", `Mercado Libre respondió: ${String(token.message || token.error || response.status)}`, false);
  await admin.from("ml_oauth_tokens").upsert({
    id: 1, seller_id: String(token.user_id), access_token: token.access_token, refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + Number(token.expires_in || 21600) * 1000).toISOString(), scope: String(token.scope || ""), updated_at: new Date().toISOString(),
  });
  const me = await fetch(`${ML_API}/users/me`, { headers: { Authorization: `Bearer ${token.access_token}` } }).then((r) => r.json()).catch(() => ({})) as Record<string, any>;
  const { data: integration } = await admin.from("integrations").select("public_config").eq("provider", "mercado_libre").maybeSingle();
  await admin.from("integrations").update({
    status: "configurado", last_error: null, updated_at: new Date().toISOString(),
    public_config: { ...(integration?.public_config || {}), seller_id: String(token.user_id), nickname: String(me.nickname || ""), site_id: String(me.site_id || "MPE") },
  }).eq("provider", "mercado_libre");
  return page("Mercado Libre conectado", `Cuenta ${String(me.nickname || token.user_id)} vinculada. Activa la integración en el panel cuando quieras publicar.`);
});
