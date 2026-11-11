import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Consulta de RUC (padrón de SUNAT) y DNI (RENIEC) para completar el comprobante en el checkout.
// Usa un proveedor de consultas peruano con token (por defecto apis.net.pe v2). El token vive solo aquí,
// nunca en el navegador. Configúralo con:
//   supabase secrets set PERU_API_TOKEN=tu_token
//   supabase secrets set PERU_API_BASE=https://api.apis.net.pe/v2   (opcional; cámbialo si tu proveedor usa otra dirección)
// Despliega con: supabase functions deploy consulta-documento

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

// Los proveedores nombran distinto los campos; se toma el primero que exista.
function pick(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = Deno.env.get("PERU_API_TOKEN");
  const base = (Deno.env.get("PERU_API_BASE") || "https://api.apis.net.pe/v2").replace(/\/$/, "");
  if (!supabaseUrl || !anonKey) return respond({ error: "Configuración incompleta." }, 500);

  // Solo clientes con sesión iniciada: evita que terceros gasten las consultas del token.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const { data: caller, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller?.user) return respond({ error: "Inicia sesión para consultar." }, 401);

  let body: { tipo?: string; numero?: string };
  try {
    body = await request.json();
  } catch {
    return respond({ error: "Solicitud no válida." }, 400);
  }
  const tipo = body.tipo === "ruc" ? "ruc" : body.tipo === "dni" ? "dni" : "";
  const numero = String(body.numero ?? "").replace(/\D/g, "");
  if (tipo === "ruc" && !/^(10|20)\d{9}$/.test(numero)) return respond({ error: "El RUC debe tener 11 dígitos y empezar con 10 o 20." }, 400);
  if (tipo === "dni" && !/^\d{8}$/.test(numero)) return respond({ error: "El DNI debe tener 8 dígitos." }, 400);
  if (!tipo) return respond({ error: "Tipo de documento no válido." }, 400);

  // Con token: API v2. Sin token: API pública v1 (mismos datos, con límites de uso).
  const url = token
    ? `${base}/${tipo === "ruc" ? "sunat/ruc" : "reniec/dni"}?numero=${numero}`
    : `https://api.apis.net.pe/v1/${tipo}?numero=${numero}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" } });
  } catch {
    return respond({ error: "No se pudo conectar con el servicio de consulta." }, 502);
  }
  if (upstream.status === 404 || upstream.status === 422) return respond({ error: tipo === "ruc" ? "No encontramos ese RUC en SUNAT." : "No encontramos ese DNI." }, 404);
  if (!upstream.ok) return respond({ error: "El servicio de consulta no respondió. Escribe los datos a mano." }, 502);

  const data = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  if (tipo === "ruc") {
    const nombre = pick(data, ["razonSocial", "razon_social", "nombre", "nombre_o_razon_social"]);
    if (!nombre) return respond({ error: "No encontramos ese RUC en SUNAT." }, 404);
    return respond({
      tipo, numero, nombre,
      estado: pick(data, ["estado"]),
      condicion: pick(data, ["condicion"]),
      direccion: pick(data, ["direccion", "domicilio_fiscal"]),
      fuente: "SUNAT",
    });
  }
  const completo = pick(data, ["nombreCompleto", "nombre_completo", "full_name"]);
  const nombre = completo || [pick(data, ["nombres", "first_name"]), pick(data, ["apellidoPaterno", "first_last_name"]), pick(data, ["apellidoMaterno", "second_last_name"])].filter(Boolean).join(" ");
  if (!nombre) return respond({ error: "No encontramos ese DNI." }, 404);
  return respond({ tipo, numero, nombre, fuente: "RENIEC" });
});
