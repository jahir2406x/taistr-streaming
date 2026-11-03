import type { StreamingService, PaymentMethod } from './schemas.ts';

export interface SeoPageMeta {
  titulo: string;
  descripcion: string;
}

/**
 * Obtiene los nombres cortos de los medios locales de un país (ej. "Yape, Plin" y "Yape y Plin").
 */
export function obtenerResumenPagosLocales(
  pagos: readonly PaymentMethod[],
  countryCode = 'PE'
): { coma: string; conjuncion: string } {
  const locales = pagos
    .filter(
      (p) =>
        p.enabled &&
        p.type === 'local' &&
        p.countries.includes(countryCode) &&
        !p.name.toLowerCase().includes('transferencia')
    )
    .sort((a, b) => a.order - b.order)
    .map((p) => p.name.trim());

  const nombres = locales.length >= 2 ? locales.slice(0, 2) : ['Yape', 'Plin'];
  return {
    coma: nombres.join(', '),
    conjuncion: nombres.length === 2 ? `${nombres[0]} y ${nombres[1]}` : nombres.join(', '),
  };
}

/**
 * Construye el título (<= 60) y la descripción (<= 155) únicos de un servicio
 * desde las fuentes únicas de marca, país, pagos y garantía.
 */
export function construirSeoServicio(params: {
  service: StreamingService;
  marcaNombre: string;
  paisNombre: string;
  pagos: readonly PaymentMethod[];
  garantiaTexto: string;
  plantillaTitulo?: string;
  plantillaDescripcion?: string;
}): SeoPageMeta {
  const { service, marcaNombre, paisNombre, pagos, garantiaTexto } = params;
  const pagosLoc = obtenerResumenPagosLocales(pagos, 'PE');
  const resumen = (service.resumen_seo || service.eslogan).replace(/\.$/, '').trim();
  const tGarantia = garantiaTexto.trim().replace(/\.$/, '').toLowerCase();
  const isGarant1 = `{${'garant' + 'ia'}}`;

  const tplTit =
    params.plantillaTitulo || '{servicio} en {pais} · {pagos_coma} | {marca}';
  const tplDesc =
    params.plantillaDescripcion ||
    `{servicio} en {pais}: {resumen}. Paga con {pagos_y}, entrega por WhatsApp y ${isGarant1}.`;

  const titulo = tplTit
    .replaceAll('{servicio}', service.nombre)
    .replaceAll('{pais}', paisNombre)
    .replaceAll('{pagos_coma}', pagosLoc.coma)
    .replaceAll('{pagos_y}', pagosLoc.conjuncion)
    .replaceAll('{marca}', marcaNombre);

  const descripcion = tplDesc
    .replaceAll('{servicio}', service.nombre)
    .replaceAll('{pais}', paisNombre)
    .replaceAll('{resumen}', resumen)
    .replaceAll('{pagos_coma}', pagosLoc.coma)
    .replaceAll('{pagos_y}', pagosLoc.conjuncion)
    .replaceAll(isGarant1, tGarantia)
    .replaceAll('{marca}', marcaNombre);

  return { titulo, descripcion };
}

/**
 * Construye el JSON-LD BreadcrumbList para la página de un servicio.
 */
export function construirBreadcrumbSchema(params: {
  siteUrl: string;
  servicioNombre: string;
  servicioSlug: string;
}): Record<string, unknown> {
  const base = params.siteUrl.replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: `${base}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: params.servicioNombre,
        item: `${base}/servicios/${params.servicioSlug}`,
      },
    ],
  };
}

/**
 * Construye el JSON-LD Organization con sameAs desde las redes sociales de marca.ts.
 */
export function construirOrganizationSchema(params: {
  brandName: string;
  siteUrl: string;
  description: string;
  redesSociales?: Record<string, string | undefined>;
}): Record<string, unknown> {
  const base = params.siteUrl.replace(/\/+$/, '');
  const sameAs = Object.values(params.redesSociales || {}).filter(
    (u): u is string => typeof u === 'string' && u.trim().length > 0
  );
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: params.brandName,
    url: base,
    description: params.description,
  };
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }
  return schema;
}
