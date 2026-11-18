-- MSJ Fashion Store · Promociones del informe «Análisis de precios, márgenes y promociones» (18 nov 2026)
-- Lleva a la tienda las ideas del informe del curso Comercio Electrónico:
--   1) Los 2x1 de Black & White Friday y Navidad pasan a «2da unidad al 50%» (Tabla 9: dejan de perder dinero).
--   2) Campañas con fecha de inicio y fin (Tabla 5) + oferta relámpago de 24 h (Tabla 8).
--   3) 10 packs con precio especial (Tabla 6): el descuento se aplica solo cuando el combo está en la bolsa.
--   4) Regalo con compra (gorra con el Perfume Oud Night), envío gratis desde S/ 150 en diciembre y 3x2 del Top Alba.
--   5) Condiciones de cada oferta (Tabla 8), visibles para el cliente.
-- Regla para no acumular: si un producto ya tiene otra oferta en la misma campaña (2da al 50%, 3x2 o regalo),
-- no lleva además el % de la Tabla 5 (Camisa Nube en Cyber, Top Alba en Verano, Perfume Oud Night en Previa Navidad).
--
-- El precio real lo calcula checkout_cart en el servidor; la página solo lo muestra. Ejecutar una vez en
-- Supabase → SQL Editor, DESPUÉS de campaigns.sql (y antes de v2026.sql si todavía no lo corrieron). Se puede repetir.

begin;

-- 1) Promociones de toda la tienda: nuevos tipos «2da al 50%» y «3x2», promociones por producto y condiciones.
alter table public.promotions drop constraint if exists promotions_kind_check;
alter table public.promotions add constraint promotions_kind_check check (kind in ('2x1','percent','2da50','3x2'));
alter table public.promotions add column if not exists product_slugs text[];
alter table public.promotions add column if not exists conditions text not null default '';

insert into public.promotions (code,name,tagline,kind,discount_value,category_slugs,product_slugs,theme,starts_at,ends_at,conditions) values
  ('BLACK-FRIDAY','Black & White Friday','La tienda se viste de blanco y negro: la 2da unidad al 50% en polos, poleras, jeans, pantalones, joggers y zapatillas.','2da50',0,array['polos','poleras','jeans','pantalones','joggers','zapatillas'],null,'bw','2026-11-27 00:00-05','2026-12-01 00:00-05',
   'El 50% se aplica a la unidad de menor precio de cada par. Hasta agotar stock. No se acumula con el precio de socio VIP: se aplica el mejor.'),
  ('CYBER-MSJ','Cyber MSJ','Hasta 15% en camisas, polos, pantalones, zapatillas y mochilas, y la 2da Camisa Nube al 50%.','2da50',0,null,array['camisa-nube'],null,'2026-12-02 00:00-05','2026-12-09 00:00-05',
   'El 50% se aplica a la segunda Camisa Nube; tallas S a XL. Los descuentos de la campaña rigen del 2 al 8 de diciembre de 2026.'),
  ('NAVIDAD','Navidad MSJ','Regalos para dos: la 2da unidad al 50% en perfumes, relojes, lentes y joyería.','2da50',0,array['perfumes','relojes','lentes','joyeria'],null,null,'2026-12-18 00:00-05','2026-12-25 00:00-05',
   'El 50% se aplica a la unidad de menor precio de cada par. Hasta agotar stock.'),
  ('VERANO-MSJ','Verano MSJ','10% en vestidos, lentes y gorras de verano, y el Top Alba en 3x2.','3x2',0,null,array['top-alba'],null,'2027-01-02 00:00-05','2027-01-16 00:00-05',
   'Lleva tres Top Alba y paga dos (sale gratis el de menor precio); tallas XS a L; hasta agotar stock.')
on conflict (code) do update
set name = excluded.name, tagline = excluded.tagline, kind = excluded.kind, discount_value = excluded.discount_value,
    category_slugs = excluded.category_slugs, product_slugs = excluded.product_slugs, theme = excluded.theme,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at, conditions = excluded.conditions, is_active = true;

create or replace function public.active_promotion()
returns public.promotions language sql stable security definer set search_path = '' as $$
  select * from public.promotions where is_active and now() >= starts_at and now() < ends_at order by starts_at desc limit 1;
$$;
revoke all on function public.active_promotion() from public;
grant execute on function public.active_promotion() to anon,authenticated;

-- 2) Reglas de campaña con fecha: descuento por producto, envío gratis desde un monto y regalo con compra.
create table if not exists public.campaign_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  campaign text not null,
  kind text not null check (kind in ('descuento','envio_gratis','regalo')),
  product_slug text,
  discount_percent numeric(5,2) check (discount_percent is null or discount_percent between 0 and 90),
  min_subtotal numeric(10,2) check (min_subtotal is null or min_subtotal >= 0),
  gift_product_slug text,
  gift_stock integer check (gift_stock is null or gift_stock >= 0),
  starts_at timestamptz not null, ends_at timestamptz not null,
  conditions text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.campaign_rules enable row level security;
drop policy if exists "reglas de campaña visibles" on public.campaign_rules;
create policy "reglas de campaña visibles" on public.campaign_rules for select using (is_active);
drop policy if exists "administran reglas de campaña" on public.campaign_rules;
create policy "administran reglas de campaña" on public.campaign_rules for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
grant select on public.campaign_rules to anon,authenticated;
grant insert,update,delete on public.campaign_rules to authenticated;

insert into public.campaign_rules (code,campaign,kind,product_slug,discount_percent,min_subtotal,gift_product_slug,gift_stock,starts_at,ends_at,conditions) values
  -- Fin de temporada fría (19 – 30 nov.): liquidación al 20%.
  ('FRIA-chaqueta-norte','Fin de temporada fría','descuento','chaqueta-norte',20,null,null,null,'2026-11-19 00:00-05','2026-12-01 00:00-05','Del 19 al 30 de noviembre de 2026; solo stock de temporada fría.'),
  ('FRIA-chompa-suave','Fin de temporada fría','descuento','chompa-suave',20,null,null,null,'2026-11-19 00:00-05','2026-12-01 00:00-05','Del 19 al 30 de noviembre de 2026; solo stock de temporada fría.'),
  -- Oferta relámpago de 24 horas (26 nov.).
  ('RELAMPAGO-chaqueta-norte','Relámpago 24 h','descuento','chaqueta-norte',30,null,null,null,'2026-11-26 00:00-05','2026-11-27 00:00-05','Solo el 26 de noviembre de 2026 (24 horas); solo stock de temporada fría; máximo dos por cliente.'),
  -- Cyber MSJ (2 – 8 dic.). La Camisa Nube va con «2da al 50%» (promoción CYBER-MSJ).
  ('CYBER-pantalon-trazo','Cyber MSJ','descuento','pantalon-trazo',15,null,null,null,'2026-12-02 00:00-05','2026-12-09 00:00-05','Del 2 al 8 de diciembre de 2026; hasta agotar stock.'),
  ('CYBER-camisa-oxford','Cyber MSJ','descuento','camisa-oxford',15,null,null,null,'2026-12-02 00:00-05','2026-12-09 00:00-05','Del 2 al 8 de diciembre de 2026; hasta agotar stock.'),
  ('CYBER-polera-crop','Cyber MSJ','descuento','polera-crop',15,null,null,null,'2026-12-02 00:00-05','2026-12-09 00:00-05','Del 2 al 8 de diciembre de 2026; hasta agotar stock.'),
  ('CYBER-polo-clasico-premium','Cyber MSJ','descuento','polo-clasico-premium',10,null,null,null,'2026-12-02 00:00-05','2026-12-09 00:00-05','Del 2 al 8 de diciembre de 2026; hasta agotar stock.'),
  ('CYBER-zapatillas-urbanas','Cyber MSJ','descuento','zapatillas-urbanas',15,null,null,null,'2026-12-02 00:00-05','2026-12-09 00:00-05','Del 2 al 8 de diciembre de 2026; hasta agotar stock.'),
  ('CYBER-mochila-urbana','Cyber MSJ','descuento','mochila-urbana',15,null,null,null,'2026-12-02 00:00-05','2026-12-09 00:00-05','Del 2 al 8 de diciembre de 2026; hasta agotar stock.'),
  -- Previa Navidad (9 – 17 dic.). El Perfume Oud Night va con regalo (recomendación 3 del informe).
  ('PREVIA-cinturon-clasico','Previa Navidad','descuento','cinturon-clasico',15,null,null,null,'2026-12-09 00:00-05','2026-12-18 00:00-05','Del 9 al 17 de diciembre de 2026; hasta agotar stock.'),
  ('PREVIA-collar-dorado','Previa Navidad','descuento','collar-dorado',15,null,null,null,'2026-12-09 00:00-05','2026-12-18 00:00-05','Del 9 al 17 de diciembre de 2026; hasta agotar stock.'),
  ('PREVIA-bolso-linea','Previa Navidad','descuento','bolso-linea',15,null,null,null,'2026-12-09 00:00-05','2026-12-18 00:00-05','Del 9 al 17 de diciembre de 2026; hasta agotar stock.'),
  ('PREVIA-vestido-elegante','Previa Navidad','descuento','vestido-elegante',15,null,null,null,'2026-12-09 00:00-05','2026-12-18 00:00-05','Del 9 al 17 de diciembre de 2026; hasta agotar stock.'),
  ('PREVIA-tacones-aura','Previa Navidad','descuento','tacones-aura',15,null,null,null,'2026-12-09 00:00-05','2026-12-18 00:00-05','Del 9 al 17 de diciembre de 2026; hasta agotar stock.'),
  ('PREVIA-perfume-aqua-fresh','Previa Navidad','descuento','perfume-aqua-fresh',10,null,null,null,'2026-12-09 00:00-05','2026-12-18 00:00-05','Del 9 al 17 de diciembre de 2026; hasta agotar stock.'),
  ('PREVIA-regalo-oud-night','Previa Navidad','regalo','perfume-oud-night',null,null,'gorra-msj-classic',30,'2026-12-09 00:00-05','2026-12-18 00:00-05','Gorra MSJ Classic de regalo con el Perfume Oud Night, del 9 al 17 de diciembre de 2026. Hasta agotar 30 gorras; la gorra no se cambia por dinero.'),
  -- Envío gratis desde S/ 150 todo diciembre (todas las zonas).
  ('DICIEMBRE-envio-gratis','Envío gratis en diciembre','envio_gratis',null,null,150,null,null,'2026-12-01 00:00-05','2027-01-01 00:00-05','Pedidos desde S/ 150 (después de descuentos) del 1 al 31 de diciembre de 2026; un envío gratis por pedido.'),
  -- Verano MSJ (2 – 15 ene.). El Top Alba va con 3x2 (promoción VERANO-MSJ).
  ('VERANO-vestido-brisa','Verano MSJ','descuento','vestido-brisa',10,null,null,null,'2027-01-02 00:00-05','2027-01-16 00:00-05','Del 2 al 15 de enero de 2027; hasta agotar stock.'),
  ('VERANO-lentes-sol-msj','Verano MSJ','descuento','lentes-sol-msj',10,null,null,null,'2027-01-02 00:00-05','2027-01-16 00:00-05','Del 2 al 15 de enero de 2027; hasta agotar stock.'),
  ('VERANO-gorra-msj-classic','Verano MSJ','descuento','gorra-msj-classic',10,null,null,null,'2027-01-02 00:00-05','2027-01-16 00:00-05','Del 2 al 15 de enero de 2027; hasta agotar stock.')
on conflict (code) do update
set campaign = excluded.campaign, kind = excluded.kind, product_slug = excluded.product_slug, discount_percent = excluded.discount_percent,
    min_subtotal = excluded.min_subtotal, gift_product_slug = excluded.gift_product_slug, starts_at = excluded.starts_at,
    ends_at = excluded.ends_at, conditions = excluded.conditions, is_active = true;
-- (gift_stock no se reinicia al repetir el script: conserva cuántas gorras de regalo quedan.)

-- Mayor descuento de campaña vigente para un producto (0 si no tiene).
create or replace function public.campaign_discount(p_slug text)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(max(discount_percent),0) from public.campaign_rules
  where kind = 'descuento' and is_active and product_slug = p_slug and now() >= starts_at and now() < ends_at;
$$;
-- Monto mínimo de la campaña de envío gratis vigente (null si no hay).
create or replace function public.campaign_free_shipping_from()
returns numeric language sql stable security definer set search_path = '' as $$
  select min(min_subtotal) from public.campaign_rules
  where kind = 'envio_gratis' and is_active and now() >= starts_at and now() < ends_at;
$$;
revoke all on function public.campaign_discount(text) from public;
revoke all on function public.campaign_free_shipping_from() from public;
grant execute on function public.campaign_discount(text) to anon,authenticated;
grant execute on function public.campaign_free_shipping_from() to anon,authenticated;

-- 3) Packs y combos (Tabla 6). Precio fijo del pack; termina en .90.
create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  product_slugs text[] not null check (array_length(product_slugs,1) between 2 and 4),
  price numeric(10,2) not null check (price > 0),
  sort_order integer not null default 0,
  starts_at timestamptz, ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.packs enable row level security;
drop policy if exists "packs visibles" on public.packs;
create policy "packs visibles" on public.packs for select using (is_active);
drop policy if exists "administran packs" on public.packs;
create policy "administran packs" on public.packs for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
grant select on public.packs to anon,authenticated;
grant insert,update,delete on public.packs to authenticated;

insert into public.packs (slug,name,description,product_slugs,price,sort_order) values
  ('noche-elegante','Noche Elegante','Vestido, tacones y collar listos para una noche especial.',array['vestido-elegante','tacones-aura','collar-dorado'],308.90,1),
  ('noche-para-el','Noche para él','Perfume intenso y camisa clásica para salir de noche.',array['perfume-oud-night','camisa-oxford'],285.90,2),
  ('pack-urbano','Pack Urbano','Zapatillas y mochila para moverte por la ciudad.',array['zapatillas-urbanas','mochila-urbana'],200.90,3),
  ('abrigada-mujer','Abrigada Mujer','Chompa y polera para los días fríos.',array['chompa-suave','polera-crop'],179.90,4),
  ('regalo-para-ella','Regalo para ella','Perfume fresco y bolso compacto: el regalo resuelto.',array['perfume-aqua-fresh','bolso-linea'],167.90,5),
  ('look-oficina-hombre','Look Oficina Hombre','Camisa Oxford y cinturón clásico para la oficina.',array['camisa-oxford','cinturon-clasico'],126.90,6),
  ('casual-hombre','Casual Hombre','Polo de algodón y gorra para el fin de semana.',array['polo-clasico-premium','gorra-msj-classic'],120.90,7),
  ('verano-mujer','Verano Mujer','Vestido fresco y lentes de sol para el verano.',array['vestido-brisa','lentes-sol-msj'],116.90,8),
  ('capas-hombre','Capas Hombre','Chaqueta ligera y camisa para vestir en capas.',array['chaqueta-norte','camisa-nube'],99.90,9),
  ('basicos-mujer','Básicos Mujer','Top y pantalón que combinan con todo.',array['top-alba','pantalon-trazo'],70.90,10)
on conflict (slug) do update
set name = excluded.name, description = excluded.description, product_slugs = excluded.product_slugs,
    price = excluded.price, sort_order = excluded.sort_order, is_active = true;

-- 4) Packs + promoción del día sobre las unidades de la bolsa. La página (app.js) usa el mismo cálculo.
--    p_units: un elemento por unidad: {"slug": ..., "category": ..., "price": precio ya rebajado (oferta o socio)}.
--    Primero se arman los packs (de más productos y mayor precio primero; solo si el pack sale más barato que comprar
--    por separado) y la promoción del día se aplica a las unidades que no entraron en un pack.
create or replace function public.cart_promotions(p_units jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_n integer := coalesce(jsonb_array_length(p_units),0);
  v_used boolean[] := array_fill(false, array[greatest(coalesce(jsonb_array_length(p_units),0),1)]);
  v_pack record; v_pick integer[]; v_slug text; v_found integer; v_sum numeric; v_ok boolean; i integer;
  v_pack_amount numeric := 0; v_names text[] := '{}';
  v_promo public.promotions%rowtype; v_prices numeric[]; v_promo_amount numeric := 0;
begin
  for v_pack in
    select * from public.packs
    where is_active and (starts_at is null or now() >= starts_at) and (ends_at is null or now() < ends_at)
    order by array_length(product_slugs,1) desc, price desc
  loop
    loop
      v_pick := '{}'; v_ok := true; v_sum := 0;
      foreach v_slug in array v_pack.product_slugs loop
        v_found := null;
        for i in 1..v_n loop
          if not v_used[i] and not (i = any(v_pick)) and p_units -> (i - 1) ->> 'slug' = v_slug then v_found := i; exit; end if;
        end loop;
        if v_found is null then v_ok := false; exit; end if;
        v_pick := v_pick || v_found;
        v_sum := v_sum + (p_units -> (v_found - 1) ->> 'price')::numeric;
      end loop;
      exit when not v_ok or v_sum <= v_pack.price;
      foreach i in array v_pick loop v_used[i] := true; end loop;
      v_pack_amount := v_pack_amount + (v_sum - v_pack.price);
      v_names := v_names || v_pack.name;
    end loop;
  end loop;

  select * into v_promo from public.active_promotion();
  if v_promo.id is not null then
    select coalesce(array_agg(s.u order by s.u desc),'{}') into v_prices from (
      select (t.e ->> 'price')::numeric as u
      from jsonb_array_elements(p_units) with ordinality as t(e,k)
      where not v_used[t.k::integer]
        and ((v_promo.category_slugs is null and v_promo.product_slugs is null)
          or t.e ->> 'category' = any(coalesce(v_promo.category_slugs,'{}'))
          or t.e ->> 'slug' = any(coalesce(v_promo.product_slugs,'{}')))
    ) s;
    v_promo_amount := case v_promo.kind
      when '2x1'   then (select coalesce(sum(x.p),0) from unnest(v_prices) with ordinality as x(p,n) where x.n % 2 = 0)
      when '2da50' then round((select coalesce(sum(x.p),0) from unnest(v_prices) with ordinality as x(p,n) where x.n % 2 = 0) * 0.5,2)
      when '3x2'   then (select coalesce(sum(x.p),0) from unnest(v_prices) with ordinality as x(p,n) where x.n % 3 = 0)
      when 'percent' then round((select coalesce(sum(x.p),0) from unnest(v_prices) as x(p)) * v_promo.discount_value / 100,2)
      else 0 end;
  end if;
  return jsonb_build_object('promo_amount',round(v_promo_amount,2),'pack_amount',round(v_pack_amount,2),'packs',to_jsonb(v_names),
    'promo_code',case when v_promo_amount > 0 then v_promo.code end);
end;
$$;
revoke all on function public.cart_promotions(jsonb) from public;
grant execute on function public.cart_promotions(jsonb) to authenticated;

-- 5) Regalo con compra: agrega al pedido el producto de regalo (S/ 0.00) mientras quede stock del regalo.
create or replace function public.apply_campaign_gifts(p_order_id uuid,p_slugs text[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_rule public.campaign_rules%rowtype; v_variant uuid; v_name text; v_label text;
begin
  for v_rule in
    select * from public.campaign_rules
    where kind = 'regalo' and is_active and now() >= starts_at and now() < ends_at
      and product_slug = any(p_slugs) and coalesce(gift_stock,1) > 0
    for update
  loop
    select v.id,p.name,v.size || ' / ' || v.color into v_variant,v_name,v_label
      from public.product_variants v join public.products p on p.id = v.product_id
      where p.slug = v_rule.gift_product_slug and v.is_active and v.stock > 0
      order by v.stock desc limit 1 for update of v;
    if found then
      insert into public.order_items (order_id,variant_id,product_name,variant_label,unit_price,quantity)
      values (p_order_id,v_variant,v_name || ' (regalo)',v_label,0,1);
      update public.product_variants set stock = stock - 1 where id = v_variant;
      update public.campaign_rules set gift_stock = gift_stock - 1 where id = v_rule.id and gift_stock is not null;
    end if;
  end loop;
end;
$$;
revoke all on function public.apply_campaign_gifts(uuid,text[]) from public;

-- 6) Checkout con packs, campañas, envío gratis y regalo (misma función de campaigns.sql con esos cambios).
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
  -- Informe de precios: packs, campañas con fecha, envío gratis y regalo con compra.
  v_slug text; v_slugs text[] := '{}'; v_units_json jsonb := '[]'::jsonb; v_promo_result jsonb; v_pack_amount numeric(10,2) := 0; v_free_from numeric;
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
    select coalesce(v.price,p.price),p.discount_percent,v.stock,p.name,v.size,v.color,p.vip_only,c.slug,p.slug into v_price,v_discount,v_stock,v_product_name,v_size,v_color,v_vip_only,v_category,v_slug
      from public.product_variants v join public.products p on p.id = v.product_id left join public.categories c on c.id = p.category_id
      where v.id = v_variant_id and v.is_active and p.is_active for update of v;
    if not found then raise exception 'Variante no disponible.'; end if;
    v_discount := greatest(v_discount,public.campaign_discount(v_slug));
    if v_vip_only and v_vip_pct = 0 then raise exception '% es exclusiva para socios MSJ Privilège.',v_product_name; end if;
    if v_stock < v_quantity then raise exception 'Stock insuficiente para %.',v_product_name; end if;
    -- Sin acumulación: se aplica el mayor entre el descuento de oferta y el de socio.
    v_public_price := round(v_price * (1 - v_discount / 100),2);
    v_price := round(v_price * (1 - greatest(v_discount,v_vip_pct) / 100),2);
    v_vip_saving := v_vip_saving + ((v_public_price - v_price) * v_quantity);
    v_subtotal := v_subtotal + (v_price * v_quantity);
    -- Cada unidad pasa a cart_promotions (packs y promoción del día) con su producto, categoría y precio ya rebajado.
    v_units_json := v_units_json || (select jsonb_agg(jsonb_build_object('slug',v_slug,'category',v_category,'price',v_price)) from generate_series(1,v_quantity));
    v_slugs := v_slugs || v_slug;
  end loop;
  v_promo_result := public.cart_promotions(v_units_json);
  v_pack_amount := (v_promo_result ->> 'pack_amount')::numeric;
  v_promo_amount := (v_promo_result ->> 'promo_amount')::numeric + v_pack_amount;
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
  -- Campaña «Envío gratis desde S/ X»: baja el mínimo en todas las zonas mientras esté vigente.
  v_free_from := public.campaign_free_shipping_from();
  if v_zone.id is not null and v_free_from is not null and (v_subtotal - v_promo_amount - v_discount_amount) >= v_free_from then v_shipping := 0; end if;
  v_total := v_subtotal - v_promo_amount - v_discount_amount + v_shipping + v_donation;
  perform set_config('msj.stock_reason','venta',true);
  insert into public.orders (id,user_id,payment_method,payment_status,recipient,shipping_address,city,phone,subtotal,discount_amount,coupon_code,shipping_zone_id,shipping_amount,total,nivel_vip,vip_discount_amount,promo_code,promo_discount_amount,donation_amount,yape_operation,donation_cause)
  values (v_order_id,v_user_id,p_payment_method,case when p_payment_method in ('yape','lemon') then 'pending' else 'unpaid' end,p_address ->> 'recipient',p_address ->> 'address',p_address ->> 'city',coalesce(p_address ->> 'phone',''),
    v_subtotal,v_discount_amount,v_code,v_zone.id,v_shipping,v_total,v_vip_level,v_vip_saving,nullif(concat_ws('+',v_promo_result ->> 'promo_code',case when v_pack_amount > 0 then 'PACK' end),''),v_promo_amount,v_donation,v_yape,case when v_donation > 0 then coalesce(p_donation_cause,'el-nino') end);
  -- El pago con Yape o Lemon queda «pendiente» hasta que el equipo confirma en su app que llegó el monto con ese número de operación.
  if p_payment_method in ('yape','lemon') then
    insert into public.payments (order_id,provider,provider_reference,amount,status) values (v_order_id,p_payment_method,v_yape,v_total,'pending');
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_variant_id := (v_item ->> 'variant_id')::uuid; v_quantity := (v_item ->> 'quantity')::integer;
    select coalesce(v.price,p.price),p.discount_percent,p.name,v.size,v.color,p.slug into v_price,v_discount,v_product_name,v_size,v_color,v_slug
      from public.product_variants v join public.products p on p.id = v.product_id where v.id = v_variant_id;
    v_discount := greatest(v_discount,public.campaign_discount(v_slug));
    v_price := round(v_price * (1 - greatest(v_discount,v_vip_pct) / 100),2);
    insert into public.order_items (order_id,variant_id,product_name,variant_label,unit_price,quantity)
    values (v_order_id,v_variant_id,v_product_name,v_size || ' / ' || v_color,v_price,v_quantity);
    update public.product_variants set stock = stock - v_quantity where id = v_variant_id;
  end loop;
  perform public.apply_campaign_gifts(v_order_id,v_slugs);
  return v_order_id;
end;
$$;
revoke all on function public.checkout_cart(jsonb,text,jsonb,text,numeric,text,text) from public;
grant execute on function public.checkout_cart(jsonb,text,jsonb,text,numeric,text,text) to authenticated;

commit;

-- 7) Verificación: promociones, reglas de campaña y packs cargados.
select code, name, kind, starts_at, ends_at from public.promotions where ends_at > now() order by starts_at;
select campaign, count(*) as reglas from public.campaign_rules group by campaign order by min(starts_at);
select name, price from public.packs order by sort_order;