-- Catálogo MSJ: 30 productos con título y descripción completos (2026-11-14)
-- Título:      tipo + marca/modelo + atributo
-- Descripción: qué es + qué ofrece + para quién es (+ tallas reales según las variantes)
-- Características: datos de la ficha (elemento 5). Se completan desde el panel → Editar producto.
-- No cambia slugs, precios, fotos ni stock. Solo nombre, descripción, características e is_active.
-- Ejecutar una vez en Supabase → SQL Editor.

begin;

-- 0) Columna de características (también está en schema.sql).
alter table public.products add column if not exists specs jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object');

-- 1) Desactivar 4 productos (fotos repetidas) para quedar en 30.
--    No se borran: se pueden reactivar con is_active = true cuando tengan foto propia.
update public.products
set is_active = false, updated_at = now()
where slug in ('camiseta-base', 'sueter-punto', 'perfume-noir', 'perfume-blue-cedar');

-- 2) Nuevos títulos y descripciones.
update public.products p
set name = v.titulo, description = v.descripcion, is_active = true, updated_at = now()
from (values
  -- Abrigos
  ('abrigo-pano', 'Abrigo de paño MSJ para mujer – Corte recto',
   'Abrigo de paño para mujer con líneas limpias que abriga sin perder estilo. Se lleva sobre vestidos, blusas o chompas, para la oficina o salidas en temporada de frío. Pensado para quien busca una prenda elegante y fácil de combinar. Tallas XS a L.'),
  ('abrigo-urbano', 'Abrigo urbano MSJ para hombre – Corte versátil',
   'Abrigo de corte urbano para hombre, ideal como capa exterior en días fríos. Tiene espacio para usarlo sobre camisas, chompas o poleras sin sentirse ajustado. Para quien quiere verse arreglado en la ciudad, del trabajo a una salida. Tallas S a XL.'),

  -- Accesorios
  ('aretes-minimal', 'Aretes minimalistas MSJ – Diseño ligero',
   'Aretes de diseño minimalista y peso ligero, cómodos para usar todo el día. Suman un detalle discreto a looks casuales o de oficina. Para mujeres que prefieren accesorios sencillos y elegantes. Talla única.'),
  ('billetera-essential', 'Billetera compacta MSJ Essential – Tarjetas y efectivo',
   'Billetera compacta con espacios para tarjetas y efectivo. Su tamaño reducido entra fácil en el bolsillo o en el bolso. Para quien quiere llevar lo necesario ordenado y sin bulto. Unisex, talla única.'),
  ('bolso-linea', 'Bolso compacto MSJ Línea – Para lo esencial',
   'Bolso compacto con espacio para lo esencial: celular, llaves y billetera. Práctico para el día a día o una salida corta, sin cargar peso de más. Unisex, talla única.'),
  ('cinturon-clasico', 'Cinturón clásico MSJ – Acabado sobrio',
   'Cinturón de diseño clásico y acabado sobrio que combina con jeans, pantalones de vestir o vestidos. Es un básico que completa el look de oficina o casual. Unisex, tallas S, M y L: elige según tu talla de pantalón.'),
  ('collar-dorado', 'Collar dorado MSJ – Diseño delicado',
   'Collar de tono dorado y diseño delicado que suma brillo a tu conjunto. Queda bien con blusas, escotes en V y vestidos, de día o de noche. Para mujeres que buscan un accesorio fino para destacar sin exagerar. Talla única.'),
  ('gorra-msj-classic', 'Gorra MSJ Classic – Perfil clásico unisex',
   'Gorra de perfil clásico para completar tu look casual. Práctica para paseos, viajes o días de sol. Unisex, talla única.'),
  ('lentes-sol-msj', 'Lentes de sol MSJ – Diseño clásico unisex',
   'Lentes de sol de diseño clásico que combinan con cualquier estilo. Ideales para el día a día, la playa o los viajes. Unisex, talla única.'),
  ('mochila-urbana', 'Mochila urbana MSJ – Espacio para el día a día',
   'Mochila urbana con espacio para llevar lo esencial del día. Cómoda para ir a clases, al trabajo o de paseo por la ciudad. Para quien busca una mochila práctica y con estilo. Unisex, talla única.'),

  -- Camisas
  ('camisa-lino', 'Camisa de lino MSJ para mujer – Fresca y ligera',
   'Camisa de lino ligero, fresca para los días cálidos. El lino deja respirar la piel, por eso es ideal para el verano, la oficina o un paseo. Combínala con jeans, shorts o pantalones de tela. Tallas XS a L.'),
  ('camisa-oxford', 'Camisa Oxford de algodón MSJ para hombre – Cuello clásico',
   'Camisa Oxford de algodón con tacto suave y cuello clásico. Funciona con terno para la oficina o con jeans para un look casual. Para hombres que buscan una camisa versátil y cómoda. Tallas S a XL.'),
  ('camisa-nube', 'Camisa de algodón MSJ Nube unisex – Corte relajado',
   'Camisa de algodón ligero con corte relajado, cómoda para todos los días. Úsala abierta sobre un polo o abotonada con jeans. Unisex, para quien busca una camisa fresca y sencilla. Tallas S a XL.'),

  -- Chompas
  ('chompa-suave', 'Chompa de punto MSJ para mujer – Suave y ligera',
   'Chompa de punto ligero, suave y cómoda para los días frescos. Abriga sin pesar y se lleva sola o sobre una blusa. Para mujeres que quieren estar abrigadas con un look sencillo. Tallas XS a L.'),
  ('chompa-trenzada', 'Chompa trenzada MSJ para hombre – Tejido de punto cálido',
   'Chompa de punto con textura trenzada que abriga en los días de frío. Se ve bien sobre una camisa o un polo, para el trabajo o el fin de semana. Para hombres que buscan una prenda cálida y con estilo. Tallas S a XL.'),

  -- Hombre
  ('chaqueta-norte', 'Chaqueta ligera MSJ Norte para hombre – Líneas limpias',
   'Chaqueta ligera y funcional de líneas limpias, para usar como capa en días frescos. Fácil de llevar sobre polos y camisas. Para hombres que quieren una prenda práctica para el día a día. Tallas S a XL.'),
  ('polo-clasico-premium', 'Polo de algodón MSJ Premium para hombre – Corte clásico',
   'Polo de algodón suave con corte clásico. Cómodo para el uso diario y fácil de combinar con jeans, bermudas o casacas. Para hombres que buscan un básico que dure. Tallas S a XL.'),

  -- Mujer
  ('pantalon-trazo', 'Pantalón amplio MSJ Trazo para mujer – Caída fluida',
   'Pantalón de silueta amplia y caída fluida, cómodo y fácil de combinar. Queda bien con tops, blusas o camisas, para la oficina o el fin de semana. Para mujeres que priorizan la comodidad sin perder estilo. Tallas XS a L.'),
  ('top-alba', 'Top básico MSJ Alba para mujer – Tacto suave',
   'Top básico de tacto suave y forma sencilla. Úsalo solo en días cálidos o como base debajo de una camisa, blazer o chompa. Para mujeres que buscan una prenda versátil para su día a día. Tallas XS a L.'),
  ('vestido-brisa', 'Vestido fresco MSJ Brisa para mujer – Movimiento natural',
   'Vestido fresco de caída suelta y movimiento natural, ideal para días cálidos. Lúcelo con sandalias de día o con tacones para una salida. Para mujeres que buscan comodidad y frescura. Tallas XS a L.'),
  ('vestido-elegante', 'Vestido elegante MSJ para mujer – Ocasiones especiales',
   'Vestido de silueta elegante y cómoda, pensado para ocasiones especiales: matrimonios, cenas o eventos. Combínalo con tacones y un collar para completar el look. Para mujeres que quieren verse arregladas sin sacrificar comodidad. Tallas XS a L.'),

  -- Perfumes
  ('perfume-amber-musk', 'Perfume MSJ Amber Musk unisex – Ámbar y almizcle',
   'Fragancia unisex envolvente con notas de ámbar y almizcle. Su aroma cálido es ideal para la tarde, la noche o los días fríos. Para quienes prefieren perfumes intensos y sofisticados.'),
  ('perfume-aqua-fresh', 'Perfume MSJ Aqua Fresh unisex – Notas frescas',
   'Fragancia unisex de notas limpias y frescas para todos los días. Ligera y agradable, perfecta para el trabajo, las clases o después de hacer deporte. Para quienes buscan un aroma fresco que no canse.'),
  ('perfume-citrus-bloom', 'Perfume MSJ Citrus Bloom unisex – Notas cítricas',
   'Fragancia unisex con notas cítricas luminosas, fresca y alegre. Ideal para el día y para los meses de calor. Para quienes buscan un perfume energizante y fácil de usar.'),
  ('perfume-oud-night', 'Perfume MSJ Oud Night unisex – Especiado nocturno',
   'Fragancia unisex de aroma profundo y especiado con notas de oud. Pensada para la noche, cenas y eventos. Para quienes buscan un perfume intenso que deje huella.'),
  ('perfume-velvet-rose', 'Perfume MSJ Velvet Rose unisex – Floral cálido',
   'Fragancia unisex de notas florales suaves sobre un fondo cálido. Delicada y elegante, para el día o una cita especial. Para quienes disfrutan los aromas florales sin que resulten pesados.'),

  -- Poleras
  ('polera-crew', 'Polera cuello redondo MSJ Crew para hombre – Corte relajado',
   'Polera de cuello redondo, suave y de corte relajado, ideal para usar en capas. Llévala sobre un polo o debajo de una casaca en días frescos. Para hombres que buscan comodidad para el día a día. Tallas S a XL.'),
  ('polera-crop', 'Polera crop MSJ para mujer – Silueta corta',
   'Polera de silueta corta y moderna, cómoda para el día a día. Combínala con jeans o pantalones de tiro alto. Para mujeres que buscan un básico juvenil y fácil de llevar. Tallas XS a L.'),

  -- Zapatos
  ('tacones-aura', 'Tacones MSJ Aura para mujer – Diseño versátil',
   'Tacones de diseño versátil que suman elegancia a cada conjunto. Combinan con vestidos, faldas o pantalones de vestir, para la oficina o una ocasión especial. Para mujeres que buscan un calzado elegante y fácil de combinar. Tallas 36 a 40.'),
  ('zapatillas-urbanas', 'Zapatillas urbanas MSJ unisex – Comodidad para la ciudad',
   'Zapatillas urbanas cómodas para acompañarte por toda la ciudad. Ideales para caminar, ir a clases o al trabajo con un look casual. Unisex, tallas 36 a 44.')
) as v(slug, titulo, descripcion)
where p.slug = v.slug;

-- 3) Características conocidas. La «Marca» (MSJ) la muestra la tienda sola.
--    Falta que ustedes agreguen lo que solo saben con el producto en mano:
--    material exacto (%), contenido de los perfumes (ml), medidas de bolsos/mochilas, cuidado.
update public.products p
set specs = v.specs::jsonb, updated_at = now()
from (values
  ('abrigo-pano',          '{"Material":"Paño","Corte":"Recto, de líneas limpias","Temporada":"Otoño-invierno"}'),
  ('abrigo-urbano',        '{"Corte":"Urbano, holgado para usar en capas","Temporada":"Otoño-invierno"}'),
  ('aretes-minimal',       '{"Estilo":"Minimalista","Peso":"Ligero"}'),
  ('billetera-essential',  '{"Formato":"Compacto","Compartimentos":"Tarjetas y efectivo"}'),
  ('bolso-linea',          '{"Tamaño":"Compacto","Capacidad":"Celular, llaves y billetera"}'),
  ('cinturon-clasico',     '{"Estilo":"Clásico","Acabado":"Sobrio"}'),
  ('collar-dorado',        '{"Tono":"Dorado","Estilo":"Delicado"}'),
  ('gorra-msj-classic',    '{"Estilo":"Perfil clásico"}'),
  ('lentes-sol-msj',       '{"Estilo":"Clásico"}'),
  ('mochila-urbana',       '{"Estilo":"Urbano"}'),
  ('camisa-lino',          '{"Material":"Lino","Temporada":"Primavera-verano"}'),
  ('camisa-oxford',        '{"Material":"Algodón, tejido Oxford","Cuello":"Clásico"}'),
  ('camisa-nube',          '{"Material":"Algodón ligero","Corte":"Relajado"}'),
  ('chompa-suave',         '{"Tejido":"Punto ligero"}'),
  ('chompa-trenzada',      '{"Tejido":"Punto trenzado","Temporada":"Otoño-invierno"}'),
  ('chaqueta-norte',       '{"Tipo":"Chaqueta ligera","Temporada":"Entretiempo"}'),
  ('polo-clasico-premium', '{"Material":"Algodón","Corte":"Clásico"}'),
  ('pantalon-trazo',       '{"Silueta":"Amplia","Caída":"Fluida"}'),
  ('top-alba',             '{"Tacto":"Suave","Uso":"Solo o como capa base"}'),
  ('vestido-brisa',        '{"Caída":"Suelta","Temporada":"Primavera-verano"}'),
  ('vestido-elegante',     '{"Ocasión":"Eventos y ocasiones especiales"}'),
  ('perfume-amber-musk',   '{"Tipo":"Fragancia unisex","Notas":"Ámbar y almizcle","Ideal para":"Tarde, noche y días fríos"}'),
  ('perfume-aqua-fresh',   '{"Tipo":"Fragancia unisex","Notas":"Frescas y limpias","Ideal para":"Uso diario"}'),
  ('perfume-citrus-bloom', '{"Tipo":"Fragancia unisex","Notas":"Cítricas","Ideal para":"Día y verano"}'),
  ('perfume-oud-night',    '{"Tipo":"Fragancia unisex","Notas":"Oud y especias","Ideal para":"Noche y eventos"}'),
  ('perfume-velvet-rose',  '{"Tipo":"Fragancia unisex","Notas":"Florales sobre fondo cálido","Ideal para":"Día o cita especial"}'),
  ('polera-crew',          '{"Cuello":"Redondo","Corte":"Relajado"}'),
  ('polera-crop',          '{"Silueta":"Corta (crop)"}'),
  ('tacones-aura',         '{"Estilo":"Versátil","Ocasión":"Oficina y eventos"}'),
  ('zapatillas-urbanas',   '{"Estilo":"Urbano","Uso":"Caminar y día a día"}')
) as v(slug, specs)
where p.slug = v.slug;

commit;

-- 4) Verificación: debe dar 30 activos, 4 inactivos y 30 con características.
select count(*) filter (where is_active) as activos,
       count(*) filter (where not is_active) as inactivos,
       count(*) filter (where is_active and specs <> '{}'::jsonb) as con_caracteristicas
from public.products;
