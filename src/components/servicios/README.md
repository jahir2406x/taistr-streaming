# Carpeta `src/components/servicios/`
- **Qué hay aquí**: Tarjetas de servicio (`ServiceCard`), tarjetas de plan (`TarjetaPlan`), panel deslizable (`PanelCompra`) y selector de pago (`SelectorMedioPago`).
- **Si quiero cambiar los textos del panel de compra**: Ve a `src/editar/textos/panel-compra.json`.
- **Si quiero cambiar medios de pago, planes o color de brillo**: Ve a `src/editar/pagos.json` o `src/editar/servicios/*.json`.
- **Qué no tocar**: La lógica vive en `src/core/panel-compra.ts` y los enlaces los genera `BotonWhatsApp.astro`.

