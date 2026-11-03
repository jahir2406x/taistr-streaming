# Carpeta `src/core/`
- **Qué hay aquí**: Lógica pura de negocio (esquemas Zod, precios multi-moneda, países, medios de pago y motor de plantillas de WhatsApp).
- **Si quiero cambiar países, pagos o plantillas**: Ve a `src/editar/paises.json`, `src/editar/pagos.json` o `src/editar/mensajes-whatsapp.json`.
- **Qué no tocar**: Esta carpeta es reutilizable para la futura app de escritorio y está probada con `npm test`.

