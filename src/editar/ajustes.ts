/**
 * QUÉ ES ESTE ARCHIVO: Interruptores globales de la tienda (mostrar/ocultar precios, fechas, URL y analítica).
 * QUÉ PUEDES EDITAR: `SHOW_PRICES` (true o false), `prices_updated_at` (fecha) y la URL por defecto.
 * QUÉ NO TOCAR: La estructura `import.meta.env` ni los nombres de las variables exportadas.
 */

export const AJUSTES = {
  // Activa o desactiva todas las animaciones y micro-interacciones del sitio
  ANIMACIONES: true,
  // Cambia a `false` si deseas ocultar todos los precios y mostrar "Consultar precio por WhatsApp"
  SHOW_PRICES: true,
  // Fecha de última actualización de tarifas que se muestra en el pie de página y en Garantía
  prices_updated_at: '2026-10-30',
  // URL principal del sitio (usa la variable de entorno SITE_URL si existe, o el valor de respaldo)
  siteUrl: (typeof import.meta !== 'undefined' && import.meta.env?.SITE_URL) || 'https://taistr.com',
  // Token opcional de Cloudflare Web Analytics (sin cookies)
  cfBeaconToken: (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_CF_BEACON_TOKEN) || '',
  // Código opcional de verificación para Google Search Console desde variable de entorno GOOGLE_SITE_VERIFICATION (sin valor por defecto)
  googleSiteVerification: (typeof import.meta !== 'undefined' && import.meta.env?.GOOGLE_SITE_VERIFICATION) || '',
  // Banderas para activar páginas adicionales de confianza una vez completados sus textos (mientras sean false llevan noindex y no salen en sitemap ni enlaces)
  PAGINAS_CONFIANZA: {
    quienes_somos: false,
    terminos: false,
  },
  // paso de redondeo del precio final: 0.5 = a la mitad de sol más cercana, 1 = entero, 0.01 = céntimos
  redondeo: {
    PEN: 0.5,
    MXN: 1,
    ARS: 1,
    USD: 0.01,
  },
  // Duraciones disponibles en el panel de compra (valores por defecto para los servicios que no definen los suyos). descuento_pct: 0 significa precio normal sin descuento.
  duraciones: [
    { meses: 1, etiqueta: '1 mes', descuento_pct: 0 },
    { meses: 2, etiqueta: '2 meses', descuento_pct: 0 },
    { meses: 3, etiqueta: '3 meses', descuento_pct: 5 },
    { meses: 6, etiqueta: '6 meses', descuento_pct: 8 },
  ],
  // Umbrales para valoraciones de 1 a 5 estrellas directamente en la página
  VALORACIONES: {
    mostrar_desde: 5,
    schema_desde: 15,
    schema_activo: false,
  },
  // Topes máximos de peso por página en dist/ (medición: máx 73 KB JS y 61.5 KB CSS con margen de seguridad)
  PRESUPUESTO: {
    js_por_pagina_kb: 88,
    css_por_pagina_kb: 65,
  },
} as const;
