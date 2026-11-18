-- Catálogo MSJ: categorías y colecciones para los 30 productos (2026-11-14)
-- Problema que corrige: las 10 categorías antiguas tenían department = 'ropa' (incluso Perfumes,
-- Accesorios y Zapatos), así que las páginas Perfumes / Accesorios / Calzado salían vacías con
-- «Limpiar filtros». Además Mujer/Hombre/Unisex eran categorías de público, no de tipo de prenda.
-- Ejecutar una vez en Supabase → SQL Editor. Se puede repetir sin problema.

begin;

-- 1) Categorías iguales a las de la tienda (catalog-data.js), con su departamento correcto.
insert into public.categories (name, slug, department, icon, sort_order, is_active) values
  ('Polos',                   'polos',      'ropa',       '👕', 1,  true),
  ('Camisas',                 'camisas',    'ropa',       '👔', 2,  true),
  ('Blusas y tops',           'blusas',     'ropa',       '👚', 3,  true),
  ('Poleras y capuchas',      'poleras',    'ropa',       '🧥', 4,  true),
  ('Casacas',                 'casacas',    'ropa',       '🧥', 5,  true),
  ('Abrigos',                 'abrigos',    'ropa',       '🧥', 6,  true),
  ('Chompas',                 'chompas',    'ropa',       '🧶', 7,  true),
  ('Pantalones',              'pantalones', 'ropa',       '👖', 10, true),
  ('Vestidos',                'vestidos',   'ropa',       '👗', 13, true),
  ('Zapatillas',              'zapatillas', 'calzado',    '👟', 16, true),
  ('Zapatos',                 'zapatos',    'calzado',    '👞', 17, true),
  ('Tacones',                 'tacones',    'calzado',    '👠', 20, true),
  ('Gorras y gorros',         'gorras',     'accesorios', '🧢', 21, true),
  ('Bolsos y carteras',       'bolsos',     'accesorios', '👜', 22, true),
  ('Mochilas',                'mochilas',   'accesorios', '🎒', 23, true),
  ('Lentes de sol',           'lentes',     'accesorios', '🕶️', 24, true),
  ('Joyería',                 'joyeria',    'accesorios', '💍', 26, true),
  ('Cinturones y billeteras', 'cinturones', 'accesorios', '👛', 27, true),
  ('Perfumes',                'perfumes',   'perfumes',   '✨', 28, true)
on conflict (slug) do update
set name = excluded.name, department = excluded.department, icon = excluded.icon,
    sort_order = excluded.sort_order, is_active = true;

-- 2) Cada producto a su categoría por tipo de prenda (el público Mujer/Hombre/Unisex ya está en «audience»).
update public.products p
set category_id = c.id, updated_at = now()
from (values
  ('abrigo-pano','abrigos'), ('abrigo-urbano','abrigos'),
  ('aretes-minimal','joyeria'), ('collar-dorado','joyeria'),
  ('billetera-essential','cinturones'), ('cinturon-clasico','cinturones'),
  ('bolso-linea','bolsos'), ('gorra-msj-classic','gorras'), ('lentes-sol-msj','lentes'), ('mochila-urbana','mochilas'),
  ('camisa-lino','camisas'), ('camisa-oxford','camisas'), ('camisa-nube','camisas'),
  ('chompa-suave','chompas'), ('chompa-trenzada','chompas'), ('sueter-punto','chompas'),
  ('chaqueta-norte','casacas'), ('polo-clasico-premium','polos'), ('camiseta-base','polos'),
  ('pantalon-trazo','pantalones'), ('top-alba','blusas'),
  ('vestido-brisa','vestidos'), ('vestido-elegante','vestidos'),
  ('perfume-amber-musk','perfumes'), ('perfume-aqua-fresh','perfumes'), ('perfume-citrus-bloom','perfumes'),
  ('perfume-oud-night','perfumes'), ('perfume-velvet-rose','perfumes'), ('perfume-noir','perfumes'), ('perfume-blue-cedar','perfumes'),
  ('polera-crew','poleras'), ('polera-crop','poleras'),
  ('tacones-aura','tacones'), ('zapatillas-urbanas','zapatillas')
) as v(slug, category_slug)
join public.categories c on c.slug = v.category_slug
where p.slug = v.slug;

-- 3) Las categorías antiguas de público quedan vacías: se ocultan (no se borran).
update public.categories c
set is_active = false
where c.slug in ('mujer', 'hombre', 'unisex', 'accesorios')
  and not exists (select 1 from public.products p where p.category_id = c.id);

-- 4) Colecciones de la tienda (página Colecciones y filtros ?col=).
insert into public.collections (name, slug, description, image_url, sort_order, is_active) values
  ('Otoño-Invierno',     'otono-invierno', 'Abrigos de lana, chompas y botines para la temporada fría.', 'https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?auto=format&fit=crop&w=900&q=80', 1, true),
  ('Minimal Luxury',     'minimal-luxury', 'Líneas limpias, tonos neutros y materiales nobles.',        'https://images.unsplash.com/photo-1571513722275-4b41940f54b8?auto=format&fit=crop&w=900&q=80', 2, true),
  ('Night Edition',      'night-edition',  'Vestidos, sastrería y fragancias para brillar de noche.',   'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=900&q=80', 3, true),
  ('Estilo urbano',      'urbano',         'Capuchas, casacas y zapatillas para moverte por la ciudad.', 'https://images.unsplash.com/photo-1509942774463-acf339cf87d5?auto=format&fit=crop&w=900&q=80', 4, true),
  ('Oficina y formal',   'oficina',        'Camisas, blazers y zapatos para tus días de trabajo.',      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80', 5, true),
  ('Temporada de frío',  'frio',           'Abrigos, chompas y botas para los meses fríos.',            'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=80', 6, true),
  ('Deportivo',          'deportivo',      'Conjuntos, joggers y zapatillas para entrenar.',            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80', 7, true),
  ('Noche y eventos',    'noche',          'Vestidos, tacones y fragancias para ocasiones especiales.', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=80', 8, true),
  ('Verano',             'verano',         'Prendas frescas, shorts, sandalias y lentes de sol.',       'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=900&q=80', 9, true),
  ('Básicos esenciales', 'basicos',        'Las piezas que combinan con todo.',                         'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=900&q=80', 10, true)
on conflict (slug) do update
set name = excluded.name, description = excluded.description, image_url = excluded.image_url,
    sort_order = excluded.sort_order, is_active = true;

-- 5) Productos en cada colección.
insert into public.collection_products (collection_id, product_id, sort_order)
select col.id, p.id, v.sort_order
from (values
  ('otono-invierno','abrigo-pano',1), ('otono-invierno','abrigo-urbano',2), ('otono-invierno','chompa-suave',3), ('otono-invierno','chompa-trenzada',4),
  ('minimal-luxury','camisa-lino',1), ('minimal-luxury','abrigo-pano',2), ('minimal-luxury','aretes-minimal',3), ('minimal-luxury','collar-dorado',4), ('minimal-luxury','perfume-amber-musk',5),
  ('night-edition','vestido-elegante',1), ('night-edition','tacones-aura',2), ('night-edition','perfume-oud-night',3), ('night-edition','perfume-velvet-rose',4), ('night-edition','collar-dorado',5),
  ('urbano','polera-crew',1), ('urbano','polera-crop',2), ('urbano','zapatillas-urbanas',3), ('urbano','mochila-urbana',4), ('urbano','gorra-msj-classic',5), ('urbano','chaqueta-norte',6), ('urbano','abrigo-urbano',7),
  ('oficina','camisa-oxford',1), ('oficina','camisa-lino',2), ('oficina','pantalon-trazo',3), ('oficina','cinturon-clasico',4), ('oficina','billetera-essential',5), ('oficina','tacones-aura',6),
  ('frio','abrigo-pano',1), ('frio','abrigo-urbano',2), ('frio','chompa-suave',3), ('frio','chompa-trenzada',4), ('frio','chaqueta-norte',5), ('frio','polera-crew',6),
  ('deportivo','zapatillas-urbanas',1), ('deportivo','gorra-msj-classic',2), ('deportivo','polera-crew',3), ('deportivo','mochila-urbana',4),
  ('noche','vestido-elegante',1), ('noche','tacones-aura',2), ('noche','perfume-oud-night',3), ('noche','perfume-amber-musk',4), ('noche','collar-dorado',5),
  ('verano','vestido-brisa',1), ('verano','camisa-lino',2), ('verano','top-alba',3), ('verano','lentes-sol-msj',4), ('verano','perfume-citrus-bloom',5), ('verano','perfume-aqua-fresh',6), ('verano','gorra-msj-classic',7),
  ('basicos','polo-clasico-premium',1), ('basicos','top-alba',2), ('basicos','camisa-nube',3), ('basicos','pantalon-trazo',4), ('basicos','cinturon-clasico',5), ('basicos','billetera-essential',6)
) as v(collection_slug, product_slug, sort_order)
join public.collections col on col.slug = v.collection_slug
join public.products p on p.slug = v.product_slug
on conflict (collection_id, product_id) do update set sort_order = excluded.sort_order;

commit;

-- 6) Verificación: productos activos por departamento (debe sumar 30) y colecciones con productos.
select c.department, count(p.id) as productos
from public.products p join public.categories c on c.id = p.category_id
where p.is_active
group by c.department
order by c.department;
