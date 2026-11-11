# MSJ Fashion Store

Prototipo web en HTML, CSS y JavaScript conectado al proyecto Supabase configurado en `config.js`. No necesita Node para abrir la interfaz.

## Versión 2026: qué hay de nuevo y cómo activarlo

**Instalación (en este orden, en Supabase → SQL Editor):** `database/schema.sql` → `database/campaigns.sql` → `database/gestion.sql` → **`database/v2026.sql`**. Todos son idempotentes. Si vuelves a ejecutar uno anterior, ejecuta otra vez `v2026.sql` al final. Luego, en el panel → Productos e inventario, pulsa **Cargar catálogo MSJ**: sube los 207 productos con su stock. La tienda usa `catalogSource: 'supabase'`, así que muestra **solo** lo que está en la base.

**Cuentas (importante):** en Supabase → Authentication → URL Configuration, pon tu dominio en **Site URL** y agrega `https://tu-dominio/cuenta.html` (y `http://localhost:5500/cuenta.html` para pruebas) en **Redirect URLs**. Sin esto, los enlaces de «confirmar cuenta» y «recuperar contraseña» llevan a una dirección equivocada. Ahora la tienda ofrece **Reenviar el correo** y **¿Olvidaste tu contraseña?**.

| Función | Archivos | Detalles |
|---|---|---|
| Diseño 2026 + **Liquid Glass** | `msj-2026.css`, `ui-2026.js` | Bordes redondeados, Geist + Instrument Serif. El vidrio reacciona al mouse y al dedo (brillo, rebote y estiramiento). La refracción real solo se activa en Chrome con equipos potentes, y hay versión sólida si el sistema pide menos transparencia |
| **MSJ Search** | `search-engine.js` | Nombre exacto primero («nube» → Camisa Denim Nube), sinónimos de Perú, fonética (b/v, s/z, ll/y), errores de tipeo, «¿quisiste decir?» y sugerencias en vivo |
| **M.I.S.H.I.** | `app.js`, `mishi-ai.js`, `supabase/functions/mishi-ai` | Regalos y festividades, referencias parecidas y botones de seguimiento. IA opcional con Claude vía Edge Function (la clave nunca va en el navegador) |
| **Explorador** de categorías y búsqueda | `categories-2026.js` | Departamentos y círculos con etiquetas HOT/NUEVO/−%, búsqueda a pantalla completa y barra de filtros en cápsulas en el catálogo |
| **MSJ Studio**, logros y niveles | `engage.js`, `studio.html` | El cliente diseña su tienda (gratis y sin cuenta); 13 logros y 5 niveles desbloquean paletas, looks y color libre. Cabecera fija o que se esconde al bajar |
| **Recompensas y avisos** | `engage.js` | Racha diaria, puntos por compra o reseña, canje por cupones personales y avisos de bajada de precio, stock y pedidos |
| **Privilège** «tipo Nitro» | `vip.html`, `engage.js` | Perfil con marco animado, banner y efecto de nombre, acceso anticipado por producto (lo exige el servidor), Studio premium y comparativa de planes |
| **Navidad y 2027** | `seasonal.js`, `navidad.html` | Nieve suave, luces, portada y guía de regalos, ventana «2027 · Coming soon» con suscripción. Cada campaña viste la tienda con su color |
| **Stock en tiempo real** | `engage.js` + Realtime | Si el stock cambia en Supabase, la tienda abierta se actualiza sola |
| **Centro 2026** del panel | `admin-2026.js`, `admin-2026.css` | Resumen en vivo, automatización e inventario inteligente (alertas, qué reponer, acceso anticipado), personalización, integraciones y búsquedas |
| **Mercado Pago / Mercado Libre** | `payments-mp.js`, `supabase/functions/mp-*`, `ml-*` | Instalado y **oculto** hasta tener las credenciales. Guía: `docs/integraciones-mercado-pago-libre.md` |
| **Auditoría** | `docs/auditoria-iso9001-cobit2019.md` | Procesos, objetivos de calidad, controles COBIT, riesgos y consultas de evidencia |

**Automatizaciones** (`run_automations`, cada 15 min con `pg_cron`): cancela los pagos online vencidos (el stock vuelve), avisa a los socios 7 días antes de que venza su membresía, cierra las membresías vencidas y limpia registros viejos. Cada cancelación devuelve el stock y el cupón una sola vez (trigger `orders_restock_on_cancel`). La retención semanal (`purge_old_records`) evita que la base se llene.

## Probar la tienda

Abre `index.html` en un navegador. La búsqueda, categorías, detalle, filtros, favoritos, carrito y el chatbot FAQ funcionan con el catálogo de demostración. Las solicitudes de contacto, los pedidos y el Libro de Reclamaciones requieren las tablas instaladas.

## Instalar Supabase

1. Abre Supabase → SQL Editor → New query.
2. Ejecuta el contenido actualizado de `database/schema.sql`.
3. En Auth, permite el registro y confirma el correo de tu cuenta de administración.
4. Abre `database/bootstrap_admin.sql`, reemplaza `REEMPLAZA_CON_TU_CORREO` por ese correo y ejecuta el archivo.
5. Abre `admin.html` e inicia sesión con esa cuenta.

El esquema incluye perfiles, roles, categorías, productos, variantes por color/talla e inventario, carrito, pedidos, pagos, consultas, Libro de Reclamaciones y bitácora. Las políticas RLS protegen las filas.

> **Si ya tenías el esquema instalado, vuelve a ejecutar `database/schema.sql`.** Es idempotente y agrega: el celular de entrega en pedidos, la visibilidad de la dirección para administración y personal, el cambio de rol atómico `admin_set_user_role`, la tabla `complaints` con la función `submit_complaint` y políticas más estrictas para las consultas públicas.

## Catálogo de 197 productos y páginas de la tienda

- **Páginas:** `index.html` (portada), `tienda.html` (todo el catálogo), `mujer.html`, `hombre.html`, `calzado.html`, `accesorios.html`, `perfumes.html`, `ofertas.html`, `novedades.html`, `colecciones.html` (colecciones y marcas), `cuenta.html` (pedidos, direcciones, favoritos, reseñas), `legal.html` y `reclamaciones.html`. Los catálogos aceptan filtros en la URL, p. ej. `hombre.html?c=casacas`, `tienda.html?col=urbano`, `perfumes.html?a=Mujer`.
- **`layout.js`** genera la cabecera con megamenú, el menú móvil, el pie de página y los paneles comunes de todas las páginas.
- **`catalog-data.js`** es la fuente única del catálogo: 28 categorías en 4 departamentos (ropa exterior, calzado, accesorios y perfumes), 7 marcas propias, 10 colecciones (incluidas las cápsulas Otoño-Invierno, Minimal Luxury y Night Edition) y 197 productos con tallas y colores. Las fotos son de Unsplash (licencia libre). Se comprobó una por una que existen y que muestran el producto correcto, y se evitaron las que tienen logos de marcas registradas. Los productos sin foto muestran el ícono de su categoría.
- **Para pasar el catálogo a Supabase:** ejecuta `database/schema.sql` y luego, en `admin.html` → **Productos e inventario**, pulsa **Cargar catálogo MSJ**. Crea o actualiza categorías, marcas, colecciones, productos y variantes (con stock inicial). Puedes repetirlo sin perder el stock que ya tengas. Sin conexión, la tienda usa este catálogo como vista de demostración.

- **El catálogo nunca se reduce:** `app.js` combina Supabase con `catalog-data.js`. Los productos que ya están en la base (con stock real) se pueden comprar. Los que aún no se cargaron se muestran con el botón «Consultar disponibilidad» hasta que pulses **Cargar catálogo MSJ**.
- **SQL del catálogo:** en el panel, **Descargar SQL del catálogo** genera `seed_catalog.sql` (categorías, marcas, colecciones, productos, variantes y enlaces) desde `catalog-data.js`. Es una alternativa al botón de carga: guárdalo en `database/` y ejecútalo en el SQL Editor. Es idempotente y conserva el stock existente.

### M.I.S.H.I. — asistente de compras

M.I.S.H.I. (*Moda, Inteligencia y Estilo Hiperpersonalizado Integrado*) aparece en todas las páginas, gracias a `layout.js`. Hace lo siguiente:

- Interpreta la consulta y busca en el catálogo en vivo: categoría, para quién es, presupuesto («menos de S/ 150»), ofertas, novedades, colección y notas olfativas («perfume dulce», «fresco», «amaderado»).
- Muestra tarjetas con foto, precio y botones para ver el producto o agregarlo a la bolsa (con selector de talla).
- Arma outfits por ocasión.
- Responde sobre envíos (usa las zonas de la base), pago contra entrega, cambios, reclamos y el cupón `BIENVENIDA10`.

La conversación se conserva mientras navegas por la tienda. **Importante:** funciona con reglas y búsqueda local, no con un modelo de lenguaje. Para respuestas generativas reales, conéctalo a la API de Claude mediante una Edge Function, sin exponer la clave en el navegador.

### Base de datos: 24 tablas

Además de las 13 anteriores (12 + `complaints`), el esquema crea: `brands`, `collections`, `collection_products`, `product_images`, `product_reviews` (con moderación), `wishlists` (favoritos por cuenta), `coupons`, `shipping_zones`, `customer_addresses`, `newsletter_subscribers` e `inventory_movements` (historial automático de cada cambio de stock). También añade la vista `product_ratings` y las funciones `validate_coupon` y `checkout_cart`, que ahora aplica el cupón y el costo de envío por zona en el servidor. Todas las tablas tienen RLS.

- Los costos de las **zonas de envío** son sugerencias: ajústalos en el panel → **Zonas de envío**.
- Se crea el cupón **BIENVENIDA10** (10% desde S/ 99, un uso por cliente). Desactívalo en el panel → **Cupones** si no lo quieres.
- Las reseñas se publican solo cuando las apruebas en el panel → **Reseñas**.

## Campañas: feriados 2x1, modo B/N, donación y Yape

Ejecuta `database/campaigns.sql` en el SQL Editor **después** de `schema.sql` (es idempotente).

- **Promos por feriado** (`campaigns.js` + tabla `promotions`): Semana Criolla 2x1 (28 oct – 1 nov 2026), Black & White Friday (27–30 nov), Navidad 2x1, Día de la Madre (−20%) y Fiestas Patrias (−28%). La franja superior muestra la cuenta regresiva, las tarjetas llevan la etiqueta 2x1 y la portada suma un carrusel de la promo. En 2x1, las unidades participantes se ordenan de mayor a menor precio y la segunda de cada par sale gratis. `checkout_cart` vuelve a calcularlo en el servidor, así que el navegador no puede alterar el descuento.
- **Vista previa:** añade `?promo=BLACK-FRIDAY` (o cualquier código) a la URL para mostrar una campaña sin esperar su fecha. Solo cambia lo visual; el servidor cobra la promo real del día.
- **Modo Blanco y Negro:** botón ◐ B/N en la cabecera (se recuerda en el navegador). Se activa solo en campañas con `theme = 'bw'`, como Black Friday.
- **Recomendaciones:** «Recomendado para ti» puntúa el catálogo por afinidad con lo visto (con decaimiento), los favoritos y la bolsa, según categoría, colección, marca y público, más la valoración, las novedades y la promo. Limita a 3 productos por categoría. Sin historial muestra «Lo más elegido». En la bolsa, «Completa tu look» sugiere calzado, accesorios o perfumes para el mismo público y colección.
- **MSJ Unidos por el Perú:** en el checkout el cliente puede donar S/ 1, 3, 5 o redondear. MSJ aporta el 1% de cada venta. La portada muestra lo recaudado con `donation_stats()`, que lee pedidos reales y no incluye cifras inventadas. Completa `donation.beneficiary` en `config.js` con la organización real.
- **Causas solidarias:** la portada muestra un carrusel automático con 5 causas: El Niño, niños con cáncer, árboles, friaje y educación. Se configuran en `config.js` → `donation.causes`. Cada causa muestra su avance real con `donation_stats().by_cause`. El cliente elige la causa al pagar, y `orders.donation_cause` la guarda.
- **Certificado de donación:** después de comprar aparece el botón «Ver mi certificado». `donation_certificate()` lo genera en el servidor, solo para el titular del pedido o un administrador, con el código `MSJ-DON-…`. Se puede imprimir o guardar en PDF.
- **Socios de cortesía:** la tabla `vip_cortesia` asigna la tarjeta automáticamente por correo: `samuelvillanuevachinchay15@gmail.com` → Black Sovereign y `mayloquineche@gmail.com` → Gold Pass, ambas vigentes hasta el 31/12/2026, y Samuel con el número de socio `MSJ SAMV BK26 VIP1`. Se aplica al crear la cuenta, ya mismo si la cuenta existe o al iniciar sesión. Si había una solicitud «en verificación», se cierra como cortesía. Queda registrada en `membresias_vip` y en la auditoría.
- **Seguimiento con mapa:** al comprar y en Mis pedidos → «Ver seguimiento en el mapa». Muestra la ruta del almacén de Lima a la ciudad de entrega, la distancia, el plazo, la fecha estimada y estos pasos: registrado, pago verificado, pedido listo, en camino y entregado. Los pasos avanzan cuando el panel cambia el estado del pedido o del pago. Al entrar, el socio ve una bienvenida con su tarjeta girando en 3D, una vez por sesión.
- **Lemon:** `lemon.qrImage` (`lemon-qr.png`) es un QR interoperable, así que el cliente puede pagarlo desde Yape, Plin o la app de su banco. Funciona igual que Yape: número de operación, estado `pending` y verificación en el panel.
- **Yape:** guarda tu QR como `yape-qr.png` y completa `yape.holder` en `config.js`. `yape.number` es opcional. El cliente yapea el monto exacto y escribe el número de operación. El pedido queda con pago `pending` y una fila en `payments`, y un mismo número de operación no puede repetirse. En el panel → Pedidos verás «Operación …»; compruébalo en tu app de Yape y marca `paid`. Para una confirmación automática hace falta una pasarela con webhook (Culqi, Izipay o Mercado Pago, que aceptan Yape) y RUC.

## Gestión: ganancias, proveedores y movimientos

Ejecuta `database/gestion.sql` después de `campaigns.sql`. En el panel aparecen tres vistas nuevas (`admin-gestion.js`):

- **Ganancias:** ventas, costo de mercadería, ganancia bruta, margen, ganancia neta (restando los costos fijos que escribas), ventas por día y productos más rentables. Ganancia bruta = ventas − costo − 1 % solidario. El costo es el `cost_price` del producto; si no tiene, se estima en 55 % del precio.
- **Proveedores e ingresos:** registra proveedores y pedidos de mercadería con fecha de llegada («Llega en 3 d», «Atrasado»). Al pulsar «Recibir», `receive_delivery()` suma el stock, actualiza el costo y deja el movimiento como «compra».
- **Movimientos de stock:** historial de ventas, compras, ajustes y altas, con filtro y exportación CSV.
- **Avisos de pago:** cada 20 s el panel busca pagos de Yape o Lemon pendientes. Muestra la campana 🔔, el número de operación, un sonido y una notificación del navegador.
- **Modo oscuro** en el panel (botón ☾) y en la tienda. El botón de la tienda alterna entre Claro, Oscuro y B/N.

## Datos del negocio

En `config.js` completa el bloque `business` (razón social, RUC, domicilio, correo, WhatsApp y redes) y, opcionalmente, `freeShippingFrom`. Lo que dejes vacío no se muestra en la tienda. Las páginas `legal.html` y `reclamaciones.html` muestran un aviso de “pendiente” hasta que completes razón social, RUC, domicilio y correo.

## Funciones de la tienda

- Favoritos (♡) guardados en el navegador, con un acceso en la cabecera.
- Ficha de producto con cantidad, aviso de últimas unidades, productos relacionados, compartir, consulta por WhatsApp y guía de tallas.
- Enlaces directos a cada producto (`index.html#producto/<slug>`).
- Barra de envío gratis (si configuras `freeShippingFrom`) y confirmación de pedido con número y pasos.
- La bolsa se sincroniza con el catálogo real: retira variantes inexistentes o agotadas y actualiza los precios.
- Páginas `legal.html` (términos, privacidad, envíos, cambios) y `reclamaciones.html` (Libro de Reclamaciones virtual con constancia imprimible). Revisa los textos con tu asesor antes de vender; los plazos resaltados son sugerencias.
- En el panel, **Reclamaciones** muestra cada hoja con su fecha de vencimiento (15 días hábiles, sin contar fines de semana), permite responder, cambiar el estado y exportar a CSV.

## Publicar con encabezados de seguridad

`vercel.json` (Vercel) y `_headers` (Netlify y Cloudflare Pages) aplican CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Si cargas scripts o imágenes de otro dominio, agrégalo a la CSP. `docs/controles-iso-cobit.md` relaciona los controles del proyecto con ISO 27001, ISO 9001 y COBIT 2019, junto con una matriz de riesgos. Supabase Auth gestiona contraseñas; nunca añadas contraseñas a `profiles` ni publiques la clave `service_role`.

## Panel y carga de productos

- En `admin.html`, usa **Ver panel de demostración** para recorrer el panel sin iniciar sesión. Los cambios de la demo son ficticios y se descartan al salir.
- Para editar correo, nombre o contraseña de una cuenta real, instala Supabase CLI, ejecuta `supabase login`, `supabase link --project-ref TU_PROJECT_REF` y `supabase functions deploy admin-update-user` desde la raíz del proyecto. La función comprueba la sesión y el rol de administrador; la clave `service_role` solo se usa en el entorno seguro de Supabase.
- **Invitar personal** envía una invitación de Supabase Auth y asigna el rol existente `staff`. Configura el proveedor de correo de Auth y despliega `admin-update-user`; nunca se invita con rol administrador desde este formulario.
- Para actividad de personal, ejecuta la versión actualizada de `database/schema.sql` y despliega también `supabase functions deploy admin-staff-activity`. Personal solo puede ver pedidos y editar estado de pedido/pago; el reporte solo incluye rol `staff`, con sesión, heartbeat cada 5 minutos, inactividad detectada a los 15 minutos y retención de sesiones de 30 días. Clientes no generan sesiones de seguimiento.
- **Actividad personal** en Administración muestra ingresos, presencia y cambios de las últimas 24 horas. Los cambios de pago registran valor anterior/nuevo con el actor autenticado. El estado “pagado” es una verificación manual en esta versión; antes de aceptar tarjetas, confirma pagos mediante webhook firmado por la pasarela, nunca desde el navegador.
- **Contactar** abre un correo dirigido al usuario en la aplicación de correo del equipo. **Eliminar** requiere desplegar la misma función; rechaza cuentas con pedidos y protege al último administrador activo. Para conservar el historial, desactiva esas cuentas en vez de borrarlas.
- En **Productos e inventario**, **Plantilla CSV** descarga las columnas necesarias. Completa hasta 100 productos por archivo; separa tallas y colores con `|`, usa categorías existentes y conserva los encabezados. El importador crea producto, variantes y stock.
- Las contraseñas actuales nunca se muestran. En edición, deja la contraseña nueva en blanco para conservarla.

## Ciberseguridad y auditoría de cuentas

- **Panel → 🛡️ Ciberseguridad y Cuentas**: inventario real de cuentas (Supabase Auth + perfiles + roles) con ID, nombre, correo, rol, verificación de correo, 2FA, último acceso, IP, dispositivo e intentos fallidos. La IP y el dispositivo se guardan en cada inicio de sesión hecho desde la tienda o el panel; las cuentas que no volvieron a ingresar muestran “—”.
- **Ejecutar Testeo de Seguridad / Auditoría** analiza cuentas, intentos fallidos, accesos privilegiados, RLS de cada tabla y funciones `SECURITY DEFINER`. Cada hallazgo sigue la estructura **condición, criterio, causa, efecto o riesgo y recomendación**, con botones de corrección (reenviar verificación, bloquear, restablecer contadores, quitar privilegios, copiar SQL). Cada auditoría y cada corrección quedan en `auditoria_seguridad`, que es de solo anexado: nadie puede editarla ni borrarla desde la API.
- **Inicio de sesión y registro**: medidor de seguridad de la contraseña (Débil, Media, Fuerte), bloqueo temporal de 15 minutos tras 5 intentos fallidos con contador regresivo, limpieza de entradas contra XSS y aviso cuando el correo ya tiene cuenta. Si hubo 3 o más intentos fallidos antes de un acceso correcto, la persona recibe un aviso.
- El bloqueo de la tienda funciona por navegador. Para frenar ataques distribuidos activa **CAPTCHA** (Turnstile o hCaptcha) y revisa los **Rate Limits** en Supabase → Authentication.
- La auditoría verifica la configuración; no reemplaza una prueba de penetración ni el Security Advisor de Supabase.

## MSJ Privilège Club (membresía VIP)

- **Niveles**: Gold Pass (S/ 19.90 al mes o S/ 149 al año) con 15 % de descuento y envío gratis en Lima Metropolitana y Callao; Black Sovereign VIP (S/ 39.90 al mes o S/ 299 al año) con 25 % en todos los productos, envío gratis a todo el Perú, acceso anticipado a Perfumes Maison y atención prioritaria en M.I.S.H.I.
- **Tarjeta digital** con efecto holográfico en el inicio y en Mi cuenta, con nombre, código de socio único y vencimiento. El precio de socio se ve en vivo en tarjetas de producto, ficha, bolsa, checkout y M.I.S.H.I.
- **Con Supabase** la persona solicita su plan y la solicitud queda pendiente. En **Panel → Privilège Club** confirmas el pago y la activas (o la rechazas, la revocas u otorgas una cortesía). El descuento y el envío gratis los recalcula `checkout_cart` en el servidor, así que nadie puede darse el descuento desde el navegador.
- **Sin base de datos** (vista de demostración) el pago es simulado y la tarjeta se guarda solo en ese navegador, para que puedas ver el efecto.
- **Sin acumulación**: se aplica el mayor entre el descuento de oferta y el de socio (nunca ambos), y el cupón va después. Porcentajes y precios están en `vip_discount_percent` y `vip_precio` (`database/schema.sql`) y en `vipLevels` (`app.js`); si los cambias, cámbialos en ambos lugares.
- **Tema Dark-Gold**: con membresía vigente toda la tienda cambia a negro obsidiana y dorado champán (`body.vip-member-active`) y aparece el distintivo «✦ MIEMBRO VIP».
- **👑 MSJ Privilège Lounge** (Mi cuenta y Colecciones): tarjeta 3D, ahorro acumulado (`mi_ahorro_vip`), cupón de regalo mensual personal (`reclamar_cupon_vip`: S/ 15 Gold, S/ 30 Black; solo lo usa su titular), Concierge VIP en M.I.S.H.I. y **catálogo secreto**: productos con `vip_only` (en `catalog-data.js`, `vip:1`). RLS los oculta a quien no es socio y `checkout_cart` rechaza su compra.

## Acceso: contraseña, huella, rostro y 2FA

- **Huella o rostro (passkeys / WebAuthn)**: huella de Android, Face ID o Touch ID en iPhone y Mac, Windows Hello. La biometría se verifica en el dispositivo; MSJ solo guarda una clave pública (`passkeys`). Cada persona la activa en **Mi cuenta → Seguridad** (o en el panel, «Tu acceso al panel»).
  1. Despliega la función: `supabase functions deploy passkeys`.
  2. Define los secretos: `supabase secrets set PASSKEY_RP_ID=tudominio.pe PASSKEY_ORIGINS=https://tudominio.pe,https://www.tudominio.pe`.
  3. Las passkeys exigen HTTPS en el dominio publicado (o `http://localhost` para pruebas).
  - **Modo local para demostraciones**: si abres la tienda como archivo (`file://`) o en `localhost` sin la función desplegada, «Activar en este dispositivo» usa un modo de demostración. En `localhost` pide la biometría real del equipo (Windows Hello); en `file://` simula el escaneo (Huella / Rostro / PIN). Se guarda solo en ese navegador, se puede «Probar» y «Quitar», no inicia sesión y no protege la cuenta.
- **2FA (código de 6 dígitos)**: activa **TOTP** en Supabase → Authentication → Multi-Factor. Con 2FA activo, `mfa_ok()` hace que el servidor exija el nivel AAL2 en `is_active_user()` y `has_role()`: sin el código no hay acceso a pedidos, carrito ni permisos de administración.
- **Rostro con la cámara web**: no se implementó a propósito. Un escaneo facial por cámara se puede engañar con una foto y obligaría a guardar datos biométricos sensibles (Ley N.º 29733). El acceso por rostro usa Face ID o Windows Hello, que verifican en el dispositivo y no se dejan engañar con una foto.
- El inspector de **🛡️ Ciberseguridad y Cuentas** muestra los métodos de cada cuenta: Contraseña, Huella/Passkey (con dispositivos), Facial ID (cuando el dispositivo registrado es Face ID) y 2FA.

## Seguridad recomendada

- Activa MFA para las cuentas administradoras y exige confirmación de correo y contraseñas robustas en Supabase Auth.
- Conserva RLS en todas las tablas; valida rol y sesión en Edge Functions para cualquier operación privilegiada.
- Para frenar registros y consultas automatizados, integra Cloudflare Turnstile en formularios públicos y valida el token desde una Edge Function.
- Si quieres enviar mensajes desde el panel sin abrir el correo del equipo, usa Resend desde una Edge Function y guarda su API key en los secretos de Supabase, nunca en `config.js`.

## Backups locales

1. Instala PostgreSQL Command Line Tools y confirma que `pg_dump` esté en `PATH`.
2. Ejecuta `powershell.exe -ExecutionPolicy Bypass -File scripts/configure-backup.ps1`. Introduce el host, puerto, base, usuario y contraseña PostgreSQL de Supabase. La contraseña queda cifrada con DPAPI para tu usuario de Windows, fuera del repositorio.
3. Ejecuta `powershell.exe -ExecutionPolicy Bypass -File scripts/backup-database.ps1` para probar la primera copia. Los archivos comprimidos se guardan en `backups/`; se eliminan automáticamente después de 30 días y Git ignora esa carpeta.
4. Ejecuta `powershell.exe -ExecutionPolicy Bypass -File scripts/install-backup-task.ps1` para programar una copia cada seis horas. La tarea no requiere clave de administrador, pero funciona mientras tu sesión de Windows esté iniciada.
5. Inicia `powershell.exe -ExecutionPolicy Bypass -File scripts/backup-panel-server.ps1` y abre `http://127.0.0.1:8765/`, o usa **Respaldos locales** desde Administración. El servicio solo escucha en el equipo local y ofrece estado, historial y ejecución manual.

El respaldo no puede ejecutarse si el equipo está apagado, dormido sin reactivación disponible, sin sesión de Windows o sin Internet; no es un servicio 24/7 en la nube. Para cobertura continua, usa un equipo/servidor siempre encendido o los backups administrados de Supabase. Los `.dump` contienen datos de clientes y no están cifrados por pg_dump: protege el disco con BitLocker y conserva otra copia cifrada fuera del equipo. El volcado incluye el esquema PostgreSQL accesible con esa conexión; la configuración de Auth/Storage del proyecto se respalda por separado desde Supabase.

## Antes de publicar

- Reemplaza nombres, imágenes de muestra, precios y existencias por los productos reales que tengas autorización para vender.
- Configura las URL de tus perfiles sociales y el canal real de atención; no se ha inventado un correo ni un teléfono.
- Completa cobertura, costos y condiciones de entrega, cambios, privacidad y términos.
- El asistente actual responde preguntas frecuentes con texto local; no es un modelo de IA ni envía consultas hasta instalar el esquema.
- Para tarjetas se necesita una pasarela y una función segura de servidor. No recopiles números de tarjeta en la tienda.
- Para compartir la web públicamente, súbela a un hosting HTTPS conectado con GitHub (por ejemplo, Vercel o Netlify) y agrega el dominio en los ajustes de Auth de Supabase.

Esta interfaz y el SQL son una base de desarrollo, no una certificación de auditoría. Revisa políticas, cuentas, registros y obligaciones locales con la persona responsable antes de usar datos reales o procesar ventas.
