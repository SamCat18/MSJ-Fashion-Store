-- MSJ Fashion Store · Campañas: promociones por feriados (2x1 / %), donación «MSJ Unidos por el Perú» y pago con Yape.
-- Ejecuta este archivo DESPUÉS de database/schema.sql. Es idempotente: puedes volver a ejecutarlo.

-- ---------- Pedidos: columnas nuevas ----------
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('cash_on_delivery','card','yape','lemon'));
alter table public.orders add column if not exists promo_code text;
alter table public.orders add column if not exists promo_discount_amount numeric(10,2) not null default 0 check (promo_discount_amount >= 0);
alter table public.orders add column if not exists donation_amount numeric(10,2) not null default 0 check (donation_amount >= 0);
-- yape_operation guarda el número de operación de la billetera (Yape o Lemon).
alter table public.orders add column if not exists yape_operation text;
alter table public.orders add column if not exists donation_cause text check (donation_cause in ('el-nino','cancer','arboles','friaje','educacion'));
-- Un mismo número de operación no puede usarse en dos pedidos de la misma billetera. Un pago rechazado («failed») libera
-- el número para que el cliente pueda volver a usarlo si se equivocó al escribirlo.
drop index if exists public.payments_yape_reference_key;
drop index if exists public.payments_wallet_reference_key;
create unique index payments_wallet_reference_key on public.payments (provider,provider_reference) where provider in ('yape','lemon') and status <> 'failed';

-- ---------- Promociones por fecha ----------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, tagline text not null default '',
  kind text not null check (kind in ('2x1','percent')), discount_value numeric(5,2) not null default 0 check (discount_value between 0 and 90),
  category_slugs text[], theme text check (theme in ('bw')), starts_at timestamptz not null, ends_at timestamptz not null,
  is_active boolean not null default true, created_at timestamptz not null default now(), check (ends_at > starts_at)
);
alter table public.promotions enable row level security;
drop policy if exists "promociones visibles" on public.promotions;
create policy "promociones visibles" on public.promotions for select using (is_active);
drop policy if exists "administran promociones" on public.promotions;
create policy "administran promociones" on public.promotions for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
grant select on public.promotions to anon,authenticated;
grant insert,update,delete on public.promotions to authenticated;

-- Calendario 2026-2027 (hora de Lima). Debe coincidir con el calendario de respaldo de campaigns.js.
insert into public.promotions (code,name,tagline,kind,discount_value,category_slugs,theme,starts_at,ends_at) values
  ('SEMANA-CRIOLLA','Semana Criolla 2x1','Día de la Canción Criolla y Todos los Santos: lleva 2 y paga 1 en polos, poleras, camisas, blusas y gorras.','2x1',0,array['polos','poleras','camisas','blusas','gorras'],null,'2026-10-28 00:00-05','2026-11-02 00:00-05'),
  ('BLACK-FRIDAY','Black & White Friday','La tienda se viste de blanco y negro: 2x1 en polos, jeans, joggers y zapatillas.','2x1',0,array['polos','poleras','jeans','pantalones','joggers','zapatillas'],'bw','2026-11-27 00:00-05','2026-12-01 00:00-05'),
  ('NAVIDAD','Navidad MSJ 2x1','Regalos para dos al precio de uno: perfumes, relojes, lentes y joyería.','2x1',0,array['perfumes','relojes','lentes','joyeria'],null,'2026-12-18 00:00-05','2026-12-25 00:00-05'),
  ('DIA-MADRE','Día de la Madre','20% en vestidos, blusas, bolsos y perfumes.','percent',20,array['vestidos','blusas','bolsos','perfumes'],null,'2027-05-03 00:00-05','2027-05-10 00:00-05'),
  ('FIESTAS-PATRIAS','Fiestas Patrias','28% por el 28 de julio en toda la tienda.','percent',28,null,null,'2027-07-25 00:00-05','2027-07-30 00:00-05')
on conflict (code) do nothing;

create or replace function public.active_promotion()
returns public.promotions language sql stable security definer set search_path = '' as $$
  select * from public.promotions where is_active and now() >= starts_at and now() < ends_at order by starts_at desc limit 1;
$$;
revoke all on function public.active_promotion() from public;
grant execute on function public.active_promotion() to anon,authenticated;

-- ---------- Checkout con promoción, donación y Yape ----------
drop function if exists public.checkout_cart(jsonb,text,jsonb,text);
drop function if exists public.checkout_cart(jsonb,text,jsonb,text,numeric,text);
drop function if exists public.checkout_cart(jsonb,text,jsonb,text,numeric,text,text);
create function public.checkout_cart(p_items jsonb,p_payment_method text,p_address jsonb,p_coupon text default null,p_donation numeric default 0,p_yape_operation text default null,p_donation_cause text default null)
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
  v_total numeric(10,2);
begin
  if v_user_id is null then raise exception 'Inicia sesión para crear un pedido.'; end if;
  if not public.is_active_user() then raise exception 'La cuenta está deshabilitada.'; end if;
  v_vip_pct := public.vip_discount_percent(v_user_id);
  if v_vip_pct > 0 then select nivel_vip into v_vip_level from public.profiles where id = v_user_id; end if;
  if p_payment_method not in ('cash_on_delivery','yape','lemon') then raise exception 'Método de pago no disponible.'; end if;
  if p_payment_method in ('yape','lemon') and (v_yape is null or char_length(v_yape) not between 4 and 12) then raise exception 'Ingresa el número de operación de tu pago.'; end if;
  if p_payment_method in ('yape','lemon') and exists (select 1 from public.payments where provider = p_payment_method and provider_reference = v_yape and status <> 'failed') then raise exception 'Ese número de operación ya fue registrado.'; end if;
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
    -- Sin acumulación: se aplica el mayor entre el descuento de oferta y el de socio.
    v_public_price := round(v_price * (1 - v_discount / 100),2);
    v_price := round(v_price * (1 - greatest(v_discount,v_vip_pct) / 100),2);
    v_vip_saving := v_vip_saving + ((v_public_price - v_price) * v_quantity);
    v_subtotal := v_subtotal + (v_price * v_quantity);
    if v_promo.id is not null and (v_promo.category_slugs is null or v_category = any(v_promo.category_slugs)) then
      v_units := v_units || array_fill(v_price,array[v_quantity]);
    end if;
  end loop;
  -- 2x1: se ordenan las unidades participantes de mayor a menor precio y una de cada par sale gratis (la de menor precio).
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
  insert into public.orders (id,user_id,payment_method,payment_status,recipient,shipping_address,city,phone,subtotal,discount_amount,coupon_code,shipping_zone_id,shipping_amount,total,nivel_vip,vip_discount_amount,promo_code,promo_discount_amount,donation_amount,yape_operation,donation_cause)
  values (v_order_id,v_user_id,p_payment_method,case when p_payment_method in ('yape','lemon') then 'pending' else 'unpaid' end,p_address ->> 'recipient',p_address ->> 'address',p_address ->> 'city',coalesce(p_address ->> 'phone',''),
    v_subtotal,v_discount_amount,v_code,v_zone.id,v_shipping,v_total,v_vip_level,v_vip_saving,case when v_promo_amount > 0 then v_promo.code end,v_promo_amount,v_donation,v_yape,case when v_donation > 0 then coalesce(p_donation_cause,'el-nino') end);
  -- El pago con Yape o Lemon queda «pendiente» hasta que el equipo confirma en su app que llegó el monto con ese número de operación.
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
grant select (promo_code,promo_discount_amount,donation_amount,yape_operation,donation_cause) on public.orders to authenticated;

-- ---------- Transparencia de la donación ----------
-- Aportes de clientes + 1% que MSJ pone de cada venta (mercadería, sin envío). Solo cuenta pedidos no anulados desde el inicio de la campaña.
create or replace function public.donation_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'customers', coalesce(sum(donation_amount),0),
    'store', round(coalesce(sum(subtotal - discount_amount - promo_discount_amount),0) * 0.01,2),
    'orders', count(*),
    'donors', count(*) filter (where donation_amount > 0),
    'by_cause', coalesce((select jsonb_object_agg(cause,jsonb_build_object('amount',amount,'donors',donors))
      from (select donation_cause as cause,sum(donation_amount) as amount,count(*) as donors from public.orders
            where status <> 'cancelled' and donation_amount > 0 and donation_cause is not null and created_at >= '2026-10-28 00:00-05' group by donation_cause) c),'{}'::jsonb))
  from public.orders where status <> 'cancelled' and created_at >= '2026-10-28 00:00-05';
$$;
revoke all on function public.donation_stats() from public;
grant execute on function public.donation_stats() to anon,authenticated;

-- Certificado de donación: el titular del pedido (o un administrador) obtiene los datos para imprimir su constancia.
create or replace function public.donation_certificate(p_order uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('order',o.id,'amount',o.donation_amount,'cause',o.donation_cause,'created_at',o.created_at,
    'name',coalesce(nullif(p.full_name,''),o.recipient),'status',o.status,
    'code','MSJ-DON-' || upper(substr(replace(o.id::text,'-',''),1,10)))
  from public.orders o join public.profiles p on p.id = o.user_id
  where o.id = p_order and o.donation_amount > 0 and o.status <> 'cancelled' and (o.user_id = auth.uid() or public.has_role('admin'));
$$;
revoke all on function public.donation_certificate(uuid) from public;
grant execute on function public.donation_certificate(uuid) to authenticated;

-- ---------- Socios de cortesía del MSJ Privilège Club ----------
-- Estos correos reciben su tarjeta automáticamente al crear su cuenta (o ya mismo, si la cuenta existe), y se renueva al iniciar sesión.
create table if not exists public.vip_cortesia (
  email text primary key check (email = lower(email)), nivel text not null check (nivel in ('gold','black')),
  meses integer not null default 12 check (meses between 1 and 120), created_at timestamptz not null default now()
);
alter table public.vip_cortesia enable row level security;
revoke all on public.vip_cortesia from public,anon,authenticated;
-- vence: fecha fija de la cortesía (si es null, se usan «meses» desde hoy). codigo: número de socio personalizado.
alter table public.vip_cortesia add column if not exists vence timestamptz;
alter table public.vip_cortesia add column if not exists codigo text unique;
-- Los tres administradores del equipo tienen Black Sovereign (S/ 39.90) de cortesía hasta el 31/12/2027.
insert into public.vip_cortesia (email,nivel,meses,vence,codigo) values
  ('samuelvillanuevachinchay15@gmail.com','black',12,'2027-12-31 23:59:59-05','MSJ SAMV BK26 VIP1'),
  ('ryzlogz@gmail.com','black',12,'2027-12-31 23:59:59-05',null),
  ('mayloquineche@gmail.com','black',12,'2027-12-31 23:59:59-05',null)
on conflict (email) do update set nivel = excluded.nivel,meses = excluded.meses,vence = excluded.vence,codigo = coalesce(excluded.codigo,public.vip_cortesia.codigo);

create or replace function public.aplicar_vip_cortesia(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.vip_cortesia%rowtype; v_email text; v_vence timestamptz;
begin
  select lower(email) into v_email from public.profiles where id = p_user;
  select * into v from public.vip_cortesia where email = v_email;
  if not found then return; end if;
  v_vence := coalesce(v.vence,now() + make_interval(months => v.meses));
  if v_vence <= now() then return; end if;
  -- Ya activa con ese nivel, vigencia y código: no se toca.
  if exists (select 1 from public.profiles where id = p_user and es_vip and nivel_vip = v.nivel and vip_expira >= v_vence
             and (v.codigo is null or codigo_socio = v.codigo)) then return; end if;
  update public.profiles set codigo_socio = null where codigo_socio = v.codigo and id <> p_user;
  update public.profiles set es_vip = true,nivel_vip = v.nivel,vip_expira = greatest(coalesce(vip_expira,now()),v_vence),
    codigo_socio = coalesce(v.codigo,codigo_socio,public.vip_codigo_nuevo()) where id = p_user;
  -- Una solicitud que quedó «en verificación» se cierra como cortesía; si no hay, se registra una nueva.
  update public.membresias_vip set estado = 'activa',nivel = v.nivel,monto = 0,referencia_pago = 'Cortesía MSJ',inicia = now(),vence = v_vence
    where user_id = p_user and estado = 'pendiente';
  if not found then
    insert into public.membresias_vip (user_id,nivel,periodo,monto,estado,referencia_pago,inicia,vence)
    values (p_user,v.nivel,'anual',0,'activa','Cortesía MSJ',now(),v_vence);
  end if;
  insert into public.auditoria_seguridad (evento,user_id,email,actor_id,detalle)
  values ('vip_activado',p_user,v_email,null,jsonb_build_object('nivel',v.nivel,'cortesia',true,'vence',v_vence));
end;
$$;
revoke all on function public.aplicar_vip_cortesia(uuid) from public,anon,authenticated;

-- Llamada por la tienda al iniciar sesión: solo puede aplicarse a la propia cuenta.
create or replace function public.reclamar_vip_cortesia()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then perform public.aplicar_vip_cortesia(auth.uid()); end if;
end;
$$;
revoke all on function public.reclamar_vip_cortesia() from public,anon;
grant execute on function public.reclamar_vip_cortesia() to authenticated;

create or replace function public.trigger_vip_cortesia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.aplicar_vip_cortesia(new.id);
  return new;
end;
$$;
revoke all on function public.trigger_vip_cortesia() from public,anon,authenticated;
drop trigger if exists vip_cortesia_on_profile on public.profiles;
create trigger vip_cortesia_on_profile after insert or update of email on public.profiles for each row execute function public.trigger_vip_cortesia();

-- Cuentas que ya existen.
select public.aplicar_vip_cortesia(p.id) from public.profiles p join public.vip_cortesia c on c.email = lower(p.email);

-- ---------- Comprobante de pago: boleta o factura ----------
-- La tienda registra los datos; la emisión electrónica ante SUNAT se hace con un proveedor OSE/PSE (p. ej. Nubefact) usando el RUC del negocio.
alter table public.orders add column if not exists comprobante_tipo text not null default 'boleta' check (comprobante_tipo in ('boleta','factura'));
alter table public.orders add column if not exists comprobante_doc text;
alter table public.orders add column if not exists comprobante_nombre text;
alter table public.orders add column if not exists comprobante_direccion text;
-- Correo al que se envía la boleta o factura cuando el equipo aprueba el pago (obligatorio en el checkout).
alter table public.orders add column if not exists comprobante_email text check (char_length(comprobante_email) <= 160);
grant select (comprobante_tipo,comprobante_doc,comprobante_nombre,comprobante_direccion,comprobante_email) on public.orders to authenticated;
drop function if exists public.set_order_invoice(uuid,text,text,text);
drop function if exists public.set_order_invoice(uuid,text,text,text,text);
create or replace function public.set_order_invoice(p_order uuid,p_tipo text,p_doc text default '',p_nombre text default '',p_direccion text default '',p_email text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_doc text := regexp_replace(coalesce(p_doc,''),'\D','','g'); v_email text := lower(nullif(trim(coalesce(p_email,'')),''));
begin
  if p_tipo not in ('boleta','factura') then raise exception 'Tipo de comprobante no válido.'; end if;
  if p_tipo = 'factura' and (v_doc !~ '^(10|20)[0-9]{9}$' or coalesce(trim(p_nombre),'') = '') then raise exception 'Para factura ingresa un RUC válido y la razón social.'; end if;
  if p_tipo = 'boleta' and (v_doc !~ '^[0-9]{8}$' or char_length(trim(coalesce(p_nombre,''))) < 3) then raise exception 'Para la boleta escribe tu DNI (8 dígitos) y tu nombre completo.'; end if;
  if v_email is not null and (v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 160) then raise exception 'Escribe un correo válido para enviarte tu comprobante.'; end if;
  -- Solo el dueño del pedido, solo en la primera hora tras la compra y antes de que el comprobante se emita.
  -- Sin correo (versiones anteriores de la tienda) se usa el de la cuenta, así nunca falta a quién enviarlo.
  update public.orders o set comprobante_tipo = p_tipo,comprobante_doc = nullif(v_doc,''),
    comprobante_nombre = left(nullif(trim(coalesce(p_nombre,'')),''),150),
    comprobante_direccion = case when p_tipo = 'factura' then left(nullif(trim(coalesce(p_direccion,'')),''),250) end,
    comprobante_email = coalesce(v_email,(select lower(p.email) from public.profiles p where p.id = o.user_id))
  where o.id = p_order and o.user_id = auth.uid() and o.created_at > now() - interval '1 hour' and o.comprobante_numero is null;
  if not found then raise exception 'Pedido no encontrado.'; end if;
end;
$$;
revoke all on function public.set_order_invoice(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.set_order_invoice(uuid,text,text,text,text,text) to authenticated;

-- ---------- Verificación de pagos con Yape/Lemon y emisión del comprobante ----------
-- 1) El cliente paga y envía su número de operación al crear el pedido (checkout_cart lo exige): el pago queda «pending».
-- 2) El panel avisa al equipo, que comprueba en su app que llegó el monto con ese número y lo aprueba o lo rechaza.
-- 3) Recién al aprobar (payment_status = 'paid') se numera la boleta o factura y el cliente puede verla e imprimirla.
alter table public.orders add column if not exists comprobante_serie text;
alter table public.orders add column if not exists comprobante_numero integer;
alter table public.orders add column if not exists comprobante_emitido_at timestamptz;
alter table public.orders add column if not exists pago_verificado_por uuid references public.profiles(id) on delete set null;
alter table public.orders add column if not exists pago_verificado_at timestamptz;
alter table public.orders add column if not exists pago_rechazo_motivo text check (char_length(pago_rechazo_motivo) <= 300);
-- 4) La Edge Function enviar-comprobante manda la boleta o factura al correo del cliente y deja constancia aquí.
alter table public.orders add column if not exists comprobante_enviado_at timestamptz;
alter table public.orders add column if not exists comprobante_enviado_a text;
create unique index if not exists orders_comprobante_key on public.orders (comprobante_serie,comprobante_numero) where comprobante_numero is not null;
grant select (comprobante_serie,comprobante_numero,comprobante_emitido_at,pago_verificado_at,pago_rechazo_motivo,comprobante_enviado_at,comprobante_enviado_a) on public.orders to authenticated;

-- Correlativo por serie: B001 boletas, F001 facturas. Solo lo toca la función de emisión.
create table if not exists public.comprobante_series (serie text primary key, ultimo integer not null default 0 check (ultimo >= 0));
alter table public.comprobante_series enable row level security;
revoke all on public.comprobante_series from public,anon,authenticated;
insert into public.comprobante_series (serie) values ('B001'),('F001') on conflict (serie) do nothing;

-- Cualquier paso a «paid» (botón Aprobar del panel o el selector de estado de pago, también en contra entrega)
-- registra quién verificó y emite el comprobante una sola vez.
create or replace function public.emitir_comprobante()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_serie text; v_numero integer;
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.pago_verificado_por := (select p.id from public.profiles p where p.id = auth.uid());
    new.pago_verificado_at := now();
    new.pago_rechazo_motivo := null;
    if new.comprobante_numero is null then
      v_serie := case when new.comprobante_tipo = 'factura' then 'F001' else 'B001' end;
      update public.comprobante_series set ultimo = ultimo + 1 where serie = v_serie returning ultimo into v_numero;
      new.comprobante_serie := v_serie;
      new.comprobante_numero := v_numero;
      new.comprobante_emitido_at := now();
    end if;
    update public.payments set status = 'paid' where order_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
revoke all on function public.emitir_comprobante() from public,anon,authenticated;
drop trigger if exists emitir_comprobante_on_paid on public.orders;
create trigger emitir_comprobante_on_paid before update of payment_status on public.orders for each row execute function public.emitir_comprobante();

-- Aprobar: el equipo confirmó en su app que llegó el pago. Si el cliente escribió mal el número, se puede corregir aquí.
create or replace function public.aprobar_pago_billetera(p_order uuid,p_operacion text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_op text := nullif(regexp_replace(coalesce(p_operacion,''),'\D','','g'),'');
begin
  if not (public.has_role('admin') or public.has_role('staff')) then raise exception 'Solo el equipo de MSJ puede verificar pagos.'; end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_order.payment_method not in ('yape','lemon') or v_order.payment_status <> 'pending' or v_order.status = 'cancelled' then
    raise exception 'Este pedido no tiene un pago por verificar.';
  end if;
  if v_op is not null and v_op is distinct from v_order.yape_operation then
    if char_length(v_op) not between 4 and 12 then raise exception 'El número de operación debe tener de 4 a 12 dígitos.'; end if;
    if exists (select 1 from public.payments where provider = v_order.payment_method and provider_reference = v_op and status <> 'failed' and order_id <> p_order) then
      raise exception 'Ese número de operación ya está registrado en otro pedido.';
    end if;
    update public.payments set provider_reference = v_op where order_id = p_order and status = 'pending';
  end if;
  update public.orders set payment_status = 'paid',yape_operation = coalesce(v_op,yape_operation),
    status = case when status = 'pending' then 'confirmed' else status end
  where id = p_order returning * into v_order;
  return jsonb_build_object('serie',v_order.comprobante_serie,'numero',v_order.comprobante_numero,
    'codigo',v_order.comprobante_serie || '-' || lpad(v_order.comprobante_numero::text,8,'0'));
end;
$$;
revoke all on function public.aprobar_pago_billetera(uuid,text) from public,anon;
grant execute on function public.aprobar_pago_billetera(uuid,text) to authenticated;

-- Rechazar: la operación no existe o el monto no coincide. El pedido se anula, vuelve el stock y el uso del cupón,
-- y el número de operación queda libre por si el cliente solo se equivocó al escribirlo.
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
  -- Con database/v2026.sql instalado, el trigger orders_restock_on_cancel ya devolvió el stock y el cupón al cancelar:
  -- aquí solo se hace cuando ese trigger no existe, para no devolverlo dos veces.
  if not exists (select 1 from pg_trigger where tgname = 'orders_restock_on_cancel' and not tgisinternal) then
    -- «ajuste»: es el motivo de inventario válido en schema.sql y gestion.sql para una devolución de stock.
    perform set_config('msj.stock_reason','ajuste',true);
    update public.product_variants v set stock = v.stock + i.quantity
    from (select variant_id,sum(quantity)::integer as quantity from public.order_items where order_id = p_order and variant_id is not null group by variant_id) i
    where v.id = i.variant_id;
    if v_order.coupon_code is not null then
      update public.coupons set used_count = greatest(used_count - 1,0) where code = v_order.coupon_code;
    end if;
  end if;
end;
$$;
revoke all on function public.rechazar_pago_billetera(uuid,text) from public,anon;
grant execute on function public.rechazar_pago_billetera(uuid,text) to authenticated;

-- Comprobante para ver o imprimir: solo existe una vez emitido, y solo lo ve el titular del pedido o el equipo.
-- Los precios incluyen IGV (18 %); la donación no es venta y no forma parte del comprobante.
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
    and (o.user_id = auth.uid() or public.has_role('admin') or public.has_role('staff'));
$$;
revoke all on function public.comprobante_pedido(uuid) from public,anon;
grant execute on function public.comprobante_pedido(uuid) to authenticated;

-- Consulta de pedido sin iniciar sesión: número de pedido (los 8 primeros caracteres del id, como lo ven cliente y panel)
-- + celular de entrega. Pedir ambos evita que alguien recorra pedidos ajenos; no devuelve nombre ni dirección.
create or replace function public.consultar_pedido(p_codigo text,p_celular text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with q as (select lower(regexp_replace(coalesce(p_codigo,''),'[^0-9A-Fa-f]','','g')) as codigo,
                    right(regexp_replace(coalesce(p_celular,''),'\D','','g'),9) as celular)
  select jsonb_build_object('codigo',upper(left(o.id::text,8)),'fecha',o.created_at,'estado',o.status,'pago',o.payment_status,
    'metodo',o.payment_method,'total',o.total,'ciudad',o.city,'operacion',right(o.yape_operation,4),
    'comprobante',case when o.comprobante_numero is not null then o.comprobante_serie || '-' || lpad(o.comprobante_numero::text,8,'0') end,
    'comprobante_tipo',o.comprobante_tipo,'enviado',o.comprobante_enviado_at is not null,'rechazo',o.pago_rechazo_motivo,
    'articulos',(select coalesce(sum(i.quantity),0) from public.order_items i where i.order_id = o.id))
  from public.orders o cross join q
  where char_length(q.codigo) = 8 and char_length(q.celular) = 9
    and left(o.id::text,8) = q.codigo and right(regexp_replace(o.phone,'\D','','g'),9) = q.celular
  order by o.created_at desc limit 1;
$$;
revoke all on function public.consultar_pedido(text,text) from public;
grant execute on function public.consultar_pedido(text,text) to anon,authenticated;

-- Constancia del envío por correo (la llama la Edge Function con la sesión del administrador que aprobó).
create or replace function public.marcar_comprobante_enviado(p_order uuid,p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.has_role('admin') or public.has_role('staff')) then raise exception 'Solo el equipo de MSJ puede enviar comprobantes.'; end if;
  update public.orders set comprobante_enviado_at = now(),comprobante_enviado_a = left(lower(trim(p_email)),160)
  where id = p_order and comprobante_numero is not null;
  if not found then raise exception 'El comprobante de ese pedido aún no se emitió.'; end if;
end;
$$;
revoke all on function public.marcar_comprobante_enviado(uuid,text) from public,anon;
grant execute on function public.marcar_comprobante_enviado(uuid,text) to authenticated;

-- ---------- Consulta de RUC (SUNAT) y DNI (RENIEC) desde la base de datos ----------
-- Usa la extensión http de Supabase y el servicio público apis.net.pe v1 (sin token). Solo clientes con sesión,
-- con un límite de 20 consultas por hora por cuenta para evitar abusos.
create extension if not exists http with schema extensions;
create table if not exists public.document_lookups (
  id bigserial primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null, created_at timestamptz not null default now()
);
create index if not exists document_lookups_user_idx on public.document_lookups(user_id,created_at desc);
alter table public.document_lookups enable row level security;
revoke all on public.document_lookups from public,anon,authenticated;

create or replace function public.consulta_documento(p_tipo text,p_numero text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_numero text := regexp_replace(coalesce(p_numero,''),'\D','','g');
  v_tipo text := lower(coalesce(p_tipo,'')); v_response extensions.http_response; v_data jsonb; v_nombre text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para consultar.'; end if;
  if v_tipo = 'ruc' and v_numero !~ '^(10|20)[0-9]{9}$' then raise exception 'El RUC debe tener 11 dígitos y empezar con 10 o 20.'; end if;
  if v_tipo = 'dni' and v_numero !~ '^[0-9]{8}$' then raise exception 'El DNI debe tener 8 dígitos.'; end if;
  if v_tipo not in ('ruc','dni') then raise exception 'Tipo de documento no válido.'; end if;
  if (select count(*) from public.document_lookups where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Llegaste al límite de consultas por hora. Escribe los datos a mano.';
  end if;
  insert into public.document_lookups (user_id,tipo) values (auth.uid(),v_tipo);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','6000');
  select * into v_response from extensions.http_get('https://api.apis.net.pe/v1/' || v_tipo || '?numero=' || v_numero);
  if v_response.status <> 200 then return jsonb_build_object('encontrado',false); end if;
  begin v_data := v_response.content::jsonb; exception when others then return jsonb_build_object('encontrado',false); end;
  v_nombre := nullif(trim(coalesce(v_data ->> 'nombre',v_data ->> 'razonSocial','')),'');
  if v_nombre is null then return jsonb_build_object('encontrado',false); end if;
  return jsonb_build_object('encontrado',true,'tipo',v_tipo,'numero',v_numero,'nombre',v_nombre,
    'estado',coalesce(v_data ->> 'estado',''),'condicion',coalesce(v_data ->> 'condicion',''),
    'direccion',trim(coalesce(v_data ->> 'direccion','')),'fuente',case when v_tipo = 'ruc' then 'SUNAT' else 'RENIEC' end);
end;
$$;
revoke all on function public.consulta_documento(text,text) from public,anon;
grant execute on function public.consulta_documento(text,text) to authenticated;
