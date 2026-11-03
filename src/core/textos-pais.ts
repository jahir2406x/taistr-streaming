import type { Country, PaymentMethod, PorPaisConfig } from './schemas.ts';
import { getPaymentMethodsForCountry, resolveCountry } from './pricing.ts';

export interface ResolverTextoPaisContext {
  porPais: PorPaisConfig;
  paises: Country[];
  pagos: PaymentMethod[];
}

/**
 * Resuelve el texto correspondiente a una clave y país, aplicando prioridad:
 * override específico del país > plantilla base > override de 'default' > cadena vacía.
 * Sustituye los marcadores {pais}, {metodos_pago} y {moneda}.
 * Devuelve un texto seguro sin 'undefined' ni llaves sin resolver.
 */
export function resolverTextoPais(
  clave: string,
  codigoPais: string | null | undefined,
  contexto: ResolverTextoPaisContext
): string {
  if (!clave || !contexto || !contexto.porPais) {
    return '';
  }

  const entry = contexto.porPais[clave];
  if (!entry) {
    return '';
  }

  const paises = contexto.paises || [];
  const pagos = contexto.pagos || [];
  const country = resolveCountry(codigoPais, paises);
  const normCode = String(country.code || 'default').trim().toUpperCase();

  // 1. Prioridad: override del país > plantilla base > override 'default'
  let rawText = '';
  if (entry.overrides) {
    const overrideKey = Object.keys(entry.overrides).find(
      (k) => k.toUpperCase() === normCode
    );
    if (overrideKey && typeof entry.overrides[overrideKey] === 'string' && entry.overrides[overrideKey].trim() !== '') {
      rawText = entry.overrides[overrideKey];
    }
  }

  if (!rawText && typeof entry.plantilla === 'string' && entry.plantilla.trim() !== '') {
    rawText = entry.plantilla;
  }

  if (!rawText && entry.overrides) {
    const defaultKey = Object.keys(entry.overrides).find(
      (k) => k.toUpperCase() === 'DEFAULT'
    );
    if (defaultKey && typeof entry.overrides[defaultKey] === 'string' && entry.overrides[defaultKey].trim() !== '') {
      rawText = entry.overrides[defaultKey];
    }
  }

  if (!rawText) {
    return '';
  }

  // 2. Determinar valores de marcadores
  const paisNombre = country.nombre_texto || (country.code === 'default' ? 'tu país' : country.name);
  const metodosPago = getPaymentMethodsForCountry(country.code, pagos, paises)
    .map((p) => p.name)
    .join(' · ');
  
  let monedaNombre = country.moneda_nombre;
  if (!monedaNombre) {
    if (country.code === 'PE') monedaNombre = 'soles (PEN)';
    else if (country.code === 'MX') monedaNombre = 'pesos mexicanos (MXN)';
    else if (country.code === 'AR') monedaNombre = 'pesos argentinos (ARS)';
    else monedaNombre = 'dólares (USD)';
  }

  const replacers: Record<string, string> = {
    pais: paisNombre || '',
    metodos_pago: metodosPago || '',
    moneda: monedaNombre || '',
  };

  // 3. Reemplazar marcadores conocidos
  let resolved = rawText.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    return replacers[key] !== undefined ? replacers[key] : '';
  });

  // 4. Limpieza de seguridad: sin dobles espacios ni espacios antes de puntuación
  resolved = resolved
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.:;?!])/g, '$1')
    .trim();

  return resolved;
}

const PAISES_QUERY_LISTA_BLANCA = new Set(['PE', 'MX', 'AR']);

/**
 * Extrae y valida el parámetro ?pais=PE|MX|AR de una cadena de consulta URL.
 * Ignora utm_* y cualquier valor fuera de la lista blanca (PE, MX, AR).
 */
export function resolverPaisDesdeQuery(search: string | null | undefined): 'PE' | 'MX' | 'AR' | null {
  if (!search || typeof search !== 'string') return null;
  const cleanSearch = search.startsWith('?') ? search.slice(1) : search;
  if (!cleanSearch) return null;
  try {
    const params = new URLSearchParams(cleanSearch);
    const raw = params.get('pais');
    if (!raw) return null;
    const upper = raw.trim().toUpperCase();
    if (PAISES_QUERY_LISTA_BLANCA.has(upper)) {
      return upper as 'PE' | 'MX' | 'AR';
    }
  } catch {
    return null;
  }
  return null;
}
