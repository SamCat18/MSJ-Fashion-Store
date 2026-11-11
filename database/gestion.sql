-- MSJ Fashion Store · Gestión: proveedores, ingresos de mercadería, costo de productos y reporte de ganancias.
-- Ejecuta este archivo DESPUÉS de database/schema.sql y database/campaigns.sql. Es idempotente.

-- ---------- Costo de cada producto ----------
-- cost_price: lo que le cuesta a MSJ cada unidad. Si está vacío, el reporte usa el 55 % del precio de venta como costo estimado.
alter table public.products add column if not exists cost_price numeric(10,2) check (cost_price is null or cost_price >= 0);

-- Movimientos de inventario: se agrega el motivo «compra» (ingreso de mercadería de un proveedor).
alter table public.inventory_movements drop constraint if exists inventory_movements_reason_check;
-- (devolucion y mercado_libre los usa database/v2026.sql; se incluyen para poder ejecutar este archivo en cualquier orden).
alter table public.inventory_movements add constraint inventory_movements_reason_check check (reason in ('venta','ajuste','alta','compra','devolucion','mercado_libre'));

-- ---------- Proveedores ----------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 2 and 120),
  ruc text check (ruc is null or ruc ~ '^(10|20)[0-9]{9}$'), contact text not null default '' check (char_length(contact) <= 120),
  phone text not null default '' check (char_length(phone) <= 30), email text not null default '' check (char_length(email) <= 160),
  category text not null default '' check (char_length(category) <= 80), lead_days integer not null default 7 check (lead_days between 0 and 120),
  is_active boolean not null default true, created_at timestamptz not null default now()
);
-- Ingresos de mercadería: pedidos a proveedores; al marcarlos como recibidos suman stock y registran el movimiento.
create table if not exists public.supplier_deliveries (
  id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.suppliers(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 10000), unit_cost numeric(10,2) not null check (unit_cost >= 0),
  status text not null default 'pendiente' check (status in ('pendiente','recibido','cancelado')),
  expected_at date not null default (current_date + 7), received_at timestamptz, notes text not null default '' check (char_length(notes) <= 300),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(), created_at timestamptz not null default now()
);
create index if not exists supplier_deliveries_status_idx on public.supplier_deliveries(status,expected_at);
alter table public.suppliers enable row level security;
alter table public.supplier_deliveries enable row level security;
drop policy if exists suppliers_admin on public.suppliers;
create policy suppliers_admin on public.suppliers for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists deliveries_admin on public.supplier_deliveries;
create policy deliveries_admin on public.supplier_deliveries for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
revoke all on public.suppliers,public.supplier_deliveries from public,anon;
grant select,insert,update on public.suppliers,public.supplier_deliveries to authenticated;
drop trigger if exists audit_suppliers on public.suppliers;
create trigger audit_suppliers after insert or update or delete on public.suppliers for each row execute function public.log_audit_change();
drop trigger if exists audit_supplier_deliveries on public.supplier_deliveries;
create trigger audit_supplier_deliveries after insert or update or delete on public.supplier_deliveries for each row execute function public.log_audit_change();

-- Recibir un ingreso: suma stock (queda en inventory_movements como «compra») y actualiza el costo del producto.
create or replace function public.receive_delivery(p_delivery uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.supplier_deliveries%rowtype;
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  select * into v from public.supplier_deliveries where id = p_delivery and status = 'pendiente' for update;
  if not found then raise exception 'El ingreso ya no está pendiente.'; end if;
  perform set_config('msj.stock_reason','compra',true);
  update public.product_variants set stock = stock + v.quantity where id = v.variant_id;
  update public.products p set cost_price = v.unit_cost from public.product_variants pv where pv.id = v.variant_id and p.id = pv.product_id;
  update public.supplier_deliveries set status = 'recibido',received_at = now() where id = v.id;
end;
$$;
revoke all on function public.receive_delivery(uuid) from public,anon;
grant execute on function public.receive_delivery(uuid) to authenticated;

-- ---------- Reporte de ganancias ----------
-- Ventas = mercadería cobrada (subtotal − cupón − promo). Costo = unidades × costo del producto (o 55 % del precio si no tiene costo).
-- Ganancia bruta = ventas − costo − aporte solidario de MSJ (1 %). Envíos y donaciones de clientes se informan aparte.
create or replace function public.admin_profit_report(p_from timestamptz default now() - interval '30 days',p_to timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.has_role('admin') then raise exception 'Se requiere rol administrador.'; end if;
  with o as (
    select * from public.orders where status <> 'cancelled' and created_at >= p_from and created_at < p_to
  ), costs as (
    select oi.order_id,sum(oi.quantity * coalesce(p.cost_price,round(oi.unit_price * 0.55,2))) as cost,sum(oi.quantity) as units
    from public.order_items oi join o on o.id = oi.order_id
    left join public.product_variants pv on pv.id = oi.variant_id left join public.products p on p.id = pv.product_id
    group by oi.order_id
  ), totals as (
    select count(*) as orders,
      coalesce(sum(o.subtotal - o.discount_amount - coalesce(o.promo_discount_amount,0)),0) as sales,
      coalesce(sum(o.subtotal - o.discount_amount - coalesce(o.promo_discount_amount,0)) filter (where o.payment_status = 'paid'),0) as paid_sales,
      coalesce(sum(o.shipping_amount),0) as shipping,coalesce(sum(coalesce(o.donation_amount,0)),0) as donations,
      coalesce(sum(c.cost),0) as cost,coalesce(sum(c.units),0) as units
    from o left join costs c on c.order_id = o.id
  ), top as (
    select coalesce(jsonb_agg(t order by t.revenue desc),'[]'::jsonb) as items from (
      select oi.product_name as name,sum(oi.quantity) as units,sum(oi.quantity * oi.unit_price) as revenue,
        sum(oi.quantity * (oi.unit_price - coalesce(p.cost_price,round(oi.unit_price * 0.55,2)))) as profit
      from public.order_items oi join o on o.id = oi.order_id
      left join public.product_variants pv on pv.id = oi.variant_id left join public.products p on p.id = pv.product_id
      group by oi.product_name order by revenue desc limit 8) t
  ), daily as (
    select coalesce(jsonb_agg(d order by d.day),'[]'::jsonb) as items from (
      select (o.created_at at time zone 'America/Lima')::date as day,count(*) as orders,
        sum(o.subtotal - o.discount_amount - coalesce(o.promo_discount_amount,0)) as sales
      from o group by 1) d
  )
  select jsonb_build_object('orders',t.orders,'units',t.units,'sales',t.sales,'paid_sales',t.paid_sales,'shipping',t.shipping,
    'donations',t.donations,'cost',round(t.cost,2),'store_donation',round(t.sales * 0.01,2),
    'profit',round(t.sales - t.cost - t.sales * 0.01,2),
    'margin',case when t.sales > 0 then round((t.sales - t.cost - t.sales * 0.01) / t.sales * 100,1) else 0 end,
    'ticket',case when t.orders > 0 then round(t.sales / t.orders,2) else 0 end,
    'top',top.items,'daily',daily.items) into v_result
  from totals t,top,daily;
  return v_result;
end;
$$;
revoke all on function public.admin_profit_report(timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_profit_report(timestamptz,timestamptz) to authenticated;

-- Proveedores de ejemplo (puedes editarlos o desactivarlos en el panel).
insert into public.suppliers (name,contact,phone,category,lead_days)
select * from (values
  ('Textiles Gamarra (ejemplo)','Ventas mayoristas','','Polos, poleras y casacas',5),
  ('Calzado Trujillo (ejemplo)','Área comercial','','Zapatillas y zapatos',7),
  ('Maison MSJ Fragancias (ejemplo)','Laboratorio','','Perfumes',10)
) as s(name,contact,phone,category,lead_days)
where not exists (select 1 from public.suppliers);
