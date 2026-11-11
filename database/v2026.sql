-- MSJ Fashion Store · Versión 2026
-- Búsqueda inteligente, ajustes de la tienda (Navidad y teaser 2027), MSJ Studio y Recompensas (puntos y racha diaria),
-- notificaciones, automatizaciones de inventario y pedidos, y la estructura de Mercado Pago + Mercado Libre.
--
-- Ejecuta este archivo DESPUÉS de database/schema.sql y database/campaigns.sql (gestion.sql es opcional).
-- Es idempotente: puedes volver a ejecutarlo. Si vuelves a ejecutar campaigns.sql, ejecuta otra vez este archivo.
--
-- Mercado Pago y Mercado Libre quedan INSTALADOS PERO APAGADOS (integrations.enabled = false). La tienda no muestra nada
-- hasta que tengas las credenciales: ver docs/integraciones-mercado-pago-libre.md.

-- =====================================================================================================================
-- 0. Extensiones
-- =====================================================================================================================
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Normaliza texto para buscar: minúsculas, sin tildes (ñ → n) y solo letras, números y espacios.
-- search_path incluye extensions y public para encontrar unaccent esté donde esté instalada.
create or replace function public.msj_norm(p_text text)
returns text language sql immutable parallel safe set search_path = extensions, public, pg_temp as $$
  select trim(regexp_replace(lower(unaccent('unaccent'::regdictionary, coalesce(p_text,''))),'[^a-z0-9]+',' ','g'));
$$;
revoke all on function public.msj_norm(text) from public;
grant execute on function public.msj_norm(text) to anon,authenticated,service_role;

-- =====================================================================================================================
-- 1. Ajustes de la tienda (los edita el panel → Personalización)
-- =====================================================================================================================
create table if not exists public.store_settings (
  key text primary key check (key ~ '^[a-z0-9_.-]{2,60}$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  description text not null default '' check (char_length(description) <= 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.store_settings enable row level security;
revoke all on public.store_settings from public,anon,authenticated;
grant select on public.store_settings to anon,authenticated;
drop policy if exists store_settings_read on public.store_settings;
create policy store_settings_read on public.store_settings for select to anon,authenticated using (is_public or public.has_role('admin'));
drop trigger if exists audit_store_settings on public.store_settings;
create trigger audit_store_settings after insert or update or delete on public.store_settings for each row execute function public.log_audit_change();

insert into public.store_settings (key,value,is_public,description) values
  ('season','{"mode":"christmas","enabled":true,"starts_at":"2026-11-01T00:00:00-05:00","ends_at":"2027-01-07T00:00:00-05:00","snow":true,"lights":true,"headline":"Navidad MSJ","subline":"Regalos que se sienten como un abrazo. Envolvemos gratis cada pedido.","gift_wrap":true}'::jsonb,
    true,'Temporada visual de la tienda (Navidad): nieve, luces, guía de regalos y franja festiva.'),
  ('teaser_2027','{"enabled":true,"title":"2027 · Coming soon","subtitle":"Neo Minimal: la nueva colección MSJ llega con el año nuevo.","launch_at":"2027-01-01T00:00:00-05:00","cta":"Avísame primero","frequency":"daily"}'::jsonb,
    true,'Ventana emergente «2027 Coming Soon» con cuenta regresiva.'),
  ('announcement','{"enabled":false,"text":""}'::jsonb,true,'Mensaje propio para la franja superior (reemplaza al automático).'),
  ('loyalty','{"enabled":true,"points_per_sol":1,"welcome_points":50,"review_points":20,"checkin_points":5,"streak_bonus":25,"streak_every":7,"multipliers":{"gold":1.5,"black":2},"rewards":[{"points":500,"amount":10,"min":80},{"points":1000,"amount":25,"min":150},{"points":2000,"amount":60,"min":300}]}'::jsonb,
    true,'MSJ Recompensas: puntos por compra, racha diaria y canjes por cupones.'),
  ('studio','{"enabled":true}'::jsonb,true,'MSJ Studio: el cliente diseña cómo se ve su tienda.'),
  ('automation','{"low_stock_threshold":3,"mp_payment_minutes":120,"new_badge_days":0,"search_log_days":180,"events_log_days":90}'::jsonb,
    false,'Reglas de automatización (umbral de stock bajo, vencimiento de pagos online, limpieza de registros).')
on conflict (key) do nothing;

-- Lee un ajuste con valor por defecto (uso interno de otras funciones).
create or replace function public.setting(p_key text,p_default jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value from public.store_settings s where s.key = p_key),p_default);
$$;
revoke all on function public.setting(text,jsonb) from public,anon,authenticated;

create or replace function public.admin_save_setting(p_key text,p_value jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then raise exception 'Solo administración puede cambiar los ajustes de la tienda.'; end if;
  if p_key !~ '^[a-z0-9_.-]{2,60}$' then raise exception 'Clave de ajuste no válida.'; end if;
  if jsonb_typeof(p_value) <> 'object' or pg_column_size(p_value) > 16000 then raise exception 'El valor debe ser un objeto JSON de menos de 16 KB.'; end if;
  insert into public.store_settings (key,value,updated_at,updated_by) values (p_key,p_value,now(),auth.uid())
  on conflict (key) do update set value = excluded.value,updated_at = now(),updated_by = auth.uid();
end;
$$;
revoke all on function public.admin_save_setting(text,jsonb) from public,anon;
grant execute on function public.admin_save_setting(text,jsonb) to authenticated;

-- =====================================================================================================================
-- 2. Búsqueda inteligente (M.I.S.H.I. y buscador): nombre exacto primero, luego coincidencias y tolerancia a errores
-- =====================================================================================================================
-- Puntaje: nombre idéntico 120 · palabra completa en el nombre 70 · el nombre empieza así 25 · contiene 20
-- · cada palabra en nombre/categoría/marca/descripción · similitud por trigramas (errores de tipeo: «nuve» → «nube»).
create or replace function public.search_products(p_query text,p_limit integer default 24)
returns table (product_id uuid,slug text,name text,score numeric,match text)
language sql stable security definer set search_path = extensions, public, pg_temp as $$
  with q as (select left(public.msj_norm(p_query),80) as v),
  t as (select array(select w from q,unnest(string_to_array(q.v,' ')) w where char_length(w) >= 2) as terms),
  docs as (
    select p.id,p.slug,p.name,public.msj_norm(p.name) as n,
      public.msj_norm(concat_ws(' ',c.name,b.name,p.audience,p.description)) as d
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.brands b on b.id = p.brand_id
    where p.is_active and (not p.vip_only or public.is_vip_member())
  ),
  scored as (
    select docs.*,
      (case when docs.n = q.v then 120 else 0 end)
      + (case when (' ' || docs.n || ' ') like ('% ' || q.v || ' %') then 70 else 0 end)
      + (case when docs.n like (q.v || '%') then 25 else 0 end)
      + (case when position(q.v in docs.n) > 0 then 20 else 0 end)
      + coalesce((select sum(case when (' ' || docs.n || ' ') like ('% ' || w || ' %') then 14
                                  when position(w in docs.n) > 0 then 8
                                  when position(w in docs.d) > 0 then 4 else 0 end) from unnest(t.terms) w),0)
      + 30 * word_similarity(q.v,docs.n)
      + 8 * word_similarity(q.v,docs.d) as s
    from docs,q,t
  )
  select sc.id,sc.slug,sc.name,round(sc.s::numeric,2),
    case when sc.s >= 110 then 'exacto' when position(q.v in sc.n) > 0 then 'nombre'
         when sc.s >= 25 then 'relacionado' else 'aproximado' end
  from scored sc,q
  where char_length(q.v) >= 2 and sc.s >= 12
  order by sc.s desc,sc.name
  limit greatest(1,least(coalesce(p_limit,24),60));
$$;
revoke all on function public.search_products(text,integer) from public;
grant execute on function public.search_products(text,integer) to anon,authenticated;

-- Registro anónimo de búsquedas (sin cuenta ni IP en claro) para ver qué buscan los clientes y qué no encuentran.
create table if not exists public.search_log (
  id bigserial primary key, query text not null check (char_length(query) between 2 and 80),
  results integer not null default 0 check (results >= 0), source text not null default 'tienda' check (source in ('tienda','mishi','catalogo')),
  ip_hash text not null default '', created_at timestamptz not null default now()
);
create index if not exists search_log_created_idx on public.search_log(created_at desc);
alter table public.search_log enable row level security;
revoke all on public.search_log from public,anon,authenticated;

create or replace function public.log_search(p_query text,p_results integer default 0,p_source text default 'tienda')
returns void language plpgsql security definer set search_path = '' as $$
declare v_q text := left(public.msj_norm(p_query),80); v_ip text := md5(coalesce(public.request_ip(),'') || 'msj');
begin
  if char_length(v_q) < 2 then return; end if;
  -- Límite suave: 30 registros por minuto por origen, y la misma búsqueda no se repite en 2 minutos.
  if (select count(*) from public.search_log where ip_hash = v_ip and created_at > now() - interval '1 minute') >= 30 then return; end if;
  if exists (select 1 from public.search_log where ip_hash = v_ip and query = v_q and created_at > now() - interval '2 minutes') then return; end if;
  insert into public.search_log (query,results,source,ip_hash)
  values (v_q,greatest(0,least(coalesce(p_results,0),999)),case when p_source in ('tienda','mishi','catalogo') then p_source else 'tienda' end,v_ip);
end;
$$;
revoke all on function public.log_search(text,integer,text) from public;
grant execute on function public.log_search(text,integer,text) to anon,authenticated;

-- Límite de uso de la IA de M.I.S.H.I. (Edge Function mishi-ai): N consultas por hora por visitante (clave anónima).
create table if not exists public.ai_requests (
  id bigserial primary key, quota_key text not null check (char_length(quota_key) between 8 and 64), created_at timestamptz not null default now()
);
create index if not exists ai_requests_key_idx on public.ai_requests(quota_key,created_at desc);
alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from public,anon,authenticated;
create or replace function public.ai_take_quota(p_key text,p_limit integer default 20)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.ai_requests where quota_key = p_key and created_at > now() - interval '1 hour') >= greatest(1,least(coalesce(p_limit,20),500)) then
    return false;
  end if;
  insert into public.ai_requests (quota_key) values (left(p_key,64));
  delete from public.ai_requests where created_at < now() - interval '2 days';
  return true;
end;
$$;
revoke all on function public.ai_take_quota(text,integer) from public,anon,authenticated;
grant execute on function public.ai_take_quota(text,integer) to service_role;

create or replace function public.admin_search_insights(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1,least(coalesce(p_days,30),365)));
begin
  if not public.has_role('admin') then raise exception 'Solo administración.'; end if;
  return jsonb_build_object(
    'total',(select count(*) from public.search_log where created_at >= v_from),
    'top',coalesce((select jsonb_agg(x) from (select query,count(*) as veces,round(avg(results),1) as resultados
      from public.search_log where created_at >= v_from group by query order by count(*) desc,query limit 15) x),'[]'::jsonb),
    'sin_resultados',coalesce((select jsonb_agg(x) from (select query,count(*) as veces,max(created_at) as ultima
      from public.search_log where created_at >= v_from and results = 0 group by query order by count(*) desc,query limit 15) x),'[]'::jsonb));
end;
$$;
revoke all on function public.admin_search_insights(integer) from public,anon;
grant execute on function public.admin_search_insights(integer) to authenticated;

-- =====================================================================================================================
-- 3. Notificaciones para clientes (bajó de precio tu favorito, volvió el stock, tu pedido avanzó, puntos)
-- =====================================================================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('precio','stock','pedido','pago','vip','puntos','sistema')),
  title text not null check (char_length(title) between 1 and 120), body text not null default '' check (char_length(body) <= 400),
  link text not null default '' check (char_length(link) <= 300), dedupe_key text,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id,created_at desc);
create unique index if not exists notifications_dedupe_key on public.notifications(user_id,dedupe_key) where dedupe_key is not null;
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.notify(p_user uuid,p_kind text,p_title text,p_body text default '',p_link text default '',p_dedupe text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id,kind,title,body,link,dedupe_key)
  values (p_user,p_kind,left(p_title,120),left(coalesce(p_body,''),400),left(coalesce(p_link,''),300),p_dedupe)
  on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
end;
$$;
revoke all on function public.notify(uuid,text,text,text,text,text) from public,anon,authenticated;

create or replace function public.notifications_mark_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.notifications_mark_read(uuid[]) from public,anon;
grant execute on function public.notifications_mark_read(uuid[]) to authenticated;

-- =====================================================================================================================
-- 4. MSJ Recompensas: puntos, racha diaria y canje por cupones personales
-- =====================================================================================================================
create table if not exists public.loyalty_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  streak integer not null default 0 check (streak >= 0), best_streak integer not null default 0 check (best_streak >= 0),
  last_checkin date, updated_at timestamptz not null default now()
);
create table if not exists public.points_ledger (
  id bigserial primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null check (points <> 0),
  reason text not null check (reason in ('bienvenida','racha','compra','canje','ajuste','resena','reversion')),
  ref text, created_at timestamptz not null default now()
);
create unique index if not exists points_ledger_once on public.points_ledger(user_id,reason,ref) where ref is not null;
create index if not exists points_ledger_user_idx on public.points_ledger(user_id,created_at desc);
alter table public.loyalty_accounts enable row level security;
alter table public.points_ledger enable row level security;
revoke all on public.loyalty_accounts,public.points_ledger from public,anon,authenticated;
grant select on public.loyalty_accounts,public.points_ledger to authenticated;
drop policy if exists loyalty_own_read on public.loyalty_accounts;
create policy loyalty_own_read on public.loyalty_accounts for select to authenticated using (user_id = (select auth.uid()) or public.has_role('admin'));
drop policy if exists ledger_own_read on public.points_ledger;
create policy ledger_own_read on public.points_ledger for select to authenticated using (user_id = (select auth.uid()) or public.has_role('admin'));

-- Cada movimiento del libro de puntos actualiza el saldo (nunca baja de cero).
create or replace function public.points_ledger_apply()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.loyalty_accounts (user_id,points_balance,lifetime_points)
  values (new.user_id,greatest(new.points,0),greatest(new.points,0))
  on conflict (user_id) do update set
    points_balance = greatest(public.loyalty_accounts.points_balance + new.points,0),
    lifetime_points = public.loyalty_accounts.lifetime_points + greatest(new.points,0),
    updated_at = now();
  return new;
end;
$$;
revoke all on function public.points_ledger_apply() from public,anon,authenticated;
drop trigger if exists points_ledger_apply on public.points_ledger;
create trigger points_ledger_apply after insert on public.points_ledger for each row execute function public.points_ledger_apply();

create or replace function public.add_points(p_user uuid,p_points integer,p_reason text,p_ref text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if p_user is null or coalesce(p_points,0) = 0 then return false; end if;
  insert into public.points_ledger (user_id,points,reason,ref) values (p_user,p_points,p_reason,p_ref)
  on conflict (user_id,reason,ref) where ref is not null do nothing returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.add_points(uuid,integer,text,text) from public,anon,authenticated;

-- Multiplicador de socio: Gold 1.5x, Black 2x (ajustable en store_settings.loyalty.multipliers).
create or replace function public.points_multiplier(p_user uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((public.setting('loyalty') -> 'multipliers' ->> (
    select p.nivel_vip from public.profiles p where p.id = p_user and p.es_vip and p.vip_expira > now()))::numeric,1);
$$;
revoke all on function public.points_multiplier(uuid) from public,anon,authenticated;

-- Bienvenida: puntos al crear la cuenta + aviso.
create or replace function public.profiles_welcome()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_points integer := coalesce((public.setting('loyalty') ->> 'welcome_points')::integer,50);
begin
  if coalesce((public.setting('loyalty') ->> 'enabled')::boolean,true) and v_points > 0 then
    perform public.add_points(new.id,v_points,'bienvenida','welcome');
  end if;
  perform public.notify(new.id,'puntos','¡Bienvenida/o a MSJ! ✦','Te regalamos ' || v_points || ' puntos MSJ. Vuelve cada día para sumar tu racha.','cuenta.html#recompensas','welcome');
  return new;
end;
$$;
revoke all on function public.profiles_welcome() from public,anon,authenticated;
drop trigger if exists profiles_welcome on public.profiles;
create trigger profiles_welcome after insert on public.profiles for each row execute function public.profiles_welcome();

-- Racha diaria: una vez por día (hora de Lima). Bonus cada 7 días seguidos.
create or replace function public.daily_checkin()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_today date := (now() at time zone 'America/Lima')::date; v_cfg jsonb := public.setting('loyalty');
  v_acc public.loyalty_accounts%rowtype; v_streak integer; v_points integer; v_bonus integer := 0; v_every integer;
begin
  if v_user is null then raise exception 'Inicia sesión para sumar tu racha.'; end if;
  if not public.is_active_user() then raise exception 'La cuenta está deshabilitada.'; end if;
  if not coalesce((v_cfg ->> 'enabled')::boolean,true) then raise exception 'Las recompensas están en pausa.'; end if;
  insert into public.loyalty_accounts (user_id) values (v_user) on conflict (user_id) do nothing;
  select * into v_acc from public.loyalty_accounts where user_id = v_user for update;
  if v_acc.last_checkin = v_today then
    return jsonb_build_object('ok',false,'already',true,'streak',v_acc.streak,'points',v_acc.points_balance);
  end if;
  v_streak := case when v_acc.last_checkin = v_today - 1 then v_acc.streak + 1 else 1 end;
  v_every := greatest(coalesce((v_cfg ->> 'streak_every')::integer,7),2);
  v_points := round(coalesce((v_cfg ->> 'checkin_points')::integer,5) * public.points_multiplier(v_user));
  if v_streak % v_every = 0 then v_bonus := coalesce((v_cfg ->> 'streak_bonus')::integer,25); end if;
  update public.loyalty_accounts set streak = v_streak,best_streak = greatest(best_streak,v_streak),last_checkin = v_today,updated_at = now()
  where user_id = v_user;
  perform public.add_points(v_user,v_points + v_bonus,'racha',v_today::text);
  select * into v_acc from public.loyalty_accounts where user_id = v_user;
  return jsonb_build_object('ok',true,'streak',v_streak,'earned',v_points + v_bonus,'bonus',v_bonus,'points',v_acc.points_balance,
    'next_bonus_in',v_every - (v_streak % v_every));
end;
$$;
revoke all on function public.daily_checkin() from public,anon;
grant execute on function public.daily_checkin() to authenticated;

-- Canje: convierte puntos en un cupón personal (solo lo usa su titular, un uso, vence en 60 días).
create or replace function public.redeem_points(p_points integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_reward jsonb; v_acc public.loyalty_accounts%rowtype; v_code text;
begin
  if v_user is null then raise exception 'Inicia sesión para canjear.'; end if;
  if not public.is_active_user() then raise exception 'La cuenta está deshabilitada.'; end if;
  select r into v_reward from jsonb_array_elements(public.setting('loyalty') -> 'rewards') r where (r ->> 'points')::integer = p_points limit 1;
  if v_reward is null then raise exception 'Ese canje no existe.'; end if;
  select * into v_acc from public.loyalty_accounts where user_id = v_user for update;
  if not found or v_acc.points_balance < p_points then raise exception 'Aún no tienes puntos suficientes.'; end if;
  v_code := 'MSJP-' || upper(substr(md5(gen_random_uuid()::text),1,8));
  insert into public.coupons (code,description,discount_type,discount_value,min_subtotal,starts_at,ends_at,max_uses,once_per_customer,is_active,owner_id)
  values (v_code,'Canje de ' || p_points || ' puntos MSJ','amount',(v_reward ->> 'amount')::numeric,coalesce((v_reward ->> 'min')::numeric,0),
    now(),now() + interval '60 days',1,true,true,v_user);
  perform public.add_points(v_user,-p_points,'canje',v_code);
  perform public.notify(v_user,'puntos','Canjeaste ' || p_points || ' puntos','Tu cupón ' || v_code || ' vale S/ ' || (v_reward ->> 'amount') || ' y vence en 60 días.','cuenta.html#recompensas','canje:' || v_code);
  return jsonb_build_object('code',v_code,'amount',(v_reward ->> 'amount')::numeric,'min',coalesce((v_reward ->> 'min')::numeric,0),
    'expires',now() + interval '60 days','points',v_acc.points_balance - p_points);
end;
$$;
revoke all on function public.redeem_points(integer) from public,anon;
grant execute on function public.redeem_points(integer) to authenticated;

-- Reseña aprobada: suma puntos a su autor.
create or replace function public.reviews_award_points()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if public.add_points(new.user_id,coalesce((public.setting('loyalty') ->> 'review_points')::integer,20),'resena',new.id::text) then
      perform public.notify(new.user_id,'puntos','Tu reseña fue publicada ★','Gracias por contarnos tu experiencia: sumaste puntos MSJ.','cuenta.html#recompensas','resena:' || new.id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.reviews_award_points() from public,anon,authenticated;
drop trigger if exists reviews_award_points on public.product_reviews;
create trigger reviews_award_points after update of status on public.product_reviews for each row execute function public.reviews_award_points();

-- =====================================================================================================================
-- 5. MSJ Studio: el cliente diseña cómo se ve su tienda (opciones premium solo para socios)
-- =====================================================================================================================
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public,anon,authenticated;
grant select on public.user_preferences to authenticated;
drop policy if exists preferences_own_read on public.user_preferences;
create policy preferences_own_read on public.user_preferences for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.save_ui_theme(p_theme jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_vip boolean := public.is_vip_member(); v_clean jsonb := '{}'::jsonb;
  v_accent text := lower(coalesce(p_theme ->> 'accent',''));
  v_surface text := coalesce(p_theme ->> 'surface','nieve'); v_radius text := coalesce(p_theme ->> 'radius','suave');
  v_density text := coalesce(p_theme ->> 'density','comodo'); v_font text := coalesce(p_theme ->> 'font','moderna');
  v_cards text := coalesce(p_theme ->> 'cards','limpia'); v_motion text := coalesce(p_theme ->> 'motion','normal');
  v_glass text := coalesce(p_theme ->> 'glass','normal'); v_header text := coalesce(p_theme ->> 'header','fija');
begin
  if v_header not in ('fija','auto') then v_header := 'fija'; end if;
  if v_user is null then raise exception 'Inicia sesión para guardar tu diseño.'; end if;
  if jsonb_typeof(p_theme) <> 'object' then raise exception 'Diseño no válido.'; end if;
  if v_accent !~ '^#[0-9a-f]{6}$' then v_accent := '#b08d57'; end if;
  if v_surface not in ('nieve','marfil','niebla','champan','pino','obsidiana') then raise exception 'Fondo no válido.'; end if;
  if v_radius not in ('recto','suave','redondo') or v_density not in ('comodo','compacto') or v_font not in ('moderna','editorial','geometrica')
     or v_cards not in ('limpia','enmarcada','flotante') or v_motion not in ('normal','reducido') or v_glass not in ('sutil','normal','intenso') then
    raise exception 'Opción de diseño no válida.';
  end if;
  -- Opciones premium (deben coincidir con premium en ui-2026.js): fondos Champán, Pino y Obsidiana, letra Geométrica,
  -- tarjetas Flotantes y Liquid Glass intenso.
  if not v_vip and (v_surface in ('champan','pino','obsidiana') or v_font = 'geometrica' or v_cards = 'flotante' or v_glass = 'intenso') then
    raise exception 'Esa opción es exclusiva para socios MSJ Privilège.';
  end if;
  v_clean := jsonb_build_object('accent',v_accent,'surface',v_surface,'radius',v_radius,'density',v_density,'font',v_font,
    'cards',v_cards,'motion',v_motion,'glass',v_glass,'header',v_header,'festive',coalesce((p_theme ->> 'festive')::boolean,true));
  insert into public.user_preferences (user_id,theme,updated_at) values (v_user,v_clean,now())
  on conflict (user_id) do update set theme = excluded.theme,updated_at = now();
  return v_clean;
end;
$$;
revoke all on function public.save_ui_theme(jsonb) from public,anon;
grant execute on function public.save_ui_theme(jsonb) to authenticated;

-- Todo lo que la tienda necesita del cliente en una sola llamada: puntos, racha, avisos sin leer y su diseño.
create or replace function public.my_engagement()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_acc public.loyalty_accounts%rowtype; v_today date := (now() at time zone 'America/Lima')::date; v_every integer;
begin
  if v_user is null then return null; end if;
  select * into v_acc from public.loyalty_accounts where user_id = v_user;
  v_every := greatest(coalesce((public.setting('loyalty') ->> 'streak_every')::integer,7),2);
  return jsonb_build_object(
    'points',coalesce(v_acc.points_balance,0),'lifetime',coalesce(v_acc.lifetime_points,0),
    'streak',case when v_acc.last_checkin >= v_today - 1 then coalesce(v_acc.streak,0) else 0 end,
    'best_streak',coalesce(v_acc.best_streak,0),'checked_today',coalesce(v_acc.last_checkin = v_today,false),
    'next_bonus_in',v_every - (case when v_acc.last_checkin >= v_today - 1 then coalesce(v_acc.streak,0) else 0 end % v_every),
    'multiplier',public.points_multiplier(v_user),'vip',public.is_vip_member(),
    'unread',(select count(*) from public.notifications n where n.user_id = v_user and n.read_at is null),
    'theme',(select u.theme from public.user_preferences u where u.user_id = v_user),
    'coupons',coalesce((select jsonb_agg(jsonb_build_object('code',c.code,'amount',c.discount_value,'min',c.min_subtotal,'ends_at',c.ends_at) order by c.created_at desc)
      from public.coupons c where c.owner_id = v_user and c.is_active and c.used_count < coalesce(c.max_uses,1) and (c.ends_at is null or c.ends_at > now())),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(x) from (select l.points,l.reason,l.created_at from public.points_ledger l where l.user_id = v_user order by l.created_at desc limit 12) x),'[]'::jsonb),
    -- Logros del Studio: se calculan con lo que el cliente ya hizo (no se pueden «marcar» desde el navegador).
    'achievements',jsonb_build_object(
      'bienvenida',true,
      'primer_diseno',exists (select 1 from public.user_preferences u where u.user_id = v_user),
      'racha_3',coalesce(v_acc.best_streak,0) >= 3,
      'racha_7',coalesce(v_acc.best_streak,0) >= 7,
      'racha_30',coalesce(v_acc.best_streak,0) >= 30,
      'primera_compra',exists (select 1 from public.orders o where o.user_id = v_user and o.payment_status = 'paid'),
      'cliente_fiel',(select count(*) from public.orders o where o.user_id = v_user and o.payment_status = 'paid') >= 3,
      'critico',exists (select 1 from public.product_reviews r where r.user_id = v_user and r.status = 'approved'),
      'coleccionista',(select count(*) from public.wishlists w where w.user_id = v_user) >= 5,
      'solidario',exists (select 1 from public.orders o where o.user_id = v_user and o.donation_amount > 0 and o.status <> 'cancelled'),
      'puntos_1000',coalesce(v_acc.lifetime_points,0) >= 1000,
      'socio_vip',public.is_vip_member()));
end;
$$;
revoke all on function public.my_engagement() from public,anon;
grant execute on function public.my_engagement() to authenticated;

-- =====================================================================================================================
-- 6. Inventario automático: alertas de stock bajo, sugerencias de reposición y devolución de stock al cancelar
-- =====================================================================================================================
alter table public.products add column if not exists low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold between 0 and 1000);
-- Motivos de movimiento: se amplía la lista (también en gestion.sql) con devoluciones y ventas de Mercado Libre.
alter table public.inventory_movements drop constraint if exists inventory_movements_reason_check;
alter table public.inventory_movements add constraint inventory_movements_reason_check check (reason in ('venta','ajuste','alta','compra','devolucion','mercado_libre'));

create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.product_variants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, kind text not null check (kind in ('bajo','agotado')),
  stock integer not null, threshold integer not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists stock_alerts_open_key on public.stock_alerts(variant_id) where resolved_at is null;
alter table public.stock_alerts enable row level security;
revoke all on public.stock_alerts from public,anon,authenticated;
grant select on public.stock_alerts to authenticated;
drop policy if exists stock_alerts_admin_read on public.stock_alerts;
create policy stock_alerts_admin_read on public.stock_alerts for select to authenticated using (public.has_role('admin'));

create or replace function public.stock_threshold(p_product uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select p.low_stock_threshold from public.products p where p.id = p_product),
    (public.setting('automation') ->> 'low_stock_threshold')::integer,3);
$$;
revoke all on function public.stock_threshold(uuid) from public,anon,authenticated;

create or replace function public.stock_alert_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_threshold integer := public.stock_threshold(new.product_id); v_user uuid;
begin
  if new.is_active and new.stock <= v_threshold then
    insert into public.stock_alerts (variant_id,product_id,kind,stock,threshold)
    values (new.id,new.product_id,case when new.stock = 0 then 'agotado' else 'bajo' end,new.stock,v_threshold)
    on conflict (variant_id) where resolved_at is null
    do update set kind = excluded.kind,stock = excluded.stock,threshold = excluded.threshold,updated_at = now();
  else
    update public.stock_alerts set resolved_at = now(),stock = new.stock,updated_at = now() where variant_id = new.id and resolved_at is null;
  end if;
  -- Volvió el stock: avisa a quienes tienen el producto en favoritos (una vez al día por producto).
  if TG_OP = 'UPDATE' and coalesce(old.stock,0) = 0 and new.stock > 0 and new.is_active then
    for v_user in select w.user_id from public.wishlists w where w.product_id = new.product_id limit 500 loop
      perform public.notify(v_user,'stock','¡Volvió tu favorito! ' || (select p.name from public.products p where p.id = new.product_id),
        'Ya hay stock en ' || new.size || ' / ' || new.color || '. Las unidades vuelan.',
        'index.html#producto/' || (select p.slug from public.products p where p.id = new.product_id),
        'stock:' || new.product_id || ':' || to_char(now() at time zone 'America/Lima','YYYYMMDD'));
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.stock_alert_check() from public,anon,authenticated;
drop trigger if exists stock_alert_check on public.product_variants;
create trigger stock_alert_check after insert or update of stock,is_active on public.product_variants for each row execute function public.stock_alert_check();

-- Alertas iniciales para el stock que ya está bajo.
insert into public.stock_alerts (variant_id,product_id,kind,stock,threshold)
select v.id,v.product_id,case when v.stock = 0 then 'agotado' else 'bajo' end,v.stock,public.stock_threshold(v.product_id)
from public.product_variants v join public.products p on p.id = v.product_id
where v.is_active and p.is_active and v.stock <= public.stock_threshold(v.product_id)
on conflict (variant_id) where resolved_at is null do nothing;

-- Sugerencias de reposición: velocidad de venta (últimos N días), días de cobertura y cantidad sugerida
-- para cubrir p_cover_days más 7 días de seguridad.
create or replace function public.admin_restock_suggestions(p_days integer default 30,p_cover_days integer default 30)
returns table (variant_id uuid,product_name text,sku text,variant text,stock integer,vendidos integer,por_dia numeric,dias_cobertura numeric,sugerido integer,prioridad text)
language plpgsql stable security definer set search_path = '' as $$
declare v_days integer := greatest(7,least(coalesce(p_days,30),180)); v_cover integer := greatest(7,least(coalesce(p_cover_days,30),120));
begin
  if not public.has_role('admin') then raise exception 'Solo administración.'; end if;
  return query
  with sales as (
    select i.variant_id as vid,sum(i.quantity)::integer as qty
    from public.order_items i join public.orders o on o.id = i.order_id
    where o.status <> 'cancelled' and o.created_at >= now() - make_interval(days => v_days) and i.variant_id is not null
    group by i.variant_id
  ), base as (
    select v.id,p.name,p.sku,v.size || ' / ' || v.color as label,v.stock,coalesce(s.qty,0) as qty,
      round(coalesce(s.qty,0)::numeric / v_days,2) as velocity,public.stock_threshold(p.id) as threshold
    from public.product_variants v join public.products p on p.id = v.product_id left join sales s on s.vid = v.id
    where v.is_active and p.is_active
  )
  select b.id,b.name,b.sku,b.label,b.stock,b.qty,b.velocity,
    case when b.velocity > 0 then round(b.stock / b.velocity,1) end,
    greatest(0,ceil(b.velocity * (v_cover + 7)) - b.stock)::integer,
    case when b.stock = 0 and b.qty > 0 then 'urgente'
         when b.velocity > 0 and b.stock / b.velocity < 7 then 'alta'
         when b.stock <= b.threshold then 'media' else 'baja' end
  from base b
  where b.qty > 0 or b.stock <= b.threshold
  order by case when b.stock = 0 and b.qty > 0 then 0 when b.velocity > 0 and b.stock / b.velocity < 7 then 1 when b.stock <= b.threshold then 2 else 3 end,
    b.velocity desc,b.stock asc
  limit 200;
end;
$$;
revoke all on function public.admin_restock_suggestions(integer,integer) from public,anon;
grant execute on function public.admin_restock_suggestions(integer,integer) to authenticated;

-- =====================================================================================================================
-- 7. Pedidos: Mercado Pago, devolución automática de stock al cancelar, puntos y avisos
-- =====================================================================================================================
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('cash_on_delivery','card','yape','lemon','mercado_pago'));
alter table public.orders add column if not exists mp_preference_id text;
alter table public.orders add column if not exists mp_payment_id text;
alter table public.orders add column if not exists payment_expires_at timestamptz;
alter table public.orders add column if not exists stock_restored_at timestamptz;
alter table public.orders add column if not exists source text not null default 'tienda' check (source in ('tienda','mercado_libre','panel'));
grant select (payment_expires_at,mp_payment_id,source) on public.orders to authenticated;
create index if not exists orders_mp_pending_idx on public.orders(payment_expires_at) where payment_method = 'mercado_pago' and status = 'pending';
drop index if exists public.payments_mp_reference_key;
create unique index payments_mp_reference_key on public.payments(provider_reference) where provider = 'mercado_pago';

-- Al pasar un pedido a «cancelado» (panel, rechazo de pago o vencimiento) vuelve el stock y el uso del cupón, una sola vez.
create or replace function public.orders_restock_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.stock_restored_at is null then
    perform set_config('msj.stock_reason','devolucion',true);
    update public.product_variants v set stock = v.stock + i.quantity
    from (select oi.variant_id,sum(oi.quantity)::integer as quantity from public.order_items oi
          where oi.order_id = new.id and oi.variant_id is not null group by oi.variant_id) i
    where v.id = i.variant_id;
    perform set_config('msj.stock_reason','',true);
    if new.coupon_code is not null then
      update public.coupons set used_count = greatest(used_count - 1,0) where code = new.coupon_code;
    end if;
    new.stock_restored_at := now();
  elsif old.status = 'cancelled' and new.status is distinct from 'cancelled' and old.stock_restored_at is not null and new.stock_restored_at is not null then
    raise exception 'Este pedido cancelado ya devolvió su stock. Usa «Reactivar pedido» para volver a reservarlo.';
  end if;
  return new;
end;
$$;
revoke all on function public.orders_restock_on_cancel() from public,anon,authenticated;
drop trigger if exists orders_restock_on_cancel on public.orders;
create trigger orders_restock_on_cancel before update of status on public.orders for each row execute function public.orders_restock_on_cancel();

-- Reactivar un pedido cancelado: vuelve a reservar el stock si todavía alcanza.
create or replace function public.admin_reactivar_pedido(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_missing text;
begin
  if not public.has_role('admin') then raise exception 'Solo administración puede reactivar pedidos.'; end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.status <> 'cancelled' then raise exception 'El pedido no está cancelado.'; end if;
  select string_agg(oi.product_name,', ') into v_missing
  from (select variant_id,product_name,sum(quantity) as qty from public.order_items where order_id = p_order and variant_id is not null group by variant_id,product_name) oi
  join public.product_variants v on v.id = oi.variant_id where v.stock < oi.qty;
  if v_missing is not null then raise exception 'No hay stock suficiente para reactivar: %.',v_missing; end if;
  perform set_config('msj.stock_reason','venta',true);
  update public.product_variants v set stock = v.stock - i.qty
  from (select variant_id,sum(quantity)::integer as qty from public.order_items where order_id = p_order and variant_id is not null group by variant_id) i
  where v.id = i.variant_id;
  update public.orders set status = 'pending',stock_restored_at = null,pago_rechazo_motivo = null where id = p_order;
end;
$$;
revoke all on function public.admin_reactivar_pedido(uuid) from public,anon;
grant execute on function public.admin_reactivar_pedido(uuid) to authenticated;

-- Rechazo de pago con billetera: ahora el stock y el cupón los devuelve el trigger orders_restock_on_cancel.
create or replace function public.rechazar_pago_billetera(p_order uuid,p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_motivo text := left(nullif(trim(coalesce(p_motivo,'')),''),300);
begin
  if not (public.has_role('admin') or public.has_role('staff')) then raise exception 'Solo el equipo de MSJ puede verificar pagos.'; end if;
  if v_motivo is null then raise exception 'Escribe el motivo del rechazo para informar al cliente.'; end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_order.payment_method not in ('yape','lemon') or v_order.payment_status <> 'pending' or v_order.status = 'cancelled' then
    raise exception 'Este pedido no tiene un pago por verificar.';
  end if;
  update public.orders set status = 'cancelled',payment_status = 'unpaid',pago_rechazo_motivo = v_motivo,
    pago_verificado_por = (select p.id from public.profiles p where p.id = auth.uid()),pago_verificado_at = now()
  where id = p_order;
  update public.payments set status = 'failed' where order_id = p_order and status = 'pending';
end;
$$;
revoke all on function public.rechazar_pago_billetera(uuid,text) from public,anon;
grant execute on function public.rechazar_pago_billetera(uuid,text) to authenticated;

-- Puntos por compra pagada (con multiplicador de socio) y reversión si el pedido se cancela o se reembolsa.
create or replace function public.orders_loyalty_and_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(left(new.id::text,8)); v_base numeric; v_points integer; v_earned integer;
  v_mult numeric := coalesce((public.setting('loyalty') -> 'multipliers' ->> new.nivel_vip)::numeric,1);
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    v_base := new.total - coalesce(new.donation_amount,0) - coalesce(new.shipping_amount,0);
    v_points := floor(greatest(v_base,0) * coalesce((public.setting('loyalty') ->> 'points_per_sol')::numeric,1) * v_mult);
    if coalesce((public.setting('loyalty') ->> 'enabled')::boolean,true) and v_points > 0 then
      perform public.add_points(new.user_id,v_points,'compra',new.id::text);
    end if;
    perform public.notify(new.user_id,'pago','Pago verificado · pedido ' || v_code,
      case when v_points > 0 then 'Tu comprobante está listo y sumaste ' || v_points || ' puntos MSJ.' else 'Tu comprobante está listo en Mis pedidos.' end,
      'cuenta.html#pedidos','pago:' || new.id);
  end if;
  if (new.status = 'cancelled' and old.status is distinct from 'cancelled') or (new.payment_status = 'refunded' and old.payment_status is distinct from 'refunded') then
    select l.points into v_earned from public.points_ledger l where l.user_id = new.user_id and l.reason = 'compra' and l.ref = new.id::text;
    if v_earned > 0 then
      perform public.add_points(new.user_id,-least(v_earned,coalesce((select a.points_balance from public.loyalty_accounts a where a.user_id = new.user_id),0)),'reversion',new.id::text);
    end if;
  end if;
  if new.status is distinct from old.status then
    perform public.notify(new.user_id,'pedido',
      case new.status when 'confirmed' then 'Pedido ' || v_code || ' confirmado ✓' when 'shipped' then 'Tu pedido ' || v_code || ' va en camino 🚚'
        when 'delivered' then 'Pedido ' || v_code || ' entregado 🎁' when 'cancelled' then 'Pedido ' || v_code || ' cancelado' else 'Pedido ' || v_code || ' actualizado' end,
      case new.status when 'shipped' then 'Síguelo en Mis pedidos.' when 'delivered' then '¿Qué tal te quedó? Deja tu reseña y suma puntos.'
        when 'cancelled' then coalesce(new.pago_rechazo_motivo,'Si tienes dudas, escríbenos.') else 'Revisa el detalle en Mis pedidos.' end,
      'cuenta.html#pedidos','pedido:' || new.id || ':' || new.status);
  end if;
  return new;
end;
$$;
revoke all on function public.orders_loyalty_and_notify() from public,anon,authenticated;
drop trigger if exists orders_loyalty_and_notify on public.orders;
create trigger orders_loyalty_and_notify after update of status,payment_status on public.orders for each row execute function public.orders_loyalty_and_notify();

-- Bajó de precio un favorito: aviso a quienes lo guardaron (una vez al día por producto).
create or replace function public.products_price_drop_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old numeric := round(old.price * (1 - old.discount_percent / 100),2); v_new numeric := round(new.price * (1 - new.discount_percent / 100),2); v_user uuid;
begin
  if new.is_active and v_new < v_old * 0.99 then
    for v_user in select w.user_id from public.wishlists w where w.product_id = new.id limit 500 loop
      perform public.notify(v_user,'precio','Bajó de precio: ' || new.name,'Ahora S/ ' || to_char(v_new,'FM999990.00') || ' (antes S/ ' || to_char(v_old,'FM999990.00') || ').',
        'index.html#producto/' || new.slug,'precio:' || new.id || ':' || to_char(now() at time zone 'America/Lima','YYYYMMDD'));
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.products_price_drop_notify() from public,anon,authenticated;
drop trigger if exists products_price_drop_notify on public.products;
create trigger products_price_drop_notify after update of price,discount_percent on public.products for each row execute function public.products_price_drop_notify();

-- =====================================================================================================================
-- 8. Integraciones: Mercado Pago (cobros online con confirmación automática) y Mercado Libre (catálogo y ventas)
--    Todo apagado hasta tener credenciales. Los tokens NUNCA se guardan en tablas visibles: solo el service_role los lee.
-- =====================================================================================================================
create table if not exists public.integrations (
  provider text primary key check (provider in ('mercado_pago','mercado_libre')),
  enabled boolean not null default false,
  mode text not null default 'sandbox' check (mode in ('sandbox','production')),
  public_config jsonb not null default '{}'::jsonb,
  status text not null default 'pendiente_credenciales' check (status in ('pendiente_credenciales','configurado','conectado','error','pausado')),
  last_event_at timestamptz, last_sync_at timestamptz, last_error text check (char_length(last_error) <= 500),
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id) on delete set null
);
alter table public.integrations enable row level security;
revoke all on public.integrations from public,anon,authenticated;
grant select on public.integrations to authenticated;
drop policy if exists integrations_admin_read on public.integrations;
create policy integrations_admin_read on public.integrations for select to authenticated using (public.has_role('admin'));
drop trigger if exists audit_integrations on public.integrations;
create trigger audit_integrations after insert or update or delete on public.integrations for each row execute function public.log_audit_change();
insert into public.integrations (provider,public_config) values
  ('mercado_pago','{"public_key":"","statement_descriptor":"MSJ FASHION","country":"PE","currency":"PEN"}'::jsonb),
  ('mercado_libre','{"site_id":"MPE","seller_id":"","nickname":"","listing_type":"gold_special","price_markup_percent":0}'::jsonb)
on conflict (provider) do nothing;

-- Lo único que la tienda puede saber: si Mercado Pago está activo y su clave PÚBLICA.
create or replace function public.store_integrations()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('mercado_pago',coalesce((select jsonb_build_object('enabled',true,'mode',i.mode,'public_key',coalesce(i.public_config ->> 'public_key',''))
    from public.integrations i where i.provider = 'mercado_pago' and i.enabled),jsonb_build_object('enabled',false)));
$$;
revoke all on function public.store_integrations() from public;
grant execute on function public.store_integrations() to anon,authenticated;

create or replace function public.admin_set_integration(p_provider text,p_enabled boolean,p_mode text default null,p_public_config jsonb default null)
returns public.integrations language plpgsql security definer set search_path = '' as $$
declare v_row public.integrations%rowtype;
begin
  if not public.has_role('admin') then raise exception 'Solo administración.'; end if;
  select * into v_row from public.integrations where provider = p_provider for update;
  if not found then raise exception 'Integración desconocida.'; end if;
  if p_public_config is not null and (jsonb_typeof(p_public_config) <> 'object' or p_public_config ?| array['access_token','client_secret','refresh_token','webhook_secret']) then
    raise exception 'Las claves secretas no se guardan aquí: van en los secretos de Supabase (supabase secrets set).';
  end if;
  v_row.public_config := v_row.public_config || coalesce(p_public_config,'{}'::jsonb);
  if p_enabled and p_provider = 'mercado_pago' and coalesce(v_row.public_config ->> 'public_key','') = '' then
    raise exception 'Primero escribe la Public Key de Mercado Pago.';
  end if;
  if p_enabled and p_provider = 'mercado_libre' and not exists (select 1 from public.ml_oauth_tokens where id = 1) then
    raise exception 'Primero conecta la cuenta de Mercado Libre (botón «Conectar»).';
  end if;
  update public.integrations set enabled = p_enabled,mode = coalesce(nullif(p_mode,''),mode),public_config = v_row.public_config,
    status = case when p_enabled then case when p_provider = 'mercado_libre' then 'conectado' else 'configurado' end
                  when status = 'conectado' then 'pausado' else status end,
    updated_at = now(),updated_by = auth.uid()
  where provider = p_provider returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.admin_set_integration(text,boolean,text,jsonb) from public,anon;
grant execute on function public.admin_set_integration(text,boolean,text,jsonb) to authenticated;

-- Bandeja de webhooks (Mercado Pago y Mercado Libre): idempotencia, auditoría y reintentos.
create table if not exists public.integration_events (
  id bigserial primary key, provider text not null check (provider in ('mercado_pago','mercado_libre')),
  topic text not null default '' check (char_length(topic) <= 60), resource_id text not null default '' check (char_length(resource_id) <= 200),
  request_id text check (char_length(request_id) <= 120), signature_ok boolean,
  status text not null default 'recibido' check (status in ('recibido','procesado','ignorado','error')),
  error text check (char_length(error) <= 500), payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(), processed_at timestamptz
);
create unique index if not exists integration_events_request_key on public.integration_events(provider,request_id) where request_id is not null;
create index if not exists integration_events_received_idx on public.integration_events(received_at desc);
alter table public.integration_events enable row level security;
revoke all on public.integration_events from public,anon,authenticated;
grant select on public.integration_events to authenticated;
drop policy if exists integration_events_admin_read on public.integration_events;
create policy integration_events_admin_read on public.integration_events for select to authenticated using (public.has_role('admin'));

-- Tokens OAuth de Mercado Libre (rotan cada 6 horas). Sin políticas: solo el service_role (Edge Functions) los lee.
create table if not exists public.ml_oauth_tokens (
  id integer primary key default 1 check (id = 1), seller_id text not null, access_token text not null, refresh_token text not null,
  expires_at timestamptz not null, scope text not null default '', updated_at timestamptz not null default now()
);
alter table public.ml_oauth_tokens enable row level security;
revoke all on public.ml_oauth_tokens from public,anon,authenticated;
create table if not exists public.oauth_states (
  state text primary key, provider text not null, code_verifier text not null, created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from public,anon,authenticated;

-- Publicaciones de Mercado Libre: cada producto MSJ ↔ un ítem ML (las tallas/colores son variaciones).
create table if not exists public.ml_listings (
  id uuid primary key default gen_random_uuid(), product_id uuid not null unique references public.products(id) on delete cascade,
  ml_item_id text unique, ml_category_id text, listing_type text not null default 'gold_special',
  status text not null default 'borrador' check (status in ('borrador','pendiente','activo','pausado','cerrado','error')),
  sync_stock boolean not null default true, sync_price boolean not null default true,
  price_markup_percent numeric(5,2) not null default 0 check (price_markup_percent between 0 and 60),
  variation_map jsonb not null default '{}'::jsonb, permalink text, last_synced_at timestamptz,
  last_error text check (char_length(last_error) <= 500), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ml_category_map (
  category_id uuid primary key references public.categories(id) on delete cascade, ml_category_id text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.ml_orders (
  ml_order_id text primary key, status text not null default '', buyer_nickname text not null default '',
  total numeric(12,2) not null default 0, currency text not null default 'PEN', items jsonb not null default '[]'::jsonb,
  shipping jsonb not null default '{}'::jsonb, payload jsonb not null default '{}'::jsonb,
  stock_applied_at timestamptz, stock_restored_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ml_questions (
  ml_question_id text primary key, ml_item_id text not null default '', product_id uuid references public.products(id) on delete set null,
  question text not null default '', status text not null default 'UNANSWERED', answer text, asked_at timestamptz, answered_at timestamptz,
  payload jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.sync_queue (
  id bigserial primary key, provider text not null default 'mercado_libre' check (provider in ('mercado_libre')),
  action text not null check (action in ('publicar','actualizar_stock','actualizar_precio','pausar','reactivar','cerrar')),
  product_id uuid references public.products(id) on delete cascade, payload jsonb not null default '{}'::jsonb,
  status text not null default 'pendiente' check (status in ('pendiente','procesando','hecho','error','omitido')),
  attempts integer not null default 0, run_after timestamptz not null default now(), last_error text check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(), done_at timestamptz
);
create index if not exists sync_queue_pending_idx on public.sync_queue(status,run_after) where status in ('pendiente','error');
alter table public.ml_listings enable row level security;
alter table public.ml_category_map enable row level security;
alter table public.ml_orders enable row level security;
alter table public.ml_questions enable row level security;
alter table public.sync_queue enable row level security;
revoke all on public.ml_listings,public.ml_category_map,public.ml_orders,public.ml_questions,public.sync_queue from public,anon,authenticated;
grant select on public.ml_listings,public.ml_category_map,public.ml_orders,public.ml_questions,public.sync_queue to authenticated;
grant insert,update,delete on public.ml_category_map to authenticated;
grant update (sync_stock,sync_price,price_markup_percent,listing_type,ml_category_id) on public.ml_listings to authenticated;
drop policy if exists ml_listings_admin on public.ml_listings;
create policy ml_listings_admin on public.ml_listings for select to authenticated using (public.has_role('admin'));
drop policy if exists ml_listings_admin_update on public.ml_listings;
create policy ml_listings_admin_update on public.ml_listings for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists ml_category_map_admin on public.ml_category_map;
create policy ml_category_map_admin on public.ml_category_map for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists ml_orders_admin on public.ml_orders;
create policy ml_orders_admin on public.ml_orders for select to authenticated using (public.has_role('admin'));
drop policy if exists ml_questions_admin on public.ml_questions;
create policy ml_questions_admin on public.ml_questions for select to authenticated using (public.has_role('admin'));
drop policy if exists sync_queue_admin on public.sync_queue;
create policy sync_queue_admin on public.sync_queue for select to authenticated using (public.has_role('admin'));

create or replace function public.ml_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.integrations where provider = 'mercado_libre' and enabled);
$$;
revoke all on function public.ml_enabled() from public,anon,authenticated;

create or replace function public.ml_enqueue(p_product uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_product is null or not public.ml_enabled() then return; end if;
  if exists (select 1 from public.sync_queue where product_id = p_product and action = p_action and status = 'pendiente') then return; end if;
  insert into public.sync_queue (action,product_id,payload) values (p_action,p_product,coalesce(p_payload,'{}'::jsonb));
end;
$$;
revoke all on function public.ml_enqueue(uuid,text,jsonb) from public,anon,authenticated;

-- Cambió el stock o el precio en MSJ → se encola la actualización del ítem en Mercado Libre.
create or replace function public.ml_sync_triggers()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_product uuid := case when TG_TABLE_NAME = 'products' then new.id else new.product_id end;
begin
  if not public.ml_enabled() then return new; end if;
  if TG_TABLE_NAME = 'product_variants' and exists (select 1 from public.ml_listings l where l.product_id = v_product and l.sync_stock and l.ml_item_id is not null and l.status in ('activo','pausado')) then
    perform public.ml_enqueue(v_product,'actualizar_stock');
  elsif TG_TABLE_NAME = 'products' and exists (select 1 from public.ml_listings l where l.product_id = v_product and l.sync_price and l.ml_item_id is not null and l.status in ('activo','pausado')) then
    perform public.ml_enqueue(v_product,'actualizar_precio');
  end if;
  return new;
end;
$$;
revoke all on function public.ml_sync_triggers() from public,anon,authenticated;
drop trigger if exists ml_sync_stock on public.product_variants;
create trigger ml_sync_stock after update of stock on public.product_variants for each row when (old.stock is distinct from new.stock) execute function public.ml_sync_triggers();
drop trigger if exists ml_sync_price on public.products;
create trigger ml_sync_price after update of price,discount_percent on public.products for each row execute function public.ml_sync_triggers();

-- Panel: preparar publicaciones (se pueden dejar listas como borrador aunque Mercado Libre aún no esté conectado).
create or replace function public.ml_admin_prepare(p_product_ids uuid[],p_publish boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not public.has_role('admin') then raise exception 'Solo administración.'; end if;
  insert into public.ml_listings (product_id,ml_category_id)
  select p.id,m.ml_category_id from public.products p left join public.ml_category_map m on m.category_id = p.category_id
  where p.id = any(p_product_ids) and p.is_active and not p.vip_only
  on conflict (product_id) do nothing;
  get diagnostics v_count = row_count;
  if p_publish then
    if not public.ml_enabled() then raise exception 'Mercado Libre aún no está conectado: las publicaciones quedan como borrador.'; end if;
    update public.ml_listings set status = 'pendiente',updated_at = now() where product_id = any(p_product_ids) and ml_item_id is null and status in ('borrador','error');
    insert into public.sync_queue (action,product_id)
    select 'publicar',l.product_id from public.ml_listings l where l.product_id = any(p_product_ids) and l.ml_item_id is null and l.status = 'pendiente'
      and not exists (select 1 from public.sync_queue q where q.product_id = l.product_id and q.action = 'publicar' and q.status = 'pendiente');
  end if;
  return v_count;
end;
$$;
revoke all on function public.ml_admin_prepare(uuid[],boolean) from public,anon;
grant execute on function public.ml_admin_prepare(uuid[],boolean) to authenticated;

-- Venta en Mercado Libre (la llama la Edge Function ml-webhook con el service_role): descuenta el stock de MSJ una sola vez
-- y lo devuelve si la venta se cancela. Las variaciones se buscan en variation_map; si no hay, la primera variante con stock.
create or replace function public.ml_register_order(p_ml_order_id text,p_status text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.ml_orders%rowtype; v_item jsonb; v_listing public.ml_listings%rowtype; v_variant uuid; v_qty integer; v_applied integer := 0;
begin
  insert into public.ml_orders (ml_order_id,status,buyer_nickname,total,currency,items,shipping,payload,updated_at)
  values (p_ml_order_id,coalesce(p_status,''),coalesce(p_payload #>> '{buyer,nickname}',''),coalesce((p_payload ->> 'total_amount')::numeric,0),
    coalesce(p_payload ->> 'currency_id','PEN'),coalesce(p_payload -> 'order_items','[]'::jsonb),coalesce(p_payload -> 'shipping','{}'::jsonb),coalesce(p_payload,'{}'::jsonb),now())
  on conflict (ml_order_id) do update set status = excluded.status,total = excluded.total,items = excluded.items,shipping = excluded.shipping,
    payload = excluded.payload,updated_at = now()
  returning * into v_row;
  if v_row.status = 'paid' and v_row.stock_applied_at is null then
    perform set_config('msj.stock_reason','mercado_libre',true);
    for v_item in select value from jsonb_array_elements(v_row.items) loop
      select * into v_listing from public.ml_listings where ml_item_id = v_item #>> '{item,id}';
      if not found then continue; end if;
      v_qty := coalesce((v_item ->> 'quantity')::integer,1);
      v_variant := nullif(v_listing.variation_map ->> (v_item #>> '{item,variation_id}'),'')::uuid;
      if v_variant is null then
        select v.id into v_variant from public.product_variants v where v.product_id = v_listing.product_id and v.is_active order by v.stock desc limit 1;
      end if;
      update public.product_variants set stock = greatest(stock - v_qty,0) where id = v_variant;
      v_applied := v_applied + 1;
    end loop;
    update public.ml_orders set stock_applied_at = now() where ml_order_id = p_ml_order_id;
  elsif v_row.status = 'cancelled' and v_row.stock_applied_at is not null and v_row.stock_restored_at is null then
    perform set_config('msj.stock_reason','devolucion',true);
    for v_item in select value from jsonb_array_elements(v_row.items) loop
      select * into v_listing from public.ml_listings where ml_item_id = v_item #>> '{item,id}';
      if not found then continue; end if;
      v_variant := nullif(v_listing.variation_map ->> (v_item #>> '{item,variation_id}'),'')::uuid;
      if v_variant is null then
        select v.id into v_variant from public.product_variants v where v.product_id = v_listing.product_id and v.is_active order by v.stock desc limit 1;
      end if;
      update public.product_variants set stock = stock + coalesce((v_item ->> 'quantity')::integer,1) where id = v_variant;
    end loop;
    update public.ml_orders set stock_restored_at = now() where ml_order_id = p_ml_order_id;
  end if;
  perform set_config('msj.stock_reason','',true);
  return jsonb_build_object('order',p_ml_order_id,'status',v_row.status,'items_applied',v_applied);
end;
$$;
revoke all on function public.ml_register_order(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ml_register_order(text,text,jsonb) to service_role;

-- ---------- Mercado Pago: aplicar el resultado de un pago (lo llama la Edge Function mp-webhook) ----------
-- approved → pagado + confirmado (emite comprobante, suma puntos y avisa) · rejected → el cliente puede reintentar
-- refunded/charged_back → reembolsado. Verifica que el monto y la moneda coincidan con el pedido.
create or replace function public.mp_apply_payment(p_order uuid,p_payment_id text,p_status text,p_status_detail text,p_amount numeric,p_currency text,p_method text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_pay_status text; v_missing text;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then return jsonb_build_object('ok',false,'reason','pedido_no_encontrado'); end if;
  if v_order.payment_method <> 'mercado_pago' then return jsonb_build_object('ok',false,'reason','no_es_mercado_pago'); end if;
  v_pay_status := case when p_status = 'approved' then 'paid' when p_status in ('refunded','charged_back') then 'refunded'
                       when p_status in ('rejected','cancelled') then 'failed' else 'pending' end;
  insert into public.payments (order_id,provider,provider_reference,amount,status)
  values (p_order,'mercado_pago',p_payment_id,coalesce(p_amount,0),v_pay_status)
  on conflict (provider_reference) where provider = 'mercado_pago' do update set status = excluded.status,amount = excluded.amount;

  if p_status = 'approved' then
    if coalesce(p_currency,'PEN') <> 'PEN' or abs(coalesce(p_amount,0) - v_order.total) > 0.01 then
      update public.orders set pago_rechazo_motivo = left('Mercado Pago aprobó ' || coalesce(p_currency,'') || ' ' || coalesce(p_amount,0) || ' pero el pedido es de S/ ' || v_order.total || '. Revisar.',300)
      where id = p_order;
      return jsonb_build_object('ok',false,'reason','monto_no_coincide');
    end if;
    if v_order.payment_status = 'paid' then return jsonb_build_object('ok',true,'reason','ya_pagado'); end if;
    if v_order.status = 'cancelled' then
      -- Llegó el pago después del vencimiento: se reactiva si aún hay stock; si no, queda para reembolso.
      select string_agg(oi.product_name,', ') into v_missing
      from (select variant_id,product_name,sum(quantity) as qty from public.order_items where order_id = p_order and variant_id is not null group by variant_id,product_name) oi
      join public.product_variants v on v.id = oi.variant_id where v.stock < oi.qty;
      if v_missing is not null then
        update public.orders set payment_status = 'paid',mp_payment_id = p_payment_id,
          pago_rechazo_motivo = left('Pago recibido después de cancelar y sin stock (' || v_missing || '): reembolsar desde Mercado Pago.',300)
        where id = p_order;
        return jsonb_build_object('ok',false,'reason','pagado_sin_stock_reembolsar');
      end if;
      perform set_config('msj.stock_reason','venta',true);
      update public.product_variants v set stock = v.stock - i.qty
      from (select variant_id,sum(quantity)::integer as qty from public.order_items where order_id = p_order and variant_id is not null group by variant_id) i
      where v.id = i.variant_id;
      update public.orders set status = 'pending',stock_restored_at = null where id = p_order;
    end if;
    update public.orders set payment_status = 'paid',mp_payment_id = p_payment_id,pago_rechazo_motivo = null,
      yape_operation = left(p_payment_id,40),status = case when status = 'pending' then 'confirmed' else status end
    where id = p_order;
    return jsonb_build_object('ok',true,'reason','pagado');
  elsif p_status in ('refunded','charged_back') then
    update public.orders set payment_status = 'refunded' where id = p_order and payment_status <> 'refunded';
    return jsonb_build_object('ok',true,'reason','reembolsado');
  elsif p_status in ('rejected','cancelled') then
    perform public.notify(v_order.user_id,'pago','Tu pago con Mercado Pago no se aprobó',
      'Puedes intentarlo otra vez desde Mis pedidos antes de que venza la reserva.','cuenta.html#pedidos','mp-rechazo:' || p_payment_id);
    return jsonb_build_object('ok',true,'reason','rechazado');
  end if;
  return jsonb_build_object('ok',true,'reason','en_proceso');
end;
$$;
revoke all on function public.mp_apply_payment(uuid,text,text,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.mp_apply_payment(uuid,text,text,text,numeric,text,text) to service_role;

-- Comprobante: además del titular y el equipo, lo puede leer el servidor (service_role) para enviarlo por correo
-- apenas Mercado Pago confirma el pago.
create or replace function public.comprobante_pedido(p_order uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tipo',coalesce(o.comprobante_tipo,'boleta'),'codigo',o.comprobante_serie || '-' || lpad(o.comprobante_numero::text,8,'0'),
    'emitido',o.comprobante_emitido_at,'pedido',o.id,'fecha_pedido',o.created_at,
    'cliente',coalesce(nullif(o.comprobante_nombre,''),o.recipient),'documento',coalesce(o.comprobante_doc,''),'direccion',coalesce(o.comprobante_direccion,''),
    'correo',coalesce(o.comprobante_email,(select lower(p.email) from public.profiles p where p.id = o.user_id)),'enviado',o.comprobante_enviado_at,
    'metodo',o.payment_method,'operacion',coalesce(o.yape_operation,''),
    'items',coalesce((select jsonb_agg(jsonb_build_object('producto',i.product_name,'variante',i.variant_label,'cantidad',i.quantity,'precio',i.unit_price) order by i.product_name)
      from public.order_items i where i.order_id = o.id),'[]'::jsonb),
    'subtotal',o.subtotal,'descuento',o.discount_amount + coalesce(o.promo_discount_amount,0),'envio',o.shipping_amount,
    'total',v.total,'gravada',round(v.total / 1.18,2),'igv',v.total - round(v.total / 1.18,2))
  from public.orders o cross join lateral (select o.total - coalesce(o.donation_amount,0) as total) v
  where o.id = p_order and o.comprobante_numero is not null
    and (o.user_id = auth.uid() or public.has_role('admin') or public.has_role('staff') or coalesce(auth.jwt() ->> 'role','') = 'service_role');
$$;
revoke all on function public.comprobante_pedido(uuid) from public,anon;
grant execute on function public.comprobante_pedido(uuid) to authenticated,service_role;

create or replace function public.marcar_comprobante_enviado(p_order uuid,p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.has_role('admin') or public.has_role('staff') or coalesce(auth.jwt() ->> 'role','') = 'service_role') then
    raise exception 'Solo el equipo de MSJ puede enviar comprobantes.';
  end if;
  update public.orders set comprobante_enviado_at = now(),comprobante_enviado_a = left(lower(trim(p_email)),160)
  where id = p_order and comprobante_numero is not null;
  if not found then raise exception 'El comprobante de ese pedido aún no se emitió.'; end if;
end;
$$;
revoke all on function public.marcar_comprobante_enviado(uuid,text) from public,anon;
grant execute on function public.marcar_comprobante_enviado(uuid,text) to authenticated,service_role;

-- ---------- Checkout: igual que campaigns.sql + Mercado Pago (solo si la integración está activa) ----------
create or replace function public.checkout_cart(p_items jsonb,p_payment_method text,p_address jsonb,p_coupon text default null,p_donation numeric default 0,p_yape_operation text default null,p_donation_cause text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_order_id uuid := gen_random_uuid(); v_item jsonb;
  v_variant_id uuid; v_quantity integer; v_price numeric(10,2); v_discount numeric(5,2); v_stock integer;
  v_product_name text; v_size text; v_color text; v_subtotal numeric(10,2) := 0; v_category text;
  v_zone public.shipping_zones%rowtype; v_coupon public.coupons%rowtype; v_code text := upper(nullif(trim(coalesce(p_coupon,'')),''));
  v_discount_amount numeric(10,2) := 0; v_shipping numeric(10,2) := 0;
  v_vip_pct numeric := 0; v_vip_level text; v_vip_saving numeric(10,2) := 0; v_public_price numeric(10,2); v_vip_only boolean;
  v_promo public.promotions%rowtype; v_units numeric[] := '{}'; v_promo_amount numeric(10,2) := 0;
  v_donation numeric(10,2) := round(coalesce(p_donation,0),2); v_yape text := nullif(regexp_replace(coalesce(p_yape_operation,''),'\D','','g'),'');
  v_total numeric(10,2); v_mp boolean := p_payment_method = 'mercado_pago';
  v_mp_minutes integer := greatest(30,least(coalesce((public.setting('automation') ->> 'mp_payment_minutes')::integer,120),2880));
begin
  if v_user_id is null then raise exception 'Inicia sesión para crear un pedido.'; end if;
  if not public.is_active_user() then raise exception 'La cuenta está deshabilitada.'; end if;
  v_vip_pct := public.vip_discount_percent(v_user_id);
  if v_vip_pct > 0 then select nivel_vip into v_vip_level from public.profiles where id = v_user_id; end if;
  if p_payment_method not in ('cash_on_delivery','yape','lemon','mercado_pago') then raise exception 'Método de pago no disponible.'; end if;
  if v_mp and not exists (select 1 from public.integrations where provider = 'mercado_pago' and enabled) then
    raise exception 'Mercado Pago aún no está disponible. Elige otro método de pago.';
  end if;
  if p_payment_method in ('yape','lemon') and (v_yape is null or char_length(v_yape) not between 4 and 12) then raise exception 'Ingresa el número de operación de tu pago.'; end if;
  if p_payment_method in ('yape','lemon') and exists (select 1 from public.payments where provider = p_payment_method and provider_reference = v_yape and status <> 'failed') then raise exception 'Ese número de operación ya fue registrado.'; end if;
  if v_mp then v_yape := null; end if;
  if v_donation < 0 or v_donation > 100 then raise exception 'La donación debe estar entre S/ 0 y S/ 100.'; end if;
  if v_donation > 0 and coalesce(p_donation_cause,'el-nino') not in ('el-nino','cancer','arboles','friaje','educacion') then raise exception 'Causa solidaria no válida.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La bolsa está vacía.'; end if;
  if coalesce(p_address ->> 'recipient','') = '' or coalesce(p_address ->> 'address','') = '' or coalesce(p_address ->> 'city','') = '' then raise exception 'Completa los datos de entrega.'; end if;
  if char_length(regexp_replace(coalesce(p_address ->> 'phone',''),'\D','','g')) < 9 then raise exception 'Escribe un celular de contacto (9 dígitos).'; end if;
  if char_length(p_address ->> 'recipient') > 120 or char_length(p_address ->> 'address') > 300 or char_length(p_address ->> 'city') > 80 or char_length(coalesce(p_address ->> 'phone','')) > 30 then raise exception 'Los datos de entrega son demasiado largos.'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Demasiados artículos en un pedido.'; end if;
  select * into v_promo from public.active_promotion();
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item ->> 'variant_id')::uuid; v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 20 then raise exception 'Cantidad invalida.'; end if;
    select coalesce(v.price,p.price),p.discount_percent,v.stock,p.name,v.size,v.color,p.vip_only,c.slug into v_price,v_discount,v_stock,v_product_name,v_size,v_color,v_vip_only,v_category
      from public.product_variants v join public.products p on p.id = v.product_id left join public.categories c on c.id = p.category_id
      where v.id = v_variant_id and v.is_active and p.is_active for update of v;
    if not found then raise exception 'Variante no disponible.'; end if;
    if v_vip_only and v_vip_pct = 0 then raise exception '% es exclusiva para socios MSJ Privilège.',v_product_name; end if;
    if v_stock < v_quantity then raise exception 'Stock insuficiente para %.',v_product_name; end if;
    v_public_price := round(v_price * (1 - v_discount / 100),2);
    v_price := round(v_price * (1 - greatest(v_discount,v_vip_pct) / 100),2);
    v_vip_saving := v_vip_saving + ((v_public_price - v_price) * v_quantity);
    v_subtotal := v_subtotal + (v_price * v_quantity);
    if v_promo.id is not null and (v_promo.category_slugs is null or v_category = any(v_promo.category_slugs)) then
      v_units := v_units || array_fill(v_price,array[v_quantity]);
    end if;
  end loop;
  if v_promo.kind = '2x1' then
    select coalesce(sum(u),0) into v_promo_amount from (select u,row_number() over (order by u desc) as n from unnest(v_units) as u) s where n % 2 = 0;
  elsif v_promo.kind = 'percent' then
    select round(coalesce(sum(u),0) * v_promo.discount_value / 100,2) into v_promo_amount from unnest(v_units) as u;
  end if;
  if nullif(p_address ->> 'zone_id','') is not null then
    select * into v_zone from public.shipping_zones where id = (p_address ->> 'zone_id')::uuid and is_active;
    if not found then raise exception 'La zona de envío no está disponible.'; end if;
  elsif exists (select 1 from public.shipping_zones where is_active) then
    raise exception 'Selecciona la zona de envío.';
  end if;
  if v_code is not null then
    select * into v_coupon from public.coupons where code = v_code for update;
    if not found or not v_coupon.is_active or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
      or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) or (v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses)
      or (v_coupon.owner_id is not null and v_coupon.owner_id <> v_user_id) then
      raise exception 'El cupón no es válido o ya venció.';
    end if;
    if v_subtotal - v_promo_amount < v_coupon.min_subtotal then raise exception 'El cupón requiere una compra mínima de S/ %.',v_coupon.min_subtotal; end if;
    if v_coupon.once_per_customer and exists (select 1 from public.orders o where o.user_id = v_user_id and o.coupon_code = v_code and o.status <> 'cancelled') then
      raise exception 'Ya usaste este cupón.';
    end if;
    v_discount_amount := case when v_coupon.discount_type = 'percent' then round((v_subtotal - v_promo_amount) * v_coupon.discount_value / 100,2) else least(v_coupon.discount_value,v_subtotal - v_promo_amount) end;
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;
  if v_zone.id is not null then
    v_shipping := case when v_vip_level = 'black' or (v_vip_level = 'gold' and v_zone.vip_gold_free) then 0
      when v_zone.free_from is not null and (v_subtotal - v_promo_amount - v_discount_amount) >= v_zone.free_from then 0 else v_zone.cost end;
  end if;
  v_total := v_subtotal - v_promo_amount - v_discount_amount + v_shipping + v_donation;
  perform set_config('msj.stock_reason','venta',true);
  insert into public.orders (id,user_id,payment_method,payment_status,recipient,shipping_address,city,phone,subtotal,discount_amount,coupon_code,shipping_zone_id,shipping_amount,total,nivel_vip,vip_discount_amount,promo_code,promo_discount_amount,donation_amount,yape_operation,donation_cause,payment_expires_at)
  values (v_order_id,v_user_id,p_payment_method,case when p_payment_method in ('yape','lemon','mercado_pago') then 'pending' else 'unpaid' end,p_address ->> 'recipient',p_address ->> 'address',p_address ->> 'city',coalesce(p_address ->> 'phone',''),
    v_subtotal,v_discount_amount,v_code,v_zone.id,v_shipping,v_total,v_vip_level,v_vip_saving,case when v_promo_amount > 0 then v_promo.code end,v_promo_amount,v_donation,v_yape,case when v_donation > 0 then coalesce(p_donation_cause,'el-nino') end,
    case when v_mp then now() + make_interval(mins => v_mp_minutes) end);
  if p_payment_method in ('yape','lemon') then
    insert into public.payments (order_id,provider,provider_reference,amount,status) values (v_order_id,p_payment_method,v_yape,v_total,'pending');
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item ->> 'variant_id')::uuid; v_quantity := (v_item ->> 'quantity')::integer;
    select coalesce(v.price,p.price),p.discount_percent,p.name,v.size,v.color into v_price,v_discount,v_product_name,v_size,v_color
      from public.product_variants v join public.products p on p.id = v.product_id where v.id = v_variant_id;
    v_price := round(v_price * (1 - greatest(v_discount,v_vip_pct) / 100),2);
    insert into public.order_items (order_id,variant_id,product_name,variant_label,unit_price,quantity)
    values (v_order_id,v_variant_id,v_product_name,v_size || ' / ' || v_color,v_price,v_quantity);
    update public.product_variants set stock = stock - v_quantity where id = v_variant_id;
  end loop;
  return v_order_id;
end;
$$;
revoke all on function public.checkout_cart(jsonb,text,jsonb,text,numeric,text,text) from public;
grant execute on function public.checkout_cart(jsonb,text,jsonb,text,numeric,text,text) to authenticated;

-- =====================================================================================================================
-- 9. Motor de automatizaciones (cada 15 minutos con pg_cron, o con el botón «Ejecutar ahora» del panel)
-- =====================================================================================================================
create table if not exists public.automation_runs (
  id bigserial primary key, job text not null, affected integer not null default 0, details jsonb not null default '{}'::jsonb,
  trigger_source text not null default 'cron' check (trigger_source in ('cron','panel')), ran_at timestamptz not null default now()
);
create index if not exists automation_runs_ran_idx on public.automation_runs(ran_at desc);
alter table public.automation_runs enable row level security;
revoke all on public.automation_runs from public,anon,authenticated;
grant select on public.automation_runs to authenticated;
drop policy if exists automation_runs_admin on public.automation_runs;
create policy automation_runs_admin on public.automation_runs for select to authenticated using (public.has_role('admin'));

create or replace function public.run_automations()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cfg jsonb := public.setting('automation'); v_source text := case when auth.uid() is null then 'cron' else 'panel' end;
  v_expired integer := 0; v_badges integer := 0; v_vip_soon integer := 0; v_vip_off integer := 0; v_cleaned integer := 0; v_tmp integer;
  v_row record;
begin
  if auth.uid() is not null and not public.has_role('admin') then raise exception 'Solo administración.'; end if;

  -- 1) Pagos online vencidos: el pedido se cancela y el stock vuelve (trigger). 10 min de gracia por webhooks en camino.
  update public.orders set status = 'cancelled',payment_status = 'unpaid',
    pago_rechazo_motivo = 'El pago con Mercado Pago no se completó a tiempo; liberamos el stock reservado.'
  where payment_method = 'mercado_pago' and status = 'pending' and payment_status in ('pending','unpaid')
    and payment_expires_at is not null and payment_expires_at < now() - interval '10 minutes';
  get diagnostics v_expired = row_count;

  -- 2) Etiqueta «Nuevo» vence a los N días (0 = desactivado).
  if coalesce((v_cfg ->> 'new_badge_days')::integer,0) > 0 then
    update public.products set is_new = false
    where is_new and created_at < now() - make_interval(days => (v_cfg ->> 'new_badge_days')::integer);
    get diagnostics v_badges = row_count;
  end if;

  -- 3) Socios: aviso 7 días antes de vencer y cierre de membresías vencidas.
  for v_row in select id,vip_expira,nivel_vip from public.profiles where es_vip and vip_expira between now() and now() + interval '7 days' loop
    perform public.notify(v_row.id,'vip','Tu membresía Privilège vence pronto ✦',
      'Vence el ' || to_char(v_row.vip_expira at time zone 'America/Lima','DD/MM/YYYY') || '. Renuévala para conservar tus descuentos y tu diseño premium.',
      'cuenta.html#club','vip-vence:' || to_char(v_row.vip_expira,'YYYYMMDD'));
    v_vip_soon := v_vip_soon + 1;
  end loop;
  update public.profiles set es_vip = false where es_vip and vip_expira is not null and vip_expira < now();
  get diagnostics v_vip_off = row_count;

  -- 4) Limpieza: búsquedas, webhooks procesados, estados OAuth viejos y cola terminada.
  delete from public.search_log where created_at < now() - make_interval(days => greatest(30,coalesce((v_cfg ->> 'search_log_days')::integer,180)));
  get diagnostics v_tmp = row_count; v_cleaned := v_cleaned + v_tmp;
  delete from public.integration_events where status in ('procesado','ignorado') and received_at < now() - make_interval(days => greatest(15,coalesce((v_cfg ->> 'events_log_days')::integer,90)));
  get diagnostics v_tmp = row_count; v_cleaned := v_cleaned + v_tmp;
  delete from public.oauth_states where created_at < now() - interval '1 hour';
  delete from public.sync_queue where status in ('hecho','omitido') and done_at < now() - interval '30 days';
  delete from public.notifications where read_at is not null and read_at < now() - interval '120 days';

  insert into public.automation_runs (job,affected,details,trigger_source) values ('run_automations',v_expired + v_badges + v_vip_soon + v_vip_off + v_cleaned,
    jsonb_build_object('pagos_vencidos',v_expired,'etiquetas_nuevo',v_badges,'avisos_vip',v_vip_soon,'vip_cerradas',v_vip_off,'registros_limpiados',v_cleaned),v_source);
  delete from public.automation_runs where ran_at < now() - interval '60 days';
  return jsonb_build_object('pagos_vencidos',v_expired,'etiquetas_nuevo',v_badges,'avisos_vip',v_vip_soon,'vip_cerradas',v_vip_off,'registros_limpiados',v_cleaned);
end;
$$;
revoke all on function public.run_automations() from public,anon;
grant execute on function public.run_automations() to authenticated;

-- Programa la ejecución cada 15 minutos si pg_cron está disponible (Supabase → Database → Extensions → pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.unschedule(jobid) from cron.job where jobname = 'msj-automations';
    perform cron.schedule('msj-automations','*/15 * * * *','select public.run_automations()');
  end if;
exception when others then
  raise notice 'pg_cron no está disponible (%). Usa «Ejecutar ahora» en el panel o actívalo en Database → Extensions.',sqlerrm;
end $$;

-- =====================================================================================================================
-- 10. Resumen 2026 del panel (una sola llamada)
-- =====================================================================================================================
create or replace function public.admin_insights_2026()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_today timestamptz := date_trunc('day',now() at time zone 'America/Lima') at time zone 'America/Lima';
begin
  if not (public.has_role('admin') or public.has_role('staff')) then raise exception 'Solo el equipo de MSJ.'; end if;
  return jsonb_build_object(
    'ventas_hoy',(select coalesce(sum(total - coalesce(donation_amount,0)),0) from public.orders where status <> 'cancelled' and created_at >= v_today),
    'pedidos_hoy',(select count(*) from public.orders where created_at >= v_today),
    'ventas_7d',(select coalesce(sum(total - coalesce(donation_amount,0)),0) from public.orders where status <> 'cancelled' and created_at >= now() - interval '7 days'),
    'ventas_7d_previos',(select coalesce(sum(total - coalesce(donation_amount,0)),0) from public.orders where status <> 'cancelled' and created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    'ticket_promedio',(select coalesce(round(avg(total - coalesce(donation_amount,0)),2),0) from public.orders where status <> 'cancelled' and created_at >= now() - interval '30 days'),
    'pagos_por_verificar',(select count(*) from public.orders where payment_status = 'pending' and status <> 'cancelled'),
    'por_despachar',(select count(*) from public.orders where status = 'confirmed'),
    'alertas_stock',(select count(*) from public.stock_alerts where resolved_at is null),
    'agotados',(select count(*) from public.stock_alerts where resolved_at is null and kind = 'agotado'),
    'clientes_nuevos_7d',(select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'socios_activos',(select count(*) from public.profiles where es_vip and vip_expira > now()),
    'puntos_emitidos',(select coalesce(sum(points),0) from public.points_ledger where points > 0),
    'rachas_hoy',(select count(*) from public.loyalty_accounts where last_checkin = (now() at time zone 'America/Lima')::date),
    'por_dia',coalesce((select jsonb_agg(x order by x.dia) from (
      select to_char(d,'YYYY-MM-DD') as dia,coalesce((select sum(o.total - coalesce(o.donation_amount,0)) from public.orders o
        where o.status <> 'cancelled' and (o.created_at at time zone 'America/Lima')::date = d::date),0) as total
      from generate_series(((now() at time zone 'America/Lima')::date - 13)::timestamp,(now() at time zone 'America/Lima')::date::timestamp,interval '1 day') d) x),'[]'::jsonb),
    'top_productos',coalesce((select jsonb_agg(x) from (select i.product_name as nombre,sum(i.quantity) as unidades,sum(i.quantity * i.unit_price) as total
      from public.order_items i join public.orders o on o.id = i.order_id where o.status <> 'cancelled' and o.created_at >= now() - interval '30 days'
      group by i.product_name order by sum(i.quantity) desc limit 5) x),'[]'::jsonb),
    'integraciones',coalesce((select jsonb_object_agg(provider,jsonb_build_object('enabled',enabled,'status',status,'mode',mode)) from public.integrations),'{}'::jsonb),
    'ultima_automatizacion',(select jsonb_build_object('ran_at',ran_at,'details',details) from public.automation_runs order by ran_at desc limit 1));
end;
$$;
revoke all on function public.admin_insights_2026() from public,anon;
grant execute on function public.admin_insights_2026() to authenticated;

-- =====================================================================================================================
-- 11. Más vendidos reales (para las etiquetas «#1 más vendido en Polos»): solo cifras agregadas, sin datos de clientes
-- =====================================================================================================================
create or replace function public.public_bestsellers(p_days integer default 60)
returns table (product_id uuid,category_slug text,rank_in_category integer,units integer)
language sql stable security definer set search_path = '' as $$
  with sold as (
    select v.product_id,sum(i.quantity)::integer as units
    from public.order_items i join public.orders o on o.id = i.order_id join public.product_variants v on v.id = i.variant_id
    where o.status <> 'cancelled' and o.created_at >= now() - make_interval(days => greatest(7,least(coalesce(p_days,60),365)))
    group by v.product_id
  ), ranked as (
    select s.product_id,c.slug as category_slug,s.units,row_number() over (partition by c.slug order by s.units desc) as n
    from sold s join public.products p on p.id = s.product_id and p.is_active and not p.vip_only left join public.categories c on c.id = p.category_id
  )
  select product_id,category_slug,n::integer,units from ranked where n <= 3 and units >= 2 order by category_slug,n;
$$;
revoke all on function public.public_bestsellers(integer) from public;
grant execute on function public.public_bestsellers(integer) to anon,authenticated;

-- =====================================================================================================================
-- 12. Privilège «tipo Nitro»: acceso anticipado a novedades y perfil personalizado (marco, banner, efecto del nombre)
-- =====================================================================================================================
-- Acceso anticipado explícito: el panel marca hasta cuándo un producto es solo para socios (null = para todos).
alter table public.products add column if not exists early_access_until timestamptz;
alter table public.user_preferences add column if not exists profile jsonb not null default '{}'::jsonb;

-- Solo socios: marco del avatar, banner, efecto del nombre, insignia y una frase corta.
create or replace function public.save_profile_style(p_style jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_clean jsonb;
  v_frame text := coalesce(p_style ->> 'frame','ninguno'); v_banner text := coalesce(p_style ->> 'banner','champan');
  v_effect text := coalesce(p_style ->> 'name_effect','ninguno'); v_bio text := left(regexp_replace(coalesce(p_style ->> 'bio',''),'[<>`]','','g'),80);
begin
  if v_user is null then raise exception 'Inicia sesión.'; end if;
  if not public.is_vip_member() then raise exception 'El Perfil Privilège es exclusivo para socios MSJ Privilège.'; end if;
  if v_frame not in ('ninguno','oro','aurora','neon','nieve') or v_banner not in ('champan','aurora','noche','navidad')
     or v_effect not in ('ninguno','oro','arcoiris','brillo') then raise exception 'Opción de perfil no válida.'; end if;
  v_clean := jsonb_build_object('frame',v_frame,'banner',v_banner,'name_effect',v_effect,'bio',v_bio,'badge',coalesce((p_style ->> 'badge')::boolean,true));
  insert into public.user_preferences (user_id,profile,updated_at) values (v_user,v_clean,now())
  on conflict (user_id) do update set profile = excluded.profile,updated_at = now();
  return v_clean;
end;
$$;
revoke all on function public.save_profile_style(jsonb) from public,anon;
grant execute on function public.save_profile_style(jsonb) to authenticated;

create or replace function public.my_profile_style()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_vip_member() then coalesce((select u.profile from public.user_preferences u where u.user_id = auth.uid()),'{}'::jsonb) else '{}'::jsonb end;
$$;
revoke all on function public.my_profile_style() from public,anon;
grant execute on function public.my_profile_style() to authenticated;

-- Acceso anticipado: mientras early_access_until esté en el futuro, solo los socios compran ese producto. El servidor lo
-- exige aquí, antes de cualquier pedido; la tienda solo muestra la etiqueta «✦ Anticipado».
create or replace function public.early_access_blocked(p_product uuid,p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.early_access_until > now() from public.products p where p.id = p_product),false)
    and public.vip_discount_percent(p_user) = 0;
$$;
revoke all on function public.early_access_blocked(uuid,uuid) from public,anon,authenticated;

create or replace function public.check_early_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_product uuid; v_name text; v_user uuid;
begin
  select o.user_id into v_user from public.orders o where o.id = new.order_id;
  select v.product_id,p.name into v_product,v_name from public.product_variants v join public.products p on p.id = v.product_id where v.id = new.variant_id;
  if v_product is not null and public.early_access_blocked(v_product,v_user) then
    raise exception '% está en acceso anticipado para socios MSJ Privilège. Muy pronto estará disponible para todos.',v_name;
  end if;
  return new;
end;
$$;
revoke all on function public.check_early_access() from public,anon,authenticated;
-- Se valida al crear cada línea del pedido (dentro de checkout_cart, en la misma transacción: si falla, no se crea nada).
drop trigger if exists order_items_early_access on public.order_items;
create trigger order_items_early_access before insert on public.order_items for each row execute function public.check_early_access();

-- =====================================================================================================================
-- 13. Que la base de datos no crezca de más: retención de registros antiguos (configurable en store_settings.automation)
-- =====================================================================================================================
create or replace function public.purge_old_records()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cfg jsonb := public.setting('automation'); v_audit integer := 0; v_lookups integer := 0; v_movements integer := 0;
begin
  if auth.uid() is not null and not public.has_role('admin') then raise exception 'Solo administración.'; end if;
  -- Bitácora general: 2 años por defecto (evidencia de auditoría). La auditoría de seguridad es de solo anexado y no se toca.
  delete from public.audit_logs where created_at < now() - make_interval(days => greatest(365,coalesce((v_cfg ->> 'audit_log_days')::integer,730)));
  get diagnostics v_audit = row_count;
  delete from public.document_lookups where created_at < now() - interval '30 days';
  get diagnostics v_lookups = row_count;
  -- Movimientos de inventario: 3 años por defecto.
  delete from public.inventory_movements where created_at < now() - make_interval(days => greatest(365,coalesce((v_cfg ->> 'inventory_days')::integer,1095)));
  get diagnostics v_movements = row_count;
  delete from public.stock_alerts where resolved_at is not null and resolved_at < now() - interval '90 days';
  return jsonb_build_object('bitacora',v_audit,'consultas_documento',v_lookups,'movimientos',v_movements);
end;
$$;
revoke all on function public.purge_old_records() from public,anon;
grant execute on function public.purge_old_records() to authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'msj-retention';
    perform cron.schedule('msj-retention','30 4 * * 0','select public.purge_old_records()');
  end if;
exception when others then raise notice 'Retención semanal no programada: %',sqlerrm;
end $$;

-- =====================================================================================================================
-- 14. Stock en tiempo real: la tienda abierta recibe cada cambio de product_variants (Supabase Realtime respeta RLS)
-- =====================================================================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_variants') then
    execute 'alter publication supabase_realtime add table public.product_variants';
  end if;
exception when others then raise notice 'Realtime no activado para product_variants: %',sqlerrm;
end $$;

-- Fin de v2026.sql. Siguiente paso: abre admin.html → «Centro 2026» para ver automatizaciones, personalización e integraciones.
