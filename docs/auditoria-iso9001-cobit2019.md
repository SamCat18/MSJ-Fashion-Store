# Expediente de auditoría: ISO 9001:2015 y COBIT 2019 (versión 2026)

Este expediente reúne en un solo lugar lo que un auditor pedirá: los procesos, los controles, la evidencia y dónde encontrarla en MSJ Fashion Store. Complementa `docs/controles-iso-cobit.md`, que mapea ISO/IEC 27001.

> **Alcance:** venta en línea de ropa, calzado, accesorios y perfumes (tienda web, panel de administración y base de datos Supabase). Las sedes físicas, los proveedores y la contabilidad quedan fuera del alcance técnico. **No es una certificación:** sirve para preparar una auditoría interna o externa.

## 1. Mapa de procesos (ISO 9001 §4.4)

| Proceso | Entrada | Salida | Responsable | Dónde se ejecuta | Indicador (§9.1) |
|---|---|---|---|---|---|
| P1 Catálogo e inventario | Mercadería recibida | Producto publicado con stock | Administración | Panel → Productos, Proveedores, Automatización y stock | Alertas de stock abiertas, días de cobertura |
| P2 Venta en línea | Pedido del cliente | Pedido confirmado | Sistema (`checkout_cart`) | Tienda → checkout | Pedidos por día, ticket promedio |
| P3 Cobro y comprobante | Pago (Yape, Lemon, contra entrega o Mercado Pago) | Pago verificado, boleta o factura emitida | Personal o webhook | Panel → Pedidos; `mp-webhook` | Pagos por verificar, tiempo de verificación |
| P4 Despacho y entrega | Pedido confirmado | Pedido entregado | Personal | Panel → Pedidos (estados) | Pedidos por despachar |
| P5 Atención y reclamos | Consulta o reclamo | Respuesta registrada | Administración | Panel → Consultas, Reclamaciones | Reclamos vencidos (15 días hábiles) |
| P6 Fidelización | Cliente registrado | Puntos, logros y membresía | Sistema | Studio, Recompensas, Privilège | Rachas diarias, socios activos |
| P7 Mejora continua | Búsquedas sin resultado, reseñas y reclamos | Acciones de mejora | Administración | Panel → Búsquedas, Reseñas | Búsquedas sin resultados |

## 2. Política y objetivos de calidad (§5.2, §6.2)

**Política propuesta:** *En MSJ entregamos moda, calzado y perfumes con información clara, cobro seguro y entrega a tiempo. Escuchamos cada reclamo y mejoramos con datos.*

| Objetivo medible | Meta sugerida | Cómo se mide en el sistema |
|---|---|---|
| Verificar los pagos con billetera en menos de 24 h | 95 % | `orders.pago_verificado_at - created_at` (consulta 6.3) |
| Responder los reclamos dentro del plazo legal | 100 % ≤ 15 días hábiles | Panel → Reclamaciones (columna «Vence») |
| Mantener la disponibilidad de los productos más vendidos | ≤ 5 alertas «agotado» abiertas | Panel → Automatización y stock |
| Reducir las búsquedas sin resultado | −20 % trimestral | Panel → Búsquedas |
| Satisfacción del cliente | ≥ 4.3 ★ promedio | Vista `product_ratings` |

## 3. Controles COBIT 2019 implementados en la versión 2026

| Objetivo | Práctica | Control en MSJ | Evidencia |
|---|---|---|---|
| APO01 Marco de gestión | Roles definidos | `roles` / `user_roles`, `has_role()` con 2FA (`mfa_ok`) | `database/schema.sql` |
| APO07 Personas | Actividad del personal | Sesiones con heartbeat y reporte de 24 h | Panel → Actividad personal |
| APO11 Calidad | Medición de procesos | `admin_insights_2026()`: ventas, pagos, stock, clientes y engagement | Panel → Resumen en vivo |
| APO12 Riesgo | Registro de riesgos | Sección 5 de este documento | Este archivo |
| APO13 Seguridad | Gestión de secretos | Claves de Mercado Pago, Mercado Libre e IA solo en `supabase secrets`; `admin_set_integration` rechaza secretos | `database/v2026.sql` §8 |
| APO14 Datos | Retención y minimización | `run_automations()` y `purge_old_records()`: búsquedas 180 d, webhooks 90 d, bitácora 2 años, movimientos 3 años; búsquedas sin IP en claro | `database/v2026.sql` §9 y §13 |
| BAI03 Soluciones | Validación en el servidor | Precios, cupones, promociones, VIP y acceso anticipado se recalculan en `checkout_cart` y en los triggers | `database/v2026.sql` §7 y §12 |
| BAI06 Cambios | Control de versiones | Migraciones idempotentes y numeradas (`schema` → `campaigns` → `gestion` → `v2026`) | ❌ Falta Git: ver acción A1 |
| BAI10 Configuración | Configuración central | `config.js` (público), `store_settings` (editable con bitácora) | `audit_logs` (entity `store_settings`) |
| DSS01 Operaciones | Tareas programadas | `pg_cron`: `msj-automations` cada 15 min y `msj-retention` semanal | `automation_runs` |
| DSS02 Incidentes | Bandeja de webhooks | `integration_events` con estado, error y reintentos | Panel → Integraciones |
| DSS04 Continuidad | Respaldos | `scripts/backup-*.ps1` cada 6 h | Carpeta `backups/` |
| DSS05 Seguridad | Webhooks firmados y RLS | HMAC `x-signature` con ventana de 10 min; RLS en todas las tablas nuevas; permisos revocados por defecto | `mp-webhook/index.ts`, `v2026.sql` |
| DSS06 Controles de negocio | Integridad del inventario | Bloqueo `for update`, devolución de stock idempotente (`stock_restored_at`), venta de Mercado Libre aplicada una sola vez | `orders_restock_on_cancel`, `ml_register_order` |
| MEA01 Desempeño | Indicadores | Resumen en vivo y Búsquedas | Panel |
| MEA02 Control interno | Auditoría de seguridad | Testeo de seguridad con hallazgos (condición, criterio, causa, efecto, recomendación) en una tabla de solo anexado | `auditoria_seguridad` |
| MEA03 Cumplimiento | Normativa peruana | Libro de Reclamaciones (Ley 29571), datos personales (Ley 29733), sin cifras de venta inventadas | `reclamaciones.html`, sección 4 |

## 4. Cumplimiento y ética comercial

- **Publicidad veraz (Código de Protección al Consumidor):** las tarjetas solo muestran señales reales: ranking de ventas de `public_bestsellers`, stock real («Solo quedan 3») y reseñas aprobadas. No se muestran contadores de ventas inventados.
- **Datos personales (Ley 29733):** consentimiento en el boletín y en el teaser 2027, búsquedas anónimas, sin datos biométricos y sin tarjetas almacenadas (Mercado Pago las procesa).
- **Precios:** el descuento de socio, el cupón y la promoción se calculan en el servidor y no se acumulan, según las reglas documentadas.
- **Imágenes de producto:** usa fotos propias o con licencia, sin logos de marcas de terceros. Revisa los productos cargados en la base antes de la auditoría.

## 5. Registro de riesgos (actualizado)

| # | Riesgo | P | I | Control | Acción |
|---|---|---|---|---|---|
| R1 | Robo de la cuenta de administrador | M | A | Contraseñas robustas, bloqueo, bitácora | Activar MFA (TOTP) para todo el personal |
| R2 | Claves de API expuestas (IA, pagos) | M | A | Solo en `supabase secrets`, nunca en el código | Regenerar cualquier clave compartida por chat o correo |
| R3 | Aviso de pago falso | B | A | Firma HMAC y consulta del pago a la API | Revisar la bandeja de avisos con firma inválida |
| R4 | Sobreventa entre la tienda y Mercado Libre | M | M | Cola de sincronización y descuento único de stock | Ejecutar `ml-sync` cada 10 min |
| R5 | Base de datos que crece sin control | M | M | Retención automática (§13) | Revisar el tamaño en Supabase cada mes |
| R6 | Cambios que rompen la tienda | M | M | Migraciones idempotentes | A1: Git con ramas y revisión |
| R7 | Costos de IA descontrolados | B | M | Límite por visitante (`ai_take_quota`) | Alertas de gasto en la consola del proveedor |
| R8 | Reclamos sin responder a tiempo | M | M | Fecha de vencimiento visible | Revisión semanal |

## 6. Evidencia: consultas para el auditor (SQL Editor)

```sql
-- 6.1 Quién cambió precios, stock, pedidos o ajustes en los últimos 30 días
select created_at, action, entity, entity_id, actor_id from public.audit_logs
where created_at > now() - interval '30 days' order by created_at desc limit 200;

-- 6.2 Automatizaciones ejecutadas (operación continua)
select ran_at, trigger_source, details from public.automation_runs order by ran_at desc limit 50;

-- 6.3 Tiempo de verificación de pagos (objetivo de calidad)
select payment_method, round(avg(extract(epoch from (pago_verificado_at - created_at)) / 3600)::numeric, 1) as horas_promedio, count(*)
from public.orders where pago_verificado_at is not null group by payment_method;

-- 6.4 Reclamos y su estado
select status, count(*) from public.complaints group by status;

-- 6.5 Avisos de pago recibidos y su resultado
select provider, status, count(*), sum((signature_ok is false)::int) as firmas_invalidas from public.integration_events group by provider, status;

-- 6.6 Tablas sin RLS (debe devolver 0 filas)
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;
```

## 7. Acciones pendientes antes de una auditoría externa

| # | Acción | Norma | Prioridad |
|---|---|---|---|
| A1 | Versionar el proyecto en Git (GitHub privado) con ramas y revisiones | COBIT BAI06, ISO 27001 A.8.32 | Alta |
| A2 | Activar MFA en todas las cuentas `admin` y `staff` | ISO 27001 A.8.5 | Alta |
| A3 | Completar razón social, RUC y domicilio en `config.js` | Ley 29571 | Alta |
| A4 | Registrar el banco de datos de clientes ante la ANPD | Ley 29733 | Media |
| A5 | Probar una restauración de respaldo y documentarla | COBIT DSS04 | Media |
| A6 | Encuesta posventa (por ejemplo, al marcar «entregado») | ISO 9001 §9.1.2 | Media |
| A7 | Manual de procesos P1–P7 con responsables por nombre | ISO 9001 §7.5 | Media |
