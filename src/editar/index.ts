import type {
  StreamingService,
  Country,
  PaymentMethod,
  WhatsAppTemplates,
  PanelCompraTexts,
  GarantiaTexts,
  FaqItem,
} from '../core';
import { MARCA } from './marca';
import { AJUSTES } from './ajustes';
import ordenData from './servicios/orden.json';
import paisesData from './paises.json';
import pagosData from './pagos.json';
import mensajesWhatsappData from './mensajes-whatsapp.json';
import inicioData from './textos/inicio.json';
import pieData from './textos/pie.json';
import botonesData from './textos/botones.json';
import panelCompraData from './textos/panel-compra.json';
import garantiaData from './textos/garantia.json';
import faqComunesData from './textos/faq-comunes.json';
import porPaisData from './textos/por-pais.json';
import valoracionesData from './textos/valoraciones.json';
import seoData from './seo.json';

import netflix from './servicios/netflix.json';
import disneyPlus from './servicios/disney-plus.json';
import hboMax from './servicios/hbo-max.json';
import spotify from './servicios/spotify.json';
import primeVideo from './servicios/prime-video.json';
import appleTvPlus from './servicios/apple-tv-plus.json';
import vix from './servicios/vix.json';
import paramountPlus from './servicios/paramount-plus.json';
import crunchyroll from './servicios/crunchyroll.json';

const catalogoBase: StreamingService[] = [
  netflix as StreamingService,
  disneyPlus as StreamingService,
  hboMax as StreamingService,
  spotify as StreamingService,
  primeVideo as StreamingService,
  appleTvPlus as StreamingService,
  vix as StreamingService,
  paramountPlus as StreamingService,
  crunchyroll as StreamingService,
];

const mapaPorSlug = new Map<string, StreamingService>(
  catalogoBase.map((s) => [s.slug, s])
);

const orden = ordenData as string[];

/**
 * Reemplaza el marcador `{marca}` en cualquier texto o estructura JSON editable.
 */
export function aplicarMarca(texto: string): string {
  return texto.replaceAll('{marca}', MARCA.nombre);
}

function aplicarMarcaProfundo<T>(valor: T): T {
  if (typeof valor === 'string') {
    return aplicarMarca(valor) as unknown as T;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => aplicarMarcaProfundo(item)) as unknown as T;
  }
  if (valor && typeof valor === 'object') {
    const copia: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) {
      copia[k] = aplicarMarcaProfundo(v);
    }
    return copia as T;
  }
  return valor;
}

export const SERVICIOS: StreamingService[] = aplicarMarcaProfundo([
  ...orden
    .map((slug) => mapaPorSlug.get(slug))
    .filter((s): s is StreamingService => Boolean(s)),
  ...catalogoBase.filter((s) => !orden.includes(s.slug)),
]);

export const PAISES = paisesData as Country[];
export const PAGOS = pagosData as PaymentMethod[];
export const MENSAJES_WHATSAPP = mensajesWhatsappData as WhatsAppTemplates;
export const TEXTOS_INICIO = aplicarMarcaProfundo(inicioData);
export const TEXTOS_PIE = aplicarMarcaProfundo(pieData);
export const TEXTOS_BOTONES = aplicarMarcaProfundo(botonesData);
export const TEXTOS_PANEL_COMPRA = aplicarMarcaProfundo(
  panelCompraData as unknown as PanelCompraTexts
);
export const TEXTOS_GARANTIA = aplicarMarcaProfundo(
  garantiaData as GarantiaTexts
);
export const FAQ_COMUNES = aplicarMarcaProfundo(
  faqComunesData as FaqItem[]
);
export const TEXTOS_POR_PAIS = aplicarMarcaProfundo(porPaisData);
export const TEXTOS_VALORACIONES = aplicarMarcaProfundo(valoracionesData);
export const SEO_TEXTOS = aplicarMarcaProfundo(seoData);

export { MARCA, AJUSTES };
