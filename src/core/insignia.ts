/**
 * LÓGICA DE INSIGNIAS Y MONOGRAMAS DE SERVICIOS
 * - Derivación de iniciales cuando no se definen explícitamente
 * - Cálculo de luminancia relativa y contraste WCAG AA automático
 */

/**
 * Deriva las iniciales del servicio:
 * 1. Si `iniciales` está presente y no vacío, devuelve sus primeros 3 caracteres.
 * 2. Si no, toma la primera letra de las dos primeras palabras (ej. "Prime Video" -> "PV"),
 *    o las dos primeras letras si es una sola palabra (ej. "Netflix" -> "NE").
 */
export function derivarIniciales(nombre: string, inicialesExplicitas?: string): string {
  if (inicialesExplicitas && inicialesExplicitas.trim()) {
    return inicialesExplicitas.trim().slice(0, 3);
  }
  const clean = (nombre || '').trim();
  if (!clean) return '?';

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Calcula la luminancia relativa según especificación WCAG 2.1 (sRGB).
 * Devuelve un número entre 0 (negro) y 1 (blanco), o null si el color es inválido.
 */
export function calcularLuminanciaRelativa(hexColor: string): number | null {
  if (!hexColor || typeof hexColor !== 'string') return null;
  const hex = hexColor.trim().replace(/^#/, '');
  let r = 0;
  let g = 0;
  let b = 0;

  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    return null;
  }

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }

  const srgb = [r, g, b].map((val) => {
    const c = val / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Determina el color de texto con mejor contraste WCAG AA (#FFFFFF o #09090B).
 * Si el color de acento es inválido, devuelve el respaldo neutro '#FFFFFF'.
 */
export function calcularColorTextoInsignia(hexColor: string): string {
  const lum = calcularLuminanciaRelativa(hexColor);
  if (lum === null) {
    return '#FFFFFF';
  }

  // Contraste con blanco (L = 1.0) y con fondo oscuro (L ~ 0.003)
  const contrasteBlanco = (1.0 + 0.05) / (lum + 0.05);
  const contrasteOscuro = (lum + 0.05) / (0.003 + 0.05);

  // Si con blanco alcanza 4.5:1 o supera al oscuro y alcanza 3:1, usa blanco
  if (contrasteBlanco >= 4.5 || (contrasteBlanco >= 3.0 && contrasteBlanco >= contrasteOscuro)) {
    return '#FFFFFF';
  }
  return '#09090B';
}

