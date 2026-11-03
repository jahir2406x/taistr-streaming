import sharp from 'sharp';
import { derivarIniciales, calcularColorTextoInsignia } from '../core';

function escapeXml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function generarOgPngBuffer(opts: {
  titulo: string;
  subtitulo: string;
  marca: string;
  iniciales: string;
  acento: string;
}): Promise<Buffer> {
  const inits = derivarIniciales(opts.titulo, opts.iniciales);
  const acento = /^#[0-9A-Fa-f]{6}$/.test(opts.acento) ? opts.acento : '#F59E0B';
  const colorTextoInsignia = calcularColorTextoInsignia(acento);
  const fontSizeInits = inits.length === 1 ? 68 : inits.length === 2 ? 56 : 44;

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow1" cx="0.2" cy="0.25" r="0.65">
      <stop offset="0%" stop-color="${acento}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#09090B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.85" cy="0.8" r="0.55">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#09090B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#14141B"/>
      <stop offset="100%" stop-color="#0D0D12"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#09090B"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <rect x="64" y="64" width="1072" height="502" rx="32" fill="url(#cardBg)" stroke="#272732" stroke-width="2"/>
  <rect x="128" y="132" width="136" height="136" rx="30" fill="${acento}"/>
  <text x="196" y="${132 + 68 + Math.round(fontSizeInits * 0.35)}" text-anchor="middle" fill="${colorTextoInsignia}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="${fontSizeInits}" font-weight="800">${escapeXml(inits)}</text>
  <text x="128" y="356" fill="#F4F4F5" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="68" font-weight="800" letter-spacing="-1.5">${escapeXml(opts.titulo)}</text>
  <text x="128" y="418" fill="#A1A1AA" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="30" font-weight="500">${escapeXml(opts.subtitulo)}</text>
  <rect x="930" y="132" width="14" height="14" rx="3" fill="#F59E0B"/>
  <text x="956" y="148" fill="#F4F4F5" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="800">${escapeXml(opts.marca)}</text>
  <line x1="128" y1="472" x2="1072" y2="472" stroke="#22222C" stroke-width="2"/>
  <text x="128" y="516" fill="#F59E0B" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="600">${escapeXml(opts.marca)} · Atención y soporte por WhatsApp</text>
</svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

