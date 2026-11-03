import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MARCA } from '../src/editar/marca.ts';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');

const REQUIRED_HEADERS = [
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'Content-Security-Policy',
];

function walkAllFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAllFiles(fullPath, acc);
    } else if (entry.isFile()) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function parseHeadersFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  let inGlobalBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      inGlobalBlock = trimmed === '/*';
      continue;
    }
    if (inGlobalBlock) {
      const idx = trimmed.indexOf(':');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!map.has(key)) map.set(key, val);
      }
    }
  }
  return map;
}

function parseHtaccessFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /^\s*Header\s+always\s+set\s+([A-Za-z0-9-]+)\s+"([^"]+)"/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1].trim();
    const val = match[2].trim();
    if (!map.has(key)) map.set(key, val);
  }
  return map;
}

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ No existe la carpeta dist/. Ejecuta primero npm run build.');
  process.exit(1);
}

const errores: string[] = [];

// 1. Verificar equivalencia entre _headers y .htaccess
const headersPath = path.join(DIST_DIR, '_headers');
const htaccessPath = path.join(DIST_DIR, '.htaccess');

if (!fs.existsSync(headersPath)) {
  errores.push('[Cabeceras] Falta dist/_headers.');
}
if (!fs.existsSync(htaccessPath)) {
  errores.push('[Cabeceras] Falta dist/.htaccess.');
}

let cspValue = '';
if (fs.existsSync(headersPath) && fs.existsSync(htaccessPath)) {
  const headersMap = parseHeadersFile(fs.readFileSync(headersPath, 'utf8'));
  const htaccessMap = parseHtaccessFile(fs.readFileSync(htaccessPath, 'utf8'));

  for (const h of REQUIRED_HEADERS) {
    const v1 = headersMap.get(h);
    const v2 = htaccessMap.get(h);
    if (!v1) {
      errores.push(`[Cabeceras] Falta "${h}" en dist/_headers.`);
    }
    if (!v2) {
      errores.push(`[Cabeceras] Falta "${h}" en dist/.htaccess.`);
    }
    if (v1 && v2 && v1 !== v2) {
      errores.push(`[Cabeceras] "${h}" no coincide entre _headers y .htaccess.`);
    }
  }
  cspValue = headersMap.get('Content-Security-Policy') || '';
}

// 2. Verificar directivas CSP y hashes SHA-256 de scripts inline
const cspHashes = new Set<string>();
if (cspValue) {
  const directives = new Map<string, string>();
  for (const part of cspValue.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    directives.set(tokens[0], tokens.slice(1).join(' '));
  }

  const scriptSrc = directives.get('script-src') || '';
  if (!scriptSrc) {
    errores.push('[CSP] Falta la directiva script-src.');
  } else {
    if (scriptSrc.includes("'unsafe-inline'") || scriptSrc.includes("'unsafe-eval'")) {
      errores.push("[CSP] script-src NO puede incluir 'unsafe-inline' ni 'unsafe-eval'.");
    }
    const hashMatches = scriptSrc.match(/'sha256-[A-Za-z0-9+/=]+'/g) || [];
    for (const h of hashMatches) cspHashes.add(h);
  }

  for (const reqDir of [
    'default-src',
    'style-src',
    'img-src',
    'connect-src',
    'frame-ancestors',
    'base-uri',
    'form-action',
    'object-src',
    'upgrade-insecure-requests',
  ]) {
    if (!directives.has(reqDir)) {
      errores.push(`[CSP] Falta la directiva obligatoria "${reqDir}".`);
    }
  }
}

// 3. Escanear archivos en dist/
const allFiles = walkAllFiles(DIST_DIR);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));
let inlineScriptsChecked = 0;
let blankLinksChecked = 0;

const secretPatterns: Array<{ name: string; regex: RegExp }> = [
  { name: 'Clave privada PEM', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub Token', regex: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'Stripe Secret Key', regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/ },
];

for (const file of allFiles) {
  const rel = path.relative(DIST_DIR, file).replace(/\\/g, '/');
  const base = path.basename(file);

  if (
    base.startsWith('.env') ||
    base.endsWith('.map') ||
    base.endsWith('.bak') ||
    base.endsWith('.old') ||
    base.endsWith('.orig') ||
    rel.startsWith('editar/')
  ) {
    errores.push(`[Archivo sensible] No debe publicarse "${rel}" en dist/.`);
  }

  if (/\.(?:html|js|css|xml|txt)$/i.test(base) || base === '_headers' || base === '.htaccess') {
    const content = fs.readFileSync(file, 'utf8');
    for (const pat of secretPatterns) {
      if (pat.regex.test(content)) {
        errores.push(`[Secreto expuesto] Se detectó patrón de ${pat.name} en ${rel}.`);
      }
    }
  }
}

for (const file of htmlFiles) {
  const rel = path.relative(DIST_DIR, file).replace(/\\/g, '/');
  const html = fs.readFileSync(file, 'utf8');

  if (/<iframe\b/i.test(html)) {
    errores.push(`[HTML inseguro] ${rel} contiene una etiqueta <iframe> no permitida.`);
  }

  // Verificar hashes de scripts inline ejecutables
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const typeVal = typeMatch ? typeMatch[1].toLowerCase().trim() : '';
    if (typeVal === 'application/ld+json' || typeVal === 'application/json') continue;
    if (body.length > 0) {
      inlineScriptsChecked++;
      const hash = `'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`;
      if (!cspHashes.has(hash)) {
        errores.push(`[CSP Hash] ${rel} contiene un script inline sin hash SHA-256 registrado en la CSP (${hash}).`);
      }
    }
  }

  // Verificar rel="noopener noreferrer" en todos los target="_blank"
  const aRegex = /<a\b([^>]*)>/gi;
  while ((match = aRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    if (!/\btarget\s*=\s*["']_blank["']/i.test(attrs)) continue;
    blankLinksChecked++;
    const relMatch = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const relTokens = relMatch ? relMatch[1].toLowerCase().split(/\s+/) : [];
    if (!relTokens.includes('noopener') || !relTokens.includes('noreferrer')) {
      errores.push(`[Enlace externo] ${rel} tiene un enlace target="_blank" sin rel="noopener noreferrer".`);
    }
  }
}

// 4. Verificar .well-known/security.txt
const securityTxtPath = path.join(DIST_DIR, '.well-known', 'security.txt');
if (!fs.existsSync(securityTxtPath)) {
  errores.push('[security.txt] Falta dist/.well-known/security.txt.');
} else {
  const secContent = fs.readFileSync(securityTxtPath, 'utf8');
  const expectedContact = `Contact: mailto:${MARCA.correoContacto}`;
  if (!secContent.includes(expectedContact)) {
    errores.push(`[security.txt] Debe incluir "${expectedContact}".`);
  }
  const expiresMatch = secContent.match(/^Expires:\s*(.+)$/m);
  if (!expiresMatch) {
    errores.push('[security.txt] Falta el campo Expires.');
  } else {
    const expiresDate = Date.parse(expiresMatch[1].trim());
    if (Number.isNaN(expiresDate) || expiresDate <= Date.now()) {
      errores.push(`[security.txt] La fecha Expires (${expiresMatch[1].trim()}) es inválida o ya venció.`);
    }
  }
}

if (errores.length > 0) {
  console.error('❌ Falló la verificación de seguridad en dist/:');
  for (const err of errores) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  `✓ Seguridad OK — _headers y .htaccess equivalentes, CSP con ${cspHashes.size} hashes (${inlineScriptsChecked} bloques verificados), ${blankLinksChecked} enlaces _blank seguros y security.txt vigente.`
);

