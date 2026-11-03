---
name: panel-compra
description: Especificación técnica del panel de compra y la tarjeta de plan, su flujo de interacción, accesibilidad y reglas de cierre seguro. No usar para cambios de contenido o precios (usar contenido-editable).
---

# Arquitectura y Reglas del Panel de Compra

## 1. Estructura y Componentes
- `src/components/servicios/TarjetaPlan.astro`: tarjeta interactiva accesible por teclado (Enter/Espacio). Dispara `openPanelFromCard` con atributos `data-plan-*`. Los planes normales van en la cuadrícula estándar de 3 columnas (`md:grid-cols-3`); si un plan tiene `destacado: true`, se muestra en una fila horizontal ancha debajo de la cuadrícula de 3 columnas.
- `src/components/servicios/PanelCompra.astro`: modal nativo `<dialog id="panel-compra">`. En escritorio es carta centrada de dos columnas; en móvil (<768px) es hoja inferior deslizable.
- `src/components/servicios/SelectorMedioPago.astro`: lista de radios accesibles (`role="radio"`, `aria-checked`).
- `src/components/servicios/ScriptPanelCompra.astro`: controlador de eventos y sincronización.

## 2. Estado por Plan y Flujo de Selección
- Cada apertura inicia limpia con `selectedPaymentId: null` y duración predeterminada en 1 mes; abrir otro plan jamás recuerda el medio anterior.
- Selector de duración tipo radio: opciones filtradas por `plan.duraciones_permitidas > servicio.duraciones_permitidas > ajustes.ts duraciones`.
- Descuento dinámico resuelto en cascada: `precios_por_duracion` (exacto) > `plan.descuentos` > `servicio.descuentos` > `ajustes.ts (general)`. Un 0 explícito detiene la búsqueda y aplica 0%; clave ausente delega al nivel siguiente.
- Calcula precio total y ahorro dinámico (`calculateDurationPrice`), actualiza vigencia ("Qué incluye") y garantía con `resolveDurationGarantia` y `resolveDurationIncludes`, y muestra nota de renovación.
- Seleccionar un medio de pago solo actualiza estado y atributos DOM (`aria-checked`, `tabindex`, estilos).
- **PROHIBIDO** hacer `mediosListaEl.innerHTML = ''` en el clic de selección: destruiría el nodo mientras el evento burbujea, provocando cierres no deseados.
- Al seleccionar medio, el botón CTA se enciende con el color `--acento` del servicio y texto `botonConMedio`.

## 3. Regla de Cierre Seguro (Backdrop Click)
- Lógica pura centralizada en `shouldCloseOnBackdropClick` (`src/core/panel-compra.ts`, probado en `tests/core.test.ts`).
- **Error conocido a evitar**: al pulsar un medio o label, el navegador puede emitir un clic sintético (`detail === 0` o coordenadas `0,0`) que NO debe cerrar el diálogo.
- El cierre por fondo NUNCA se decide por coordenadas `getBoundingClientRect`.
- Solo se cierra si `pointerdown` y `click` empezaron y terminaron en el backdrop/diálogo, fuera de `caja`.
- Si el puntero bajó dentro de la carta (ej. arrastrar selección de texto), no se cierra.

## 4. Accesibilidad y Estilos
- Foco atrapado por `<dialog>`, restaurado a la tarjeta al cerrar (`lastTrigger.focus()`).
- Contenedores de scroll (`.carta-der-scroll`, `.carta`) se reinician a `scrollTop = 0` al abrir; foco en botones de duración usa `{ preventScroll: true }` para evitar saltos.
- Cierre con botón X, tecla Esc (`cancel` event) y clic real en el fondo.
- Bloqueo de scroll: `document.body.style.overflow = 'hidden'` al abrir, restaurado al cerrar.
- Animación de escala/opacidad en escritorio (220ms) y reversa (`is-cerrando`), anulada con `prefers-reduced-motion`.
- Variables CSS en `<style is:global>` de `PanelCompra.astro` (`--carta-*`).

