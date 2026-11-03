import fs from 'node:fs';
import path from 'node:path';
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

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ No existe la carpeta dist/. Ejecuta primero npm run build.');
  process.exit(1);
}

const htmlFiles = walkHtmlFiles(DIST_DIR);
const maxJsKb = AJUSTES.PRESUPUESTO.js_por_pagina_kb;
const maxCssKb = AJUSTES.PRESUPUESTO.css_por_pagina_kb;

let maxJsMeasured = 0;
let maxCssMeasured = 0;
const errores: string[] = [];

for (const file of htmlFiles) {
  const rel = path.relative(DIST_DIR, file).replace(/\\/g, '/');
  const html = fs.readFileSync(file, 'utf8');

  let jsBytes = 0;
  const scriptSrcSeen = new Set<string>();
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      const src = srcMatch[1];
      if (src.startsWith('/') && !scriptSrcSeen.has(src)) {
        scriptSrcSeen.add(src);
        const assetPath = path.join(DIST_DIR, src.replace(/^\//, ''));
        if (fs.existsSync(assetPath)) {
          jsBytes += fs.statSync(assetPath).size;
        }
      }
      continue;
    }
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const typeVal = typeMatch ? typeMatch[1].toLowerCase().trim() : '';
    if (typeVal === 'application/ld+json' || typeVal === 'application/json') {
      continue;
    }
    jsBytes += Buffer.byteLength(body, 'utf8');
  }

  let cssBytes = 0;
  const cssHrefSeen = new Set<string>();
  const linkRegex = /<link\b([^>]*)>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(attrs)) continue;
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch) {
      const href = hrefMatch[1];
      if (href.startsWith('/') && !cssHrefSeen.has(href)) {
        cssHrefSeen.add(href);
        const assetPath = path.join(DIST_DIR, href.replace(/^\//, ''));
        if (fs.existsSync(assetPath)) {
          cssBytes += fs.statSync(assetPath).size;
        }
      }
    }
  }

  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  while ((match = styleRegex.exec(html)) !== null) {
    cssBytes += Buffer.byteLength(match[1] || '', 'utf8');
  }

  const jsKb = Number((jsBytes / 1024).toFixed(2));
  const cssKb = Number((cssBytes / 1024).toFixed(2));
  if (jsKb > maxJsMeasured) maxJsMeasured = jsKb;
  if (cssKb > maxCssMeasured) maxCssMeasured = cssKb;

  if (jsKb > maxJsKb) {
    errores.push(`[Presupuesto JS] ${rel} usa ${jsKb} KB de JS (tope: ${maxJsKb} KB en src/editar/ajustes.ts).`);
  }
  if (cssKb > maxCssKb) {
    errores.push(`[Presupuesto CSS] ${rel} usa ${cssKb} KB de CSS (tope: ${maxCssKb} KB en src/editar/ajustes.ts).`);
  }
}

if (errores.length > 0) {
  console.error('❌ Se superó el presupuesto de rendimiento en dist/:');
  for (const err of errores) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  `✓ Presupuesto OK — ${htmlFiles.length} páginas dentro de límite (máx medido: JS ${maxJsMeasured} KB / ${maxJsKb} KB, CSS ${maxCssMeasured} KB / ${maxCssKb} KB).`
);

