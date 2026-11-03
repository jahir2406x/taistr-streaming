import type { WhatsAppButtonType, WhatsAppTemplates } from './schemas.ts';

export const ALLOWED_WHATSAPP_PLACEHOLDERS = [
  'marca',
  'servicio',
  'plan',
  'precio',
  'moneda',
  'duracion',
  'pais',
  'medio_pago',
  'pantallas',
] as const;

export type WhatsAppPlaceholder = (typeof ALLOWED_WHATSAPP_PLACEHOLDERS)[number];

export interface WhatsAppMessageContext {
  tipo?: WhatsAppButtonType;
  marca?: string;
  servicio?: string;
  plan?: string;
  precio?: string | null;
  moneda?: string;
  duracion?: string;
  pais?: string;
  codigoPais?: string;
  medio_pago?: string;
  medioPago?: string;
  pantallas?: string;
  disponible?: boolean;
  mostrarPrecios?: boolean;
  mensajePlanComprar?: string;
  mensajePlanDisponibilidad?: string;
  mensajeServicioComprar?: string;
  mensajeServicioDisponibilidad?: string;
  plantillas?: Partial<WhatsAppTemplates>;
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplates = {
  comprar_plan:
    'Hola {marca}, quiero el plan {plan} de {servicio} por {duracion} ({precio}). Estoy en {pais} y pagaría con {medio_pago}. ¿Está disponible?',
  consultar_disponibilidad:
    'Hola {marca}, quisiera consultar disponibilidad para {plan} ({duracion}) de {servicio}. Estoy en {pais} y pagaría con {medio_pago}.',
  consulta_general:
    'Hola, vengo de la web de {marca} y quiero consultar por los planes de streaming disponibles.',
  soporte:
    'Hola, vengo de la página de soporte de {marca} y tengo una consulta sobre las condiciones del servicio.',
  boton_flotante:
    'Hola, vengo de la web de {marca} y quiero consultar por los planes de streaming disponibles.',
  barra_movil:
    'Hola {marca}, quiero pedir {servicio} (desde {precio}). Estoy en {pais} y pagaría con {medio_pago}. ¿Está disponible?',
  armador_pedido:
    'Hola {marca}, quiero el plan {plan} de {servicio} ({precio} · {duracion}). Estoy en {pais} y pagaría con {medio_pago}. ¿Está disponible?',
  renovar:
    'Hola {marca}, quiero renovar mi plan {plan} de {servicio} ({duracion}) desde {pais} con {medio_pago}.',
};

export function sanitizeWhatsAppText(input: string): string {
  return input
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, 900);
}

export function cleanInterpolatedMessage(raw: string): string {
  return raw
    .split('\n')
    .map((line) =>
      line
        .replace(/\(\s*(?:desde\s+)?[·\-–—,]?\s*\)/gi, '')
        .replace(/\(\s*[·\-–—,]+\s*([^)]+)\)/g, '($1)')
        .replace(/\(([^)]+?)\s*[·\-–—,]+\s*\)/g, '($1)')
        .replace(/\(\s*\)/g, '')
        .replace(/\bpor\s+(?=\([^\)]*\)|[,.;:?!]|$)/gi, '')
        .replace(/\s+([,.;:?!])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
    .join('\n')
    .trim();
}

export function pickWhatsAppTemplate(ctx: WhatsAppMessageContext): string {
  const disponible = ctx.disponible !== false;
  const templates = { ...DEFAULT_WHATSAPP_TEMPLATES, ...(ctx.plantillas || {}) };
  const effectiveType: WhatsAppButtonType =
    !disponible &&
    (ctx.tipo === 'comprar_plan' || ctx.tipo === 'armador_pedido' || ctx.tipo === 'barra_movil')
      ? 'consultar_disponibilidad'
      : ctx.tipo || 'consulta_general';

  if (disponible) {
    if (ctx.mensajePlanComprar?.trim()) return ctx.mensajePlanComprar.trim();
    if (ctx.mensajeServicioComprar?.trim()) return ctx.mensajeServicioComprar.trim();
  } else {
    if (ctx.mensajePlanDisponibilidad?.trim()) return ctx.mensajePlanDisponibilidad.trim();
    if (ctx.mensajeServicioDisponibilidad?.trim()) return ctx.mensajeServicioDisponibilidad.trim();
  }

  return templates[effectiveType] || templates.consulta_general;
}

export function renderWhatsAppMessage(ctx: WhatsAppMessageContext): string {
  const template = pickWhatsAppTemplate(ctx);
  const showPrices = ctx.mostrarPrecios !== false;
  const isOtherCountry =
    ctx.codigoPais === 'default' ||
    (!ctx.codigoPais && (!ctx.pais || ctx.pais.toLowerCase().includes('otro')));

  const rawPayment = (ctx.medio_pago || ctx.medioPago || 'Binance (USD)').trim();
  const formattedPayment = isOtherCountry
    ? rawPayment.toLowerCase().startsWith('binance')
      ? 'Binance (USD)'
      : rawPayment.toUpperCase().includes('(USD)')
        ? rawPayment
        : `${rawPayment} (USD)`
    : rawPayment;

  const formattedCountry = isOtherCountry ? 'otro país' : (ctx.pais || 'Perú').trim();

  const values: Record<WhatsAppPlaceholder, string> = {
    marca: (ctx.marca || 'TaiSTR').trim(),
    servicio: (ctx.servicio || '').trim(),
    plan: (ctx.plan || '').trim(),
    precio: showPrices && ctx.precio ? ctx.precio.trim() : '',
    moneda: (ctx.moneda || '').trim(),
    duracion: (ctx.duracion || '').trim(),
    pais: formattedCountry,
    medio_pago: formattedPayment,
    pantallas: (ctx.pantallas || '').trim(),
  };

  const replaced = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? values[key as WhatsAppPlaceholder]
      : ''
  );

  return sanitizeWhatsAppText(cleanInterpolatedMessage(replaced));
}

export function extractTemplatePlaceholders(template: string): string[] {
  const found: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    found.push(match[1]);
  }
  return found;
}
