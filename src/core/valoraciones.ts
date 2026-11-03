export interface StarDistributionItem {
  star: 1 | 2 | 3 | 4 | 5;
  count: number;
  pct: number;
}

/**
 * Calcula el promedio de estrellas con un decimal (redondeo estándar).
 * Devuelve 0 si n es 0 o no hay datos.
 */
export function calcularPromedio(suma: number, n: number): number {
  if (!n || n <= 0) return 0;
  return Math.round((suma / n) * 10) / 10;
}

/**
 * Formatea el texto accesible y legible de valoraciones (ej. "★ 4,8 · 23 valoraciones de visitantes").
 */
export function formatearResumenValoraciones(n: number, promedio: number): string {
  const promStr = promedio.toFixed(1).replace('.', ',');
  const plural = n === 1 ? 'valoración de visitantes' : 'valoraciones de visitantes';
  return `★ ${promStr} · ${n} ${plural}`;
}

export interface DatosVotoValidados {
  servicio: string;
  estrellas: number;
  nombre?: string | null;
  comentario?: string | null;
}

/**
 * Valida y sanitiza el cuerpo de la petición de voto y reseña opcional.
 * Permite { servicio: string, estrellas: 1..5, nombre?: string, comentario?: string, hp?: string }.
 */
export function validarVoto(
  body: unknown,
  slugsValidos: ReadonlySet<string>
): { valido: true; datos: DatosVotoValidados } | { valido: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valido: false, error: 'Cuerpo de petición inválido' };
  }

  const keys = Object.keys(body);
  const keysPermitidas = new Set(['servicio', 'estrellas', 'nombre', 'comentario', 'hp']);
  for (const k of keys) {
    if (!keysPermitidas.has(k)) {
      return { valido: false, error: `Campo no permitido: ${k}` };
    }
  }

  const record = body as Record<string, unknown>;
  const { servicio, estrellas, nombre, comentario, hp } = record;

  // Verificación honeypot anti-bot
  if (hp !== undefined && hp !== null && String(hp).trim() !== '') {
    return { valido: false, error: 'Acceso no autorizado' };
  }

  if (typeof servicio !== 'string' || !slugsValidos.has(servicio.trim())) {
    return { valido: false, error: 'Servicio no válido' };
  }

  if (
    typeof estrellas !== 'number' ||
    !Number.isInteger(estrellas) ||
    estrellas < 1 ||
    estrellas > 5
  ) {
    return { valido: false, error: 'Estrellas debe ser un entero entre 1 y 5' };
  }

  let nombreLimpio: string | null = null;
  if (nombre !== undefined && nombre !== null) {
    if (typeof nombre !== 'string') {
      return { valido: false, error: 'El nombre debe ser una cadena de texto' };
    }
    const sanitized = nombre.replace(/[<>{}]/g, '').trim();
    if (sanitized.length > 40) {
      return { valido: false, error: 'El nombre no puede superar los 40 caracteres' };
    }
    if (sanitized.length > 0) {
      nombreLimpio = sanitized;
    }
  }

  let comentarioLimpio: string | null = null;
  if (comentario !== undefined && comentario !== null) {
    if (typeof comentario !== 'string') {
      return { valido: false, error: 'El comentario debe ser una cadena de texto' };
    }
    const sanitized = comentario.replace(/[<>{}]/g, '').trim();
    if (sanitized.length > 280) {
      return { valido: false, error: 'El comentario no puede superar los 280 caracteres' };
    }
    if (sanitized.length > 0) {
      comentarioLimpio = sanitized;
    }
  }

  return {
    valido: true,
    datos: {
      servicio: servicio.trim(),
      estrellas,
      nombre: nombreLimpio,
      comentario: comentarioLimpio,
    },
  };
}

/**
 * Calcula la huella SHA-256 anónima usando Web Crypto (la IP NUNCA se almacena en claro).
 */
export async function calcularHuella(
  identificador: string,
  servicio: string,
  fechaOPeriodo: string,
  salt: string
): Promise<string> {
  const raw = `${identificador}|${servicio}|${fechaOPeriodo}|${salt}`;
  const enc = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

