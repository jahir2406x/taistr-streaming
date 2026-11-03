import fs from 'node:fs';
import path from 'node:path';
import { MARCA } from '../src/editar/marca.ts';
import { AJUSTES } from '../src/editar/ajustes.ts';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');

function walkHtmlFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(fullPath, acc);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function resolveInternalFile(pathname: string): string | null {
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  if (clean === '') {
    const indexFile = path.join(DIST_DIR, 'index.html');
    return fs.existsSync(indexFile) ? indexFile : null;
  }
  const rel = clean.replace(/^\//, '');
  const candidates = [
    path.join(DIST_DIR, rel),
    path.join(DIST_DIR, `${rel}.html`),
    path.join(DIST_DIR, rel, 'index.html'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ No existe la carpeta dist/. Ejecuta primero npm run build.');
  process.exit(1);
}

const htmlFiles = walkHtmlFiles(DIST_DIR);
const idsByFile = new Map<string, Set<string>>();
const htmlByFile = new Map<string, string>();

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  htmlByFile.set(file, html);
  const ids = new Set<string>();
  const idRegex = /\bid\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  idsByFile.set(file, ids);
}

const errores: string[] = [];
let totalInternos = 0;
let totalAnclas = 0;
let totalWa = 0;
let totalImagenes = 0;

const waPrefix = `https://wa.me/${MARCA.numeroWhatsapp}?text=`;

for (const file of htmlFiles) {
  const relFile = path.relative(DIST_DIR, file).replace(/\\/g, '/');
  const html = htmlByFile.get(file) || '';
  const localIds = idsByFile.get(file) || new Set<string>();

  // 1. Revisar enlaces <a href="...">
  const aRegex = /<a\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = aRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const rawHref = hrefMatch[1].replace(/&amp;/g, '&').trim();

    if (rawHref.includes('wa.me')) {
      totalWa++;
      if (!rawHref.startsWith(waPrefix)) {
        errores.push(`[WhatsApp] ${relFile}: el enlace "${rawHref}" no usa el número oficial (${MARCA.numeroWhatsapp}) con ?text=.`);
        continue;
      }
      const encodedText = rawHref.slice(waPrefix.length);
      if (!encodedText || /\s/.test(encodedText)) {
        errores.push(`[WhatsApp] ${relFile}: el texto del enlace "${rawHref}" está vacío o contiene espacios sin codificar.`);
        continue;
      }
      try {
        const decoded = decodeURIComponent(encodedText);
        if (!decoded.trim()) {
          errores.push(`[WhatsApp] ${relFile}: el texto decodificado de "${rawHref}" está vacío.`);
        }
      } catch {
        errores.push(`[WhatsApp] ${relFile}: el parámetro text de "${rawHref}" tiene codificación URL inválida.`);
      }
      continue;
    }

    if (rawHref.startsWith('#')) {
      if (rawHref.length > 1) {
        totalAnclas++;
        const anchorId = rawHref.slice(1);
        if (!localIds.has(anchorId)) {
          errores.push(`[Ancla rota] ${relFile}: no existe id="${anchorId}" para href="${rawHref}".`);
        }
      }
      continue;
    }

    if (rawHref.startsWith('/')) {
      totalInternos++;
      const [pathPart, hashPart] = rawHref.split('#');
      const targetFile = resolveInternalFile(pathPart || '/');
      if (!targetFile) {
        errores.push(`[Enlace interno roto] ${relFile}: href="${rawHref}" no apunta a ningún archivo existente en dist/.`);
        continue;
      }
      if (hashPart) {
        totalAnclas++;
        const targetIds = idsByFile.get(targetFile) || new Set<string>();
        if (!targetIds.has(hashPart)) {
          const targetRel = path.relative(DIST_DIR, targetFile).replace(/\\/g, '/');
          errores.push(`[Ancla interna rota] ${relFile}: href="${rawHref}" busca #${hashPart}, que no existe en ${targetRel}.`);
        }
      }
    }
  }

  // 2. Revisar imágenes locales <img src="..."> y meta og:image / twitter:image
  const imgRegex = /<img\b([^>]*)>/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1].trim();
    if (src.startsWith('data:')) continue;
    if (src.startsWith('/')) {
      totalImagenes++;
      const targetImg = resolveInternalFile(src);
      if (!targetImg) {
        errores.push(`[Imagen rota] ${relFile}: src="${src}" no existe en dist/.`);
      }
    }
  }

  const metaImgRegex = /<meta\b[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]*>/gi;
  while ((match = metaImgRegex.exec(html)) !== null) {
    const tag = match[0];
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (!contentMatch) continue;
    const contentUrl = contentMatch[1].trim();
    let localPath = '';
    if (contentUrl.startsWith(AJUSTES.siteUrl)) {
      localPath = contentUrl.slice(AJUSTES.siteUrl.length);
    } else if (contentUrl.startsWith('/')) {
      localPath = contentUrl;
    }
    if (localPath) {
      totalImagenes++;
      const targetImg = resolveInternalFile(localPath);
      if (!targetImg) {
        errores.push(`[Imagen OG rota] ${relFile}: "${contentUrl}" no existe en dist/.`);
      }
    }
  }
}

if (errores.length > 0) {
  console.error('❌ Se encontraron enlaces, anclas o imágenes con errores en dist/:');
  for (const err of errores) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  `✓ Enlaces OK — ${totalInternos} enlaces internos, ${totalAnclas} anclas, ${totalImagenes} imágenes y ${totalWa} enlaces wa.me verificados.`
);

