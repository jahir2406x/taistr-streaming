import { MARCA, AJUSTES, TEXTOS_INICIO } from '../editar';
import { crearMensajeWhatsApp } from '../utils/whatsapp';

/**
 * Puente de configuración central que lee todos los valores desde `src/editar/`.
 */
export const SITE_CONFIG = {
  brandName: MARCA.nombre,
  tagline: MARCA.eslogan,
  description: MARCA.descripcion,
  siteUrl: AJUSTES.siteUrl,
  currency: MARCA.monedaPorDefecto,
  country: MARCA.paisPorDefecto,
  whatsappNumber: MARCA.numeroWhatsapp,
  SHOW_PRICES: AJUSTES.SHOW_PRICES,
  prices_updated_at: AJUSTES.prices_updated_at,
  supportHours: MARCA.horarioSoporte,
  responseTime: MARCA.tiempoRespuesta,
  paymentMethods: MARCA.mediosPagoResumen,
  defaultWhatsappMessage: crearMensajeWhatsApp({ tipo: 'consulta_general' }),
  colors: {
    background: '#09090B',
    surface: '#16161C',
    accent: '#F59E0B',
    whatsapp: '#16A34A',
  },
  socialLinks: MARCA.redesSociales,
  legal: {
    disclaimer: MARCA.legal.avisoNoAfiliacion,
    privacySummary: MARCA.legal.resumenPrivacidad,
    lastUpdated: MARCA.legal.ultimaActualizacionLegal,
  },
  generalFaq: TEXTOS_INICIO.faqGeneral.preguntas,
} as const;
