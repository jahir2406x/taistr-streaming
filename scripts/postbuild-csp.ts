import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AJUSTES } from '../src/editar/ajustes.ts';

function walkHtmlFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Extrae todos los bloques <script> inline ejecutables (sin src y sin type="application/...").
 * Devuelve sus hashes SHA-256 en formato 'sha256-...' ordenados y sin duplicados.
 */
export function collectInlineScriptHashes(distDir: string): string[] {
  const htmlFiles = walkHtmlFiles(distDir);
  const hashes = new Set<string>();
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = scriptRegex.exec(html)) !== null) {
      const attrs = match[1] || '';
      const content = match[2] || '';
      if (/\bsrc\s*=/i.test(attrs)) continue;
      const typeMatch = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs);
      if (typeMatch) {
        const t = typeMatch[1].trim().toLowerCase();
        if (t === 'application/ld+json' || t === 'application/json') continue;
      }
      if (!content) continue;
      const digest = createHash('sha256').update(content, 'utf-8').digest('base64');
      hashes.add(`'sha256-${digest}'`);
    }
  }

  return Array.from(hashes).sort();
}

export function buildSecurityHeadersConfig(scriptHashes: string[], cfBeaconToken: string) {
  const hasAnalytics = Boolean(cfBeaconToken && cfBeaconToken.trim().length > 0);
  const scriptSrcParts = ["'self'", ...scriptHashes];
  if (hasAnalytics) scriptSrcParts.push('https://static.cloudflareinsights.com');

  const connectSrcParts = ["'self'"];
  if (hasAnalytics) connectSrcParts.push('https://cloudflareinsights.com');

  // Justificación técnica de style-src 'unsafe-inline':
  // Los componentes Astro aplican variables CSS dinámicas por servicio/tarjeta mediante el atributo HTML
  // style="--acento: ...; --i: ..." y los scripts actualizan propiedades CSSOM en tiempo real
  // (indicador deslizante, spotlight y bordes de selección en el panel de compra).
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrcParts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src ${connectSrcParts.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const permissionsPolicy =
    'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), identity-credentials-get=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), otp-credentials=(), payment=(), picture-in-picture=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), storage-access=(), usb=(), web-share=(), xr-spatial-tracking=()';

  // Nota sobre HSTS preload: se incluye max-age=31536000 (1 año) e includeSubDomains.
  // La directiva '; preload' queda documentada en docs/SEGURIDAD.md sin activarse por defecto porque su registro en hstspreload.org es permanente.
  const hsts = 'max-age=31536000; includeSubDomains';

  const commonHeaders: Record<string, string> = {
    'Strict-Transport-Security': hsts,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': permissionsPolicy,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': csp,
  };

  return {
    commonHeaders,
    cacheHtml: 'public, max-age=0, must-revalidate',
    cacheImmutable: 'public, max-age=31536000, immutable',
  };
}

export function renderCloudflareHeaders(cfg: ReturnType<typeof buildSecurityHeadersConfig>): string {
  const headerLines = Object.entries(cfg.commonHeaders)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  return `# Cabeceras de seguridad y caché generadas automáticamente tras el build.
# Nota HSTS preload: para solicitar inclusión en hstspreload.org añade "; preload" a Strict-Transport-Security (ver docs/SEGURIDAD.md).
# Justificación style-src 'unsafe-inline': requerido para variables CSS por servicio en atributos style="--acento:..." y transiciones CSSOM.
/*
${headerLines}
  Cache-Control: ${cfg.cacheHtml}

/_astro/*
  Cache-Control: ${cfg.cacheImmutable}

/og/*
  Cache-Control: ${cfg.cacheImmutable}
`;
}

export function renderApacheHtaccess(cfg: ReturnType<typeof buildSecurityHeadersConfig>): string {
  const headerLines = Object.entries(cfg.commonHeaders)
    .map(([k, v]) => `  Header always set ${k} "${v}"`)
    .join('\n');

  return `# Cabeceras de seguridad y caché equivalentes a _headers (generadas automáticamente tras el build).
# Nota HSTS preload: para solicitar inclusión en hstspreload.org añade "; preload" a Strict-Transport-Security (ver docs/SEGURIDAD.md).
# Justificación style-src 'unsafe-inline': requerido para variables CSS por servicio en atributos style="--acento:..." y transiciones CSSOM.
Options -Indexes
ServerSignature Off

<IfModule mod_rewrite.c>
  RewriteEngine On
  # Forzar HTTPS
  RewriteCond %{HTTPS} !=on
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
  # /api/geo -> endpoint PHP (equivalente a la Pages Function de Cloudflare)
  RewriteRule ^api/geo/?$ api/geo.php [L,QSA]
  # Bloquear archivos ocultos (excepto .well-known) y respaldos
  RewriteRule (^|/)\\.(?!well-known/) - [F,L]
  RewriteRule \\.(bak|old|orig|tmp|swp|map|sql|log|ini|env|zip)$ - [F,L,NC]
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml application/javascript application/json application/xml image/svg+xml
</IfModule>

<IfModule mod_headers.c>
${headerLines}
  Header unset X-Powered-By

  <FilesMatch "\\.(html|xml|txt)$">
    Header set Cache-Control "${cfg.cacheHtml}"
  </FilesMatch>

  <FilesMatch "\\.(css|js|png|svg|ico|webp|woff2)$">
    Header set Cache-Control "${cfg.cacheImmutable}"
  </FilesMatch>
</IfModule>

ErrorDocument 404 /404.html
`;
}

function main() {
  const root = process.cwd();
  const distDir = resolve(root, 'dist');
  const publicDir = resolve(root, 'public');

  if (!existsSync(distDir)) {
    console.error('❌ No se encontró el directorio dist/. Ejecuta astro build primero.');
    process.exit(1);
  }

  const hashes = collectInlineScriptHashes(distDir);
  const cfg = buildSecurityHeadersConfig(hashes, AJUSTES.cfBeaconToken);
  const headersContent = renderCloudflareHeaders(cfg);
  const htaccessContent = renderApacheHtaccess(cfg);

  writeFileSync(resolve(publicDir, '_headers'), headersContent, 'utf-8');
  writeFileSync(resolve(distDir, '_headers'), headersContent, 'utf-8');
  writeFileSync(resolve(publicDir, '.htaccess'), htaccessContent, 'utf-8');
  writeFileSync(resolve(distDir, '.htaccess'), htaccessContent, 'utf-8');

  console.log(`✓ CSP actualizada en _headers y .htaccess con ${hashes.length} hashes SHA-256 de scripts inline (sin 'unsafe-inline' en script-src).`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(process.cwd(), 'scripts/postbuild-csp.ts')) {
  main();
}

