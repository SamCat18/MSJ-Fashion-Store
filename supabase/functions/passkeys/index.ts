// Passkeys (WebAuthn) para MSJ: huella de Android, Face ID / Touch ID de iPhone y Mac, Windows Hello.
// La biometría nunca sale del dispositivo; aquí solo se verifica la firma con la clave pública guardada.
// Secretos requeridos: PASSKEY_RP_ID (dominio, p. ej. "msjfashion.pe") y PASSKEY_ORIGINS
// (orígenes permitidos separados por coma, p. ej. "https://msjfashion.pe,https://www.msjfashion.pe").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@10.0.1";
import { isoBase64URL } from "npm:@simplewebauthn/server@10.0.1/helpers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const RP_NAME = "MSJ Fashion Store";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jwtClaims(authorization: string): Record<string, unknown> {
  try {
    const payload = authorization.replace(/^Bearer\s+/i, "").split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function cleanDeviceName(value: unknown) {
  return String(value ?? "").replace(/[<>"'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "Dispositivo";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rpID = Deno.env.get("PASSKEY_RP_ID");
  const origins = (Deno.env.get("PASSKEY_ORIGINS") || "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !rpID || !origins.length) {
    return respond({ error: "Las passkeys aún no están configuradas (PASSKEY_RP_ID y PASSKEY_ORIGINS)." }, 503);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "El cuerpo de la solicitud no es válido." }, 400);
  }
  const action = String(body.action || "");
  await admin.from("webauthn_challenges").delete().lt("expires_at", new Date().toISOString());

  async function takeChallenge(id: unknown, kind: string, userId: string | null) {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await admin.from("webauthn_challenges").delete().eq("id", id).eq("kind", kind).select("challenge,user_id,expires_at").maybeSingle();
    if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
    if (userId && data.user_id !== userId) return null;
    return data.challenge as string;
  }

  // ----- Registro: requiere sesión (y 2FA completo si la cuenta lo tiene activo) -----
  if (action === "register-options" || action === "register-verify") {
    const authorization = request.headers.get("Authorization") || "";
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userResult, error: userError } = await caller.auth.getUser();
    const user = userResult?.user;
    if (userError || !user) return respond({ error: "Inicia sesión para registrar una passkey." }, 401);
    const { data: profile } = await admin.from("profiles").select("is_active,full_name").eq("id", user.id).maybeSingle();
    if (!profile?.is_active) return respond({ error: "La cuenta está deshabilitada." }, 403);
    const { data: factorList } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    const verifiedFactors = (factorList?.factors || []).filter((factor) => factor.status === "verified");
    if (verifiedFactors.length && jwtClaims(authorization).aal !== "aal2") {
      return respond({ error: "Confirma tu código de verificación en dos pasos antes de registrar una passkey." }, 403);
    }
    const { data: existing } = await admin.from("passkeys").select("credential_id,transports").eq("user_id", user.id);
    if (action === "register-options") {
      if ((existing || []).length >= 10) return respond({ error: "Alcanzaste el máximo de 10 passkeys. Elimina una para agregar otra." }, 400);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userName: user.email || user.id,
        userDisplayName: profile.full_name || user.email || "Cliente MSJ",
        userID: new TextEncoder().encode(user.id),
        attestationType: "none",
        excludeCredentials: (existing || []).map((item) => ({ id: item.credential_id, transports: item.transports || undefined })),
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
      });
      const { data: saved, error } = await admin.from("webauthn_challenges")
        .insert({ user_id: user.id, challenge: options.challenge, kind: "registro", expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() })
        .select("id").single();
      if (error) return respond({ error: "No se pudo iniciar el registro." }, 500);
      return respond({ challengeId: saved.id, options });
    }
    const expectedChallenge = await takeChallenge(body.challengeId, "registro", user.id);
    if (!expectedChallenge) return respond({ error: "La solicitud venció. Inténtalo de nuevo." }, 400);
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.response as never,
        expectedChallenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch (error) {
      return respond({ error: `No se pudo verificar la passkey: ${(error as Error).message}` }, 400);
    }
    if (!verification.verified || !verification.registrationInfo) return respond({ error: "No se pudo verificar la passkey." }, 400);
    const info = verification.registrationInfo;
    const transports = Array.isArray((body.response as { response?: { transports?: string[] } })?.response?.transports)
      ? (body.response as { response: { transports: string[] } }).response.transports.slice(0, 6) : [];
    const deviceName = cleanDeviceName(body.deviceName);
    const { error } = await admin.from("passkeys").insert({
      user_id: user.id,
      credential_id: info.credentialID,
      public_key: isoBase64URL.fromBuffer(info.credentialPublicKey),
      counter: info.counter,
      transports,
      device_name: deviceName,
      backed_up: info.credentialBackedUp,
    });
    if (error) return respond({ error: error.code === "23505" ? "Esta passkey ya estaba registrada." : "No se pudo guardar la passkey." }, 400);
    await admin.from("auditoria_seguridad").insert({ evento: "passkey_registrada", user_id: user.id, email: user.email, dispositivo: deviceName });
    return respond({ registered: true, deviceName });
  }

  // ----- Acceso: público; nunca revela si un correo tiene cuenta -----
  if (action === "login-options") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
    let allowCredentials: { id: string; transports?: string[] }[] = [];
    if (email) {
      const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (profile) {
        const { data: keys } = await admin.from("passkeys").select("credential_id,transports").eq("user_id", profile.id);
        allowCredentials = (keys || []).map((item) => ({ id: item.credential_id, transports: item.transports?.length ? item.transports : undefined }));
      }
    }
    const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: allowCredentials as never });
    const { data: saved, error } = await admin.from("webauthn_challenges")
      .insert({ challenge: options.challenge, kind: "acceso", expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() })
      .select("id").single();
    if (error) return respond({ error: "No se pudo iniciar el acceso." }, 500);
    return respond({ challengeId: saved.id, options });
  }

  if (action === "login-verify") {
    const response = body.response as { id?: string; rawId?: string } | undefined;
    const credentialId = typeof response?.id === "string" ? response.id : "";
    const expectedChallenge = await takeChallenge(body.challengeId, "acceso", null);
    if (!expectedChallenge || !credentialId) return respond({ error: "La solicitud venció. Inténtalo de nuevo." }, 400);
    const { data: key } = await admin.from("passkeys").select("id,user_id,credential_id,public_key,counter,transports,device_name").eq("credential_id", credentialId).maybeSingle();
    if (!key) return respond({ error: "Esta passkey no está registrada en MSJ." }, 400);
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.response as never,
        expectedChallenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        requireUserVerification: true,
        authenticator: {
          credentialID: key.credential_id,
          credentialPublicKey: isoBase64URL.toBuffer(key.public_key),
          counter: Number(key.counter),
          transports: key.transports || undefined,
        },
      });
    } catch {
      verification = { verified: false } as { verified: boolean; authenticationInfo?: { newCounter: number } };
    }
    const { data: profile } = await admin.from("profiles").select("email,is_active").eq("id", key.user_id).maybeSingle();
    if (!verification.verified) {
      await admin.from("auditoria_seguridad").insert({ evento: "login_passkey_fallido", severidad: "media", user_id: key.user_id, email: profile?.email, dispositivo: key.device_name });
      return respond({ error: "No se pudo verificar tu identidad." }, 401);
    }
    if (!profile?.is_active || !profile.email) return respond({ error: "La cuenta está deshabilitada." }, 403);
    await admin.from("passkeys").update({ counter: verification.authenticationInfo?.newCounter ?? key.counter, last_used_at: new Date().toISOString() }).eq("id", key.id);
    // Sesión de Supabase: enlace de un solo uso generado en el servidor (no se envía ningún correo).
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: profile.email });
    if (linkError || !link?.properties?.hashed_token) return respond({ error: "No se pudo iniciar la sesión." }, 500);
    await admin.from("auditoria_seguridad").insert({ evento: "login_passkey", user_id: key.user_id, email: profile.email, dispositivo: key.device_name });
    return respond({ token_hash: link.properties.hashed_token, email: profile.email });
  }

  return respond({ error: "Acción no válida." }, 400);
});
