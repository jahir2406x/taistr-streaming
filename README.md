# TaiSTR — Catálogo de Streaming por WhatsApp

> 👉 **¿No eres programador y quieres cambiar textos, precios, WhatsApp o servicios?** Lee primero la **[Guía de Edición paso a paso (`GUIA_DE_EDICION.md`)](GUIA_DE_EDICION.md)**.

Sitio web estático ultrarrápido hecho con **Astro + Tailwind CSS** para mostrar planes de streaming en soles (`S/`) y redirigir cada pedido directamente a WhatsApp con mensajes prellenados.

## Comandos principales

```bash
npm install
npm run dev        # Servidor local de desarrollo (http://localhost:4321)
npm run check:data # Valida con Zod países, servicios, precios, pagos y plantillas de WhatsApp
npm run mensajes   # Muestra la vista previa de todos los mensajes y enlaces de WhatsApp
npm run pendientes # Lista los datos pendientes de personalizar (CAMBIAR:)
npm test           # Ejecuta pruebas unitarias de src/core
npm run build      # Ejecuta check:data y genera la carpeta estática en ./dist
```

---

## 1. Cómo cambiar tu número de WhatsApp, marca, colores y bandera de precios

Todo lo editable está concentrado en **`src/editar/`**:

- **Nombre de marca y número de WhatsApp (`src/editar/marca.ts`)**: edita `nombre: 'TaiSTR'` y `numeroWhatsapp: 'CAMBIAR: 51999999999'` (en formato internacional sin `+` ni espacios).
- **Mensajes de WhatsApp (`src/editar/mensajes-whatsapp.json`)**: plantillas globales con marcadores `{marca}`, `{servicio}`, `{plan}`, `{precio}`, `{moneda}`, `{duracion}`, `{pais}`, `{medio_pago}`, `{pantallas}`.
- **Ocultar o mostrar precios (`src/editar/ajustes.ts`)**: cambia `SHOW_PRICES: true` a `false` si prefieres ocultar los importes.
- **Colores y tipografía (`src/editar/tema.css`)**: ajusta las variables CSS en `:root`.

---

## 2. Cómo editar precios, países, monedas, medios de pago o servicios

- **Cambiar precios o mensajes por servicio (`src/editar/servicios/*.json`)**: cada servicio tiene su propio archivo con planes, precios por moneda (`PEN`, `USD`, `MXN`, `ARS`) y campos opcionales `mensaje_comprar` y `mensaje_disponibilidad`.
- **Agregar o editar países y monedas (`src/editar/paises.json`)**: agrega un bloque con `code`, `name`, `currency`, `locale` y `enabled: true`.
- **Agregar o editar medios de pago (`src/editar/pagos.json`)**: cada medio define `id`, `name`, `type`, `countries`, `currencies`, `enabled`, `order` y `note`.
- **Detección de país y qué pasa sin Cloudflare**:
  1. Primero lee la preferencia manual guardada en `localStorage` (`user_country`).
  2. Si no existe, consulta `/api/geo` (Cloudflare Pages Function en `functions/api/geo.ts` con timeout de 800 ms y sin guardar IP).
  3. **Sin Cloudflare**: si `/api/geo` no existe o falla, degrada automáticamente al código de región de `navigator.language` (si es un país activo) y finalmente a `"default"` (`USD` con pago por Binance).

---

## 3. Cómo desplegar gratis

### Opción A: Cloudflare Pages / Vercel / Netlify (Gratis y automático)
1. Sube este proyecto a un repositorio en GitHub o GitLab.
2. En **Cloudflare Pages**, crea un proyecto conectado a tu repositorio con:
   - **Framework preset**: `Astro`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. *(Opcional)* Si deseas activar **Cloudflare Web Analytics** (sin cookies), agrega la variable de entorno `PUBLIC_CF_BEACON_TOKEN` con tu token.

### Opción B: Hosting tradicional (cPanel / FTP / Hostinger)
1. Ejecuta `npm run build` en tu computadora.
2. Sube todo el contenido de la carpeta generada **`dist/`** directamente dentro de la carpeta `public_html` de tu hosting.

---

## Decisiones tomadas por defecto
- **Marca oficial**: Configurada como **TaiSTR** en `src/editar/marca.ts` como única fuente de verdad (y marcador `{marca}` en archivos `.json` y `.md`).
- **Servicio de ejemplo en modo consulta**: `Paramount+` viene con `"disponible": false` para demostrar en vivo el estado *"Consultar disponibilidad"*.
- **Seguridad anti-scraping**: Todos los botones usan el componente único `src/components/ui/BotonWhatsApp.astro` con número codificado y sanitización en cliente.

