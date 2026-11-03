# Guía de Edición para el Dueño (Sin saber programar)

Todo lo que necesitas cambiar en tu web de **TaiSTR** está concentrado en una sola carpeta: **`src/editar/`**.

## 1. Los comandos que necesitas

Abre la terminal en la carpeta del proyecto y escribe:
- **`npm run dev`** → **Previsualizar**: Abre tu web en `http://localhost:4321` y actualiza tus cambios al instante.
- **`npm run check:data`** → **Revisar errores**: Verifica comas, comillas, precios, medios de pago y textos del panel (`npm run pendientes` lista lo que tiene `CAMBIAR:`).
- **`npm run precios`** → **Ver tabla de precios y descuentos**: Muestra la tarifa final, ahorro y origen del descuento por servicio, plan y duración (usa `npm run precios -- netflix PEN` para filtrar).
- **`npm run mensajes`** → **Ver mensajes de WhatsApp**: Muestra en consola cada mensaje y enlace (usa `npm run mensajes -- netflix` para filtrar un servicio).
- **`npm run build`** → **Construir**: Valida todo y genera la carpeta final `dist/` lista para subir a internet.
- **`npm run verificar`** → **Verificación total (ejecútalo siempre antes de publicar)**: Corre en orden `check:data`, `test`, `auditar`, `build`, `presupuesto` (topes de JS y CSS en `src/editar/ajustes.ts`), `enlaces` (rutas internas, `#anclas`, imágenes y `wa.me`) y `seguridad` (cabeceras CSP con hashes SHA-256 y `security.txt`), deteniéndose al primer fallo.

---

## 2. Tabla rápida: "Quiero cambiar... → Abro este archivo → Busco este campo"

| Quiero cambiar... | Abro este archivo | Busco este campo / sección |
| :--- | :--- | :--- |
| **Nombre de la marca (TaiSTR)** | `src/editar/marca.ts` | `nombre` (en textos `.json` y `.md` usa `{marca}`) |
| **Número de WhatsApp** | `src/editar/marca.ts` | `numeroWhatsapp` (sin `+` ni espacios, ej: `51999999999`) |
| **Garantía única, panel y renovación** | `src/editar/textos/garantia.json` | `garantia_corta`, `garantia_panel`, `renovacion_frase`, `renovacion_nota` |
| **Preguntas frecuentes comunes de servicios** | `src/editar/textos/faq-comunes.json` | Preguntas automáticas de renovación y garantía para todos los servicios |
| **Texto del botón del panel (apagado / encendido)** | `src/editar/textos/panel-compra.json` | `botonSinMedio` y `botonConMedio` |
| **Duraciones y descuentos del panel** | `src/editar/ajustes.ts` | `duraciones` (meses, etiquetas y % de descuento por defecto) |
| **Descuentos por servicio o por plan** | `src/editar/servicios/<servicio>.json` | `descuentos` (`"3": 10`) a nivel de servicio o de plan, o `duraciones_permitidas` |
| **Destacar un plan (insignia, brillo, gancho)** | `src/editar/servicios/<servicio>.json` | `destacado: true`, `etiqueta`, `gancho`, `nota_panel`, `nota_interna` |
| **Qué incluye un plan en el panel** | `src/editar/servicios/<servicio>.json` | `incluye` (lista) o `nota_panel` dentro de cada plan en `planes` |
| **Color del brillo de un servicio y su panel** | `src/editar/servicios/<servicio>.json` | `color_acento` (código hexadecimal, ej: `"#E50914"`) |
| **Medios de pago y sus notas en el panel** | `src/editar/pagos.json` | `name`, `note`, `countries`, `enabled`, `order` |
| **Mensaje de compra o de disponibilidad** | `src/editar/mensajes-whatsapp.json` | `comprar_plan` o `consultar_disponibilidad` (o en el `.json` del servicio) |
| **Mensaje del botón flotante** | `src/editar/mensajes-whatsapp.json` | `boton_flotante` |
| **Texto de un botón o de la tarjeta de plan** | `src/editar/textos/botones.json` | `acciones.elegirEstePlan`, `navegacion` |
| **Horario, pie de página y redes** | `src/editar/marca.ts` y `src/editar/textos/pie.json` | `horarioSoporte`, `redesSociales`, `legal` |
| **Textos del inicio y FAQ general** | `src/editar/textos/inicio.json` | `hero`, `comoFunciona`, `beneficios`, `faqGeneral.preguntas`, `ctaFinal` |
| **Textos dinámicos por país (hero, catálogo, pie)** | `src/editar/textos/por-pais.json` | `plantilla`, `overrides` (`{pais}`, `{metodos_pago}`, `{moneda}`) |
| **Editar precio o marcar servicio no disponible** | `src/editar/servicios/<servicio>.json` | `planes` (`prices.PEN`, `USD`, `MXN`, `ARS`) o `"disponible": false` |
| **Agregar o quitar un servicio** | `src/editar/servicios/` y `orden.json` | Duplica un `.json`, edítalo y pon su `slug` en `orden.json` |
| **Mostrar u ocultar todos los precios** | `src/editar/ajustes.ts` | `SHOW_PRICES: true` (o `false`) y `prices_updated_at` |
| **Orden de las secciones: dónde se reordenan** | `src/components/secciones/HomeContent.astro` y `src/components/servicios/ServiceDetail.astro` | Orden de componentes en el marcado Astro |
| **Colores globales, países, Garantía y SEO** | `tema.css`, `paises.json`, `garantia.md`, `seo.json` | Variables `--color-*`, países activos y textos legales/SEO |

---

## 3. Cambiar el panel de compra

Al hacer clic en cualquier tarjeta de plan disponible se abre el panel de compra: en escritorio es una **carta centrada de dos columnas** (izquierda: resumen, qué incluye, garantía y pasos; derecha: medios de pago y botón fijo abajo) y en celular (menos de 768 px) una hoja que sube desde abajo.
- **Ancho, radios, sombra y duración de la animación**: variables `--carta-ancho-max`, `--carta-radio`, `--carta-animacion`, etc., al inicio del bloque `<style>` de `src/components/servicios/PanelCompra.astro` (cada una con su comentario).
1. **Dónde están los textos del panel (`src/editar/textos/panel-compra.json`)**:
   - Contiene el saludo (`saludoPrefijo`), títulos (`incluyeTitulo`, `pasosTitulo`, `eligeMedioPagoTitulo`) y etiquetas de cierre.
2. **Cómo cambiar la garantía, la renovación, los pasos y los textos del botón**:
   - La frase de garantía del panel y la nota de renovación viven en `src/editar/textos/garantia.json` (`garantia_panel` con `{duracion}` y `renovacion_frase` / `renovacion_nota`).
   - En `src/editar/textos/panel-compra.json` edita `tiempoEntregaTexto` (reemplaza `CAMBIAR:` por tus tiempos), la lista de 3 pasos en `pasos`, el texto cuando aún no eligen medio (`botonSinMedio`: `"Elige un medio de pago"`) y cuando ya eligieron (`botonConMedio`: `"Continuar por WhatsApp →"`).
3. **Cómo agregar, quitar o reordenar medios de pago y sus notas (`src/editar/pagos.json`)**:
   - Para **desactivar** un medio cambia `"enabled": true` a `false`. Para **reordenarlos** cambia el número `"order"` (`1` sale primero).
   - Edita `"name"` y `"note"` (la nota que aparece debajo del nombre en el panel). **Nunca pongas números de cuenta, CCI, CLABE, alias ni direcciones de wallet en la web**; el campo `"logo": ""` está reservado para el futuro.
4. **Cómo personalizar lo que incluye un plan (`src/editar/servicios/<servicio>.json`)**:
   - Por defecto el panel muestra las pantallas, la vigencia y la nota del plan. Si quieres mostrar una lista personalizada en un plan, rellena `"incluye": ["Calidad 4K", "PIN propio", "Smart TV y móvil"]` o `"nota_panel"` dentro de ese plan.
5. **Cómo cambiar el color del brillo de un servicio (`color_acento`)**:
   - En `src/editar/servicios/<servicio>.json` cambia `"color_acento": "#E50914"`. Ese color ilumina automáticamente el borde de la tarjeta al pasar el mouse, el resumen del panel, el selector de pago y el botón encendido.
6. **Cómo se rellena el mensaje de WhatsApp con el medio de pago**:
   - Al elegir un medio en el panel y pulsar continuar, se usa la plantilla `comprar_plan` reemplazando `{medio_pago}` por el medio elegido. Si un servicio o plan tiene `"disponible": false`, la tarjeta va directo a WhatsApp con `consultar_disponibilidad` sin abrir el panel.
7. **Cómo cambiar duraciones (meses) y descuentos multinivel**:
   - **Regla de prioridad de tarifas**:
     1. `precios_por_duracion` en el plan (tarifa fija en PEN/USD, ej: `"3": { "PEN": 28, "USD": 8 }`).
     2. `descuentos` en el plan (ej: `"3": 12` dentro del plan en `planes`).
     3. `descuentos` en el servicio (ej: `"3": 5, "6": 8` en el archivo del servicio antes de `planes`).
     4. `duraciones` globales en `src/editar/ajustes.ts` (valores por defecto).
   - Un `0` explícito en `descuentos` (ej: `"3": 0`) significa 0% de descuento y detiene la búsqueda; una clave ausente delega al nivel siguiente.
   - **Duraciones permitidas**: `plan.duraciones_permitidas > servicio.duraciones_permitidas > ajustes.ts duraciones`. Puedes restringir qué duraciones admite un plan o un servicio entero (ej: `"duraciones_permitidas": [1, 3]`).
   - **Redondeo configurable por moneda**: Configurado en `src/editar/ajustes.ts` (`redondeo`: 0.5 para PEN a medio sol más cercano, 1 para MXN/ARS a enteros, 0.01 para USD a céntimos); muestra decimales solo cuando el monto no es entero.
   - Usa **`npm run precios`** para ver la tabla completa con el ahorro y el origen de cada descuento (`plan`, `servicio`, `general` o `exacto`).
8. **Fuente única de garantía y preguntas comunes (`garantia.json` y `faq-comunes.json`)**:
   - `src/editar/textos/garantia.json`: contiene `garantia_corta` (para listados), `garantia_panel` (acepta `{duracion}` y `{meses}`), `renovacion_frase` y `renovacion_nota` (con `CAMBIAR:` para condiciones propias).
   - `src/editar/textos/faq-comunes.json`: lista de preguntas sobre renovación y garantía que se agregan al final del FAQ de TODOS los servicios automáticamente sin repetir preguntas existentes.
9. **Cómo destacar un plan (`destacado`, `etiqueta`, `gancho`, `nota_panel`, `nota_interna`)**:
   - En cualquier plan de `src/editar/servicios/<servicio>.json`:
     - `"destacado": true`: se muestra en una fila horizontal ancha debajo de la cuadrícula de 3 planes (los planes normales siempre se mantienen en la cuadrícula de 3 columnas); cuenta con resplandor sutil permanente y borde con el color de acento del servicio.
     - `"etiqueta": "Texto corto"` (hasta 28 caracteres): insignia en su propia línea en la cabecera de la tarjeta destacada.
     - `"gancho": "Frase corta"` (hasta 70 caracteres): línea de enganche con contraste AA legible sobre fondo oscuro en la tarjeta y en el panel.
     - `"nota_panel": "..."`: aparece como nota "Ten en cuenta" dentro del panel de compra.
     - `"nota_interna": "CAMBIAR: ..."`: nota interna privada (no se muestra en la web, `npm run pendientes` te avisará).
10. **Cómo agregar un plan nuevo a un servicio y comportamiento de la cuadrícula**:
    - Para agregar un plan, añade un nuevo objeto al arreglo `planes` en `src/editar/servicios/<servicio>.json` con su propio `id` y `prices` por moneda.
    - Con 1 a 3 planes normales la cuadrícula se muestra en hasta 3 columnas; con exactamente 4 planes normales se distribuye automáticamente en 2x2 (2 columnas en pantallas medianas y grandes, 1 en celular); los planes con `"destacado": true` no cuentan y se renderizan debajo a ancho completo.

---

## 4. Cambiar los mensajes de WhatsApp

1. **Plantillas globales (`src/editar/mensajes-whatsapp.json`)**:
   - `comprar_plan` (panel de compra), `consultar_disponibilidad` (sin stock), `barra_movil` (tarjetas de catálogo y barra móvil), `armador_pedido` (inicio), `consulta_general` (encabezado/hero/pie/404), `soporte` (Garantía), `boton_flotante` y `renovar`.
2. **Marcadores disponibles** (los vacíos se limpian solos sin dejar dobles espacios ni `()` vacíos):
   - `{marca}`, `{servicio}`, `{plan}`, `{precio}`, `{moneda}`, `{duracion}`, `{pais}`, `{medio_pago}`, `{pantallas}`.
3. **Personalizar UN servicio o plan concreto**:
   - Rellena `"mensaje_comprar"` o `"mensaje_disponibilidad"` en `src/editar/servicios/<servicio>.json`. Prioridad: **plan > servicio > plantilla por tipo de botón**.
4. **Cambiar solo el texto visible de un botón o agregar uno nuevo**:
   - Edita `src/editar/textos/botones.json`. Para agregar un botón en una página usa:
   ```astro
   <BotonWhatsApp tipo="renovar" servicio="Netflix" plan="Perfil Personal 4K" texto="Renovar mi cuenta" class="bg-brand-whatsapp text-white px-4 py-2 rounded" />
   ```
5. **Previsualizar y validar**:
   - Ejecuta `npm run mensajes` (o `npm run mensajes -- netflix`) y `npm run check:data`.

### Textos adaptados por país (`src/editar/textos/por-pais.json`)
En `src/editar/textos/por-pais.json` configuras los textos que cambian en vivo al elegir país (Perú, México, Argentina, otros países):
- **`plantilla`**: texto base con marcadores `{pais}`, `{metodos_pago}` y `{moneda}`.
- **`overrides`**: excepciones opcionales por código (`PE`, `MX`, `AR`, `default`).
- **Agregar uno nuevo**: añade la clave en `por-pais.json` y usa `data-texto-pais="tu_clave"` en el HTML.
- **Compartir enlace por país**: añade `?pais=PE`, `?pais=MX` o `?pais=AR` a cualquier dirección (ej. `https://taistr.com/servicios/netflix?pais=MX`) para abrir la web directamente con la moneda, pagos y textos de ese país.
- **Páginas de confianza opcionales**: completa los textos `"CAMBIAR:"` en `src/editar/textos/quienes-somos.md` y `terminos.md` (revisa con `npm run pendientes`) antes de cambiar `PAGINAS_CONFIANZA` a `true` en `src/editar/ajustes.ts`.

### Apariencia y animaciones (`src/editar/tema.css` y `src/editar/ajustes.ts`)
- **Activar o apagar animaciones**: En `src/editar/ajustes.ts`, cambia `ANIMACIONES: true` a `false` (`data-anim="off"`) para desactivar todo el movimiento (revelados, luz de puntero, botón magnético, panel e indicadores). También se apagan solas con `prefers-reduced-motion`.
- **Colores y superficies**: En `src/editar/tema.css` ajusta los colores base (`--color-*`) y los 3 niveles de superficie (`--surface-1`, `--surface-2`, `--surface-3`) junto con los bordes (`--border-subtle`, `--border-highlight`).
- **Radios, escala y tiempos**: En `src/editar/tema.css` edita radios (`--radius-card`, `--radius-card-lg`, `--radius-button`), escala tipográfica (`--text-h1..h3`), duraciones (`--anim-rapida`, `--anim-media`, `--anim-lenta`) y curvas (`--ease-out`, `--ease-spring`).
- **Chips de plataformas en el hero**: La antigua cinta en movimiento continuo fue reemplazada por una fila estática de chips clicables dentro del hero (`HeroInicio.astro`) que enlazan directo a cada servicio.

### Logos e insignias de servicios (`src/editar/servicios/<servicio>.json`)
- **Iniciales y color**: Cada servicio muestra un monograma visual con sus `iniciales` (1 a 3 caracteres, ej. `"N"`, `"D+"`, `"HBO"`) sobre su `color_acento`. Cámbialas en el `.json` del servicio.
- **Logo propio**: Para mostrar tu imagen en lugar del monograma, define `"logo_propio": "/logos/tu-archivo.svg"` (el archivo debe existir en `public/logos/`).
- **Aviso de no afiliación**: No subas logotipos oficiales ni marcas registradas de terceros para evitar reclamos legales.

### Valoraciones directas en la web (1 a 5 estrellas)
- **Cómo funciona**: Los visitantes califican con un toque de 1 a 5 estrellas en cada página de servicio.
- **Sin datos personales ni spam**: No hay comentarios ni nombres; solo estrellas registradas de forma segura y anónima en Cloudflare D1 (ver `docs/VALORACIONES.md`).
- **Visibilidad y buscadores**: El resumen `★ 4,8` se muestra desde 5 votos (`mostrar_desde` en `src/editar/ajustes.ts`). Los textos se editan en `src/editar/textos/valoraciones.json`. Para actualizar las estrellas en buscadores, ejecuta `npm run valoraciones:snapshot` cuando alcances 15 votos por servicio.

### Franja de confianza y botones (`src/editar/textos/`)
- **Franja de confianza**: Reutiliza automáticamente textos de `textos/garantia.json` (`garantia_corta`), `textos/inicio.json` (`beneficios`) y `pagos.json` (`note`). Al editarlos, la franja en el hero y en el panel se actualiza sola.
- **Etiquetas de botones y navegación**: En `textos/botones.json` ajustas las llamadas a la acción (`acciones.pedirWhatsApp`, `acciones.verPlanes`), migas y enlaces de navegación tanto de escritorio como del menú móvil (`navegacion`).

---

## 5. Mapa del proyecto y qué hacer si algo falla

```text
WEB_STREAMING/
├── public/logos/            ✅ EDITAR: Iconos/logos opcionales y portada (og-cover.svg)
├── src/editar/              ✅ EDITAR AQUÍ: marca.ts, ajustes.ts, tema.css, paises.json, pagos.json,
│                               mensajes-whatsapp.json, seo.json, servicios/*.json y textos/*
└── src/components, core, layouts, pages, utils ⛔ NO TOCAR (Código interno de la web)
```

- **Si algo falla**: ejecuta `npm run check:data` para ver el archivo exacto con error, usa `Ctrl + Z` o restaura desde `../web-respaldo`.
- **Antes de publicar**: ejecuta **`npm run verificar`**; cuando los 7 pasos salgan con `✓` (incluyendo seguridad en `docs/SEGURIDAD.md`), sube `dist/` a tu hosting o usa `npm run build` en **Cloudflare Pages**.
