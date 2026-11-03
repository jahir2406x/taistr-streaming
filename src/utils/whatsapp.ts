import { MARCA, AJUSTES, MENSAJES_WHATSAPP } from '../editar';
import {
  renderWhatsAppMessage,
  buildWhatsAppOrderMessage,
  sanitizeWhatsAppText,
  type WhatsAppMessageContext,
  type WhatsAppOrderMessageInput,
} from '../core';

export {
  sanitizeWhatsAppText,
  buildWhatsAppOrderMessage,
  renderWhatsAppMessage,
  type WhatsAppOrderMessageInput,
  type WhatsAppMessageContext,
};

/**
 * Construye el mensaje final usando las plantillas de `src/editar/mensajes-whatsapp.json`
 * y la marca de `src/editar/marca.ts`.
 */
export function crearMensajeWhatsApp(ctx: WhatsAppMessageContext): string {
  return renderWhatsAppMessage({
    marca: MARCA.nombre,
    mostrarPrecios: AJUSTES.SHOW_PRICES,
    plantillas: MENSAJES_WHATSAPP,
    ...ctx,
  });
}

/**
 * Construye el enlace oficial hacia wa.me con mensaje codificado, tomando el número únicamente de `marca.ts`.
 */
export function buildWhatsAppUrl(message: string): string {
  const cleanPhone = MARCA.numeroWhatsapp.replace(/\D/g, '');
  const cleanMessage = sanitizeWhatsAppText(message);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(cleanMessage)}`;
}

/**
 * Codifica el número de `marca.ts` en base64 para ensamblarlo en cliente.
 */
export function getEncodedPhone(): string {
  const cleanPhone = MARCA.numeroWhatsapp.replace(/\D/g, '');
  return btoa(cleanPhone);
}
