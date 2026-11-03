---
name: contenido-editable
description: Procedimientos paso a paso para que el agente o el dueño modifiquen textos, precios, planes, disponibilidad, medios de pago y mensajes en src/editar/. No usar para alterar componentes Astro ni lógica de src/core/.
---

# Procedimientos de Edición en src/editar/

## 1. Cambiar Textos de la Web
- Textos de inicio y preguntas frecuentes: edita `src/editar/textos/inicio.json`.
- Textos del pie y enlaces legales: edita `src/editar/textos/pie.json` y `src/editar/textos/garantia.md`.
- Textos dinámicos adaptados por país: edita `src/editar/textos/por-pais.json` (usa marcadores `{pais}`, `{metodos_pago}`, `{moneda}` y `overrides`).
- Títulos del panel de compra y garantía: edita `src/editar/textos/panel-compra.json`.
- Textos de botones visibles: edita `src/editar/textos/botones.json`.
- Usa `{marca}` para el nombre de marca; nunca lo escribas a mano.

## 2. Cambiar Precios, Monedas, Duraciones o Planes
- Abre `src/editar/servicios/<servicio>.json`.
- En el arreglo `planes`, ajusta `prices.PEN`, `USD`, `MXN` o `ARS`.
- Si falta una moneda local, el motor usa `prices.USD` automáticamente como respaldo.
- Duraciones globales y descuentos por defecto: edita `duraciones` en `src/editar/ajustes.ts`.
- Descuentos multinivel: `"descuentos": { "2": 0, "3": 5, "6": 8 }` a nivel de servicio o de plan. Prioridad: `precios_por_duracion` (exacto) > `plan.descuentos` > `servicio.descuentos` > `ajustes.ts (general)`. Un `0` explícito aplica 0% y detiene la búsqueda; omitir clave delega al siguiente nivel.
- Opcional por plan o servicio: `"duraciones_permitidas": [1, 3]` (prioridad: `plan > servicio > ajustes`).
- Opcional por plan: `"precios_por_duracion": { "3": { "PEN": 28 } }` para tarifa fija.
- Destacar un plan: `"destacado": true` (se muestra en una fila horizontal ancha debajo de la cuadrícula de planes normales), `"etiqueta": "Texto corto"` (hasta 28 caracteres), `"gancho": "Frase sobre el título"` (hasta 70 caracteres), `"nota_panel": "..."` y `"nota_interna": "CAMBIAR: ..."`.
- Para cambiar la lista que muestra el panel, añade `incluye: ["...", "..."]` en el plan.

## 3. Disponibilidad y Nuevo Servicio
- Para pausar ventas: pon `"disponible": false` en el servicio o en el plan individual.
- Iniciales y monograma: define `"iniciales": "N"` (1 a 3 caracteres) y opcionalmente `"logo_propio": "/logos/archivo.svg"` (debe existir en `public/logos/`); no uses logos oficiales.
- Para agregar un servicio: duplica un archivo en `src/editar/servicios/` con nuevo slug, edita sus datos y agrega su slug en `src/editar/servicios/orden.json`.

## 4. Medios de Pago
- Abre `src/editar/pagos.json`.
- Para activar/desactivar: cambia `"enabled": true|false`.
- Orden y notas: ajusta `"order"` (1 primero) y `"note"`.
- Prohibido poner cuentas, CCI, CLABE o wallets en `note`; se envían por WhatsApp.

## 5. Mensajes de WhatsApp
- Plantillas generales: edita `src/editar/mensajes-whatsapp.json`.
- Marcadores permitidos: `{marca}`, `{servicio}`, `{plan}`, `{precio}`, `{duracion}`, `{pais}`, `{medio_pago}`.
- Personalizar por servicio/plan: rellena `mensaje_comprar` en `src/editar/servicios/<servicio>.json`.

## 6. Garantía, Renovación y Preguntas Comunes
- `src/editar/textos/garantia.json`: fuente única de garantía (`garantia_corta`, `garantia_panel`, `renovacion_frase`, `renovacion_nota`). Admite `{duracion}` y `{meses}`.
- `src/editar/textos/faq-comunes.json`: preguntas automáticas de renovación y garantía añadidas a todos los servicios sin duplicar existentes.
- `src/editar/textos/garantia.md`: texto completo de la página de términos y condiciones.

## 7. Valoraciones y Comandos de Validación
- Valoraciones con estrellas: edita los textos en `src/editar/textos/valoraciones.json` y los umbrales en `src/editar/ajustes.ts`.
- `npm run check:data` → valida comas, tipos, países, monedas, medios de pago y descuentos.
- `npm run precios` → muestra tabla comparativa de tarifas, ahorros y origen de descuento (`plan`, `servicio`, `general`, `exacto`).
- `npm run pendientes` → lista textos de ejemplo pendientes de reemplazar (`CAMBIAR:`).
- `npm run mensajes` → muestra en consola todos los mensajes de WhatsApp generados.
- `npm run resena` → asistente interactivo para registrar opiniones reales autorizadas en `src/editar/resenas.json`.
