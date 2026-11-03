# Arquitectura Reutilizable (`src/core` y `src/data`)

El proyecto separa los datos y reglas de negocio de la interfaz Astro para compartirlos con una futura app de escritorio (compras, estadísticas y finanzas).

## 1. Cómo agregar países, monedas y medios de pago
- **Nuevo país/moneda**: Agrega un bloque en `src/editar/paises.json` (`code`, `name`, `currency`, `locale`, `enabled: true`) y añade la clave de esa moneda en el objeto `prices` de cada plan en `src/editar/servicios/*.json` (si falta una moneda, `resolvePlanPrice` usa `USD` automáticamente).
- **Nuevo medio de pago**: Agrega un bloque en `src/editar/pagos.json` indicando los códigos de país en `countries` (o `["*"]` para global) y su `order`. Nunca incluyas números de cuenta ni wallets en el JSON.
- **Validación**: Ejecuta `npm run check:data` para verificar con Zod todos los JSON antes de compilar.

## 2. Reutilización en futura App de Escritorio (Tauri / Electron)
- **`src/core/`** está escrito en TypeScript puro (sin importar Astro, DOM ni Node) y exporta:
  - Esquemas Zod y tipos: `CountrySchema`, `StreamingServiceSchema`, `PaymentMethodSchema` y `OrderSchema` (`id`, `created_at`, `service_id`, `plan_id`, `country`, `currency`, `amount`, `payment_method_id`, `status`, `cost`, `notes`, sin PII).
  - Funciones puras: `resolveCountry`, `getCurrencyForCountry`, `resolvePlanPrice`, `formatPrice`, `getPaymentMethodsForCountry` y `buildWhatsAppOrderMessage`.
- La app de escritorio puede importar directamente `src/core` y `src/data/*.json` (como submódulo o paquete de monorepo) para registrar órdenes (`Order`), calcular márgenes (`amount - cost`) por moneda/país y auditar ventas.

## 3. Fase Futura Opcional: Recepción de Reseñas con Cloudflare Functions
- Actualmente las opiniones viven en `src/editar/resenas.json` (100% estático, registradas vía `npm run resena`).
- Si en una fase futura se desea que el cliente envíe su reseña desde un formulario web sin abrir repositorios:
  - Crear una Cloudflare Pages Function (`functions/api/resena.ts`) protegida con **Cloudflare Turnstile**.
  - Emitir un **token firmado de un solo uso por venta** al entregar el pedido por WhatsApp (`/calificar?token=...`) para garantizar que solo compradores reales opinen.
  - Guardar cada envío en estado `pendiente` (KV/D1) para **moderación del dueño** antes de publicar en el build estático.
  - Actualizar la **Política de Privacidad** detallando el tratamiento del nombre abreviado, país y comentario.

