import type { Country, DurationOption, PaymentMethod, PricesMap } from './schemas.ts';
import { renderWhatsAppMessage, sanitizeWhatsAppText } from './mensajes.ts';

/**
 * Resuelve el objeto Country a partir de un código ISO ("PE", "MX", "AR", etc.) o devuelve el bloque "default" (USD).
 */
export function resolveCountry(countryCode: string | null | undefined, countries: readonly Country[]): Country {
  const fallback =
    countries.find((c) => c.code === 'default') ?? {
      code: 'default',
      name: 'Otros países',
      currency: 'USD',
      locale: 'es-419',
      enabled: true,
    };

  if (!countryCode) return fallback;
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'DEFAULT') return fallback;

  const found = countries.find(
    (c) => c.enabled && c.code.toUpperCase() === normalized
  );
  return found ?? fallback;
}

/**
 * Devuelve la moneda correspondiente al país o "USD" si no está soportado.
 */
export function getCurrencyForCountry(countryCode: string | null | undefined, countries: readonly Country[]): string {
  return resolveCountry(countryCode, countries).currency;
}

/**
 * Obtiene el monto y la moneda efectiva de un mapa de precios.
 * Si falta la moneda solicitada, usa USD como respaldo.
 */
export function resolvePlanPrice(
  prices: PricesMap,
  targetCurrency: string
): { amount: number; currency: string; isFallback: boolean } {
  const code = targetCurrency.trim().toUpperCase();
  if (typeof prices[code] === 'number' && prices[code] > 0) {
    return { amount: prices[code], currency: code, isFallback: false };
  }
  const usd = typeof prices.USD === 'number' && prices.USD > 0 ? prices.USD : 0;
  return { amount: usd, currency: 'USD', isFallback: code !== 'USD' };
}

/**
 * Formatea un monto con Intl.NumberFormat asegurando siempre mostrar el código ISO al final
 * (ej: "S/ 15 PEN", "$ 70 MXN", "US$ 4 USD").
 */
export function formatPrice(amount: number, currency: string, locale = 'es-419'): string {
  const iso = currency.trim().toUpperCase();
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;

  let formattedNumber: string;
  try {
    formattedNumber = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: iso,
      currencyDisplay: 'symbol',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replace(/\u00A0/g, ' ')
      .trim();
  } catch {
    formattedNumber = `${amount}`;
  }

  // Algunos locales (es-419) anteponen el código ISO ("USD 3.20"): se normaliza a "$3.20 USD"
  // para no mostrar la moneda dos veces.
  if (formattedNumber.toUpperCase().startsWith(`${iso} `)) {
    formattedNumber = `${iso === 'USD' ? '$' : ''}${formattedNumber.slice(iso.length + 1).trim()}`;
  }

  if (formattedNumber.toUpperCase().endsWith(` ${iso}`)) {
    return formattedNumber;
  }
  return `${formattedNumber} ${iso}`;
}

/**
 * Devuelve los medios de pago habilitados para un código de país ("PE", "MX", "AR" o "default"),
 * ordenados por el campo `order`. Para "default" devuelve los marcados con "*" (ej. Binance).
 */
export function getPaymentMethodsForCountry(
  countryCode: string | null | undefined,
  payments: readonly PaymentMethod[],
  countries: readonly Country[]
): PaymentMethod[] {
  const resolved = resolveCountry(countryCode, countries);
  const targetCode = resolved.code;

  return payments
    .filter((pm) => {
      if (!pm.enabled) return false;
      if (targetCode === 'default') {
        return pm.countries.includes('*') || pm.countries.includes('default');
      }
      return pm.countries.includes(targetCode) || pm.countries.includes('*');
    })
    .sort((a, b) => a.order - b.order);
}

export interface WhatsAppOrderMessageInput {
  serviceName: string;
  planName?: string;
  duration?: string;
  formattedPrice?: string | null;
  countryCode: string;
  countryName: string;
  paymentMethodName?: string;
  available?: boolean;
  showPrices?: boolean;
  brandName?: string;
}

/**
 * Construye el mensaje contextualizado de WhatsApp delegando al motor de plantillas `renderWhatsAppMessage`.
 */
export function buildWhatsAppOrderMessage(input: WhatsAppOrderMessageInput): string {
  return renderWhatsAppMessage({
    tipo: !input.available
      ? 'consultar_disponibilidad'
      : input.planName
        ? 'comprar_plan'
        : 'barra_movil',
    marca: input.brandName || 'TaiSTR',
    servicio: input.serviceName,
    plan: input.planName,
    duracion: input.duration,
    precio: input.formattedPrice,
    codigoPais: input.countryCode,
    pais: input.countryName,
    medio_pago: input.paymentMethodName,
    disponible: input.available !== false,
    mostrarPrecios: input.showPrices !== false,
  });
}

export type DiscountSource = 'exacto' | 'plan' | 'servicio' | 'general';

export interface ResolveDiscountResult {
  pct: number;
  source: 'plan' | 'servicio' | 'general';
}

/**
 * Resuelve el porcentaje de descuento a aplicar para una duración (meses) en cascada:
 * 1. plan.descuentos[meses] (si existe la clave, incluso 0) -> 'plan'
 * 2. service.descuentos[meses] (si existe la clave, incluso 0) -> 'servicio'
 * 3. descuento por defecto de ajustes.ts -> 'general'
 *
 * Un 0 explícito detiene la búsqueda y aplica 0% de descuento. Una clave ausente delega al nivel siguiente.
 */
export function resolveDurationDiscount(
  meses: number,
  plan?: { descuentos?: Record<string, number> | null } | null,
  service?: { descuentos?: Record<string, number> | null } | null,
  defaultDiscounts?: readonly DurationOption[] | Record<string, number> | null
): ResolveDiscountResult {
  const durKey = String(meses);

  if (plan?.descuentos && Object.prototype.hasOwnProperty.call(plan.descuentos, durKey)) {
    const val = Number(plan.descuentos[durKey]);
    return { pct: isNaN(val) ? 0 : Math.max(0, Math.min(90, val)), source: 'plan' };
  }

  if (service?.descuentos && Object.prototype.hasOwnProperty.call(service.descuentos, durKey)) {
    const val = Number(service.descuentos[durKey]);
    return { pct: isNaN(val) ? 0 : Math.max(0, Math.min(90, val)), source: 'servicio' };
  }

  if (defaultDiscounts) {
    if (Array.isArray(defaultDiscounts)) {
      const match = defaultDiscounts.find((d) => d.meses === meses);
      if (match) {
        return { pct: Math.max(0, Math.min(90, Number(match.descuento_pct) || 0)), source: 'general' };
      }
    } else if (typeof defaultDiscounts === 'object' && Object.prototype.hasOwnProperty.call(defaultDiscounts, durKey)) {
      const val = Number((defaultDiscounts as Record<string, number>)[durKey]);
      return { pct: isNaN(val) ? 0 : Math.max(0, Math.min(90, val)), source: 'general' };
    }
  }

  return { pct: 0, source: 'general' };
}

export const DEFAULT_REDONDEO: Record<string, number> = {
  PEN: 0.5,
  MXN: 1,
  ARS: 1,
  USD: 0.01,
};

/**
 * Redondea un valor al múltiplo más cercano del paso indicado (mitad hacia arriba).
 * - 0.5 = a la mitad de sol más cercana (14.25 -> 14.5, 13.5 -> 13.5)
 * - 1 = entero (14.5 -> 15, 14.4 -> 14)
 * - 0.01 = céntimos (3.245 -> 3.25)
 */
export function roundToStep(value: number, step: number): number {
  if (!step || step <= 0) return value;
  if (step === 1) return Math.round(value);
  if (step === 0.01) return Math.round(value * 100) / 100;
  return Math.round(Math.round(value / step + 1e-9) * step * 100) / 100;
}

export interface CalculateDurationPriceParams {
  planPrices: PricesMap;
  meses: number;
  descuentoPct?: number;
  targetCurrency: string;
  preciosPorDuracion?: Record<string, PricesMap>;
  showPrices?: boolean;
  locale?: string;
  plan?: {
    descuentos?: Record<string, number> | null;
    precios_por_duracion?: Record<string, PricesMap> | null;
  } | null;
  service?: {
    descuentos?: Record<string, number> | null;
  } | null;
  defaultDiscounts?: readonly DurationOption[] | Record<string, number> | null;
  redondeo?: Record<string, number>;
}

export interface DurationPriceResult {
  amount: number;
  currency: string;
  formatted: string;
  monthlyAmount: number;
  baseTotalWithoutDiscount: number;
  savingsAmount: number;
  savingsFormatted: string;
  isExact: boolean;
  isFallback: boolean;
  discountPct: number;
  discountSource: DiscountSource;
}

/**
 * Calcula el precio total de una duración para un plan y moneda según las reglas de TaiSTR:
 * 1. Si el plan define un precio exacto para esa duración y moneda, se usa ese (origen: 'exacto').
 * 2. Si no, resolución multinivel de descuento: plan > servicio > ajustes.ts general.
 * 3. precio mensual × meses × (1 - descuento_pct / 100), redondeado (PEN/MXN/ARS a entero, USD a 2 decimales).
 * 4. Si falta la moneda mensual, usa el respaldo en USD.
 * 5. Calcula el ahorro frente a pagar mes a mes (mensual × meses - precio final).
 */
export function calculateDurationPrice(params: CalculateDurationPriceParams): DurationPriceResult {
  const {
    planPrices,
    meses,
    descuentoPct,
    targetCurrency,
    preciosPorDuracion,
    showPrices = true,
    locale = 'es-419',
    plan,
    service,
    defaultDiscounts,
    redondeo,
  } = params;

  const baseMonthly = resolvePlanPrice(planPrices, targetCurrency);
  const monthlyAmount = baseMonthly.amount;
  const currency = baseMonthly.currency;
  const isFallback = baseMonthly.isFallback;

  const durKey = String(meses);
  const effectivePreciosPorDuracion = preciosPorDuracion ?? plan?.precios_por_duracion ?? undefined;

  let amount = 0;
  let isExact = false;
  let discountSource: DiscountSource = 'general';
  let pct = 0;

  if (effectivePreciosPorDuracion && effectivePreciosPorDuracion[durKey]) {
    const durMap = effectivePreciosPorDuracion[durKey];
    if (typeof durMap[currency] === 'number' && durMap[currency] > 0) {
      amount = durMap[currency];
      isExact = true;
      discountSource = 'exacto';
    } else if (currency !== 'USD' && typeof durMap.USD === 'number' && durMap.USD > 0) {
      amount = durMap.USD;
      isExact = true;
      discountSource = 'exacto';
    }
  }

  if (!isExact) {
    if (plan !== undefined || service !== undefined || defaultDiscounts !== undefined) {
      const resolved = resolveDurationDiscount(meses, plan, service, defaultDiscounts);
      pct = resolved.pct;
      discountSource = resolved.source;
    } else {
      pct = Math.max(0, Math.min(90, Number(descuentoPct) || 0));
      discountSource = 'general';
    }

    const raw = monthlyAmount * meses * (1 - pct / 100);
    const step =
      (redondeo && typeof redondeo[currency] === 'number')
        ? redondeo[currency]
        : (DEFAULT_REDONDEO[currency] ?? (currency === 'USD' ? 0.01 : 1));

    amount = roundToStep(raw, step);
  }

  const baseTotalWithoutDiscount = monthlyAmount * meses;
  let savingsAmount = Math.round((baseTotalWithoutDiscount - amount) * 100) / 100;
  if (savingsAmount <= 0) {
    savingsAmount = 0;
  }

  const formatted = showPrices
    ? formatPrice(amount, currency, locale)
    : 'Consultar precio por WhatsApp';

  const savingsFormatted =
    showPrices && savingsAmount > 0
      ? formatPrice(savingsAmount, currency, locale)
      : '';

  return {
    amount,
    currency,
    formatted,
    monthlyAmount,
    baseTotalWithoutDiscount,
    savingsAmount,
    savingsFormatted,
    isExact,
    isFallback,
    discountPct: pct,
    discountSource,
  };
}

/**
 * Filtra las duraciones disponibles priorizando:
 * 1. plan.duraciones_permitidas
 * 2. service.duraciones_permitidas
 * 3. todas las duraciones globales (ajustes.ts)
 */
export function getAvailableDurationsForPlan(
  allDurations: readonly DurationOption[],
  duracionesPermitidasPlan?: readonly number[] | null,
  duracionesPermitidasService?: readonly number[] | null
): DurationOption[] {
  const allowed =
    duracionesPermitidasPlan && duracionesPermitidasPlan.length > 0
      ? duracionesPermitidasPlan
      : duracionesPermitidasService && duracionesPermitidasService.length > 0
        ? duracionesPermitidasService
        : null;

  if (!allowed || allowed.length === 0) {
    return [...allDurations];
  }
  const allowedSet = new Set(allowed);
  const filtered = allDurations.filter((d) => allowedSet.has(d.meses));
  return filtered.length > 0 ? filtered : [...allDurations];
}
