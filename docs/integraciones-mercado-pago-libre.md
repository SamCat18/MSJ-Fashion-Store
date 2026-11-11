# Mercado Pago y Mercado Libre en MSJ

Todo está instalado y **apagado**. La tienda no muestra nada hasta que completes estos pasos, así que puedes hacerlo con calma cuando tengas tu DNI y la cuenta verificada.

## Qué queda listo

| Pieza | Archivo | Qué hace |
|---|---|---|
| Tablas y funciones | `database/v2026.sql` (sección 8) | `integrations`, `integration_events` (bandeja de webhooks), `ml_oauth_tokens`, `ml_listings`, `ml_orders`, `ml_questions`, `sync_queue`, `mp_apply_payment`, `ml_register_order` |
| Pago en la tienda | `payments-mp.js` | Opción «Mercado Pago» en el checkout, regreso desde Mercado Pago y botón «Pagar» en Mis pedidos |
| Crear el cobro | `supabase/functions/mp-create-preference` | Arma el pago con el monto **guardado en la base**, no el del navegador |
| Confirmación automática | `supabase/functions/mp-webhook` | Verifica la firma, consulta el pago a Mercado Pago, marca el pedido como pagado, emite la boleta y la envía por correo |
| Conectar Mercado Libre | `supabase/functions/ml-oauth` | OAuth 2.0 con PKCE; los tokens solo los lee el servidor |
| Sincronizar | `supabase/functions/ml-sync` | Publica productos y actualiza stock y precio desde la cola |
| Ventas de Mercado Libre | `supabase/functions/ml-webhook` | Registra la venta y descuenta el stock de MSJ una sola vez |
| Panel | `admin-2026.js` → Integraciones | Estado, checklist, URLs para copiar, publicaciones y avisos recibidos |

## Cómo funciona el pago automático

1. El cliente elige Mercado Pago. `checkout_cart` crea el pedido con pago `pending` y **reserva el stock** por 2 horas (`automation.mp_payment_minutes`).
2. `mp-create-preference` crea el cobro y la tienda redirige a Mercado Pago.
3. Mercado Pago avisa a `mp-webhook`. La función:
   - valida la firma `x-signature` (HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con tu clave secreta) y rechaza avisos de más de 10 minutos;
   - guarda el aviso en `integration_events` (un mismo aviso no se procesa dos veces);
   - consulta el pago en `GET /v1/payments/{id}`. Nunca confía en el cuerpo del aviso;
   - llama a `mp_apply_payment`, que comprueba que el monto y la moneda (PEN) coincidan con el pedido.
4. Si el pago está aprobado: pedido **pagado y confirmado**, boleta o factura emitida, puntos sumados, aviso al cliente y comprobante enviado por correo (si configuraste Resend).
5. Si nadie paga a tiempo, `run_automations` cancela el pedido y el stock vuelve solo. Si el pago llega tarde y aún hay stock, el pedido se reactiva. Si ya no hay stock, el pedido queda marcado para reembolso.

## Paso a paso: Mercado Pago

1. **Cuenta verificada.** Crea o verifica tu cuenta de Mercado Pago Perú con tu DNI.
2. **Aplicación.** En *Mercado Pago Developers → Tus integraciones → Crear aplicación*, elige «Pagos online» → «Checkout Pro».
3. **Credenciales de prueba primero.** Copia el *Access Token* y la *Public Key* de prueba (`TEST-...`).
4. **Webhook.** En *Webhooks → Configurar notificaciones*:
   - URL: `https://minqplrkeatulamldvvb.supabase.co/functions/v1/mp-webhook`
   - Evento: **Pagos**
   - Copia la **clave secreta** que te muestra.
5. **Secretos y despliegue** (en tu computadora, con Supabase CLI):
   ```bash
   supabase login
   supabase link --project-ref minqplrkeatulamldvvb
   supabase secrets set MP_ACCESS_TOKEN=TEST-xxxx MP_WEBHOOK_SECRET=xxxx SITE_URL=https://tu-dominio.pe
   supabase functions deploy mp-create-preference
   supabase functions deploy mp-webhook --no-verify-jwt
   ```
6. **Panel → Centro 2026 → Integraciones → Mercado Pago:** pega la *Public Key*, deja el modo «Pruebas», marca «Activar» y guarda.
7. **`config.js`:** cambia `features.mercadoPago` a `true` y publica.
8. **Prueba** con las tarjetas de prueba de Mercado Pago. En el panel verás el aviso en «Últimos avisos recibidos» y el pedido pasará a pagado solo.
9. **Producción:** repite los pasos 3 a 6 con las credenciales `APP_USR-...` y cambia el modo a «Producción».

> Nunca pegues el *Access Token* ni la clave secreta en `config.js` ni en el panel. Solo van en `supabase secrets`.

## Paso a paso: Mercado Libre

1. Cuenta de vendedor en Mercado Libre Perú.
2. En `developers.mercadolibre.com.pe` crea una aplicación:
   - URI de redirect: `https://minqplrkeatulamldvvb.supabase.co/functions/v1/ml-oauth`
   - URL de notificaciones: `https://minqplrkeatulamldvvb.supabase.co/functions/v1/ml-webhook`
   - Tópicos: `orders_v2`, `items`, `questions`
3. Secretos y despliegue:
   ```bash
   supabase secrets set ML_APP_ID=xxxx ML_CLIENT_SECRET=xxxx ML_CRON_SECRET=una-clave-larga-al-azar
   supabase functions deploy ml-oauth --no-verify-jwt
   supabase functions deploy ml-sync --no-verify-jwt
   supabase functions deploy ml-webhook --no-verify-jwt
   ```
4. Panel → Integraciones → **Conectar cuenta de Mercado Libre** y autoriza.
5. Elige productos y pulsa **Preparar borradores**. Puedes hacerlo desde ya, aunque Mercado Libre aún no esté conectado.
6. Activa la integración. Los cambios de stock y precio se encolan solos.
7. Programa `ml-sync` cada 10 minutos (SQL Editor, requiere las extensiones `pg_cron` y `pg_net`):
   ```sql
   select cron.schedule('msj-ml-sync','*/10 * * * *',$$
     select net.http_post(url := 'https://minqplrkeatulamldvvb.supabase.co/functions/v1/ml-sync',
       headers := jsonb_build_object('x-cron-secret','una-clave-larga-al-azar','Content-Type','application/json'), body := '{}'::jsonb);
   $$);
   ```
8. `config.js`: `features.mercadoLibre = true`.

**Límites de esta primera versión:** cada producto se publica como un solo ítem. El stock es la suma de las tallas, y las tallas y colores van en la descripción. Las variaciones de Mercado Libre necesitan los atributos de cada categoría; cuando quieras activarlas, se completan en `ml_listings.variation_map`.

## M.I.S.H.I. con IA (opcional)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-xxxx
supabase functions deploy mishi-ai --no-verify-jwt
```
Después cambia `features.mishiAI` a `true` en `config.js`. Tiene un límite de 20 consultas por hora por visitante y de 60 con cuenta (`ai_take_quota`). Si la IA falla, M.I.S.H.I. responde con su motor local.

> Las claves de IA, Mercado Pago o Mercado Libre nunca van en el código ni en el chat. Si alguna se compartió, regenérala en la consola del proveedor.
