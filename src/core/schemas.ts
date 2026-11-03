import { z } from 'zod';

export const CountrySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  nombre_texto: z.string().min(1).optional(),
  currency: z.string().length(3),
  moneda_nombre: z.string().min(1).optional(),
  locale: z.string().min(2),
  enabled: z.boolean(),
});

export type Country = z.infer<typeof CountrySchema>;

export const PorPaisItemSchema = z.object({
  plantilla: z.string().min(1),
  overrides: z.record(z.string(), z.string()).optional(),
});

export type PorPaisItem = z.infer<typeof PorPaisItemSchema>;

export const PorPaisSchema = z.record(z.string(), PorPaisItemSchema);

export type PorPaisConfig = z.infer<typeof PorPaisSchema>;

export const PricesMapSchema = z.record(z.string(), z.number().positive());

export type PricesMap = z.infer<typeof PricesMapSchema>;

export const DurationOptionSchema = z.object({
  meses: z.number().int().positive(),
  etiqueta: z.string().min(1),
  descuento_pct: z.number().min(0).max(90),
});

export type DurationOption = z.infer<typeof DurationOptionSchema>;

export const ServicePlanSchema = z.object({
  id: z.string().min(1).optional(),
  nombre: z.string().min(1),
  duracion: z.string().min(1),
  pantallas: z.string().min(1),
  prices: PricesMapSchema,
  nota: z.string(),
  incluye: z.array(z.string()).optional(),
  nota_panel: z.string().optional(),
  disponible: z.boolean().optional(),
  destacado: z.boolean().optional(),
  etiqueta: z.string().max(28, { message: 'La etiqueta no debe superar los 28 caracteres' }).optional(),
  gancho: z.string().max(70, { message: 'El gancho no debe superar los 70 caracteres' }).optional(),
  nota_interna: z.string().optional(),
  mensaje_comprar: z.string().optional(),
  mensaje_disponibilidad: z.string().optional(),
  precios_por_duracion: z.record(z.string(), PricesMapSchema).optional(),
  duraciones_permitidas: z.array(z.number().int().positive()).optional(),
  descuentos: z.record(z.string(), z.number().int().min(0).max(90)).optional(),
});

export type ServicePlan = z.infer<typeof ServicePlanSchema>;

export const ServiceFaqSchema = z.object({
  pregunta: z.string().min(1),
  respuesta: z.string().min(1),
});

export type ServiceFaq = z.infer<typeof ServiceFaqSchema>;

export const StreamingServiceSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  slug: z.string().min(1),
  iniciales: z.string().min(1).max(3, { message: 'Las iniciales deben tener entre 1 y 3 caracteres' }).optional(),
  logo_propio: z.string().min(1).optional(),
  categoria: z.enum(['video', 'musica', 'anime']),
  eslogan: z.string().min(1),
  descripcion_corta: z.string().min(1),
  resumen_seo: z.string().min(1).optional(),
  descripcion_larga: z.string().min(1),
  caracteristicas: z.array(z.string().min(1)).min(1),
  descuentos: z.record(z.string(), z.number().int().min(0).max(90)).optional(),
  duraciones_permitidas: z.array(z.number().int().positive()).optional(),
  planes: z.array(ServicePlanSchema).min(1),
  mensaje_whatsapp: z.string().optional(),
  mensaje_comprar: z.string().optional(),
  mensaje_disponibilidad: z.string().optional(),
  color_acento: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  disponible: z.boolean(),
  faq: z.array(ServiceFaqSchema),
});

export type StreamingService = z.infer<typeof StreamingServiceSchema>;

export const PaymentMethodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['local', 'crypto']),
  countries: z.array(z.string().min(1)).min(1),
  currencies: z.array(z.string().length(3)).min(1),
  enabled: z.boolean(),
  order: z.number().int(),
  note: z.string().min(1),
  /** Campo reservado para futuro uso; no se muestra en la interfaz actual */
  logo: z.string().optional(),
});

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PanelCompraTextsSchema = z.object({
  saludoPrefijo: z.string().min(1),
  conectorDe: z.string().min(1),
  incluyeTitulo: z.string().min(1),
  vigenciaPrefijo: z.string().min(1),
  garantiaTexto: z.string().min(1),
  tiempoEntregaTexto: z.string().min(1),
  pasosTitulo: z.string().min(1),
  pasos: z.array(z.string().min(1)),
  eligeDuracionTitulo: z.string().min(1).optional(),
  etiquetaMes: z.string().min(1).optional(),
  etiquetaMeses: z.string().min(1).optional(),
  ahorrasEtiqueta: z.string().min(1).optional(),
  conectorPor: z.string().min(1).optional(),
  eligeMedioPagoTitulo: z.string().min(1),
  eligeMedioPagoSubtitulo: z.string().min(1),
  botonSinMedio: z.string().min(1),
  botonConMedio: z.string().min(1),
  cerrarPanelLabel: z.string().min(1),
  cerrarTexto: z.string().min(1),
});

export type PanelCompraTexts = z.infer<typeof PanelCompraTextsSchema>;

export const WhatsAppTemplatesSchema = z.object({
  comprar_plan: z.string().min(1),
  consultar_disponibilidad: z.string().min(1),
  consulta_general: z.string().min(1),
  soporte: z.string().min(1),
  boton_flotante: z.string().min(1),
  barra_movil: z.string().min(1),
  armador_pedido: z.string().min(1),
  renovar: z.string().min(1),
});

export type WhatsAppTemplates = z.infer<typeof WhatsAppTemplatesSchema>;
export type WhatsAppButtonType = keyof WhatsAppTemplates;

export const GarantiaTextsSchema = z.object({
  garantia_corta: z.string().min(1),
  garantia_panel: z.string().min(1),
  renovacion_frase: z.string().min(1),
  renovacion_nota: z.string().optional().default(''),
  vigencia_etiqueta: z.string().min(1).default('Vigencia: {duracion}'),
});

export type GarantiaTexts = z.infer<typeof GarantiaTextsSchema>;

export const FaqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const FaqComunesSchema = z.array(FaqItemSchema).min(1);

export type FaqItem = z.infer<typeof FaqItemSchema>;

export const ValoracionesTextsSchema = z.object({
  titulo: z.string().min(1),
  subtitulo: z.string().min(1),
  primerosEnValorar: z.string().min(1),
  gracias: z.string().min(1),
  yaValoraste: z.string().min(1),
  botonEnviar: z.string().min(1),
  botonEnviando: z.string().min(1),
  seleccionaEstrellas: z.string().min(1),
  errorGenerico: z.string().min(1),
  ariaLabelEstrella: z.string().min(1),
  sufijoSingular: z.string().min(1),
  sufijoPlural: z.string().min(1),
});

export type ValoracionesTexts = z.infer<typeof ValoracionesTextsSchema>;

export const OrderStatusSchema = z.enum([
  'pending',
  'paid',
  'delivered',
  'refunded',
  'cancelled',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().datetime(),
  service_id: z.string().min(1),
  plan_id: z.string().min(1),
  country: z.string().min(2),
  currency: z.string().length(3),
  amount: z.number().nonnegative(),
  payment_method_id: z.string().min(1),
  status: OrderStatusSchema,
  cost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export type Order = z.infer<typeof OrderSchema>;
