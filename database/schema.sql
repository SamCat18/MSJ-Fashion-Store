create extension if not exists "pgcrypto";

-- Bitácora genérica para todas las tablas auditadas. Se define al inicio porque las actualizaciones de este script
-- disparan los triggers ya instalados. Lee OLD/NEW como JSONB: nunca nombra columnas que solo existen en una tabla
-- (acceder a OLD.status en una tabla sin esa columna produce el error 42703).
create or replace function public.log_audit_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end;
  v_new jsonb := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) end;
  v_row jsonb;
  v_record_id uuid;
  v_action text := TG_OP;
  v_details jsonb := jsonb_build_object('source','database_trigger');
  v_signals text[] := array['intentos_fallidos','ultimo_intento_fallido','ultimo_acceso','ultimo_dispositivo','ultima_ip'];
begin
  v_row := case when TG_OP = 'DELETE' then v_old else v_new end;
  -- Los contadores de acceso ya quedan en auditoria_seguridad; no se duplican en la bitácora general.
  if TG_OP = 'UPDATE' and TG_TABLE_NAME = 'profiles' and (v_old - v_signals) = (v_new - v_signals) then
    return NEW;
  end if;
  begin
    v_record_id := case when TG_TABLE_NAME = 'user_roles' then v_row ->> 'user_id' else coalesce(v_row ->> 'id',v_row ->> 'user_id') end::uuid;
  exception when others then
    v_record_id := null;
  end;
  if TG_OP = 'UPDATE' and v_old ? 'payment_status' and (v_old ->> 'payment_status') is distinct from (v_new ->> 'payment_status') then
    v_action := 'payment_status_updated';
    v_details := jsonb_build_object('source','database_trigger','from',v_old ->> 'payment_status','to',v_new ->> 'payment_status');
  elsif TG_OP = 'UPDATE' and TG_TABLE_NAME in ('orders','payments') and v_old ? 'status' and (v_old ->> 'status') is distinct from (v_new ->> 'status') then
    v_action := case when TG_TABLE_NAME = 'payments' then 'payment_status_updated' else 'order_status_updated' end;
    v_details := jsonb_build_object('source','database_trigger','from',v_old ->> 'status','to',v_new ->> 'status');
  end if;
  insert into public.audit_logs (actor_id,action,entity,entity_id,details)
  values ((select p.id from public.profiles p where p.id = auth.uid()),v_action,TG_TABLE_NAME,v_record_id,v_details);
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;
-- Membresía MSJ Privilège Club y señales de seguridad de la cuenta (solo las escriben funciones seguras o un administrador).
alter table public.profiles add column if not exists es_vip boolean not null default false;
alter table public.profiles add column if not exists nivel_vip text check (nivel_vip in ('gold','black'));
alter table public.profiles add column if not exists vip_expira timestamptz;
alter table public.profiles add column if not exists codigo_socio text unique;
alter table public.profiles add column if not exists intentos_fallidos integer not null default 0 check (intentos_fallidos >= 0);
alter table public.profiles add column if not exists ultimo_intento_fallido timestamptz;
alter table public.profiles add column if not exists ultimo_acceso timestamptz;
alter table public.profiles add column if not exists ultimo_dispositivo text not null default '' check (char_length(ultimo_dispositivo) <= 120);
alter table public.profiles add column if not exists ultima_ip text not null default '' check (char_length(ultima_ip) <= 64);
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique,
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), category_id uuid references public.categories(id),
  name text not null, slug text not null unique, description text not null default '', sku text not null unique,
  price numeric(10,2) not null check (price >= 0), image_url text not null default '', model_image_url text not null default '',
  audience text not null check (audience in ('Mujer','Hombre','Unisex')),
  is_new boolean not null default false, discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 90),
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.products add column if not exists is_new boolean not null default false;
alter table public.products add column if not exists discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 90);
alter table public.products add column if not exists model_image_url text not null default '';
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  size text not null, color text not null default 'Unico', price numeric(10,2) check (price >= 0),
  stock integer not null default 0 check (stock >= 0), is_active boolean not null default true,
  unique (product_id,size,color)
);
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id), quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(), unique (user_id,variant_id)
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','refunded')),
  payment_method text not null check (payment_method in ('cash_on_delivery','card')),
  recipient text not null, shipping_address text not null, city text not null,
  subtotal numeric(10,2) not null check (subtotal >= 0), shipping_amount numeric(10,2) not null default 0 check (shipping_amount >= 0),
  total numeric(10,2) not null check (total >= 0), created_at timestamptz not null default now()
);
alter table public.orders add column if not exists phone text not null default '';
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id), product_name text not null, variant_label text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0), quantity integer not null check (quantity > 0)
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null, provider_reference text, amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')), created_at timestamptz not null default now()
);
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(), role_key text not null unique, name text not null, description text not null default '',
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id), granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), primary key (user_id,role_id)
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  action text not null, entity text not null, entity_id uuid, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null,
  staff_email text not null,
  staff_name text not null default '',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('logout','timeout'))
);
create index if not exists staff_sessions_started_at_idx on public.staff_sessions(started_at desc);
create index if not exists staff_sessions_last_seen_idx on public.staff_sessions(last_seen_at desc) where ended_at is null;
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(), profile_id uuid references public.profiles(id) on delete set null,
  sender_name text not null, email text not null, message text not null check (char_length(message) between 5 and 1000),
  status text not null default 'new' check (status in ('new','in_progress','resolved')), created_at timestamptz not null default now()
);

insert into public.roles (role_key,name,description) values
  ('admin','Administrador','Gestiona catálogo, pedidos, cuentas y configuración.'),
  ('staff','Personal','Apoyo de operaciones con permisos limitados.'),
  ('customer','Cliente','Cuenta de compra.' )
on conflict (role_key) do nothing;

-- 2FA obligatorio en el servidor: si la cuenta activó un factor (TOTP), la sesión debe estar en nivel AAL2
-- (contraseña o passkey + código) para usar permisos de cliente, personal o administración.
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal','aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to anon,authenticated;

create or replace function public.has_role(p_role_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id and r.is_active
    join public.profiles p on p.id = ur.user_id and p.is_active
    where ur.user_id = auth.uid() and r.role_key = p_role_key
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;


drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update or delete on public.products for each row execute function public.log_audit_change();
drop trigger if exists audit_variants on public.product_variants;
create trigger audit_variants after insert or update or delete on public.product_variants for each row execute function public.log_audit_change();
drop trigger if exists audit_orders on public.orders;
create trigger audit_orders after insert or update or delete on public.orders for each row execute function public.log_audit_change();
drop trigger if exists audit_payments on public.payments;
create trigger audit_payments after insert or update or delete on public.payments for each row execute function public.log_audit_change();
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function public.log_audit_change();
drop trigger if exists audit_user_roles on public.user_roles;
create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.log_audit_change();
drop trigger if exists audit_contact_messages on public.contact_messages;
create trigger audit_contact_messages after insert or update or delete on public.contact_messages for each row execute function public.log_audit_change();

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,email,full_name) values (new.id,new.email,coalesce(new.raw_user_meta_data ->> 'full_name',''))
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;
  insert into public.user_roles (user_id,role_id)
  select new.id,r.id from public.roles r where r.role_key = 'customer'
  on conflict (user_id,role_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.create_profile_for_new_user();

-- ===== Catálogo ampliado y operación comercial =====
alter table public.categories add column if not exists department text not null default 'ropa';
alter table public.categories add column if not exists icon text not null default '';
alter table public.categories add column if not exists image_url text not null default '';
alter table public.categories add column if not exists sort_order integer not null default 0;
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique,
  description text not null default '', is_active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.products add column if not exists brand_id uuid references public.brands(id) on delete set null;
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, description text not null default '',
  image_url text not null default '', sort_order integer not null default 0, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0, primary key (collection_id,product_id)
);
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  url text not null check (char_length(url) <= 500), alt text not null default '' check (char_length(alt) <= 160),
  sort_order integer not null default 0, created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id,sort_order);
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, author_name text not null default '' check (char_length(author_name) <= 60),
  rating smallint not null check (rating between 1 and 5), comment text not null default '' check (char_length(comment) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')), created_at timestamptz not null default now(),
  unique (product_id,user_id)
);
create table if not exists public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id,product_id)
);
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(), code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description text not null default '' check (char_length(description) <= 200),
  discount_type text not null check (discount_type in ('percent','amount')), discount_value numeric(10,2) not null check (discount_value > 0),
  min_subtotal numeric(10,2) not null default 0 check (min_subtotal >= 0), starts_at timestamptz, ends_at timestamptz,
  max_uses integer check (max_uses > 0), used_count integer not null default 0 check (used_count >= 0),
  once_per_customer boolean not null default true, is_active boolean not null default true, created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 90)
);
create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '',
  cost numeric(10,2) not null default 0 check (cost >= 0), free_from numeric(10,2) check (free_from >= 0),
  days_min integer not null default 1 check (days_min >= 0), days_max integer not null default 3 check (days_max >= days_min),
  sort_order integer not null default 0, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Casa' check (char_length(label) <= 40), recipient text not null check (char_length(recipient) between 1 and 120),
  phone text not null default '' check (char_length(phone) <= 30), address text not null check (char_length(address) between 5 and 300),
  city text not null check (char_length(city) between 2 and 80), zone_id uuid references public.shipping_zones(id) on delete set null,
  is_default boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists customer_addresses_user_idx on public.customer_addresses(user_id);
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(), email text not null unique check (char_length(email) between 5 and 160),
  source text not null default 'footer' check (char_length(source) <= 40), consent boolean not null check (consent),
  created_at timestamptz not null default now()
);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta integer not null, stock_after integer not null, reason text not null default 'ajuste' check (reason in ('venta','ajuste','alta')),
  actor_id uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists inventory_movements_variant_idx on public.inventory_movements(variant_id,created_at desc);
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0);
alter table public.orders add column if not exists shipping_zone_id uuid references public.shipping_zones(id) on delete set null;
alter table public.orders add column if not exists nivel_vip text check (nivel_vip in ('gold','black'));
alter table public.orders add column if not exists vip_discount_amount numeric(10,2) not null default 0 check (vip_discount_amount >= 0);
-- Gold Pass: envío gratis solo en las zonas marcadas (Lima Metropolitana y Callao).
alter table public.shipping_zones add column if not exists vip_gold_free boolean not null default false;

-- Descuento de socio vigente: Gold 15 %, Black Sovereign 25 %. Debe coincidir con vipLevels en app.js.
create or replace function public.vip_discount_percent(p_user_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select case when p.es_vip and p.vip_expira > now() then case p.nivel_vip when 'black' then 25 when 'gold' then 15 else 0 end else 0 end
    from public.profiles p where p.id = p_user_id and p.is_active),0)::numeric;
$$;
revoke all on function public.vip_discount_percent(uuid) from public,anon,authenticated;
-- ¿La sesión actual es de un socio con membresía vigente? Lo usa la política del catálogo secreto.
create or replace function public.is_vip_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.vip_discount_percent(auth.uid()) > 0;
$$;
revoke all on function public.is_vip_member() from public;
grant execute on function public.is_vip_member() to anon,authenticated;
-- Catálogo secreto / Early Access: piezas que solo ven y compran los socios.
alter table public.products add column if not exists vip_only boolean not null default false;
-- Cupón personal (p. ej. el regalo mensual de socio): solo lo puede usar su titular.
alter table public.coupons add column if not exists owner_id uuid references public.profiles(id) on delete cascade;

drop function if exists public.checkout_cart(jsonb,text,jsonb);
create or replace function public.checkout_cart(p_items jsonb,p_payment_method text,p_address jsonb,p_coupon text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_order_id uuid := gen_random_uuid(); v_item jsonb;
  v_variant_id uuid; v_quantity integer; v_price numeric(10,2); v_discount numeric(5,2); v_stock integer;
  v_product_name text; v_size text; v_color text; v_subtotal numeric(10,2) := 0;
  v_zone public.shipping_zones%rowtype; v_coupon public.coupons%rowtype; v_code text := upper(nullif(trim(coalesce(p_coupon,'')),''));
  v_discount_amount numeric(10,2) := 0; v_shipping numeric(10,2) := 0;
  v_vip_pct numeric := 0; v_vip_level text; v_vip_saving numeric(10,2) := 0; v_public_price numeric(10,2); v_vip_only boolean;
begin
  if v_user_id is null then raise exception 'Inicia sesión para crear un pedido.'; end if;
  if not public.is_active_user() then raise exception 'La cuenta está deshabilitada.'; end if;
  v_vip_pct := public.vip_discount_percent(v_user_id);
  if v_vip_pct > 0 then select nivel_vip into v_vip_level from public.profiles where id = v_user_id; end if;
  if p_payment_method <> 'cash_on_delivery' then raise exception 'Método de pago no disponible.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La bolsa está vacía.'; end if;
  if coalesce(p_address ->> 'recipient','') = '' or coalesce(p_address ->> 'address','') = '' or coalesce(p_address ->> 'city','') = '' then raise exception 'Completa los datos de entrega.'; end if;
  if char_length(p_address ->> 'recipient') > 120 or char_length(p_address ->> 'address') > 300 or char_length(p_address ->> 'city') > 80 or char_length(coalesce(p_address ->> 'phone','')) > 30 then raise exception 'Los datos de entrega son demasiado largos.'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Demasiados artículos en un pedido.'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item ->> 'variant_id')::uuid; v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 20 then raise exception 'Cantidad invalida.'; end if;
    select coalesce(v.price,p.price),p.discount_percent,v.stock,p.name,v.size,v.color,p.vip_only into v_price,v_discount,v_stock,v_product_name,v_size,v_color,v_vip_only
      from public.product_variants v join public.products p on p.id = v.product_id
      where v.id = v_variant_id and v.is_active and p.is_active for update of v;
    if not found then raise exception 'Variante no disponible.'; end if;
    if v_vip_only and v_vip_pct = 0 then raise exception '% es exclusiva para socios MSJ Privilège.',v_product_name; end if;
    if v_stock < v_quantity then raise exception 'Stock insuficiente para %.',v_product_name; end if;
    -- Sin acumulación: se aplica el mayor entre el descuento de oferta y el de socio.
    v_public_price := round(v_price * (1 - v_discount / 100),2);
    v_price := round(v_price * (1 - greatest(v_discount,v_vip_pct) / 100),2);
    v_vip_saving := v_vip_saving + ((v_public_price - v_price) * v_quantity);
    v_subtotal := v_subtotal + (v_price * v_quantity);
  end loop;
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
    if v_subtotal < v_coupon.min_subtotal then raise exception 'El cupón requiere una compra mínima de S/ %.',v_coupon.min_subtotal; end if;
    if v_coupon.once_per_customer and exists (select 1 from public.orders o where o.user_id = v_user_id and o.coupon_code = v_code and o.status <> 'cancelled') then
      raise exception 'Ya usaste este cupón.';
    end if;
    v_discount_amount := case when v_coupon.discount_type = 'percent' then round(v_subtotal * v_coupon.discount_value / 100,2) else least(v_coupon.discount_value,v_subtotal) end;
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;
  if v_zone.id is not null then
    v_shipping := case when v_vip_level = 'black' or (v_vip_level = 'gold' and v_zone.vip_gold_free) then 0
      when v_zone.free_from is not null and (v_subtotal - v_discount_amount) >= v_zone.free_from then 0 else v_zone.cost end;
  end if;
  perform set_config('msj.stock_reason','venta',true);
  insert into public.orders (id,user_id,payment_method,recipient,shipping_address,city,phone,subtotal,discount_amount,coupon_code,shipping_zone_id,shipping_amount,total,nivel_vip,vip_discount_amount)
  values (v_order_id,v_user_id,p_payment_method,p_address ->> 'recipient',p_address ->> 'address',p_address ->> 'city',coalesce(p_address ->> 'phone',''),
    v_subtotal,v_discount_amount,v_code,v_zone.id,v_shipping,v_subtotal - v_discount_amount + v_shipping,v_vip_level,v_vip_saving);
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

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.contact_messages enable row level security;
revoke all on public.staff_sessions from public,anon,authenticated;
grant all on public.staff_sessions to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()) and is_active);
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles for select to authenticated using (public.has_role('admin'));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists categories_read_active on public.categories;
create policy categories_read_active on public.categories for select to anon,authenticated using (is_active);
drop policy if exists products_read_active on public.products;
create policy products_read_active on public.products for select to anon,authenticated using (is_active and (not vip_only or public.is_vip_member()));
drop policy if exists variants_read_active on public.product_variants;
create policy variants_read_active on public.product_variants for select to anon,authenticated using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active));
drop policy if exists cart_select_own on public.cart_items;
create policy cart_select_own on public.cart_items for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
drop policy if exists cart_insert_own on public.cart_items;
create policy cart_insert_own on public.cart_items for insert to authenticated with check (user_id = (select auth.uid()) and public.is_active_user());
drop policy if exists cart_update_own on public.cart_items;
create policy cart_update_own on public.cart_items for update to authenticated using (user_id = (select auth.uid()) and public.is_active_user()) with check (user_id = (select auth.uid()) and public.is_active_user());
drop policy if exists cart_delete_own on public.cart_items;
create policy cart_delete_own on public.cart_items for delete to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders for select to authenticated using (user_id = (select auth.uid()) and public.is_active_user());
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own on public.order_items for select to authenticated using (public.is_active_user() and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select to authenticated using (public.is_active_user() and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage on public.products for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists categories_admin_manage on public.categories;
create policy categories_admin_manage on public.categories for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists variants_admin_manage on public.product_variants;
create policy variants_admin_manage on public.product_variants for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists orders_admin_read on public.orders;
create policy orders_admin_read on public.orders for select to authenticated using (public.has_role('admin'));
drop policy if exists orders_staff_read on public.orders;
create policy orders_staff_read on public.orders for select to authenticated using (public.has_role('staff'));
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders for update to authenticated using (public.has_role('staff')) with check (public.has_role('staff'));
drop policy if exists roles_admin_read on public.roles;
create policy roles_admin_read on public.roles for select to authenticated using (public.has_role('admin'));
drop policy if exists roles_read_self on public.roles;
create policy roles_read_self on public.roles for select to authenticated using (exists (select 1 from public.user_roles ur where ur.role_id = id and ur.user_id = (select auth.uid())));
drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists user_roles_admin_manage on public.user_roles;
create policy user_roles_admin_manage on public.user_roles for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.has_role('admin'));
drop policy if exists contact_messages_public_insert on public.contact_messages;
create policy contact_messages_public_insert on public.contact_messages for insert to anon,authenticated with check (
  char_length(message) between 5 and 1000 and char_length(sender_name) between 1 and 100 and char_length(email) between 3 and 160
  and status = 'new' and (profile_id is null or profile_id = (select auth.uid()))
);
drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages for select to authenticated using (public.has_role('admin'));
drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update on public.contact_messages for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

grant select on public.categories,public.products,public.product_variants to anon,authenticated;
grant select on public.profiles,public.order_items,public.payments,public.roles,public.user_roles,public.audit_logs,public.contact_messages to authenticated;
revoke all on public.orders from public,anon,authenticated;
grant select (id,user_id,status,payment_status,payment_method,recipient,shipping_address,phone,city,subtotal,discount_amount,coupon_code,shipping_zone_id,shipping_amount,total,created_at,nivel_vip,vip_discount_amount) on public.orders to authenticated;
grant update (status,payment_status) on public.orders to authenticated;
grant insert on public.contact_messages to anon,authenticated;
grant update on public.contact_messages to authenticated;
grant select,insert,update,delete on public.cart_items to authenticated;
grant insert,update,delete on public.products,public.categories,public.product_variants,public.profiles,public.user_roles to authenticated;
revoke all on function public.has_role(text) from public;
grant execute on function public.has_role(text) to authenticated;
revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to authenticated;
revoke all on function public.create_profile_for_new_user() from public,anon,authenticated;
revoke all on function public.log_audit_change() from public,anon,authenticated;
revoke all on function public.checkout_cart(jsonb,text,jsonb,text) from public;
grant execute on function public.checkout_cart(jsonb,text,jsonb,text) to authenticated;

insert into public.categories (name,slug) values ('Mujer','mujer'),('Hombre','hombre'),('Unisex','unisex'),('Camisas','camisas'),('Poleras','poleras'),('Chompas','chompas'),('Abrigos','abrigos'),('Zapatos','zapatos'),('Accesorios','accesorios'),('Perfumes','perfumes') on conflict (slug) do nothing;
insert into public.products (category_id,name,slug,description,sku,price,image_url,audience) values
 ((select id from public.categories where slug='unisex'),'Camisa Nube','camisa-nube','Algodon ligero y corte relajado para todos los dias.','FOR-CAM-001',34.90,'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='mujer'),'Pantalon Trazo','pantalon-trazo','Silueta amplia y caida fluida, facil de combinar.','FOR-PAN-001',49.90,'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='hombre'),'Chaqueta Norte','chaqueta-norte','Una capa ligera, funcional y de lineas limpias.','FOR-CHA-001',79.00,'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=80','Hombre'),
 ((select id from public.categories where slug='unisex'),'Sueter Punto','sueter-punto','Punto comodo y calido con acabado atemporal.','FOR-SUE-001',58.00,'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='mujer'),'Vestido Brisa','vestido-brisa','Una prenda fresca de movimiento natural.','FOR-VES-001',64.50,'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='hombre'),'Camiseta Base','camiseta-base','Algodon diario con corte sencillo y versatil.','FOR-CAM-002',24.00,'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80','Hombre'),
 ((select id from public.categories where slug='accesorios'),'Lentes Sol MSJ','lentes-sol-msj','Lentes de sol de diseno clasico para completar tu look.','FOR-ACC-001',69.00,'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='perfumes'),'Perfume Noir','perfume-noir','Una fragancia intensa para cada ocasion.','FOR-PER-001',199.00,'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='mujer'),'Top Alba','top-alba','Una base versatil de tacto suave y forma sencilla.','FOR-TOP-001',29.00,'https://images.unsplash.com/photo-1551163943-3f6a855d1153?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='accesorios'),'Bolso Linea','bolso-linea','Un bolso compacto con espacio para lo esencial.','FOR-BOL-001',42.00,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='hombre'),'Polo Clasico Premium','polo-clasico-premium','Polo de algodon suave con corte clasico.','FOR-POL-001',89.00,'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80','Hombre'),
 ((select id from public.categories where slug='mujer'),'Vestido Elegante','vestido-elegante','Una silueta elegante y comoda para ocasiones especiales.','FOR-VES-002',149.00,'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='zapatos'),'Zapatillas Urbanas','zapatillas-urbanas','Zapatillas comodas para acompanarte por toda la ciudad.','FOR-ZAP-001',129.00,'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='zapatos'),'Tacones Aura','tacones-aura','Un diseno versatil que suma elegancia a cada conjunto.','FOR-ZAP-002',169.00,'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='accesorios'),'Gorra MSJ Classic','gorra-msj-classic','Gorra de perfil clasico para completar tu look casual.','FOR-ACC-002',49.00,'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='accesorios'),'Mochila Urbana','mochila-urbana','Espacio y estilo para llevar lo esencial contigo.','FOR-ACC-003',99.00,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='camisas'),'Camisa Oxford','camisa-oxford','Camisa de algodon de tacto suave con cuello clasico.','FOR-CAM-003',89.00,'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=80','Hombre'),
 ((select id from public.categories where slug='camisas'),'Camisa Lino','camisa-lino','Lino ligero y fresco para dias calidos.','FOR-CAM-004',95.00,'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='poleras'),'Polera Crew','polera-crew','Polera suave de corte relajado para usar en capas.','FOR-POL-002',79.00,'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80','Hombre'),
 ((select id from public.categories where slug='poleras'),'Polera Crop','polera-crop','Un basico comodo con silueta corta y moderna.','FOR-POL-003',75.00,'https://images.unsplash.com/photo-1578681994506-b8f463449011?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='chompas'),'Chompa Trenzada','chompa-trenzada','Tejido calido de punto con textura trenzada.','FOR-CHO-001',139.00,'https://images.unsplash.com/photo-1610652492500-ded49ceeb378?auto=format&fit=crop&w=900&q=80','Hombre'),
 ((select id from public.categories where slug='chompas'),'Chompa Suave','chompa-suave','Punto ligero y comodo para los dias frescos.','FOR-CHO-002',129.00,'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='abrigos'),'Abrigo Pano','abrigo-pano','Abrigo de lineas limpias para la temporada.','FOR-ABR-001',249.00,'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='abrigos'),'Abrigo Urbano','abrigo-urbano','Una capa versatil con espacio para combinar.','FOR-ABR-002',269.00,'https://images.unsplash.com/photo-1544923246-77307dd654cb?auto=format&fit=crop&w=900&q=80','Hombre'),
 ((select id from public.categories where slug='perfumes'),'Perfume Velvet Rose','perfume-velvet-rose','Notas florales suaves con un fondo calido.','FOR-PER-002',179.00,'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='perfumes'),'Perfume Citrus Bloom','perfume-citrus-bloom','Una fragancia fresca con notas citricas luminosas.','FOR-PER-003',159.00,'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='perfumes'),'Perfume Oud Night','perfume-oud-night','Aroma profundo y especiado para la noche.','FOR-PER-004',229.00,'https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='perfumes'),'Perfume Aqua Fresh','perfume-aqua-fresh','Notas limpias y frescas para todos los dias.','FOR-PER-005',149.00,'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='perfumes'),'Perfume Amber Musk','perfume-amber-musk','Una combinacion envolvente de ambar y almizcle.','FOR-PER-006',189.00,'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='perfumes'),'Perfume Blue Cedar','perfume-blue-cedar','Maderas frescas y notas aromaticas para cada ocasion.','FOR-PER-007',209.00,'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='accesorios'),'Billetera Essential','billetera-essential','Billetera compacta con espacio para tarjetas y efectivo.','FOR-ACC-004',59.00,'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='accesorios'),'Cinturon Clasico','cinturon-clasico','Un basico versatil con acabado sobrio.','FOR-ACC-005',55.00,'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=80','Unisex'),
 ((select id from public.categories where slug='accesorios'),'Collar Dorado','collar-dorado','Un detalle delicado para sumar brillo a tu conjunto.','FOR-ACC-006',45.00,'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=80','Mujer'),
 ((select id from public.categories where slug='accesorios'),'Aretes Minimal','aretes-minimal','Aretes ligeros de diseno minimalista.','FOR-ACC-007',35.00,'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=80','Mujer')
on conflict (slug) do nothing;
update public.products set is_new=true where slug in ('camisa-oxford','camisa-lino','polera-crop','chompa-suave','abrigo-urbano','perfume-velvet-rose','perfume-oud-night','perfume-amber-musk');
update public.products set discount_percent=15 where slug='polera-crew';
update public.products set discount_percent=10 where slug in ('chompa-trenzada','billetera-essential');
update public.products set discount_percent=20 where slug='abrigo-pano';
update public.products set discount_percent=12 where slug='perfume-citrus-bloom';
insert into public.product_variants (product_id,size,stock) select p.id,s.size,10 from public.products p cross join (values ('S'),('M'),('L'),('XL')) as s(size) where p.slug in ('camisa-nube','chaqueta-norte','sueter-punto','camiseta-base','polo-clasico-premium') on conflict (product_id,size,color) do nothing;
insert into public.product_variants (product_id,size,stock) select p.id,s.size,10 from public.products p cross join (values ('XS'),('S'),('M'),('L')) as s(size) where p.slug in ('pantalon-trazo','vestido-brisa','vestido-elegante','top-alba') on conflict (product_id,size,color) do nothing;
insert into public.product_variants (product_id,size,stock) select p.id,s.size,10 from public.products p cross join (values ('36'),('37'),('38'),('39'),('40'),('41'),('42'),('43'),('44')) as s(size) where p.slug='zapatillas-urbanas' on conflict (product_id,size,color) do nothing;
insert into public.product_variants (product_id,size,stock) select p.id,s.size,10 from public.products p cross join (values ('36'),('37'),('38'),('39'),('40')) as s(size) where p.slug='tacones-aura' on conflict (product_id,size,color) do nothing;
insert into public.product_variants (product_id,size,stock) select p.id,s.size,10 from public.products p cross join (values ('S'),('M'),('L'),('XL')) as s(size) where p.slug in ('camisa-oxford','polera-crew','chompa-trenzada','abrigo-urbano') on conflict (product_id,size,color) do nothing;
insert into public.product_variants (product_id,size,stock) select p.id,s.size,10 from public.products p cross join (values ('XS'),('S'),('M'),('L')) as s(size) where p.slug in ('camisa-lino','polera-crop','chompa-suave','abrigo-pano') on conflict (product_id,size,color) do nothing;
insert into public.product_variants (product_id,size,stock) select p.id,'Unica',10 from public.products p where p.slug in ('perfume-velvet-rose','perfume-citrus-bloom','perfume-oud-night','perfume-aqua-fresh','perfume-amber-musk','perfume-blue-cedar','billetera-essential','collar-dorado','aretes-minimal') on conflict (product_id,size,color) do nothing;
insert into public.product_variants (product_id,size,stock) select p.id,s.size,10 from public.products p cross join (values ('S'),('M'),('L')) as s(size) where p.slug='cinturon-clasico' on conflict (product_id,size,color) do nothing;
insert into public.product_variants (product_id,size,stock) select p.id,'Unica',10 from public.products p where p.slug in ('bolso-linea','lentes-sol-msj','perfume-noir','gorra-msj-classic','mochila-urbana') on conflict (product_id,size,color) do nothing;

-- Cambio de rol atómico: reemplaza el rol en una sola transacción y protege al último administrador activo.
create or replace function public.admin_set_user_role(p_user_id uuid,p_role_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role_id uuid;
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  select id into v_role_id from public.roles where role_key = p_role_key and is_active;
  if v_role_id is null then raise exception 'El rol seleccionado no existe o está inactivo.'; end if;
  if p_role_key <> 'admin'
    and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p_user_id and r.role_key = 'admin')
    and (select count(distinct ur.user_id) from public.user_roles ur
         join public.roles r on r.id = ur.role_id and r.role_key = 'admin' and r.is_active
         join public.profiles p on p.id = ur.user_id and p.is_active) <= 1 then
    raise exception 'No se puede quitar el rol al último administrador activo.';
  end if;
  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles (user_id,role_id,granted_by) values (p_user_id,v_role_id,auth.uid());
end;
$$;
revoke all on function public.admin_set_user_role(uuid,text) from public,anon;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;

-- Libro de Reclamaciones virtual (Código de Protección y Defensa del Consumidor, Perú).
create sequence if not exists public.complaint_number_seq;
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('LR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.complaint_number_seq')::text,6,'0')),
  kind text not null check (kind in ('reclamo','queja')),
  consumer_name text not null check (char_length(consumer_name) between 2 and 120),
  document_type text not null check (document_type in ('DNI','CE','Pasaporte','RUC')),
  document_number text not null check (char_length(document_number) between 6 and 20),
  address text not null check (char_length(address) between 5 and 300),
  phone text not null default '' check (char_length(phone) <= 30),
  email text not null check (char_length(email) between 5 and 160),
  guardian_name text not null default '' check (char_length(guardian_name) <= 120),
  item_type text not null check (item_type in ('producto','servicio')),
  item_description text not null check (char_length(item_description) between 3 and 300),
  amount numeric(10,2) check (amount >= 0),
  order_reference text not null default '' check (char_length(order_reference) <= 40),
  detail text not null check (char_length(detail) between 10 and 2000),
  consumer_request text not null check (char_length(consumer_request) between 5 and 1000),
  status text not null default 'new' check (status in ('new','in_progress','answered')),
  provider_response text not null default '' check (char_length(provider_response) <= 3000),
  responded_at timestamptz,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists complaints_created_at_idx on public.complaints(created_at desc);
alter table public.complaints enable row level security;
revoke all on public.complaints from public,anon,authenticated;
grant select on public.complaints to authenticated;
grant update (status,provider_response,responded_at) on public.complaints to authenticated;
drop policy if exists complaints_admin_read on public.complaints;
create policy complaints_admin_read on public.complaints for select to authenticated using (public.has_role('admin'));
drop policy if exists complaints_admin_update on public.complaints;
create policy complaints_admin_update on public.complaints for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop trigger if exists audit_complaints on public.complaints;
create trigger audit_complaints after insert or update or delete on public.complaints for each row execute function public.log_audit_change();

-- El público registra la hoja mediante esta función, que devuelve el código para su constancia.
create or replace function public.submit_complaint(p_data jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_amount numeric(10,2);
begin
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Datos no válidos.'; end if;
  if coalesce(p_data ->> 'accepted','') <> 'true' then raise exception 'Debes aceptar el tratamiento de datos.'; end if;
  if coalesce(p_data ->> 'email','') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Correo no válido.'; end if;
  begin
    v_amount := nullif(p_data ->> 'amount','')::numeric;
  exception when others then
    raise exception 'Monto no válido.';
  end;
  insert into public.complaints (kind,consumer_name,document_type,document_number,address,phone,email,guardian_name,item_type,item_description,amount,order_reference,detail,consumer_request,profile_id)
  values (p_data ->> 'kind',trim(p_data ->> 'consumer_name'),p_data ->> 'document_type',trim(p_data ->> 'document_number'),trim(p_data ->> 'address'),
    trim(coalesce(p_data ->> 'phone','')),lower(trim(p_data ->> 'email')),trim(coalesce(p_data ->> 'guardian_name','')),p_data ->> 'item_type',
    trim(p_data ->> 'item_description'),v_amount,trim(coalesce(p_data ->> 'order_reference','')),trim(p_data ->> 'detail'),trim(p_data ->> 'consumer_request'),auth.uid())
  returning code into v_code;
  return v_code;
end;
$$;
revoke all on function public.submit_complaint(jsonb) from public;
grant execute on function public.submit_complaint(jsonb) to anon,authenticated;

-- ===== Seguridad de las tablas del catálogo ampliado =====
alter table public.brands enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_reviews enable row level security;
alter table public.wishlists enable row level security;
alter table public.coupons enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists brands_read_active on public.brands;
create policy brands_read_active on public.brands for select to anon,authenticated using (is_active or public.has_role('admin'));
drop policy if exists brands_admin_manage on public.brands;
create policy brands_admin_manage on public.brands for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists collections_read_active on public.collections;
create policy collections_read_active on public.collections for select to anon,authenticated using (is_active or public.has_role('admin'));
drop policy if exists collections_admin_manage on public.collections;
create policy collections_admin_manage on public.collections for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists collection_products_read on public.collection_products;
create policy collection_products_read on public.collection_products for select to anon,authenticated using (true);
drop policy if exists collection_products_admin_manage on public.collection_products;
create policy collection_products_admin_manage on public.collection_products for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists product_images_read on public.product_images;
create policy product_images_read on public.product_images for select to anon,authenticated using (true);
drop policy if exists product_images_admin_manage on public.product_images;
create policy product_images_admin_manage on public.product_images for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists reviews_read on public.product_reviews;
create policy reviews_read on public.product_reviews for select to authenticated using (status = 'approved' or user_id = (select auth.uid()) or public.has_role('admin'));
drop policy if exists reviews_read_public on public.product_reviews;
create policy reviews_read_public on public.product_reviews for select to anon using (status = 'approved');
drop policy if exists reviews_insert_own on public.product_reviews;
create policy reviews_insert_own on public.product_reviews for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending' and public.is_active_user());
drop policy if exists reviews_delete_own on public.product_reviews;
create policy reviews_delete_own on public.product_reviews for delete to authenticated using (user_id = (select auth.uid()) or public.has_role('admin'));
drop policy if exists reviews_admin_update on public.product_reviews;
create policy reviews_admin_update on public.product_reviews for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists wishlists_own on public.wishlists;
create policy wishlists_own on public.wishlists for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_active_user());

drop policy if exists coupons_admin_manage on public.coupons;
create policy coupons_admin_manage on public.coupons for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists shipping_zones_read on public.shipping_zones;
create policy shipping_zones_read on public.shipping_zones for select to anon,authenticated using (is_active or public.has_role('admin'));
drop policy if exists shipping_zones_admin_manage on public.shipping_zones;
create policy shipping_zones_admin_manage on public.shipping_zones for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

drop policy if exists addresses_own on public.customer_addresses;
create policy addresses_own on public.customer_addresses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_active_user());
drop policy if exists addresses_admin_read on public.customer_addresses;
create policy addresses_admin_read on public.customer_addresses for select to authenticated using (public.has_role('admin'));

drop policy if exists newsletter_public_insert on public.newsletter_subscribers;
create policy newsletter_public_insert on public.newsletter_subscribers for insert to anon,authenticated with check (consent and email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
drop policy if exists newsletter_admin_read on public.newsletter_subscribers;
create policy newsletter_admin_read on public.newsletter_subscribers for select to authenticated using (public.has_role('admin'));
drop policy if exists newsletter_admin_delete on public.newsletter_subscribers;
create policy newsletter_admin_delete on public.newsletter_subscribers for delete to authenticated using (public.has_role('admin'));

drop policy if exists inventory_admin_read on public.inventory_movements;
create policy inventory_admin_read on public.inventory_movements for select to authenticated using (public.has_role('admin'));

grant select on public.brands,public.collections,public.collection_products,public.product_images,public.shipping_zones to anon,authenticated;
revoke all on public.product_reviews from anon;
grant select (id,product_id,author_name,rating,comment,status,created_at) on public.product_reviews to anon;
grant select on public.product_reviews to authenticated;
grant insert,update,delete on public.brands,public.collections,public.collection_products,public.product_images,public.shipping_zones,public.coupons to authenticated;
grant select on public.coupons,public.inventory_movements,public.newsletter_subscribers to authenticated;
grant insert,delete on public.product_reviews to authenticated;
grant update (status) on public.product_reviews to authenticated;
grant select,insert,delete on public.wishlists to authenticated;
grant select,insert,update,delete on public.customer_addresses to authenticated;
grant insert (email,source,consent) on public.newsletter_subscribers to anon,authenticated;
grant delete on public.newsletter_subscribers to authenticated;
revoke all on public.inventory_movements from anon;

-- Valoración promedio pública (solo reseñas aprobadas; respeta RLS de quien consulta).
create or replace view public.product_ratings with (security_invoker = true) as
  select product_id, round(avg(rating)::numeric,1) as average, count(*)::integer as total
  from public.product_reviews where status = 'approved' group by product_id;
grant select on public.product_ratings to anon,authenticated;

-- Historial de inventario: cada cambio de stock queda registrado con su motivo.
create or replace function public.log_inventory_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) end;
  v_delta integer;
  v_reason text := coalesce(nullif(current_setting('msj.stock_reason',true),''),'ajuste');
begin
  -- Se lee como JSONB para no depender de columnas concretas si el trigger se asigna a otra tabla por error.
  if not (v_new ? 'stock') then return NEW; end if;
  if TG_OP = 'INSERT' then
    v_delta := coalesce((v_new ->> 'stock')::integer,0);
    if v_reason = 'ajuste' then v_reason := 'alta'; end if;
  else
    v_delta := coalesce((v_new ->> 'stock')::integer,0) - coalesce((v_old ->> 'stock')::integer,0);
  end if;
  if v_delta = 0 then return NEW; end if;
  insert into public.inventory_movements (variant_id,delta,stock_after,reason,actor_id)
  values ((v_new ->> 'id')::uuid,v_delta,(v_new ->> 'stock')::integer,v_reason,(select p.id from public.profiles p where p.id = auth.uid()));
  return NEW;
end;
$$;
revoke all on function public.log_inventory_movement() from public,anon,authenticated;
drop trigger if exists inventory_movement on public.product_variants;
create trigger inventory_movement after insert or update of stock on public.product_variants for each row execute function public.log_inventory_movement();

drop trigger if exists audit_coupons on public.coupons;
create trigger audit_coupons after insert or update or delete on public.coupons for each row execute function public.log_audit_change();
drop trigger if exists audit_shipping_zones on public.shipping_zones;
create trigger audit_shipping_zones after insert or update or delete on public.shipping_zones for each row execute function public.log_audit_change();
drop trigger if exists audit_product_reviews on public.product_reviews;
create trigger audit_product_reviews after update or delete on public.product_reviews for each row execute function public.log_audit_change();

-- Vista previa de cupones en el checkout (no expone la tabla de cupones).
create or replace function public.validate_coupon(p_code text,p_subtotal numeric)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v public.coupons%rowtype;
  v_code text := upper(trim(coalesce(p_code,'')));
  v_amount numeric(10,2);
begin
  if auth.uid() is null then return jsonb_build_object('valid',false,'message','Inicia sesión para usar cupones.'); end if;
  select * into v from public.coupons where code = v_code;
  if not found or not v.is_active or (v.starts_at is not null and v.starts_at > now()) or (v.ends_at is not null and v.ends_at < now())
    or (v.max_uses is not null and v.used_count >= v.max_uses) or (v.owner_id is not null and v.owner_id <> auth.uid()) then
    return jsonb_build_object('valid',false,'message','El cupón no es válido o ya venció.');
  end if;
  if coalesce(p_subtotal,0) < v.min_subtotal then
    return jsonb_build_object('valid',false,'message','Este cupón requiere una compra mínima de S/ ' || v.min_subtotal || '.');
  end if;
  if v.once_per_customer and exists (select 1 from public.orders o where o.user_id = auth.uid() and o.coupon_code = v_code and o.status <> 'cancelled') then
    return jsonb_build_object('valid',false,'message','Ya usaste este cupón.');
  end if;
  v_amount := case when v.discount_type = 'percent' then round(p_subtotal * v.discount_value / 100,2) else least(v.discount_value,p_subtotal) end;
  return jsonb_build_object('valid',true,'code',v.code,'discount',v_amount,'description',v.description);
end;
$$;
revoke all on function public.validate_coupon(text,numeric) from public;
grant execute on function public.validate_coupon(text,numeric) to authenticated;

-- Datos iniciales editables: zonas de envío (costos sugeridos) y un cupón de bienvenida.
insert into public.shipping_zones (name,description,cost,free_from,days_min,days_max,sort_order) values
  ('Lima Metropolitana','Todos los distritos de Lima',10,199,1,3,1),
  ('Callao','Provincia Constitucional del Callao',10,199,1,3,2),
  ('Lima provincias','Huaral, Cañete, Huacho y otras',15,249,2,4,3),
  ('Costa norte','Piura, Lambayeque, La Libertad, Tumbes, Áncash',18,299,3,5,4),
  ('Costa sur','Ica, Arequipa, Moquegua, Tacna',18,299,3,5,5),
  ('Sierra','Cusco, Junín, Cajamarca, Puno, Ayacucho y otras',20,299,3,7,6),
  ('Selva','Loreto, San Martín, Ucayali, Madre de Dios, Amazonas',25,349,4,8,7)
on conflict (name) do nothing;
insert into public.coupons (code,description,discount_type,discount_value,min_subtotal,once_per_customer)
values ('BIENVENIDA10','10% de descuento en tu primera compra desde S/ 99','percent',10,99,true)
on conflict (code) do nothing;
update public.shipping_zones set vip_gold_free = true where name in ('Lima Metropolitana','Callao') and not vip_gold_free;

-- =====================================================================
-- Ciberseguridad: registro de eventos de seguridad (solo lectura para administradores, solo escritura por funciones).
-- =====================================================================
create table if not exists public.auditoria_seguridad (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  severidad text not null default 'info' check (severidad in ('info','baja','media','alta','critica')),
  user_id uuid references public.profiles(id) on delete set null,
  email text check (char_length(email) <= 160),
  actor_id uuid references public.profiles(id) on delete set null,
  ip text not null default '' check (char_length(ip) <= 64),
  dispositivo text not null default '' check (char_length(dispositivo) <= 120),
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- La lista de eventos se redefine en cada ejecución para poder ampliarla sin recrear la tabla.
alter table public.auditoria_seguridad drop constraint if exists auditoria_seguridad_evento_check;
alter table public.auditoria_seguridad add constraint auditoria_seguridad_evento_check check (evento in (
  'login_fallido','login_exitoso','login_passkey','login_passkey_fallido','auditoria_ejecutada','correccion_aplicada','cuenta_bloqueada','cuenta_habilitada',
  'passkey_registrada','passkey_eliminada','2fa_activado','2fa_desactivado','vip_solicitado','vip_activado','vip_rechazado','vip_revocado','cupon_vip_emitido'));
create index if not exists auditoria_seguridad_fecha_idx on public.auditoria_seguridad(created_at desc);
create index if not exists auditoria_seguridad_email_idx on public.auditoria_seguridad(email,created_at desc) where evento = 'login_fallido';
alter table public.auditoria_seguridad enable row level security;
revoke all on public.auditoria_seguridad from public,anon,authenticated;
grant select on public.auditoria_seguridad to authenticated;
drop policy if exists auditoria_seguridad_admin_read on public.auditoria_seguridad;
create policy auditoria_seguridad_admin_read on public.auditoria_seguridad for select to authenticated using (public.has_role('admin'));
-- Sin políticas de insert/update/delete: el registro es de solo anexado y nadie puede alterarlo desde la API.

-- IP del cliente según la cabecera que añade el proxy de Supabase (informativa: puede ser un proxy o VPN).
create or replace function public.request_ip()
returns text language plpgsql stable set search_path = '' as $$
declare v_headers json;
begin
  v_headers := nullif(current_setting('request.headers',true),'')::json;
  return left(trim(split_part(coalesce(v_headers ->> 'cf-connecting-ip',v_headers ->> 'x-forwarded-for',v_headers ->> 'x-real-ip',''),',',1)),64);
exception when others then
  return '';
end;
$$;
revoke all on function public.request_ip() from public,anon,authenticated;

-- Intento fallido de inicio de sesión. No revela si el correo existe y limita el volumen para evitar abuso.
create or replace function public.registrar_intento_fallido(p_email text,p_dispositivo text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_ip text := public.request_ip();
  v_fails integer;
begin
  if char_length(v_email) > 160 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then return; end if;
  if (select count(*) from public.auditoria_seguridad where evento = 'login_fallido' and email = v_email and created_at > now() - interval '1 hour') >= 30 then return; end if;
  if v_ip <> '' and (select count(*) from public.auditoria_seguridad where evento = 'login_fallido' and ip = v_ip and created_at > now() - interval '1 hour') >= 100 then return; end if;
  update public.profiles set intentos_fallidos = intentos_fallidos + 1, ultimo_intento_fallido = now() where email = v_email returning intentos_fallidos into v_fails;
  insert into public.auditoria_seguridad (evento,severidad,user_id,email,ip,dispositivo,detalle)
  values ('login_fallido',case when coalesce(v_fails,0) >= 5 then 'alta' when coalesce(v_fails,0) >= 3 then 'media' else 'baja' end,
    (select id from public.profiles where email = v_email),v_email,v_ip,left(regexp_replace(coalesce(p_dispositivo,''),'[<>"''`]','','g'),120),
    jsonb_build_object('intentos_consecutivos',coalesce(v_fails,0)));
end;
$$;
revoke all on function public.registrar_intento_fallido(text,text) from public;
grant execute on function public.registrar_intento_fallido(text,text) to anon,authenticated;

-- Acceso correcto: reinicia el contador y guarda último acceso, dispositivo e IP. Devuelve los fallos previos para avisar a la persona.
drop function if exists public.registrar_acceso(text);
create or replace function public.registrar_acceso(p_dispositivo text default '')
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_device text := left(regexp_replace(coalesce(p_dispositivo,''),'[<>"''`]','','g'),120);
  v_ip text := public.request_ip();
  v_previous integer;
begin
  if auth.uid() is null then return 0; end if;
  select intentos_fallidos into v_previous from public.profiles where id = auth.uid();
  update public.profiles set intentos_fallidos = 0, ultimo_acceso = now(), ultimo_dispositivo = v_device, ultima_ip = v_ip where id = auth.uid();
  insert into public.auditoria_seguridad (evento,severidad,user_id,email,ip,dispositivo,detalle)
  select 'login_exitoso',case when coalesce(v_previous,0) >= 3 then 'media' else 'info' end,p.id,p.email,v_ip,v_device,jsonb_build_object('fallos_previos',coalesce(v_previous,0))
  from public.profiles p where p.id = auth.uid();
  return coalesce(v_previous,0);
end;
$$;
revoke all on function public.registrar_acceso(text) from public,anon;
grant execute on function public.registrar_acceso(text) to authenticated;

-- =====================================================================
-- Passkeys (WebAuthn): huella de Android, Face ID / Touch ID de iPhone y Mac, Windows Hello.
-- La biometría nunca sale del dispositivo: aquí solo se guarda la clave pública. Las escribe la Edge Function "passkeys".
-- =====================================================================
create table if not exists public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_name text not null default '' check (char_length(device_name) <= 80),
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user_idx on public.passkeys(user_id);
alter table public.passkeys enable row level security;
revoke all on public.passkeys from public,anon,authenticated;
grant select (id,user_id,device_name,backed_up,created_at,last_used_at) on public.passkeys to authenticated;
grant delete on public.passkeys to authenticated;
drop policy if exists passkeys_own_read on public.passkeys;
create policy passkeys_own_read on public.passkeys for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists passkeys_admin_read on public.passkeys;
create policy passkeys_admin_read on public.passkeys for select to authenticated using (public.has_role('admin'));
drop policy if exists passkeys_own_delete on public.passkeys;
create policy passkeys_own_delete on public.passkeys for delete to authenticated using (user_id = (select auth.uid()) and public.mfa_ok());
drop trigger if exists audit_passkeys on public.passkeys;
create trigger audit_passkeys after insert or delete on public.passkeys for each row execute function public.log_audit_change();

-- Retos de un solo uso (5 minutos) para registrar o usar una passkey. Solo los usa la Edge Function con la clave de servicio.
create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  challenge text not null,
  kind text not null check (kind in ('registro','acceso')),
  expires_at timestamptz not null default now() + interval '5 minutes',
  created_at timestamptz not null default now()
);
alter table public.webauthn_challenges enable row level security;
revoke all on public.webauthn_challenges from public,anon,authenticated;

-- La propia persona deja constancia de cambios en su 2FA y passkeys (el servidor añade IP y correo).
create or replace function public.registrar_evento_cuenta(p_evento text,p_dispositivo text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  if p_evento not in ('2fa_activado','2fa_desactivado','passkey_eliminada') then raise exception 'Evento no permitido.'; end if;
  insert into public.auditoria_seguridad (evento,severidad,user_id,email,ip,dispositivo)
  select p_evento,case when p_evento = '2fa_desactivado' then 'media' else 'info' end,p.id,p.email,public.request_ip(),left(regexp_replace(coalesce(p_dispositivo,''),'[<>"''`]','','g'),120)
  from public.profiles p where p.id = auth.uid();
end;
$$;
revoke all on function public.registrar_evento_cuenta(text,text) from public,anon;
grant execute on function public.registrar_evento_cuenta(text,text) to authenticated;

-- Inventario de cuentas para el inspector de ciberseguridad (Auth + perfil + roles + métodos de acceso). Solo administradores.
drop function if exists public.admin_cuentas_seguridad();
create or replace function public.admin_cuentas_seguridad()
returns table (id uuid,full_name text,email text,roles text[],is_active boolean,email_verificado boolean,mfa_activo boolean,ultimo_acceso timestamptz,
  creado timestamptz,intentos_fallidos integer,ultimo_intento_fallido timestamptz,ultimo_dispositivo text,ultima_ip text,es_vip boolean,nivel_vip text,vip_expira timestamptz,
  metodo_password boolean,totp_activo boolean,passkeys integer,passkey_dispositivos text[])
language sql stable security definer set search_path = '' as $$
  select p.id,p.full_name,p.email,
    coalesce(array_agg(distinct r.role_key) filter (where r.role_key is not null),'{}'::text[]),
    p.is_active,u.email_confirmed_at is not null,
    exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified'),
    greatest(u.last_sign_in_at,p.ultimo_acceso),p.created_at,p.intentos_fallidos,p.ultimo_intento_fallido,p.ultimo_dispositivo,p.ultima_ip,
    p.es_vip and coalesce(p.vip_expira > now(),false),p.nivel_vip,p.vip_expira,
    coalesce(u.encrypted_password,'') <> '',
    exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified' and f.factor_type = 'totp'),
    (select count(*)::integer from public.passkeys k where k.user_id = p.id),
    coalesce((select array_agg(k.device_name order by k.created_at) from public.passkeys k where k.user_id = p.id),'{}'::text[])
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.user_roles ur on ur.user_id = p.id
  left join public.roles r on r.id = ur.role_id and r.is_active
  where public.has_role('admin')
  group by p.id,u.id
  order by p.created_at desc
  limit 5000;
$$;
revoke all on function public.admin_cuentas_seguridad() from public,anon;
grant execute on function public.admin_cuentas_seguridad() to authenticated;

-- Estado técnico para la auditoría: RLS por tabla, funciones SECURITY DEFINER sin search_path y fallos de acceso recientes.
create or replace function public.admin_auditoria_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  return jsonb_build_object(
    'tablas',(select coalesce(jsonb_agg(jsonb_build_object('tabla',c.relname,'rls',c.relrowsecurity,
        'politicas',(select count(*) from pg_policies pp where pp.schemaname = 'public' and pp.tablename = c.relname),
        'anon_select',has_table_privilege('anon',c.oid,'SELECT')) order by c.relname),'[]'::jsonb)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p')),
    'funciones_sin_search_path',(select coalesce(jsonb_agg(p.oid::regprocedure::text order by p.proname),'[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) as cfg(valor) where cfg.valor like 'search_path=%')),
    'fallidos_24h',(select count(*) from public.auditoria_seguridad where evento = 'login_fallido' and created_at > now() - interval '24 hours'),
    'ips_fallidas_24h',(select coalesce(jsonb_agg(jsonb_build_object('ip',ip,'total',total) order by total desc),'[]'::jsonb) from (
      select ip,count(*) as total from public.auditoria_seguridad where evento = 'login_fallido' and ip <> '' and created_at > now() - interval '24 hours'
      group by ip having count(*) >= 10 order by count(*) desc limit 10) ranked),
    'generado',now());
end;
$$;
revoke all on function public.admin_auditoria_snapshot() from public,anon;
grant execute on function public.admin_auditoria_snapshot() to authenticated;

-- El administrador deja constancia de cada auditoría y de cada corrección aplicada.
create or replace function public.admin_registrar_evento_seguridad(p_evento text,p_severidad text,p_user_id uuid default null,p_detalle jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  if p_evento not in ('auditoria_ejecutada','correccion_aplicada','cuenta_bloqueada','cuenta_habilitada') then raise exception 'Evento no permitido.'; end if;
  if pg_column_size(coalesce(p_detalle,'{}'::jsonb)) > 20000 then raise exception 'Detalle demasiado grande.'; end if;
  insert into public.auditoria_seguridad (evento,severidad,user_id,email,actor_id,ip,detalle)
  values (p_evento,coalesce(nullif(p_severidad,''),'info'),p_user_id,(select email from public.profiles where id = p_user_id),auth.uid(),public.request_ip(),coalesce(p_detalle,'{}'::jsonb));
end;
$$;
revoke all on function public.admin_registrar_evento_seguridad(text,text,uuid,jsonb) from public,anon;
grant execute on function public.admin_registrar_evento_seguridad(text,text,uuid,jsonb) to authenticated;

-- =====================================================================
-- MSJ Privilège Club: solicitudes y membresías VIP.
-- La membresía se activa solo cuando un administrador confirma el pago; el descuento lo aplica checkout_cart.
-- =====================================================================
create table if not exists public.membresias_vip (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nivel text not null check (nivel in ('gold','black')),
  periodo text not null check (periodo in ('mensual','anual')),
  monto numeric(10,2) not null check (monto >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente','activa','rechazada','revocada')),
  referencia_pago text not null default '' check (char_length(referencia_pago) <= 80),
  inicia timestamptz, vence timestamptz,
  revisado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists membresias_vip_una_pendiente on public.membresias_vip(user_id) where estado = 'pendiente';
create index if not exists membresias_vip_fecha_idx on public.membresias_vip(created_at desc);
alter table public.membresias_vip enable row level security;
revoke all on public.membresias_vip from public,anon,authenticated;
grant select on public.membresias_vip to authenticated;
drop policy if exists membresias_vip_own_read on public.membresias_vip;
create policy membresias_vip_own_read on public.membresias_vip for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists membresias_vip_admin_read on public.membresias_vip;
create policy membresias_vip_admin_read on public.membresias_vip for select to authenticated using (public.has_role('admin'));
drop trigger if exists audit_membresias_vip on public.membresias_vip;
create trigger audit_membresias_vip after insert or update or delete on public.membresias_vip for each row execute function public.log_audit_change();

create or replace function public.vip_precio(p_nivel text,p_periodo text)
returns numeric language sql immutable set search_path = '' as $$
  select case p_nivel || ':' || p_periodo when 'gold:mensual' then 19.90 when 'gold:anual' then 149.00
    when 'black:mensual' then 39.90 when 'black:anual' then 299.00 end::numeric;
$$;

-- El cliente solicita (o cambia) su plan; queda pendiente hasta que se confirme el pago.
create or replace function public.solicitar_membresia_vip(p_nivel text,p_periodo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_monto numeric(10,2) := public.vip_precio(p_nivel,p_periodo);
begin
  if auth.uid() is null then raise exception 'Inicia sesión para unirte al club.'; end if;
  if not public.is_active_user() then raise exception 'La cuenta está deshabilitada.'; end if;
  if v_monto is null then raise exception 'Plan no válido.'; end if;
  update public.membresias_vip set nivel = p_nivel,periodo = p_periodo,monto = v_monto,created_at = now()
    where user_id = auth.uid() and estado = 'pendiente' returning id into v_id;
  if v_id is null then
    insert into public.membresias_vip (user_id,nivel,periodo,monto) values (auth.uid(),p_nivel,p_periodo,v_monto) returning id into v_id;
  end if;
  insert into public.auditoria_seguridad (evento,user_id,email,ip,detalle)
  select 'vip_solicitado',p.id,p.email,public.request_ip(),jsonb_build_object('nivel',p_nivel,'periodo',p_periodo,'monto',v_monto) from public.profiles p where p.id = auth.uid();
  return jsonb_build_object('id',v_id,'monto',v_monto,'estado','pendiente');
end;
$$;
revoke all on function public.solicitar_membresia_vip(text,text) from public,anon;
grant execute on function public.solicitar_membresia_vip(text,text) to authenticated;

create or replace function public.vip_codigo_nuevo()
returns text language plpgsql volatile set search_path = '' as $$
declare v_code text;
begin
  loop
    v_code := 'MSJ ' || lpad((floor(random() * 10000))::int::text,4,'0') || ' ' || lpad((floor(random() * 10000))::int::text,4,'0') || ' ' || lpad((floor(random() * 10000))::int::text,4,'0');
    exit when not exists (select 1 from public.profiles where codigo_socio = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function public.vip_codigo_nuevo() from public,anon,authenticated;

-- Confirma el pago de una solicitud y activa (o extiende) la membresía.
create or replace function public.admin_activar_vip(p_membresia uuid,p_referencia text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare v public.membresias_vip%rowtype; v_inicio timestamptz; v_vence timestamptz;
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  select * into v from public.membresias_vip where id = p_membresia and estado = 'pendiente' for update;
  if not found then raise exception 'La solicitud ya no está pendiente.'; end if;
  select greatest(now(),case when es_vip and nivel_vip = v.nivel then coalesce(vip_expira,now()) else now() end) into v_inicio from public.profiles where id = v.user_id;
  v_vence := v_inicio + case v.periodo when 'anual' then interval '1 year' else interval '1 month' end;
  update public.membresias_vip set estado = 'activa',inicia = now(),vence = v_vence,referencia_pago = left(coalesce(p_referencia,''),80),revisado_por = auth.uid() where id = v.id;
  update public.profiles set es_vip = true,nivel_vip = v.nivel,vip_expira = v_vence,codigo_socio = coalesce(codigo_socio,public.vip_codigo_nuevo()) where id = v.user_id;
  insert into public.auditoria_seguridad (evento,user_id,email,actor_id,detalle)
  select 'vip_activado',p.id,p.email,auth.uid(),jsonb_build_object('nivel',v.nivel,'periodo',v.periodo,'monto',v.monto,'vence',v_vence) from public.profiles p where p.id = v.user_id;
end;
$$;
revoke all on function public.admin_activar_vip(uuid,text) from public,anon;
grant execute on function public.admin_activar_vip(uuid,text) to authenticated;

create or replace function public.admin_rechazar_vip(p_membresia uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  update public.membresias_vip set estado = 'rechazada',revisado_por = auth.uid() where id = p_membresia and estado = 'pendiente' returning user_id into v_user;
  if v_user is null then raise exception 'La solicitud ya no está pendiente.'; end if;
  insert into public.auditoria_seguridad (evento,user_id,email,actor_id) select 'vip_rechazado',p.id,p.email,auth.uid() from public.profiles p where p.id = v_user;
end;
$$;
revoke all on function public.admin_rechazar_vip(uuid) from public,anon;
grant execute on function public.admin_rechazar_vip(uuid) to authenticated;

-- Membresía de cortesía o de prueba otorgada directamente por un administrador (queda registrada).
create or replace function public.admin_otorgar_vip(p_user_id uuid,p_nivel text,p_meses integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_vence timestamptz;
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  if p_nivel not in ('gold','black') or p_meses not between 1 and 24 then raise exception 'Nivel o duración no válidos.'; end if;
  v_vence := now() + make_interval(months => p_meses);
  insert into public.membresias_vip (user_id,nivel,periodo,monto,estado,referencia_pago,inicia,vence,revisado_por)
  values (p_user_id,p_nivel,case when p_meses >= 12 then 'anual' else 'mensual' end,0,'activa','Cortesía',now(),v_vence,auth.uid());
  update public.profiles set es_vip = true,nivel_vip = p_nivel,vip_expira = v_vence,codigo_socio = coalesce(codigo_socio,public.vip_codigo_nuevo()) where id = p_user_id;
  if not found then raise exception 'La cuenta no existe.'; end if;
  insert into public.auditoria_seguridad (evento,user_id,email,actor_id,detalle)
  select 'vip_activado',p.id,p.email,auth.uid(),jsonb_build_object('nivel',p_nivel,'meses',p_meses,'cortesia',true) from public.profiles p where p.id = p_user_id;
end;
$$;
revoke all on function public.admin_otorgar_vip(uuid,text,integer) from public,anon;
grant execute on function public.admin_otorgar_vip(uuid,text,integer) to authenticated;

create or replace function public.admin_revocar_vip(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  update public.profiles set es_vip = false,vip_expira = least(coalesce(vip_expira,now()),now()) where id = p_user_id;
  update public.membresias_vip set estado = 'revocada',revisado_por = auth.uid() where user_id = p_user_id and estado = 'activa' and coalesce(vence,now()) > now();
  insert into public.auditoria_seguridad (evento,severidad,user_id,email,actor_id) select 'vip_revocado','baja',p.id,p.email,auth.uid() from public.profiles p where p.id = p_user_id;
end;
$$;
revoke all on function public.admin_revocar_vip(uuid) from public,anon;
grant execute on function public.admin_revocar_vip(uuid) to authenticated;

-- Cupón de regalo mensual del Lounge: personal (owner_id), de un solo uso y válido hasta fin de mes (hora de Lima).
-- Gold: S/ 15 desde S/ 150 · Black Sovereign: S/ 30 desde S/ 200.
create or replace function public.reclamar_cupon_vip()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_pct numeric := public.vip_discount_percent(auth.uid());
  v_month text := to_char(now() at time zone 'America/Lima','YYMM');
  v_code text;
  v_value numeric(10,2);
  v_min numeric(10,2);
  v_ends timestamptz := (date_trunc('month',now() at time zone 'America/Lima') + interval '1 month' - interval '1 second') at time zone 'America/Lima';
  v_used boolean;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Inicia sesión para ver tu cupón.'; end if;
  if v_pct = 0 then raise exception 'El cupón mensual es exclusivo para socios MSJ Privilège.'; end if;
  v_value := case when v_pct >= 25 then 30 else 15 end;
  v_min := case when v_pct >= 25 then 200 else 150 end;
  v_code := 'SOCIO-' || v_month || '-' || upper(substr(md5(auth.uid()::text || v_month),1,5));
  insert into public.coupons (code,description,discount_type,discount_value,min_subtotal,ends_at,max_uses,once_per_customer,is_active,owner_id)
  values (v_code,'Regalo mensual MSJ Privilège','amount',v_value,v_min,v_ends,1,true,true,auth.uid())
  on conflict (code) do nothing;
  if found then
    insert into public.auditoria_seguridad (evento,user_id,email,detalle) select 'cupon_vip_emitido',p.id,p.email,jsonb_build_object('codigo',v_code) from public.profiles p where p.id = auth.uid();
  end if;
  select used_count >= coalesce(max_uses,1) into v_used from public.coupons where code = v_code;
  return jsonb_build_object('code',v_code,'discount',v_value,'min_subtotal',v_min,'ends_at',v_ends,'used',coalesce(v_used,false));
end;
$$;
revoke all on function public.reclamar_cupon_vip() from public,anon;
grant execute on function public.reclamar_cupon_vip() to authenticated;

-- Ahorro acumulado gracias a la membresía (pedidos no cancelados).
create or replace function public.mi_ahorro_vip()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('total',coalesce(sum(o.vip_discount_amount),0),'pedidos',count(*) filter (where o.vip_discount_amount > 0))
  from public.orders o where o.user_id = auth.uid() and o.status <> 'cancelled';
$$;
revoke all on function public.mi_ahorro_vip() from public,anon;
grant execute on function public.mi_ahorro_vip() to authenticated;
