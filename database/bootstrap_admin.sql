-- 1. Registra la cuenta desde la tienda y confirma su correo.
-- 2. Reemplaza el correo de abajo por el de esa cuenta.
-- 3. Ejecuta este archivo en Supabase SQL Editor y entra en admin.html.
do $$
declare
  v_email text := 'REEMPLAZA_CON_TU_CORREO';
begin
  if v_email = 'REEMPLAZA_CON_TU_CORREO' then
    raise exception 'Reemplaza el correo de ejemplo antes de ejecutar este archivo.';
  end if;

  insert into public.user_roles (user_id,role_id)
  select p.id,r.id
  from public.profiles p
  join public.roles r on r.role_key = 'admin'
  where lower(p.email) = lower(v_email)
  on conflict (user_id,role_id) do nothing;

  if not exists (
    select 1 from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id and r.role_key = 'admin'
    where lower(p.email) = lower(v_email)
  ) then
    raise exception 'No se encontró una cuenta registrada con ese correo.';
  end if;
end;
$$;
