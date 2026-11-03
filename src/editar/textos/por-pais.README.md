# Textos por País (`por-pais.json`)
Textos adaptables según el país seleccionado en la web.
- `plantilla`: Texto base con marcadores `{pais}`, `{metodos_pago}`, `{moneda}`.
- `overrides`: Excepciones por código de país (`PE`, `MX`, `AR`, `default`).
Para agregar o modificar un texto:
1. Añade la clave en `por-pais.json` con su plantilla y overrides si aplica.
2. Añade `data-texto-pais="clave"` en el elemento HTML que debe actualizarse.

