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

function passwordIsWeak(password: string) {
  const normalized = password.toLowerCase();
  const commonPasswords = new Set([
    "12345", "123456", "123456789", "password", "password123", "qwerty",
    "qwerty123", "admin", "admin123", "letmein", "welcome", "iloveyou",
    "abc123", "111111", "000000",
  ]);
  const sequences = [
    "0123456789", "9876543210", "abcdefghijklmnopqrstuvwxyz",
    "zyxwvutsrqponmlkjihgfedcba",
  ];
  const hasSequence = sequences.some((sequence) =>
    Array.from({ length: sequence.length - 4 }, (_, index) =>
      sequence.slice(index, index + 5)
    ).some((part) => normalized.includes(part))
  );
  return password.length < 10 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    commonPasswords.has(normalized) ||
    hasSequence ||
    /(.)\1{4,}/i.test(password);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return respond({ error: "Método no permitido." }, 405);
  }

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
  if (authError || !callerResult.user) {
    return respond({ error: "La sesión no es válida." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: callerProfile }, { data: assignments, error: roleError }] =
    await Promise.all([
      adminClient.from("profiles").select("is_active").eq("id", callerResult.user.id)
        .maybeSingle(),
      adminClient.from("user_roles").select("roles!inner(role_key,is_active)")
        .eq("user_id", callerResult.user.id),
    ]);
  const isAdmin = (assignments || []).some((assignment) =>
    assignment.roles?.role_key === "admin" && assignment.roles?.is_active
  );
  if (roleError || !callerProfile?.is_active || !isAdmin) {
    return respond({ error: "Se requiere una cuenta activa con rol administrador." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "El cuerpo de la solicitud no es válido." }, 400);
  }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (body.action === "invite_staff") {
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!fullName || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return respond({ error: "Revisa el nombre y el correo del personal." }, 400);
    }
    const { data: staffRole, error: staffRoleError } = await adminClient.from("roles")
      .select("id").eq("role_key", "staff").eq("is_active", true).maybeSingle();
    if (staffRoleError || !staffRole) {
      return respond({ error: "No existe un rol Personal activo. Ejecuta database/schema.sql." }, 500);
    }
    const { data: invitation, error: inviteError } = await adminClient.auth.admin
      .inviteUserByEmail(email, { data: { full_name: fullName } });
    if (inviteError || !invitation.user) {
      return respond({ error: inviteError?.message || "No se pudo enviar la invitación." }, 400);
    }
    const { error: clearRolesError } = await adminClient.from("user_roles")
      .delete().eq("user_id", invitation.user.id);
    if (clearRolesError) {
      await adminClient.auth.admin.deleteUser(invitation.user.id);
      return respond({ error: "No se pudo preparar el rol del personal." }, 500);
    }
    const { error: assignRoleError } = await adminClient.from("user_roles").insert({
      user_id: invitation.user.id,
      role_id: staffRole.id,
      granted_by: callerResult.user.id,
    });
    if (assignRoleError) {
      await adminClient.auth.admin.deleteUser(invitation.user.id);
      return respond({ error: "No se pudo asignar el rol Personal." }, 500);
    }
    await adminClient.from("audit_logs").insert({
      actor_id: callerResult.user.id,
      action: "invited",
      entity: "profile",
      entity_id: invitation.user.id,
      details: { email, role: "staff" },
    });
    return respond({ invited: true, email });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return respond({ error: "El usuario seleccionado no es válido." }, 400);
  }
  if (body.action === "delete") {
    if (userId === callerResult.user.id) {
      return respond({ error: "No puedes eliminar tu propia cuenta administrativa." }, 403);
    }
    const [{ data: profile, error: profileError }, { count: orderCount, error: orderError }] =
      await Promise.all([
        adminClient.from("profiles").select("email").eq("id", userId).maybeSingle(),
        adminClient.from("orders").select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);
    if (profileError || orderError) {
      return respond({ error: "No se pudo comprobar el historial de la cuenta." }, 500);
    }
    if (!profile) return respond({ error: "No se encontró el usuario." }, 404);
    if (orderCount) {
      return respond({ error: "Esta cuenta tiene pedidos. Desactívala para conservar su historial." }, 409);
    }

    const { data: targetRoles, error: targetRoleError } = await adminClient.from("user_roles")
      .select("roles!inner(role_key)").eq("user_id", userId);
    if (targetRoleError) {
      return respond({ error: "No se pudieron comprobar los permisos del usuario." }, 500);
    }
    if (targetRoles?.some((item) => item.roles?.role_key === "admin")) {
      const { data: activeAdmins, error: adminCountError } = await adminClient
        .from("user_roles")
        .select("user_id,profiles!inner(is_active),roles!inner(role_key,is_active)")
        .eq("roles.role_key", "admin")
        .eq("roles.is_active", true)
        .eq("profiles.is_active", true);
      if (adminCountError) {
        return respond({ error: "No se pudo comprobar la cuenta administradora." }, 500);
      }
      const adminIds = new Set((activeAdmins || []).map((item) => item.user_id));
      if (adminIds.size <= 1) {
        return respond({ error: "No se puede eliminar al último administrador activo." }, 409);
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return respond({ error: "No se pudo eliminar la cuenta. Si tiene historial asociado, desactívala." }, 409);
    }
    const { error: auditError } = await adminClient.from("audit_logs").insert({
      actor_id: callerResult.user.id,
      action: "deleted",
      entity: "profile",
      entity_id: userId,
      details: { email: profile.email },
    });
    return respond({ deleted: true, audit_recorded: !auditError });
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!fullName || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return respond({ error: "Revisa el nombre y el correo electrónico." }, 400);
  }
  if (password && passwordIsWeak(password)) {
    return respond({ error: "La contraseña debe tener 10 caracteres, mayúscula, minúscula, número y símbolo, y no ser común ni secuencial." }, 400);
  }

  const { data: previousProfile, error: profileReadError } = await adminClient
    .from("profiles").select("email,full_name").eq("id", userId).maybeSingle();
  if (profileReadError || !previousProfile) {
    return respond({ error: "No se encontró el perfil solicitado." }, 404);
  }
  const { data: targetResult, error: targetError } = await adminClient.auth.admin
    .getUserById(userId);
  if (targetError || !targetResult.user) {
    return respond({ error: "No se encontró la cuenta de autenticación." }, 404);
  }

  const { error: profileUpdateError } = await adminClient.from("profiles")
    .update({ email, full_name: fullName }).eq("id", userId);
  if (profileUpdateError) {
    return respond({ error: profileUpdateError.message }, 400);
  }

  const authUpdates: {
    email: string;
    email_confirm: boolean;
    user_metadata: Record<string, unknown>;
    password?: string;
  } = {
    email,
    email_confirm: true,
    user_metadata: { ...targetResult.user.user_metadata, full_name: fullName },
  };
  if (password) authUpdates.password = password;
  const { error: authUpdateError } = await adminClient.auth.admin
    .updateUserById(userId, authUpdates);
  if (authUpdateError) {
    await adminClient.from("profiles").update(previousProfile).eq("id", userId);
    return respond({ error: authUpdateError.message }, 400);
  }

  return respond({ updated: true });
});
