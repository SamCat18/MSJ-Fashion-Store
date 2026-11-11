import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return respond({ error: "Configuración o sesión incompleta." }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: callerResult, error: authError } = await callerClient.auth.getUser();
  if (authError || !callerResult.user) return respond({ error: "La sesión no es válida." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: callerProfile }, { data: callerRoles, error: rolesError }] = await Promise.all([
    adminClient.from("profiles").select("id,email,full_name,is_active")
      .eq("id", callerResult.user.id).maybeSingle(),
    adminClient.from("user_roles").select("roles!inner(role_key,is_active)")
      .eq("user_id", callerResult.user.id),
  ]);
  if (rolesError || !callerProfile?.is_active) {
    return respond({ error: "La cuenta está inactiva o no se pudieron comprobar sus permisos." }, 403);
  }
  const roleKeys = (callerRoles || []).filter((item) => item.roles?.is_active)
    .map((item) => item.roles.role_key);
  const isAdmin = roleKeys.includes("admin");
  const isStaff = roleKeys.includes("staff");
  if (!isAdmin && !isStaff) return respond({ tracked: false });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "La solicitud no es válida." }, 400);
  }

  if (body.action === "start") {
    if (!isStaff) return respond({ tracked: false });
    const { data, error } = await adminClient.from("staff_sessions").insert({
      staff_user_id: callerResult.user.id,
      staff_email: callerProfile.email || callerResult.user.email || "",
      staff_name: callerProfile.full_name || "",
    }).select("id").single();
    if (error) return respond({ error: "No se pudo registrar el ingreso del personal." }, 500);
    return respond({ tracked: true, session_id: data.id });
  }

  if (body.action === "heartbeat" || body.action === "end") {
    if (!isStaff) return respond({ tracked: false });
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
      return respond({ error: "La sesión de personal no es válida." }, 400);
    }
    const update = body.action === "end"
      ? { last_seen_at: new Date().toISOString(), ended_at: new Date().toISOString(), end_reason: "logout" }
      : { last_seen_at: new Date().toISOString() };
    const { data, error } = await adminClient.from("staff_sessions").update(update)
      .eq("id", sessionId).eq("staff_user_id", callerResult.user.id).is("ended_at", null)
      .select("id").maybeSingle();
    if (error) return respond({ error: "No se pudo actualizar la sesión del personal." }, 500);
    return respond({ tracked: Boolean(data) });
  }

  if (body.action !== "list") return respond({ error: "Acción no permitida." }, 400);
  if (!isAdmin) return respond({ error: "Solo un administrador puede consultar la actividad del personal." }, 403);

  const now = Date.now();
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const staleBefore = new Date(now - 15 * 60 * 1000).toISOString();
  const detectedAt = new Date(now).toISOString();
  const retentionBefore = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  await adminClient.from("staff_sessions").delete().lt("started_at", retentionBefore);
  await adminClient.from("staff_sessions").update({ ended_at: detectedAt, end_reason: "timeout" })
    .is("ended_at", null).lt("last_seen_at", staleBefore);

  const { data: assignments, error: assignmentsError } = await adminClient.from("user_roles")
    .select("user_id,profiles!inner(email,full_name,is_active),roles!inner(role_key,is_active)")
    .eq("roles.role_key", "staff").eq("roles.is_active", true).eq("profiles.is_active", true);
  if (assignmentsError) return respond({ error: "No se pudo consultar el personal." }, 500);
  const members = (assignments || []).map((item) => ({
    id: item.user_id,
    email: item.profiles?.email || "",
    name: item.profiles?.full_name || "Sin nombre",
  }));
  const { data: recentSessions, error: sessionsError } = await adminClient.from("staff_sessions")
    .select("id,staff_user_id,staff_email,staff_name,started_at,last_seen_at,ended_at,end_reason")
    .or(`started_at.gte.${since},last_seen_at.gte.${since}`)
    .order("started_at", { ascending: false }).limit(1000);
  if (sessionsError) return respond({ error: "No se pudieron consultar las sesiones de personal." }, 500);
  const sessions = recentSessions || [];
  const staffIds = [...new Set([...members.map((member) => member.id), ...sessions.map((session) => session.staff_user_id)])];
  const { data: recentActions, error: actionsError } = staffIds.length
    ? await adminClient.from("audit_logs").select("id,actor_id,action,entity,entity_id,details,created_at")
      .in("actor_id", staffIds).gte("created_at", since).order("created_at", { ascending: false }).limit(1000)
    : { data: [], error: null };
  if (actionsError) return respond({ error: "No se pudo leer la actividad de las últimas 24 horas." }, 500);
  const actions = recentActions || [];
  const memberMap = new Map(members.map((member) => [member.id, member]));
  for (const session of sessions) {
    if (!memberMap.has(session.staff_user_id)) {
      memberMap.set(session.staff_user_id, { id: session.staff_user_id, name: session.staff_name || "Personal (rol retirado)", email: session.staff_email || "", role_removed: true });
    }
  }
  const allMembers = [...memberMap.values()];
  const events: Record<string, unknown>[] = [];
  for (const session of sessions) {
    if (session.started_at >= since) {
      events.push({ id: `${session.id}-start`, user_id: session.staff_user_id, name: session.staff_name, email: session.staff_email, action: "Inicio de sesión", section: "Acceso", created_at: session.started_at });
    }
    if (session.ended_at && session.ended_at >= since) {
      events.push({ id: `${session.id}-end`, user_id: session.staff_user_id, name: session.staff_name, email: session.staff_email, action: session.end_reason === "timeout" ? "Inactividad detectada (15 min)" : "Cierre de sesión", section: "Acceso", created_at: session.ended_at });
    }
  }
  for (const action of actions) {
    const member = memberMap.get(action.actor_id);
    const transition = action.details?.from && action.details?.to
      ? `: ${action.details.from} → ${action.details.to}`
      : "";
    const label = action.action === "payment_status_updated"
      ? `Verificó pago${transition}`
      : action.action === "order_status_updated"
      ? `Actualizó pedido${transition}`
      : `${action.action}${transition}`;
    events.push({ id: action.id, user_id: action.actor_id, name: member?.name || "Personal", email: member?.email || "", action: label, section: action.entity, record_id: action.entity_id, created_at: action.created_at });
  }
  events.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));

  const summaries = allMembers.map((member) => {
    const memberSessions = sessions.filter((session) => session.staff_user_id === member.id);
    const lastSeen = memberSessions.reduce((latest, session) =>
      !latest || session.last_seen_at > latest ? session.last_seen_at : latest, "");
    return {
      ...member,
      active_now: memberSessions.some((session) => !session.ended_at && session.last_seen_at >= staleBefore),
      last_seen_at: lastSeen || null,
      logins_24h: memberSessions.filter((session) => session.started_at >= since).length,
      actions_24h: actions.filter((action) => action.actor_id === member.id).length,
    };
  });
  return respond({ since, members: summaries, events: events.slice(0, 1000) });
});
