---
name: web-taistr
description: Guía de arquitectura y mapa de rutas del proyecto TaiSTR para saber exactamente qué archivo abrir ante cualquier tarea. No usar para redacción de copy publicitario ni para diseño visual de nuevos componentes desde cero.
---

# Mapa y Reglas de Arquitectura TaiSTR

## Mapa Rápido: Qué Tarea → Qué Archivo Abrir
- **Marca y WhatsApp**: `src/editar/marca.ts` (única fuente de verdad de nombre y teléfono).
- **Ajustes globales y analítica**: `src/editar/ajustes.ts`.
- **Tema, superficies y animaciones**: `src/editar/tema.css` (variables `--color-*`, `--surface-*`, `--anim-*`, `--ease-*`), interruptor `ANIMACIONES` en `src/editar/ajustes.ts` y delegado ligero en `src/components/layout/ScriptAnimaciones.astro`.
- **SEO y metadatos**: `src/editar/seo.json`, `src/core/seo.ts`, `src/pages/og/[slug].png.ts` y `src/layouts/BaseLayout.astro`.
- **Valoraciones directas**: `src/editar/textos/valoraciones.json`, `BloqueValoracion.astro`, `functions/api/valorar.ts`, `functions/api/valoraciones.ts` y `docs/VALORACIONES.md`.
- **Páginas de confianza**: `src/editar/textos/quienes-somos.md` / `terminos.md` (bandera `PAGINAS_CONFIANZA` en `ajustes.ts`).
- **Textos de páginas**: `src/editar/textos/` (`inicio.json`, `pie.json`, `botones.json`, `panel-compra.json`).
- **Textos adaptables por país**: `src/editar/textos/por-pais.json` y función `resolverTextoPais` en `src/core/textos-pais.ts`.
- **Servicios y planes**: `src/editar/servicios/<slug>.json` y orden en `src/editar/servicios/orden.json`.
- **Insignias y monogramas**: `src/components/servicios/InsigniaServicio.astro` y lógica en `src/core/insignia.ts`.
- **Países y monedas**: `src/editar/paises.json` y lógica en `src/core/pricing.ts`.
- **Medios de pago**: `src/editar/pagos.json`.
- **Mensajes de WhatsApp**: `src/editar/mensajes-whatsapp.json` y constructor en `src/utils/whatsapp.ts`.
- **Botón de WhatsApp**: `src/components/ui/BotonWhatsApp.astro` (único componente que genera `wa.me`).
- **Tarjeta de plan**: `src/components/servicios/TarjetaPlan.astro`.
- **Panel de compra**: `src/components/servicios/PanelCompra.astro` y `ScriptPanelCompra.astro`.
- **Detección de país cliente**: `src/components/layout/GestorPaisCliente.astro` y `functions/api/geo.ts`.
- **Lógica compartida y pruebas**: `src/core/` y `tests/core.test.ts`.
- **Guía del dueño y seguridad**: `GUIA_DE_EDICION.md` y `docs/SEGURIDAD.md`.
- **Orden de las secciones: dónde se reordenan**: `src/components/secciones/HomeContent.astro` (portada) y `src/components/servicios/ServiceDetail.astro` (servicios).
- **Verificación integral sin navegador**: antes de publicar ejecuta `npm run verificar` (`check:data`, `test`, `auditar`, `build`, `presupuesto`, `enlaces` y `seguridad`).

## Reglas del Dueño
1. La marca se llama exactamente TaiSTR y sale de `src/editar/marca.ts`.
2. Textos, precios, números y mensajes viven en `src/editar/`, nunca dentro de componentes.
3. Los enlaces de WhatsApp los arma un único componente o módulo; ningún otro sitio escribe `wa.me`.
4. Nunca mostrar en la web cuentas, CCI, CLABE, alias, Binance ID ni direcciones de wallet; esos datos se dan por WhatsApp.
5. Sin logos oficiales ni imágenes de marcas de terceros (solo SVG neutros en `public/logos/`).
6. La selección de medio de pago es estado del panel abierto, independiente por plan.
7. Accesibilidad: teclado, aria y `prefers-reduced-motion`. Sin librerías nuevas sin avisar. Una URL por página.

## Forma de Trabajar Barata (Ahorro de Tokens)
- Una tarea, una causa; en errores, causa raíz primero y arreglo mínimo después.
- Editar por fragmentos precisos; verificar con `npm run build` una sola vez y `npm test`.
- NO abrir navegador ni revisar varios anchos de pantalla (lo hace el dueño y reporta).
- Si otra skill (por ejemplo design-taste-frontend) pide bucles de capturas o abrir el navegador, no lo hagas salvo que el dueño lo pida explícitamente.
- Si un comando falla 3 veces igual, detenerse y explicar. Respaldo antes de cambios grandes.
- Resumen final de máximo 5 líneas. Si existe la skill `token-economy`, aplican sus directrices.

