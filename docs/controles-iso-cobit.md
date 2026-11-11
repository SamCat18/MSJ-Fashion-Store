# Mapa de controles: ISO/IEC 27001:2022, ISO 9001:2015 y COBIT 2019

Este documento relaciona lo que hace MSJ Fashion Store con los controles de cada marco. Sirve como punto de partida para una auditoría interna. No es una certificación: la evidencia se debe revisar con la persona responsable.

Leyenda: ✅ implementado · 🟡 parcial o depende de la configuración · ❌ pendiente

## ISO/IEC 27001:2022 (Anexo A)

| Control | Qué exige | Cómo se cumple en el proyecto | Estado |
|---|---|---|---|
| A.5.15 Control de acceso | Acceso según la necesidad | Roles `admin`, `staff` y `customer`. RLS en todas las tablas (`database/schema.sql`). El personal solo ve pedidos | ✅ |
| A.5.17 Información de autenticación | Gestión segura de contraseñas | Supabase Auth (hash), mínimo 10 caracteres con complejidad y bloqueo de claves comunes. Nunca se muestran | ✅ |
| A.5.18 Derechos de acceso | Altas, cambios y bajas controlados | Invitación de personal vía Edge Function. Cambio de rol atómico (`admin_set_user_role`) que protege al último administrador | ✅ |
| A.5.34 Privacidad y datos personales | Cumplir la ley de datos | Política de privacidad (Ley 29733), consentimiento en formularios, derechos ARCO | 🟡 Falta registrar el banco de datos ante la ANPD |
| A.8.2 Accesos privilegiados | Restringir y vigilar | La `service_role` solo vive en las Edge Functions. Se recomienda MFA para administradores | 🟡 Activar MFA |
| A.8.3 Restricción de acceso a la información | Mínimo privilegio | Permisos por columna en `orders`. El público registra reclamos solo mediante una función, sin acceso de lectura | ✅ |
| A.8.5 Autenticación segura | MFA y confirmación | Confirmación de correo en Supabase Auth | 🟡 Activar MFA |
| A.8.9 Gestión de configuración | Configuración controlada | `config.js` centraliza los datos públicos. La librería de Supabase está fijada con hash SRI | ✅ |
| A.8.12 Prevención de fuga de datos | Evitar exposición | `robots.txt`, `noindex` en el panel y `Referrer-Policy` | ✅ |
| A.8.13 Copias de seguridad | Respaldos probados | `pg_dump` cada 6 h con retención de 30 días (`scripts/`) | 🟡 Cifrar los `.dump` y guardar una copia fuera del equipo |
| A.8.15 Registro de eventos | Bitácora de actividad | Disparadores `audit_logs` en productos, pedidos, pagos, perfiles, roles, consultas y reclamos | ✅ |
| A.8.16 Monitoreo | Detectar actividad anómala | Panel de actividad del personal, con heartbeat y tiempo de inactividad | ✅ |
| A.8.23 Filtrado web | — | No aplica a la tienda | — |
| A.8.24 Criptografía | Datos cifrados | HTTPS (HSTS en `vercel.json`/`_headers`). No se almacenan tarjetas | ✅ al publicar con HTTPS |
| A.8.25–8.28 Desarrollo seguro | Validación y codificación segura | Escape de HTML en todo el render, validación en el servidor (`checkout_cart`, `submit_complaint`), CSP | ✅ |
| A.8.32 Gestión de cambios | Cambios trazables | Requiere control de versiones | ❌ Inicializar Git o GitHub |

## ISO 9001:2015 (gestión de la calidad)

| Cláusula | Evidencia en el proyecto | Estado |
|---|---|---|
| 7.5 Información documentada | README, este documento, políticas en `legal.html` | 🟡 Falta el manual de procesos (pedido → envío → entrega) |
| 8.2.1 Comunicación con el cliente | Chat de ayuda, formulario de consultas, WhatsApp configurable | ✅ |
| 8.2.2 Requisitos del producto | Ficha con tallas, colores, stock, guía de tallas y políticas visibles | ✅ |
| 8.5.2 Identificación y trazabilidad | Código de pedido, SKU y bitácora de cambios de estado | ✅ |
| 8.7 Salidas no conformes | Política de cambios y devoluciones por fallas | ✅ |
| 9.1.2 Satisfacción del cliente | Libro de Reclamaciones con plazo y estado | 🟡 Agregar una encuesta posventa |
| 10.2 No conformidad y acción correctiva | Reclamos con respuesta registrada y exportable a CSV | ✅ |

## COBIT 2019 (gobierno y gestión de TI)

| Objetivo | Práctica | Evidencia | Estado |
|---|---|---|---|
| APO01 Marco de gestión de TI | Roles y responsabilidades | Roles en la base de datos y permisos del panel | ✅ |
| APO12 Gestión del riesgo | Matriz de riesgos | — | ❌ Ver la tabla de abajo |
| APO13 Gestión de la seguridad | Políticas de seguridad | RLS, CSP, MFA recomendado, este documento | 🟡 |
| BAI06 Gestión de cambios | Control de versiones | — | ❌ Usar Git |
| DSS01 Operaciones | Procedimientos operativos | Panel de pedidos y estados | ✅ |
| DSS04 Continuidad | Respaldos y recuperación | Backups locales | 🟡 Probar una restauración y documentarla |
| DSS05 Servicios de seguridad | Protección de endpoints e identidades | Edge Functions con verificación de rol | ✅ |
| DSS06 Controles de procesos de negocio | Integridad de transacciones | `checkout_cart` bloquea el stock (`for update`) y recalcula precios en el servidor | ✅ |
| MEA01 Monitoreo del desempeño | Métricas | Resumen del panel (pedidos, stock bajo) | ✅ |
| MEA03 Cumplimiento externo | Leyes aplicables | Libro de Reclamaciones (Ley 29571), privacidad (Ley 29733) | 🟡 Completar los datos del negocio |

## Matriz de riesgos inicial

| Riesgo | Probabilidad | Impacto | Control actual | Acción pendiente |
|---|---|---|---|---|
| Robo de la cuenta de administrador | Media | Alto | Contraseñas robustas, bitácora | Activar MFA |
| Pérdida de la base de datos | Baja | Alto | Backups cada 6 h | Copia cifrada fuera del equipo y prueba de restauración |
| Pedidos falsos o spam | Media | Medio | Requiere cuenta. Límites de longitud y cantidad | Cloudflare Turnstile en formularios públicos |
| Fuga de datos de clientes | Baja | Alto | RLS, permisos por columna, sin tarjetas | Revisión periódica de políticas |
| Multa por incumplir Indecopi | Media | Medio | Libro de Reclamaciones virtual | Completar RUC y razón social. Responder en ≤ 15 días hábiles |
| Cambios sin control que rompen la web | Media | Medio | — | Git más un entorno de pruebas |
