import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const temaCssPath = path.resolve('src/editar/tema.css');

const VAGUE_TEXTS = new Set([
  'aquí',
  'aqui',
  'ver',
  'click',
  'haz clic',
  'haz click',
  'clic aquí',
  'clic aqui',
  'más',
  'mas',
  'leer más',
  'leer mas',
  'detalles',
]);

interface ErrorReport {
  file: string;
  tipo: string;
  mensaje: string;
}

const errores: ErrorReport[] = [];

// 1. Verificación de contraste en tema.css
function parseHexColor(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrastTokens() {
  if (!fs.existsSync(temaCssPath)) return;
  const content = fs.readFileSync(temaCssPath, 'utf-8');
  const tokens: Record<string, [number, number, number]> = {};

  const regex = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const rgb = parseHexColor(match[2]);
    if (rgb) tokens[name] = rgb;
  }

  const bgTokens = ['ground', 'ground-card', 'ground-elevated'];
  const textTokens = ['ink', 'ink-muted'];

  for (const bg of bgTokens) {
    if (!tokens[bg]) continue;
    for (const fg of textTokens) {
      if (!tokens[fg]) continue;
      const ratio = getContrast(tokens[fg], tokens[bg]);
      if (ratio < 4.5) {
        errores.push({
          file: 'src/editar/tema.css',
          tipo: 'Contraste WCAG AA',
          mensaje: `El par --color-${fg} y --color-${bg} tiene contraste ${ratio.toFixed(2)}:1 (mínimo requerido 4.5:1)`,
        });
      }
    }
  }
}

function getHtmlFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAttr(tag: string, attr: string): string | null {
  const regex = new RegExp(`\\b${attr}=(?:["']([^"']*)["']|([^\\s>]+))`, 'i');
  const match = tag.match(regex);
  if (!match) return null;
  return match[1] ?? match[2] ?? '';
}

function auditHtmlFile(filePath: string) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
  const html = fs.readFileSync(filePath, 'utf-8');

  // a) Verificar <html lang="...">
  const htmlTagMatch = html.match(/<html\b[^>]*>/i);
  if (!htmlTagMatch) {
    errores.push({ file: rel, tipo: 'HTML lang', mensaje: 'Falta la etiqueta <html>' });
  } else {
    const lang = getAttr(htmlTagMatch[0], 'lang');
    if (!lang || !lang.trim()) {
      errores.push({ file: rel, tipo: 'HTML lang', mensaje: 'La etiqueta <html> no tiene atributo lang especificado' });
    }
  }

  // b) Verificar <h1> exactamente 1 por página y saltos de encabezado
  const headings: Array<{ level: number; text: string }> = [];
  const hRegex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hMatch;
  while ((hMatch = hRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(hMatch[1], 10),
      text: cleanHtmlText(hMatch[2]),
    });
  }

  const h1Count = headings.filter((h) => h.level === 1).length;
  if (h1Count !== 1) {
    errores.push({
      file: rel,
      tipo: 'Encabezado H1',
      mensaje: `La página debe tener exactamente 1 encabezado <h1> (encontrados: ${h1Count})`,
    });
  }

  let prevLevel = 0;
  for (const h of headings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      errores.push({
        file: rel,
        tipo: 'Salto de encabezado',
        mensaje: `Salto incorrecto de nivel de h${prevLevel} a h${h.level} ("${h.text.slice(0, 40)}")`,
      });
    }
    prevLevel = h.level;
  }

  // c) Verificar <img> sin alt
  const imgRegex = /<img\b([^>]*)>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const tag = imgMatch[0];
    const attrs = imgMatch[1];
    if (!/\balt\s*=/i.test(attrs)) {
      errores.push({
        file: rel,
        tipo: 'Imagen sin alt',
        mensaje: `La etiqueta <img> no tiene atributo alt (usa alt="" si es decorativa): ${tag.slice(0, 60)}`,
      });
    }
  }

  // d) Enlaces y botones con nombre accesible y sin nombres vagos
  const aRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let aMatch;
  while ((aMatch = aRegex.exec(html)) !== null) {
    const attrs = aMatch[1];
    const innerHtml = aMatch[2];
    const ariaLabel = getAttr(attrs, 'aria-label');
    const title = getAttr(attrs, 'title');
    const innerText = cleanHtmlText(innerHtml);
    const accessibleName = (ariaLabel || innerText || title || '').trim();

    if (!accessibleName) {
      errores.push({
        file: rel,
        tipo: 'Enlace sin nombre accesible',
        mensaje: `Enlace <a ${attrs.slice(0, 50)}...> no tiene texto ni aria-label ni title`,
      });
    } else if (VAGUE_TEXTS.has(accessibleName.toLowerCase())) {
      errores.push({
        file: rel,
        tipo: 'Enlace con nombre vago',
        mensaje: `Enlace con texto no descriptivo "${accessibleName}". Agrega un aria-label o title específico.`,
      });
    }
  }

  const btnRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let btnMatch;
  while ((btnMatch = btnRegex.exec(html)) !== null) {
    const attrs = btnMatch[1];
    const innerHtml = btnMatch[2];
    const ariaLabel = getAttr(attrs, 'aria-label');
    const title = getAttr(attrs, 'title');
    const innerText = cleanHtmlText(innerHtml);
    const accessibleName = (ariaLabel || innerText || title || '').trim();

    if (!accessibleName) {
      errores.push({
        file: rel,
        tipo: 'Botón sin nombre accesible',
        mensaje: `Botón <button ${attrs.slice(0, 50)}...> no tiene texto ni aria-label ni title`,
      });
    } else if (VAGUE_TEXTS.has(accessibleName.toLowerCase())) {
      errores.push({
        file: rel,
        tipo: 'Botón con nombre vago',
        mensaje: `Botón con texto no descriptivo "${accessibleName}". Agrega un aria-label específico.`,
      });
    }
  }

  // e) Campos de formulario sin label
  const inputRegex = /<(?:input|textarea|select)\b([^>]*)>/gi;
  let inputMatch;
  while ((inputMatch = inputRegex.exec(html)) !== null) {
    const tag = inputMatch[0];
    const attrs = inputMatch[1];
    const type = getAttr(attrs, 'type') || 'text';
    if (type.toLowerCase() === 'hidden') continue;

    const id = getAttr(attrs, 'id');
    const ariaLabel = getAttr(attrs, 'aria-label');
    const ariaLabelledby = getAttr(attrs, 'aria-labelledby');
    const title = getAttr(attrs, 'title');

    const hasAria = Boolean(ariaLabel || ariaLabelledby || title);
    let hasLabelFor = false;
    if (id) {
      const labelRegex = new RegExp(`<label\\b[^>]*\\bfor=["']${id}["']`, 'i');
      hasLabelFor = labelRegex.test(html);
    }

    if (!hasAria && !hasLabelFor) {
      errores.push({
        file: rel,
        tipo: 'Campo sin etiqueta accesible',
        mensaje: `Campo <${tag.slice(0, 60)}> no tiene <label for="...">, aria-label ni title`,
      });
    }
  }
}

// Ejecutar auditoría
checkContrastTokens();

if (!fs.existsSync(distDir)) {
  console.error('❌ La carpeta dist/ no existe. Ejecuta primero "npm run build".');
  process.exit(1);
}

const htmlFiles = getHtmlFiles(distDir);
for (const file of htmlFiles) {
  auditHtmlFile(file);
}

if (errores.length > 0) {
  console.error(`\n❌ Se encontraron ${errores.length} problemas de accesibilidad (a11y):\n`);
  for (const err of errores) {
    console.error(`  - [${err.tipo}] ${err.file}: ${err.mensaje}`);
  }
  process.exit(1);
} else {
  console.log(`✓ a11y: Accesibilidad OK — ${htmlFiles.length} páginas verificadas sin errores (H1 único, orden de encabezados, alt en imágenes, nombres accesibles, labels y contraste AA).`);
}

