# Carpeta `src/editar/servicios/`

- **QUÉ ES ESTA CARPETA**: Contiene un archivo `.json` por cada plataforma de streaming y el archivo `orden.json`.
- **QUÉ PUEDES CAMBIAR**: Precios (`prices`), planes, descuentos (`descuentos`), duraciones permitidas (`duraciones_permitidas`), descripciones, preguntas frecuentes (`faq`) y disponibilidad (`true` o `false`).
- **DESCUENTOS MULTINIVEL**: Puedes definir `"descuentos": { "2": 0, "3": 5, "6": 8 }` tanto a nivel de servicio (antes de `planes`) como dentro de un plan individual en `planes`. La prioridad es: `precios_por_duracion` (exacto) > `plan.descuentos` > `servicio.descuentos` > `ajustes.ts (general)`. Un `0` explícito aplica 0% de descuento y detiene la búsqueda; una clave omitida delega al siguiente nivel. Verifica todas las tarifas con `npm run precios`.
- **DURACIONES PERMITIDAS**: Campo opcional `"duraciones_permitidas": [1, 3]` para restringir opciones en el panel de compra. Prioridad: `plan > servicio > ajustes.ts`.
- **CÓMO AGREGAR O QUITAR UN SERVICIO**: Duplica cualquier archivo `.json`, cámbiale el nombre (ej. `youtube.json`), edita sus datos y agrega su `slug` en `orden.json`.
- **QUÉ NO TOCAR**: Los nombres de las claves (`id`, `slug`, `categoria`, `planes`, `prices`, `USD`).

